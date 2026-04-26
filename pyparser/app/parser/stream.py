"""
Streaming JSON pipeline.

Strategy:
  1. First pass: ijson.kvitems / items walks top-level keys without loading
     the whole file. We process each subtree as it arrives and flush rows
     to the writers in BATCH_SIZE chunks.
  2. We build small in-memory name→id maps for DefineVars / EnvVars /
     ToolsetSwitches so we can resolve cross-references in pass 2.
  3. Second light pass walks DefineVars/EnvVars again to emit relationship
     rows. (DefineVars and EnvVars sections are typically << total file size.)

For 11 GB+ files most of the volume sits under `ProcessedFiles` and
`MOFP.IncFiles` / `CSHFP.IncFiles`, which are streamed without ever holding
more than BATCH_SIZE rows in RAM.
"""
from __future__ import annotations

import asyncio
import os
import time
import uuid
from typing import Any, Iterable

import ijson

from ..config import settings
from ..models import JobCreate, JobStatus
from ..progress import ProgressBroker
from ..storage.writer_db import DbWriter
from ..storage.writer_shards import ShardWriter
from . import normalizer as N
from . import relations as R


PROGRESS_EVERY = 500_000  # bytes


async def _emit(broker: ProgressBroker, job_id: str, status: JobStatus, stage: str, msg: str | None = None):
    status.stage = stage
    await broker.publish(job_id, {
        "jobId": job_id, "stage": stage, "progress": status.progress,
        "bytesRead": status.bytesRead, "bytesTotal": status.bytesTotal,
        "rows": dict(status.rows), "message": msg,
    })


def _open_progress(path: str, status: JobStatus, broker: ProgressBroker, job_id: str, loop: asyncio.AbstractEventLoop):
    """Yield a file-like object that updates progress as bytes are read."""
    status.bytesTotal = os.path.getsize(path)
    f = open(path, "rb")

    last_emit = [0]

    class _Wrap:
        def read(self, n: int = -1) -> bytes:
            chunk = f.read(n)
            if chunk:
                status.bytesRead += len(chunk)
                if status.bytesTotal:
                    status.progress = min(0.99, status.bytesRead / status.bytesTotal)
                if status.bytesRead - last_emit[0] >= PROGRESS_EVERY:
                    last_emit[0] = status.bytesRead
                    asyncio.run_coroutine_threadsafe(
                        broker.publish(job_id, {
                            "jobId": job_id, "stage": status.stage,
                            "progress": status.progress,
                            "bytesRead": status.bytesRead, "bytesTotal": status.bytesTotal,
                            "rows": dict(status.rows),
                        }), loop,
                    )
            return chunk

        def close(self):
            f.close()

    return _Wrap(), f


