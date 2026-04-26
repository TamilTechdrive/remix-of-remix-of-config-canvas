"""Parquet + SQLite shard writer.

Each entity gets its own Parquet file, written incrementally via row groups.
A small SQLite index records counts and file paths for fast retrieval/export.
"""
from __future__ import annotations

import os
import sqlite3
import time
from typing import Any

from ..config import settings

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
    HAS_ARROW = True
except Exception:  # pragma: no cover
    HAS_ARROW = False


CATEGORIES = (
    "processed_files",
    "included_files",
    "define_vars",
    "env_vars",
    "env_var_relations",
    "toolset_vars",
    "toolset_switch_opts",
)


class ShardWriter:
    def __init__(self, job_id: str, session_id: str, enabled: bool = True, flush_rows: int = 10_000) -> None:
        self.job_id = job_id
        self.session_id = session_id
        self.enabled = enabled and HAS_ARROW
        self.flush_rows = flush_rows
        self.dir = os.path.join(settings.shards_dir, job_id)
        self._buffers: dict[str, list[dict]] = {c: [] for c in CATEGORIES}
        self._writers: dict[str, "pq.ParquetWriter"] = {}
        self._counts: dict[str, int] = {c: 0 for c in CATEGORIES}
        self._sqlite: sqlite3.Connection | None = None

    def start(self) -> None:
        if not self.enabled:
            return
        os.makedirs(self.dir, exist_ok=True)
        self._sqlite = sqlite3.connect(os.path.join(self.dir, "index.sqlite"))
        self._sqlite.execute(
            "CREATE TABLE IF NOT EXISTS shards("
            "category TEXT PRIMARY KEY, file TEXT, rows INTEGER, updated_at REAL)"
        )
        self._sqlite.execute(
            "CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT)"
        )
        self._sqlite.execute(
            "INSERT OR REPLACE INTO meta(k,v) VALUES (?,?)",
            ("session_id", self.session_id),
        )
        self._sqlite.commit()

    def add(self, category: str, row: dict[str, Any]) -> None:
        if not self.enabled or category not in self._buffers:
            return
        self._buffers[category].append(row)
        self._counts[category] += 1
        if len(self._buffers[category]) >= self.flush_rows:
            self._flush(category)

    def _flush(self, category: str) -> None:
        if not self.enabled:
            return
        rows = self._buffers[category]
        if not rows:
            return
        table = pa.Table.from_pylist(rows)
        if category not in self._writers:
            path = os.path.join(self.dir, f"{category}.parquet")
            self._writers[category] = pq.ParquetWriter(path, table.schema)
        self._writers[category].write_table(table)
        self._buffers[category] = []

    def close(self) -> None:
        if not self.enabled:
            return
        for cat in list(self._buffers.keys()):
            self._flush(cat)
        for cat, w in self._writers.items():
            try:
                w.close()
            except Exception:
                pass
            if self._sqlite is not None:
                self._sqlite.execute(
                    "INSERT OR REPLACE INTO shards(category,file,rows,updated_at) VALUES (?,?,?,?)",
                    (cat, f"{cat}.parquet", self._counts.get(cat, 0), time.time()),
                )
        if self._sqlite is not None:
            self._sqlite.commit()
            self._sqlite.close()
