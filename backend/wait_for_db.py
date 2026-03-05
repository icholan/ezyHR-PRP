import os
import time
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from dotenv import load_dotenv

load_dotenv()

def get_db_url():
    _db_url = os.getenv("DATABASE_URL", "postgresql://postgres:root@localhost:5432/postgres")
    if _db_url.startswith("postgresql://") and "+asyncpg" not in _db_url:
        return _db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return _db_url

async def wait_for_db(retries=5, delay=2):
    db_url = get_db_url()
    print(f"Waiting for database at {db_url.split('@')[-1]}...")
    
    engine = create_async_engine(db_url)
    
    for i in range(retries):
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
                print("Database is ready!")
                await engine.dispose()
                return True
        except Exception as e:
            print(f"Database not ready (attempt {i+1}/{retries}).")
            print(f"Error details: {type(e).__name__}: {str(e)}")
            if "ssl" in str(e).lower():
                print("HINT: Database might require SSL. Try adding '?sslmode=require' to your DATABASE_URL.")
            if i < retries - 1:
                await asyncio.sleep(delay)
    
    await engine.dispose()
    return False

if __name__ == "__main__":
    success = asyncio.run(wait_for_db())
    if not success:
        print("Could not connect to database. Exiting.")
        exit(1)