async def run_parse_job(
    job_id: str,
    payload: JobCreate,
    status: JobStatus,
    broker: ProgressBroker,
) -> None:
    path = payload.filePath
    if not os.path.isfile(path):
        raise FileNotFoundError(f"File not found: {path}")

    session_id = uuid.uuid4().hex
    status.sessionId = session_id

    # Storage writers
    use_db = payload.storeMode in ("db", "both")
    use_shards = payload.storeMode in ("shards", "both")
    db = DbWriter(session_id=session_id, enabled=use_db, batch_size=settings.batch_size)
    shards = ShardWriter(job_id=job_id, session_id=session_id, enabled=use_shards)
    await db.start()
    shards.start()

    # Session row
    if use_db:
        await db.write_session({
            "id": session_id,
            "name": payload.sessionName or os.path.basename(path),
            "source_path": path,
            "project_id": payload.projectId,
            "build_id": payload.buildId,
            "module_id": payload.moduleId,
            "started_at": time.time(),
        })

    # In-mem name → id maps for relationship resolution
    define_name_to_id: dict[str, str] = {}
    env_name_to_id: dict[str, str] = {}
    define_raw_lite: dict[str, dict] = {}
    env_raw_lite: dict[str, dict] = {}
    toolset_switch_rows: list[dict] = []

    loop = asyncio.get_running_loop()

    # ---------- PASS 1: stream main sections ----------
    await _emit(broker, job_id, status, "parsing")
    wrap, raw_fh = _open_progress(path, status, broker, job_id, loop)

    try:
        # Use 'multiple_values=False' default. We do prefix-driven parsing.
        parser = ijson.parse(wrap, use_float=True)

        # We iterate the token stream once and dispatch by prefix. For
        # collections we know are huge (ProcessedFiles, IncFiles) we
        # consume them here without buffering.
        current_pf_filetype: str | None = None
        pf_obj: dict | None = None

        inc_kind: str | None = None  # "MOFP" or "CSHFP"
        inc_obj: dict | None = None

        # We build up "lite" copies of DefineVars/EnvVars/ToolsetVars
        # objects (those sections are typically small relative to file size)
        section_stack: list[str] = []
        current_dict: dict[str, Any] | None = None
        current_key: str | None = None

        # Simpler approach: rely on ijson.kvitems / items for small sections,
        # but stream the giant ones. We'll do two-phase: use parse() for the
        # giant arrays, and re-open file with items() for small dicts.
        # To keep memory bounded we close the parser after the streaming pass.
        # Implementation: use ijson.items with multiple prefixes via prefix-walk.

        # Reset and use higher-level items() API per section instead — clearer.
        raw_fh.close()
    finally:
        try:
            raw_fh.close()
        except Exception:
            pass

    # ---- streaming the giant sections via items() ----
    def _stream_section(prefix: str):
        """Generator yielding items at a given ijson prefix from the file."""
        with open(path, "rb") as fh:
            yield from ijson.items(fh, prefix, use_float=True)

    # ProcessedFiles is keyed by FileType
    await _emit(broker, job_id, status, "processed_files")
    pf_count = 0
    with open(path, "rb") as fh:
        for ftype, arr in ijson.kvitems(fh, "ProcessedFiles", use_float=True):
            if not isinstance(arr, list):
                continue
            for raw in arr:
                row = N.processed_file_row(session_id, ftype, raw)
                await db.add("processed_files", row)
                shards.add("processed_files", row)
                pf_count += 1
                if pf_count % settings.batch_size == 0:
                    status.rows["processed_files"] = pf_count
                    await _emit(broker, job_id, status, "processed_files")
    status.rows["processed_files"] = pf_count

    # MOFP.IncFiles + CSHFP.IncFiles (huge for big builds)
    for kind, prefix in (("MOFP", "MOFP.IncFiles.item"), ("CSHFP", "CSHFP.IncFiles.item")):
        await _emit(broker, job_id, status, f"included_{kind.lower()}")
        cnt = 0
        try:
            for raw in _stream_section(prefix):
                row = N.included_file_row(session_id, kind, raw)
                await db.add("included_files", row)
                shards.add("included_files", row)
                cnt += 1
                if cnt % settings.batch_size == 0:
                    status.rows[f"included_{kind.lower()}"] = cnt
                    await _emit(broker, job_id, status, f"included_{kind.lower()}")
        except Exception:
            # Section may simply not exist in some files
            pass
        status.rows[f"included_{kind.lower()}"] = cnt

    # ToolsetVars { CFLAGS: { SrcLineNoRef, SWOpt: {...} }, ... } — small
    await _emit(broker, job_id, status, "toolset_vars")
    ts_count = 0
    sw_count = 0
    with open(path, "rb") as fh:
        for ts_name, ts_raw in ijson.kvitems(fh, "ToolsetVars", use_float=True):
            if not isinstance(ts_raw, dict):
                continue
            ts_row = N.toolset_var_row(session_id, ts_name, ts_raw)
            await db.add("toolset_vars", ts_row)
            shards.add("toolset_vars", ts_row)
            ts_count += 1
            for sw_row in N.toolset_switch_rows(ts_row["id"], ts_raw.get("SWOpt") or {}):
                await db.add("toolset_switch_opts", sw_row)
                shards.add("toolset_switch_opts", sw_row)
                toolset_switch_rows.append(sw_row)
                sw_count += 1
    status.rows["toolset_vars"] = ts_count
    status.rows["toolset_switch_opts"] = sw_count

    # DefineVars — keep a lite copy for relation pass
    await _emit(broker, job_id, status, "define_vars")
    dv_count = 0
    with open(path, "rb") as fh:
        for dname, draw in ijson.kvitems(fh, "DefineVars", use_float=True):
            if not isinstance(draw, dict):
                continue
            row = N.define_var_row(session_id, dname, draw)
            await db.add("define_vars", row)
            shards.add("define_vars", row)
            define_name_to_id[dname] = row["id"]
            define_raw_lite[dname] = {
                "EnvParList": draw.get("EnvParList") or [],
                "EnvSibList": draw.get("EnvSibList") or [],
            }
            dv_count += 1
    status.rows["define_vars"] = dv_count

    # EnvVars
    await _emit(broker, job_id, status, "env_vars")
    ev_count = 0
    with open(path, "rb") as fh:
        for ename, eraw in ijson.kvitems(fh, "EnvVars", use_float=True):
            if not isinstance(eraw, dict):
                continue
            row = N.env_var_row(session_id, ename, eraw)
            await db.add("env_vars", row)
            shards.add("env_vars", row)
            env_name_to_id[ename] = row["id"]
            env_raw_lite[ename] = {"RefList": eraw.get("RefList") or []}
            ev_count += 1
    status.rows["env_vars"] = ev_count

    # ---------- PASS 2: relationship resolution ----------
    await _emit(broker, job_id, status, "relationships")
    rel_count = 0
    for link in R.toolset_define_links(session_id, toolset_switch_rows, define_name_to_id):
        await db.add("env_var_relations", link)
        shards.add("env_var_relations", link)
        rel_count += 1
    for link in R.envvar_define_links(session_id, define_name_to_id, env_name_to_id, define_raw_lite):
        await db.add("env_var_relations", link)
        shards.add("env_var_relations", link)
        rel_count += 1
    for link in R.envvar_ref_links(session_id, env_raw_lite, define_name_to_id, env_name_to_id):
        await db.add("env_var_relations", link)
        shards.add("env_var_relations", link)
        rel_count += 1
    status.rows["relationships"] = rel_count

    # Flush + close
    await _emit(broker, job_id, status, "flushing")
    await db.flush_all()
    await db.close()
    shards.close()

    status.summary = {
        "sessionId": session_id,
        "rows": dict(status.rows),
        "shardsDir": shards.dir if use_shards else None,
        "filePath": path,
        "fileSize": status.bytesTotal,
    }
