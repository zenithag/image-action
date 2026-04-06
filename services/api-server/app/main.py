from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from app.db import close_pool, open_pool


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await open_pool()
    from app.storage.client import ensure_bucket
    try:
        ensure_bucket()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("MinIO bucket check failed (MinIO may not be running): %s", e)
    yield
    await close_pool()


def create_app() -> FastAPI:
    fastapi_app = FastAPI(
        title="Studio Composicao Visual API",
        version="0.1.0",
        lifespan=lifespan,
    )

    from app.auth.middleware import AuthMiddleware
    fastapi_app.add_middleware(AuthMiddleware)

    from app.core.router import router as core_router
    from app.catalog.router import router as catalog_router
    from app.gateway.router import router as gateway_router
    from app.orchestrator.router import router as orchestrator_router

    fastapi_app.include_router(core_router, prefix="/v1")
    fastapi_app.include_router(catalog_router, prefix="/v1/catalog")
    fastapi_app.include_router(gateway_router, prefix="/v1")
    fastapi_app.include_router(orchestrator_router, prefix="/v1")

    # Mount Socket.IO
    from app.realtime.manager import sio_app
    fastapi_app.mount("/socket.io", sio_app)

    return fastapi_app


app = create_app()
