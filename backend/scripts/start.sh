#!/bin/bash
set -e

echo "Checking database connectivity..."
python scripts/wait_for_db.py

echo "Running Alembic migrations..."
alembic upgrade head

echo "Starting Uvicorn server..."
# Using the PORT environment variable provided by Railway
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
