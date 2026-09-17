import logging
from typing import Annotated

import httpx
import jwt as pyjwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.auth.schemas import AuthUser
from app.config import settings

logger = logging.getLogger(__name__)

_jwks_cache: dict | None = None

security = HTTPBearer(auto_error=False)

UNPROTECTED_PREFIXES = (
    "/v1/health",
    "/v1/webhooks/",
    "/v1/internal/",
    "/docs",
    "/openapi.json",
    "/socket.io",
)


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> AuthUser:
    if not settings.auth_enabled:
        request.state.auth_user = None
        raise JSONResponse(status_code=401, content={"detail": "Authentication disabled"})

    if not credentials:
        raise JSONResponse(status_code=401, content={"detail": "Missing authorization header"})

    token = credentials.credentials

    try:
        jwks = await _get_jwks()
        claims = _decode_token(token, jwks)
        return _extract_auth_user(claims)
    except Exception as e:
        logger.warning("Auth failed: %s", e)
        raise JSONResponse(status_code=401, content={"detail": "Invalid token"})


def require_tenant_id(user: Annotated[AuthUser, Depends(get_current_user)]) -> AuthUser:
    if not user.tenant_id:
        raise JSONResponse(status_code=403, content={"detail": "No tenant_id in token"})
    return user


async def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    jwks_url = f"{settings.zitadel_issuer_url}/oauth/v2/keys"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(jwks_url)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    return _jwks_cache


def _decode_token(token: str, jwks: dict) -> dict:
    public_keys = {}
    for key_data in jwks.get("keys", []):
        kid = key_data.get("kid")
        if kid:
            public_keys[kid] = pyjwt.algorithms.RSAAlgorithm.from_jwk(key_data)

    header = pyjwt.get_unverified_header(token)
    kid = header.get("kid")
    if kid not in public_keys:
        raise pyjwt.InvalidTokenError(f"Unknown kid: {kid}")

    return pyjwt.decode(
        token,
        key=public_keys[kid],
        algorithms=["RS256"],
        options={
            "verify_exp": True,
            "verify_aud": True,
            "require": ["exp", "aud"],
        },
        issuer=settings.zitadel_issuer_url,
        audience=settings.zitadel_project_id,
    )


def _extract_auth_user(claims: dict) -> AuthUser:
    user_id = claims.get("sub", "")
    email = claims.get("email", "")
    name = claims.get("name", claims.get("preferred_username", ""))

    # Zitadel org claim
    org_id = claims.get("urn:zitadel:iam:org:id", None)

    # Extract roles from Zitadel project roles claim
    roles = []
    project_roles_key = f"urn:zitadel:iam:org:project:{settings.zitadel_project_id}:roles"
    project_roles = claims.get(project_roles_key, {})
    if isinstance(project_roles, dict):
        roles = list(project_roles.keys())

    return AuthUser(
        id=user_id,
        tenant_id=org_id,
        roles=roles,
        email=email,
        name=name,
    )


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not settings.auth_enabled:
            request.state.auth_user = None
            return await call_next(request)

        path = request.url.path
        if any(path.startswith(prefix) for prefix in UNPROTECTED_PREFIXES):
            request.state.auth_user = None
            return await call_next(request)

        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Missing or invalid authorization header"})

        token = auth_header[7:]

        try:
            jwks = await _get_jwks()
            claims = _decode_token(token, jwks)
            auth_user = _extract_auth_user(claims)
            request.state.auth_user = auth_user
        except Exception as e:
            logger.warning("Auth failed: %s", e)
            return JSONResponse(status_code=401, content={"detail": "Invalid token"})

        return await call_next(request)
