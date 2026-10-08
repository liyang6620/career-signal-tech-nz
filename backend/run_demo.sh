#!/bin/sh
set -eu

alembic upgrade head
python -m app.worker &
worker_pid=$!

uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" &
api_pid=$!

terminate() {
  kill -TERM "$api_pid" "$worker_pid" 2>/dev/null || true
  wait "$api_pid" "$worker_pid" 2>/dev/null || true
}
trap terminate INT TERM EXIT

wait "$api_pid"
