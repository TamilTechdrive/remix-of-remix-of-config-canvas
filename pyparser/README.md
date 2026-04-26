# Python Parser Service (pyparser)

High-performance streaming JSON parser for **huge** parser-output files (11 GB+).
Built with **FastAPI + ijson + orjson**, async job queue, WebSocket progress updates,
and dual storage (relational DB + Parquet/SQLite shards).

## Why Python?

Node and PHP load JSON entirely into RAM. For 11 GB+ outputs this OOMs. Python's
`ijson` parses JSON as a token stream, keeping memory constant regardless of file size.

## Features

- **File-path ingestion** — frontend sends a server-side path; no upload needed
- **Streaming parser** (ijson) — handles arbitrarily large `ProcessedFiles`,
  `MOFP.IncFiles`, `CSHFP.IncFiles`, `DefineVars`, `EnvVars`, `ToolsetVars`
- **Relationship resolution** — links `ToolsetVars -D` switches → `DefineVars`,
  `EnvVars ↔ DefineVars` via `EnvParList` / `EnvSibList`
- **Async jobs** — `POST /jobs` returns `job_id` immediately; worker runs in background
- **WebSocket progress** — `ws://host/ws/{job_id}` streams `{stage, processed, total, eta}`
- **Dual storage**
  - Streams batches (1k rows) into MySQL/MSSQL `parser_*` tables
  - Writes Parquet shards + SQLite index to `data/shards/{job_id}/`
- **No JWT required** — respects the project-wide `security_enabled` flag

## Layout

```
pyparser/
├── README.md
├── requirements.txt
├── .env.example
├── run.sh                  # uvicorn launcher
├── app/
│   ├── __init__.py
│   ├── main.py             # FastAPI app + routes + WebSocket
│   ├── config.py           # env config (DB, paths, security flag)
│   ├── models.py           # pydantic schemas
│   ├── jobs.py             # in-memory job queue + worker pool
│   ├── progress.py         # progress broker (per-job pub/sub for WS)
│   ├── parser/
│   │   ├── __init__.py
│   │   ├── stream.py       # ijson streaming pipeline
│   │   ├── relations.py    # ToolsetVars↔DefineVars↔EnvVars linker
│   │   └── normalizer.py   # row builders for each entity
│   ├── storage/
│   │   ├── __init__.py
│   │   ├── db.py           # SQLAlchemy engine (MySQL + MSSQL)
│   │   ├── writer_db.py    # batched DB writer
│   │   └── writer_shards.py# Parquet + SQLite index writer
│   └── api/
│       ├── __init__.py
│       └── routes.py
└── data/
    └── shards/             # generated Parquet/SQLite output
```

## Quick start

```bash
cd pyparser
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # edit DB url, paths
./run.sh                    # uvicorn app.main:app --host 0.0.0.0 --port 8800
```

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/health` | liveness |
| POST   | `/jobs` | submit `{filePath, projectId?, buildId?, moduleId?, sessionName?}` → `{jobId}` |
| GET    | `/jobs/{id}` | poll status `{state, progress, stage, error, summary}` |
| GET    | `/jobs` | list recent jobs |
| DELETE | `/jobs/{id}` | cancel/remove |
| GET    | `/jobs/{id}/summary` | parsed counts + relationship stats |
| GET    | `/jobs/{id}/shards` | list Parquet shard files |
| GET    | `/export/{id}/{sheet}.csv` | stream CSV from shards |
| WS     | `/ws/{id}` | live progress events |

## Frontend integration

When the **Python backend** flag is enabled in API settings (`apiConfig.usePython = true`),
the Parser Data screen routes seed/list/get to `pythonApi` instead of node/php and
opens a WebSocket for progress.

## Notes

- DB schema reuses the `parser_*` tables created by Node migration `006_parser_full_json.ts`
  and the PHP `mysql_schema.sql`. No schema duplication.
- Works against MySQL (default) or MSSQL (`DB_DIALECT=mssql`).
- Parquet shards are optional — if `pyarrow` is missing, only DB writes happen.
