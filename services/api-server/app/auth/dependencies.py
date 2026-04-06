from fastapi import Depends, HTTPException, Request

from app.auth.schemas import AuthUser
from app.config import settings


def get_current_user(request: Request) -> AuthUser | None:
    if not settings.auth_enabled:
        return None
    user = getattr(request.state, "auth_user", None)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def require_role(*roles: str):
    def dependency(request: Request) -> AuthUser:
        user = get_current_user(request)
        if user is None:
            return None
        if not any(r in user.roles for r in roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dependency


def require_superadmin(request: Request) -> AuthUser | None:
    user = get_current_user(request)
    if user is None:
        return None
    if not user.is_superadmin:
        raise HTTPException(status_code=403, detail="Superadmin required")
    return user
