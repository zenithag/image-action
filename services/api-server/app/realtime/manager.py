import logging

import socketio

from app.config import settings

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

sio_app = socketio.ASGIApp(sio, socketio_path="/socket.io")


@sio.event
async def connect(sid, environ, auth):
    logger.info("Socket.IO client connected: %s", sid)

    if not settings.auth_enabled:
        # In dev mode, accept all connections
        # Client should send tenant_id in auth dict
        tenant_id = None
        if auth and isinstance(auth, dict):
            tenant_id = auth.get("tenant_id")
        if tenant_id:
            room = f"tenant:{tenant_id}"
            sio.enter_room(sid, room)
            logger.info("Client %s joined room %s (dev mode)", sid, room)
        return True

    # In production, validate JWT
    if not auth or not isinstance(auth, dict) or "token" not in auth:
        logger.warning("Socket.IO connection rejected: no token")
        return False

    token = auth["token"]
    try:
        from app.auth.middleware import _get_jwks, _decode_token, _extract_auth_user
        jwks = await _get_jwks()
        claims = _decode_token(token, jwks)
        user = _extract_auth_user(claims)

        if not user.tenant_id:
            logger.warning("Socket.IO connection rejected: no tenant_id in token")
            return False

        room = f"tenant:{user.tenant_id}"
        sio.enter_room(sid, room)
        await sio.save_session(sid, {"user": user, "tenant_id": user.tenant_id})
        logger.info("Client %s (%s) joined room %s", sid, user.email, room)
        return True

    except Exception as e:
        logger.warning("Socket.IO auth failed: %s", e)
        return False


@sio.event
async def disconnect(sid):
    logger.info("Socket.IO client disconnected: %s", sid)


async def emit_to_tenant(tenant_id: str, event: str, data: dict) -> None:
    room = f"tenant:{tenant_id}"
    await sio.emit(event, data, room=room)
    logger.debug("Emitted %s to room %s", event, room)
