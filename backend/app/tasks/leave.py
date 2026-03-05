import asyncio
from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.services.leave import LeaveService
from datetime import date

@celery_app.task(name="app.tasks.leave.run_annual_grant")
def run_annual_grant(year: int = None):
    """
    Background task to grant annual leave entitlements.
    If year is not provided, targets the current calendar year.
    Useful for Jan 1 automation or handle rollover.
    """
    if year is None:
        year = date.today().year

    async def _execute():
        async with AsyncSessionLocal() as session:
            service = LeaveService(session)
            results = await service.grant_new_year_entitlements(year)
            print(f"Annual Grant {year} Results: {results}")
            return results

    try:
        # Check if an event loop is already running (e.g., in a weird worker config)
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(_execute())
        else:
            return asyncio.run(_execute())
    except RuntimeError:
        return asyncio.run(_execute())

@celery_app.task(name="app.tasks.leave.run_carry_expiry")
def run_carry_expiry(as_of_date_str: str = None):
    """
    Background task to expire carried-forward leave.
    as_of_date_str: Optional ISO date string (YYYY-MM-DD). If none, uses today.
    """
    if as_of_date_str:
        as_of_date = date.fromisoformat(as_of_date_str)
    else:
        as_of_date = date.today()

    async def _execute():
        async with AsyncSessionLocal() as session:
            service = LeaveService(session)
            results = await service.expire_carried_leave(as_of_date)
            print(f"Carry Expiry Check for {as_of_date} Results: {results}")
            return results

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(_execute())
        else:
            return asyncio.run(_execute())
    except RuntimeError:
        return asyncio.run(_execute())
