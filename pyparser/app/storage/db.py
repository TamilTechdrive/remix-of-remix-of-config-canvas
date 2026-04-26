"""SQLAlchemy engine factory."""
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from ..config import settings


_engine: Optional[Engine] = None


def get_engine() -> Optional[Engine]:
    global _engine
    if _engine is not None:
        return _engine
    url = settings.db_url()
    if not url:
        return None
    try:
        _engine = create_engine(url, pool_pre_ping=True, future=True)
        # Smoke test
        with _engine.connect() as c:
            c.exec_driver_sql("SELECT 1")
        return _engine
    except Exception as exc:  # pragma: no cover
        print(f"[pyparser] DB engine unavailable ({exc!s}); running in shards-only mode.")
        _engine = None
        return None
