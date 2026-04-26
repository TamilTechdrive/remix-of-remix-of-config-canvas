"""REST + WebSocket routes."""
from __future__ import annotations

import asyncio
import csv
import io
import os
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, JSONResponse

from ..config import settings
from ..jobs import manager
from ..models import JobCreate
from ..progress import broker

try:
    import pyarrow.parquet as pq
    HAS_ARROW = True
except Exception:
    HAS_ARROW = False


router = APIRouter()


@router.get("/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "pyparser",
        "securityEnabled": settings.security_enabled,
        "dbDialect": settings.db_dialect,
        "shardsDir": settings.shards_dir,
        "hasParquet": HAS_ARROW,
    }


@router.post("/jobs")
async def submit_job(payload: JobCreate) -> dict[str, Any]:
    if not os.path.isfile(payload.filePath):
        raise HTTPException(status_code=400, detail=f"File not found on server: {payload.filePath}")
    status = manager.submit(payload)
    return {"jobId": status.jobId, "state": status.state}


@router.get("/jobs")
async def list_jobs() -> list[dict[str, Any]]:
    return [s.model_dump() for s in manager.list()]


@router.get("/jobs/{job_id}")
async def get_job(job_id: str) -> dict[str, Any]:
    s = manager.get(job_id)
    if not s:
        raise HTTPException(status_code=404, detail="job not found")
    return s.model_dump()


@router.delete("/jobs/{job_id}")
async def cancel_job(job_id: str) -> dict[str, Any]:
    ok = manager.cancel(job_id)
    return {"cancelled": ok}


@router.get("/jobs/{job_id}/summary")
async def job_summary(job_id: str) -> dict[str, Any]:
    s = manager.get(job_id)
    if not s:
        raise HTTPException(status_code=404, detail="job not found")
    return {"jobId": job_id, "state": s.state, "rows": s.rows, "summary": s.summary}


@router.get("/jobs/{job_id}/shards")
async def job_shards(job_id: str) -> dict[str, Any]:
    d = os.path.join(settings.shards_dir, job_id)
    if not os.path.isdir(d):
        raise HTTPException(status_code=404, detail="no shards for job")
    files = []
    for name in sorted(os.listdir(d)):
        p = os.path.join(d, name)
        if os.path.isfile(p):
            files.append({"name": name, "size": os.path.getsize(p)})
    return {"jobId": job_id, "dir": d, "files": files}


@router.get("/export/{job_id}/{sheet}.csv")
async def export_csv(job_id: str, sheet: str):
    """Stream Parquet → CSV for the requested sheet."""
    if not HAS_ARROW:
        raise HTTPException(status_code=503, detail="pyarrow not installed")
    path = os.path.join(settings.shards_dir, job_id, f"{sheet}.parquet")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="shard not found")

    def _gen():
        pf = pq.ParquetFile(path)
        first = True
        for batch in pf.iter_batches(batch_size=2000):
            df = batch.to_pylist()
            buf = io.StringIO()
            if not df:
                continue
            writer = csv.DictWriter(buf, fieldnames=list(df[0].keys()))
            if first:
                writer.writeheader()
                first = False
            writer.writerows(df)
            yield buf.getvalue()

    headers = {"Content-Disposition": f'attachment; filename="{sheet}.csv"'}
    return StreamingResponse(_gen(), media_type="text/csv", headers=headers)


@router.websocket("/ws/{job_id}")
async def ws_progress(ws: WebSocket, job_id: str) -> None:
    await ws.accept()
    q = await broker.subscribe(job_id)
    # Send a snapshot first
    s = manager.get(job_id)
    if s:
        await ws.send_json({"jobId": job_id, "stage": s.stage, "progress": s.progress,
                            "rows": s.rows, "state": s.state})
    try:
        while True:
            try:
                ev = await asyncio.wait_for(q.get(), timeout=30.0)
            except asyncio.TimeoutError:
                await ws.send_json({"jobId": job_id, "stage": "ping", "progress": (manager.get(job_id).progress if manager.get(job_id) else 0)})
                continue
            await ws.send_json(ev)
            if ev.get("stage") in ("completed", "error", "cancelled"):
                break
    except WebSocketDisconnect:
        pass
    finally:
        await broker.unsubscribe(job_id, q)
        try:
            await ws.close()
        except Exception:
            pass
