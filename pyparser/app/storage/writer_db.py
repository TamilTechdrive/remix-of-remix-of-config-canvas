"""Batched async-friendly DB writer.

Uses SQLAlchemy Core inserts in chunks. Falls back to a no-op when no DB
is configured. Table names mirror the existing parser_* schema (see
backend migration 006_parser_full_json.ts and phpbackend2 schema).
"""
from __future__ import annotations

import asyncio
from typing import Any

from sqlalchemy import MetaData, Table, insert

from .db import get_engine


# Logical name → physical table name in the existing schema
TABLE_MAP = {
    "session": "parser_sessions",
    "processed_files": "parser_processed_files",
    "included_files": "parser_included_files",
    "define_vars": "parser_define_vars",
    "env_vars": "parser_env_vars",
    "env_var_relations": "parser_env_var_relations",
    "toolset_vars": "parser_toolset_vars",
    "toolset_switch_opts": "parser_toolset_switch_opts",
}


class DbWriter:
    def __init__(self, session_id: str, enabled: bool = True, batch_size: int = 1000) -> None:
        self.session_id = session_id
        self.enabled = enabled
        self.batch_size = batch_size
        self._buffers: dict[str, list[dict]] = {k: [] for k in TABLE_MAP}
        self._engine = None
        self._meta: MetaData | None = None
        self._tables: dict[str, Table] = {}
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        if not self.enabled:
            return
        self._engine = get_engine()
        if self._engine is None:
            self.enabled = False
            return
        self._meta = MetaData()
        for logical, physical in TABLE_MAP.items():
            try:
                self._tables[logical] = Table(physical, self._meta, autoload_with=self._engine)
            except Exception:
                # Table missing — skip silently; that section just won't persist.
                pass

    async def write_session(self, row: dict[str, Any]) -> None:
        if not self.enabled or "session" not in self._tables:
            return
        await self._exec_insert("session", [row])

    async def add(self, logical: str, row: dict[str, Any]) -> None:
        if not self.enabled:
            return
        buf = self._buffers.setdefault(logical, [])
        buf.append(row)
        if len(buf) >= self.batch_size:
            await self._flush(logical)

    async def _flush(self, logical: str) -> None:
        buf = self._buffers.get(logical)
        if not buf or logical not in self._tables:
            self._buffers[logical] = []
            return
        rows, self._buffers[logical] = buf, []
        await self._exec_insert(logical, rows)

    async def _exec_insert(self, logical: str, rows: list[dict[str, Any]]) -> None:
        table = self._tables.get(logical)
        if table is None or not rows:
            return
        # Drop keys that aren't actual columns to keep the insert resilient
        cols = {c.name for c in table.columns}
        clean = [{k: v for k, v in r.items() if k in cols} for r in rows]

        def _do_insert() -> None:
            with self._engine.begin() as conn:  # type: ignore[union-attr]
                conn.execute(insert(table), clean)

        async with self._lock:
            await asyncio.to_thread(_do_insert)

    async def flush_all(self) -> None:
        if not self.enabled:
            return
        for logical in list(self._buffers.keys()):
            await self._flush(logical)

    async def close(self) -> None:
        # Engine is shared / pooled; nothing to do here.
        return
