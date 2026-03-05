from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os

_db_url = os.getenv("DATABASE_URL", "postgresql://postgres:root@localhost:5432/postgres")
if _db_url.startswith("postgresql://") and "+asyncpg" not in _db_url:
    DATABASE_URL = _db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    DATABASE_URL = _db_url

engine = create_async_engine(DATABASE_URL, echo=False, future=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
