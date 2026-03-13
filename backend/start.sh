#!/bin/bash
set -e

echo "Checking database connectivity..."
# Railway usually provides DATABASE_URL, make sure your wait_for_db.py uses it
python wait_for_db.py

echo "Running Alembic migrations..."
alembic upgrade head

echo "======================================"
echo "Seeding Foundational Statutory Data..."
echo "======================================"

echo "Seeding Platform Admins..."
python scripts/seed_admins.py

echo "Seeding MOM Statutory Leave Rules..."
python scripts/seed_statutory_leave_rule.py

echo "Seeding 2026 CPF Rates..."
python scripts/seed_cpf_rates.py

echo "Seeding CPF Allocations..."
python scripts/seed_cpf_allocations.py

echo "Seeding SDL Rates..."
python scripts/seed_sdl_rates.py

echo "Seeding SHG (CDAC/MENDAKI/SINDA) Rates..."
python scripts/seed_shg_rates.py

echo "Starting Uvicorn server..."
# Using the PORT environment variable provided by Railway
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
