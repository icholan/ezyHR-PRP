#!/bin/bash
set -e

echo "Checking database connectivity..."
python wait_for_db.py

echo "Running Alembic migrations..."
alembic upgrade head

echo "Seeding default admin accounts..."
python scripts/seed_admins.py

echo "Starting Uvicorn server..."
# Using the PORT environment variable provided by Railway
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
