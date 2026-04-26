"""Per-job pub/sub used by the WebSocket route."""
import asyncio
from collections import defaultdict
from typing import Any


class ProgressBroker:
    def __init__(self) -> None:
        self._subs: dict[str, set[asyncio.Queue]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def subscribe(self, job_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        async with self._lock:
            self._subs[job_id].add(q)
        return q

    async def unsubscribe(self, job_id: str, q: asyncio.Queue) -> None:
        async with self._lock:
            self._subs[job_id].discard(q)
            if not self._subs[job_id]:
                self._subs.pop(job_id, None)

    async def publish(self, job_id: str, event: dict[str, Any]) -> None:
        # Snapshot to avoid holding lock while putting
        async with self._lock:
            queues = list(self._subs.get(job_id, ()))
        for q in queues:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass


broker = ProgressBroker()
