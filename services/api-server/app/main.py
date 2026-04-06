from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from app.db import close_pool, open_pool


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await open_pool()
    yield
    await close_pool()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Studio Composicao Visual API",
        version="0.1.0",
        lifespan=lifespan,
    )

    from app.core.router import router as core_router
    from app.catalog.router import router as catalog_router
    from app.gateway.router import router as gateway_router

    app.include_router(core_router, prefix="/v1")
    app.include_router(catalog_router, prefix="/v1/catalog")
    app.include_router(gateway_router, prefix="/v1")

    return app


app = create_app()
