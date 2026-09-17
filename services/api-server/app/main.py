from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.db import close_pool, open_pool
from app.config import settings

from app.limiter import limiter


class SecurityHeadersMiddlewareConfig(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        host = request.headers.get("host", "")
        allowed = [
            h.strip() for h in settings.allowed_hosts.split(",") if h.strip()
        ]
        is_allowed = any(
            allowed_host in host
            for allowed_host in allowed
        ) if host else True

        if not is_allowed and settings.allowed_hosts:
            from fastapi.responses import PlainTextResponse
            return PlainTextResponse("Forbidden", status_code=403)

        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
        return response


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

    fastapi_app.state.limiter = limiter
    fastapi_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    allowed_origins = [
        origin.strip()
        for origin in settings.cors_allowed_origins.split(",")
        if origin.strip()
    ]
    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    )

    fastapi_app.add_middleware(SecurityHeadersMiddlewareConfig)

    from app.auth.middleware import AuthMiddleware
    fastapi_app.add_middleware(AuthMiddleware)

    from app.core.router import router as core_router
    from app.catalog.router import router as catalog_router
    from app.gateway.router import router as gateway_router
    from app.orchestrator.router import router as orchestrator_router
    from app.realtime.router import router as realtime_router

    fastapi_app.include_router(core_router, prefix="/v1")
    fastapi_app.include_router(catalog_router, prefix="/v1/catalog")
    fastapi_app.include_router(gateway_router, prefix="/v1")
    fastapi_app.include_router(orchestrator_router, prefix="/v1")
    fastapi_app.include_router(realtime_router, prefix="/v1")

    from app.realtime.manager import sio_app
    fastapi_app.mount("/socket.io", sio_app)

    return fastapi_app


app = create_app()
