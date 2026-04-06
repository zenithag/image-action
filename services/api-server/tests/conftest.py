import pytest
from httpx import ASGITransport, AsyncClient

from app.db import get_conn, open_pool, close_pool
from app.main import create_app


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    await open_pool()
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await _cleanup_test_data()
    await close_pool()


async def _cleanup_test_data():
    try:
        async with get_conn() as conn:
            await conn.execute("delete from renders")
            await conn.execute("delete from composition_jobs")
            await conn.execute("delete from catalog_item_images")
            await conn.execute("delete from catalog_items")
            await conn.execute("delete from catalog_categories")
            await conn.execute("delete from messages")
            await conn.execute("delete from assets")
            await conn.execute("delete from conversations")
            await conn.execute("delete from contacts")
            await conn.execute("delete from usage_events")
            await conn.execute("delete from llm_profiles")
            await conn.execute("delete from tenant_channels")
            await conn.execute("delete from tenant_domains")
            await conn.execute("delete from tenants")
    except Exception:
        pass
