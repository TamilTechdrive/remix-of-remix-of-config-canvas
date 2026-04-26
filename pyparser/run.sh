#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
HOST=${HOST:-0.0.0.0}
PORT=${PORT:-8800}
exec uvicorn app.main:app --host "$HOST" --port "$PORT" --workers 1
