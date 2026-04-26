"""Pydantic schemas for API."""
from typing import Optional, Literal, Any
from pydantic import BaseModel, Field


class JobCreate(BaseModel):
    filePath: str = Field(..., description="Absolute path on the server filesystem to the parser JSON")
    sessionName: Optional[str] = None
    projectId: Optional[str] = None
    buildId: Optional[str] = None
    moduleId: Optional[str] = None
    storeMode: Literal["db", "shards", "both"] = "both"


class JobStatus(BaseModel):
    jobId: str
    state: Literal["queued", "running", "done", "error", "cancelled"]
    stage: str = ""
    progress: float = 0.0  # 0..1
    bytesRead: int = 0
    bytesTotal: int = 0
    rows: dict[str, int] = Field(default_factory=dict)
    error: Optional[str] = None
    startedAt: Optional[float] = None
    finishedAt: Optional[float] = None
    summary: Optional[dict[str, Any]] = None
    sessionId: Optional[str] = None


class ProgressEvent(BaseModel):
    jobId: str
    stage: str
    progress: float
    bytesRead: int = 0
    bytesTotal: int = 0
    rows: dict[str, int] = Field(default_factory=dict)
    message: Optional[str] = None
