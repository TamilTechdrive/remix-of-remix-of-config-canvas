"""In-process async job queue."""
import asyncio
import time
import uuid
from typing import Optional

from .models import JobCreate, JobStatus
from .progress import broker
from .parser.stream import run_parse_job


class JobManager:
    def __init__(self, max_concurrent: int = 2) -> None:
        self._jobs: dict[str, JobStatus] = {}
        self._tasks: dict[str, asyncio.Task] = {}
        self._sem = asyncio.Semaphore(max_concurrent)

    def submit(self, payload: JobCreate) -> JobStatus:
        job_id = uuid.uuid4().hex[:16]
        status = JobStatus(jobId=job_id, state="queued", stage="queued")
        self._jobs[job_id] = status
        task = asyncio.create_task(self._run(job_id, payload))
        self._tasks[job_id] = task
        return status

    async def _run(self, job_id: str, payload: JobCreate) -> None:
        async with self._sem:
            status = self._jobs[job_id]
            status.state = "running"
            status.startedAt = time.time()
            status.stage = "starting"
            await broker.publish(job_id, {"jobId": job_id, "stage": "starting", "progress": 0.0})
            try:
                await run_parse_job(job_id, payload, status, broker)
                status.state = "done"
                status.stage = "completed"
                status.progress = 1.0
                status.finishedAt = time.time()
                await broker.publish(job_id, {
                    "jobId": job_id, "stage": "completed", "progress": 1.0,
                    "rows": status.rows, "summary": status.summary,
                })
            except asyncio.CancelledError:
                status.state = "cancelled"
                status.finishedAt = time.time()
                await broker.publish(job_id, {"jobId": job_id, "stage": "cancelled", "progress": status.progress})
                raise
            except Exception as exc:  # noqa: BLE001
                status.state = "error"
                status.error = str(exc)
                status.finishedAt = time.time()
                await broker.publish(job_id, {"jobId": job_id, "stage": "error", "error": str(exc)})

    def get(self, job_id: str) -> Optional[JobStatus]:
        return self._jobs.get(job_id)

    def list(self) -> list[JobStatus]:
        return sorted(self._jobs.values(), key=lambda j: j.startedAt or 0, reverse=True)

    def cancel(self, job_id: str) -> bool:
        task = self._tasks.get(job_id)
        if task and not task.done():
            task.cancel()
            return True
        return False


manager = JobManager()
