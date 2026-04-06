# Fase 4: WebSocket (Socket.IO) + Auth (Zitadel) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar autenticacao JWT via Zitadel e realtime via Socket.IO ao api-server, completando o backend do MVP.

**Architecture:** Auth middleware valida JWT do Zitadel via JWKS em todas as rotas protegidas, injetando AuthUser no request. Socket.IO (python-socketio) montado no FastAPI via ASGIApp gerencia rooms por tenant, emitindo eventos quando mensagens/jobs mudam. Endpoints REST de takeover permitem operador assumir/devolver conversas.

**Tech Stack:** Python 3.12, FastAPI, python-socketio, PyJWT, httpx (JWKS), Zitadel (docker), pytest, respx

---

## Task 1: Adicionar Zitadel ao docker-compose

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Adicionar servico Zitadel ao docker-compose**

Adicionar ao `docker-compose.yml`, apos o servico `minio`:

```yaml
  zitadel:
    image: ghcr.io/zitadel/zitadel:v2.71.6
    command: start-from-init --masterkeyFromEnv --tlsMode disabled
    environment:
      ZITADEL_MASTERKEY: "MustBeAtLeast32CharactersLongKey!"
      ZITADEL_EXTERNALSECURE: "false"
      ZITADEL_EXTERNALPORT: 8080
      ZITADEL_EXTERNALDOMAIN: "localhost"
      ZITADEL_DATABASE_POSTGRES_HOST: postgres
      ZITADEL_DATABASE_POSTGRES_PORT: 5432
      ZITADEL_DATABASE_POSTGRES_DATABASE: zitadel
      ZITADEL_DATABASE_POSTGRES_USER_USERNAME: studio
      ZITADEL_DATABASE_POSTGRES_USER_PASSWORD: studio_dev
      ZITADEL_DATABASE_POSTGRES_USER_SSL_MODE: disable
      ZITADEL_DATABASE_POSTGRES_ADMIN_USERNAME: studio
      ZITADEL_DATABASE_POSTGRES_ADMIN_PASSWORD: studio_dev
      ZITADEL_DATABASE_POSTGRES_ADMIN_SSL_MODE: disable
      ZITADEL_FIRSTINSTANCE_ORG_HUMAN_USERNAME: "admin@studio.local"
      ZITADEL_FIRSTINSTANCE_ORG_HUMAN_PASSWORD: "Admin123!"
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
```

Tambem adicionar `POSTGRES_MULTIPLE_DATABASES: studio_app,zitadel` ao servico postgres (ou criar o banco zitadel no init script).

Criar `db/init-zitadel.sh`:
```bash
#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE zitadel;
EOSQL
```

- [ ] **Step 2: Testar que docker-compose sobe**

Run: `docker compose up -d`
Run: `docker compose ps`
Expected: postgres, minio e zitadel rodando (zitadel pode levar ~30s para inicializar)

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml db/init-zitadel.sh
git commit -m "infra: add Zitadel to docker-compose for JWT auth"
```

---

## Task 2: Auth schemas e config

**Files:**
- Create: `services/api-server/app/auth/__init__.py`
- Create: `services/api-server/app/auth/schemas.py`
- Modify: `services/api-server/app/config.py`

- [ ] **Step 1: Criar auth/__init__.py vazio**

- [ ] **Step 2: Criar auth/schemas.py**

```python
from dataclasses import dataclass


@dataclass
class AuthUser:
    id: str
    tenant_id: str | None
    roles: list[str]
    email: str
    name: str

    @property
    def is_superadmin(self) -> bool:
        return "superadmin" in self.roles

    @property
    def is_operator(self) -> bool:
        return "operator" in self.roles or "tenant_admin" in self.roles
```

- [ ] **Step 3: Adicionar config de Zitadel**

Em `services/api-server/app/config.py`, adicionar na classe Settings:

```python
    zitadel_issuer_url: str = "http://localhost:8080"
    zitadel_project_id: str = ""
    auth_enabled: bool = False
```

`auth_enabled=False` permite rodar testes sem Zitadel. Em producao, seta `AUTH_ENABLED=true`.

- [ ] **Step 4: Commit**

```bash
git add services/api-server/app/auth/ services/api-server/app/config.py
git commit -m "feat: auth schemas and Zitadel config settings"
```

---

## Task 3: Auth middleware e dependencies

**Files:**
- Create: `services/api-server/app/auth/middleware.py`
- Create: `services/api-server/app/auth/dependencies.py`
- Create: `services/api-server/tests/test_auth.py`

- [ ] **Step 1: Criar middleware.py**

```python
import logging
from typing import Optional

import httpx
import jwt as pyjwt
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.auth.schemas import AuthUser
from app.config import settings

logger = logging.getLogger(__name__)

_jwks_cache: dict | None = None

UNPROTECTED_PREFIXES = (
    "/v1/health",
    "/v1/webhooks/",
    "/v1/internal/",
    "/docs",
    "/openapi.json",
    "/socket.io",
)


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
        options={"verify_aud": False},
        issuer=settings.zitadel_issuer_url,
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
```

- [ ] **Step 2: Criar dependencies.py**

```python
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
```

- [ ] **Step 3: Escrever testes**

`services/api-server/tests/test_auth.py`:
```python
import pytest
from unittest.mock import patch, MagicMock

from app.auth.schemas import AuthUser
from app.auth.middleware import _extract_auth_user


def test_auth_user_is_superadmin():
    user = AuthUser(id="u1", tenant_id="t1", roles=["superadmin"], email="a@b.com", name="Admin")
    assert user.is_superadmin is True
    assert user.is_operator is False


def test_auth_user_is_operator():
    user = AuthUser(id="u2", tenant_id="t1", roles=["operator"], email="op@b.com", name="Op")
    assert user.is_superadmin is False
    assert user.is_operator is True


def test_auth_user_tenant_admin_is_operator():
    user = AuthUser(id="u3", tenant_id="t1", roles=["tenant_admin"], email="ta@b.com", name="TA")
    assert user.is_operator is True


def test_extract_auth_user():
    claims = {
        "sub": "user-123",
        "email": "test@example.com",
        "name": "Test User",
        "urn:zitadel:iam:org:id": "org-456",
        "urn:zitadel:iam:org:project:proj-1:roles": {
            "operator": {"org-456": "org-456"},
        },
    }
    with patch("app.auth.middleware.settings") as mock_settings:
        mock_settings.zitadel_project_id = "proj-1"
        user = _extract_auth_user(claims)

    assert user.id == "user-123"
    assert user.tenant_id == "org-456"
    assert "operator" in user.roles
    assert user.email == "test@example.com"


@pytest.mark.anyio
async def test_unprotected_routes_pass_without_token(client):
    resp = await client.get("/v1/health")
    assert resp.status_code == 200
```

- [ ] **Step 4: Rodar testes**

Run: `cd services/api-server && python -m pytest tests/test_auth.py -v`
Expected: 5 tests PASSED

- [ ] **Step 5: Commit**

```bash
git add services/api-server/app/auth/ services/api-server/tests/test_auth.py
git commit -m "feat: auth middleware with JWT/JWKS validation and role-based dependencies"
```

---

## Task 4: Registrar auth middleware no app

**Files:**
- Modify: `services/api-server/app/main.py`
- Modify: `services/api-server/pyproject.toml`

- [ ] **Step 1: Adicionar dependencias ao pyproject.toml**

Em `services/api-server/pyproject.toml`, adicionar ao array `dependencies`:

```toml
    "python-socketio[asyncio]>=5.12.0",
    "PyJWT[crypto]>=2.10.0",
```

- [ ] **Step 2: Instalar dependencias**

Run: `cd services/api-server && pip install -e ".[dev]"`

- [ ] **Step 3: Registrar middleware no main.py**

Em `services/api-server/app/main.py`, na funcao `create_app()`, apos criar o app e antes de include_router, adicionar:

```python
    from app.auth.middleware import AuthMiddleware
    app.add_middleware(AuthMiddleware)
```

O main.py completo deve ficar:

```python
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
    app = FastAPI(
        title="Studio Composicao Visual API",
        version="0.1.0",
        lifespan=lifespan,
    )

    from app.auth.middleware import AuthMiddleware
    app.add_middleware(AuthMiddleware)

    from app.core.router import router as core_router
    from app.catalog.router import router as catalog_router
    from app.gateway.router import router as gateway_router
    from app.orchestrator.router import router as orchestrator_router

    app.include_router(core_router, prefix="/v1")
    app.include_router(catalog_router, prefix="/v1/catalog")
    app.include_router(gateway_router, prefix="/v1")
    app.include_router(orchestrator_router, prefix="/v1")

    return app


app = create_app()
```

- [ ] **Step 4: Rodar todos os testes existentes**

Run: `cd services/api-server && python -m pytest -v --tb=short`
Expected: todos passam (auth_enabled=False por padrao, middleware e transparente)

- [ ] **Step 5: Commit**

```bash
git add services/api-server/pyproject.toml services/api-server/app/main.py
git commit -m "feat: register auth middleware and add python-socketio + PyJWT deps"
```

---

## Task 5: Socket.IO manager

**Files:**
- Create: `services/api-server/app/realtime/__init__.py`
- Create: `services/api-server/app/realtime/manager.py`
- Create: `services/api-server/app/realtime/events.py`

- [ ] **Step 1: Criar realtime/__init__.py vazio**

- [ ] **Step 2: Criar events.py**

```python
from dataclasses import dataclass, asdict
from typing import Any


@dataclass
class NewMessageEvent:
    conversation_id: str
    message: dict

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class JobUpdatedEvent:
    job_id: str
    status: str
    conversation_id: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ConversationUpdatedEvent:
    conversation_id: str
    state: str
    handled_by: str
    operator_id: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)
```

- [ ] **Step 3: Criar manager.py**

```python
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
```

- [ ] **Step 4: Commit**

```bash
git add services/api-server/app/realtime/
git commit -m "feat: Socket.IO manager with tenant rooms and JWT auth on connect"
```

---

## Task 6: Montar Socket.IO no FastAPI app

**Files:**
- Modify: `services/api-server/app/main.py`

- [ ] **Step 1: Montar Socket.IO ASGI app**

Em `services/api-server/app/main.py`, apos criar o `app` FastAPI e registrar routers, montar o Socket.IO. O main.py completo deve ficar:

```python
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
```

Note: `app` e renomeado para `fastapi_app` dentro de `create_app`, mas a variavel global continua `app = create_app()`.

- [ ] **Step 2: Rodar testes existentes**

Run: `cd services/api-server && python -m pytest -v --tb=short`
Expected: todos passam

- [ ] **Step 3: Commit**

```bash
git add services/api-server/app/main.py
git commit -m "feat: mount Socket.IO ASGI app on FastAPI"
```

---

## Task 7: Emitir eventos no conversation handler

**Files:**
- Modify: `services/api-server/app/orchestrator/conversation_handler.py`

- [ ] **Step 1: Adicionar emissao de new_message apos processar inbound**

No final da funcao `handle_inbound`, apos o bloco `# 12. Send reply`, e antes do `return`, adicionar:

```python
    # 13. Emit realtime events
    try:
        from app.realtime.manager import emit_to_tenant
        from app.realtime.events import NewMessageEvent, ConversationUpdatedEvent

        # Emit inbound message
        await emit_to_tenant(tenant_id, "new_message", NewMessageEvent(
            conversation_id=conversation_id,
            message={"direction": "inbound", "content": content, "content_type": content_type},
        ).to_dict())

        # Emit outbound reply if sent
        if reply_text:
            await emit_to_tenant(tenant_id, "new_message", NewMessageEvent(
                conversation_id=conversation_id,
                message={"direction": "outbound", "content": reply_text, "content_type": "text"},
            ).to_dict())

        # Emit conversation state change
        if transition:
            await emit_to_tenant(tenant_id, "conversation_updated", ConversationUpdatedEvent(
                conversation_id=conversation_id,
                state=transition.next_state,
                handled_by=conversation["handled_by"],
            ).to_dict())
    except Exception as e:
        logger.warning("Failed to emit realtime events: %s", e)
```

- [ ] **Step 2: Rodar testes existentes**

Run: `cd services/api-server && python -m pytest tests/test_webhook_flow.py -v`
Expected: todos passam (emit_to_tenant nao falha se ninguem esta conectado)

- [ ] **Step 3: Commit**

```bash
git add services/api-server/app/orchestrator/conversation_handler.py
git commit -m "feat: emit Socket.IO events on inbound message processing"
```

---

## Task 8: Emitir eventos no job-completed

**Files:**
- Modify: `services/api-server/app/orchestrator/router.py`

- [ ] **Step 1: Adicionar emissao de job_updated e conversation_updated**

No endpoint `job_completed`, apos o `return` de cada branch (`done` e `failed`), adicionar emissao antes do return. O endpoint completo:

No branch `done`, antes do `return {"status": "sent", ...}`:

```python
        # 8. Emit realtime events
        try:
            from app.realtime.manager import emit_to_tenant
            from app.realtime.events import JobUpdatedEvent, ConversationUpdatedEvent

            await emit_to_tenant(tenant_id, "job_updated", JobUpdatedEvent(
                job_id=job_id, status="done", conversation_id=conversation_id,
            ).to_dict())
            await emit_to_tenant(tenant_id, "conversation_updated", ConversationUpdatedEvent(
                conversation_id=conversation_id, state="completed", handled_by="ai",
            ).to_dict())
        except Exception as e:
            logger.warning("Failed to emit realtime events: %s", e)
```

No branch `failed`, antes do `return {"status": "failure_notified", ...}`:

```python
        try:
            from app.realtime.manager import emit_to_tenant
            from app.realtime.events import JobUpdatedEvent, ConversationUpdatedEvent

            await emit_to_tenant(tenant_id, "job_updated", JobUpdatedEvent(
                job_id=job_id, status="failed", conversation_id=conversation_id,
            ).to_dict())
            await emit_to_tenant(tenant_id, "conversation_updated", ConversationUpdatedEvent(
                conversation_id=conversation_id, state="completed", handled_by="ai",
            ).to_dict())
        except Exception as e:
            logger.warning("Failed to emit realtime events: %s", e)
```

- [ ] **Step 2: Rodar testes**

Run: `cd services/api-server && python -m pytest tests/test_job_completed.py -v`
Expected: 2 tests PASSED

- [ ] **Step 3: Commit**

```bash
git add services/api-server/app/orchestrator/router.py
git commit -m "feat: emit Socket.IO events on job completion"
```

---

## Task 9: Takeover endpoints + operador envia mensagem

**Files:**
- Create: `services/api-server/app/realtime/router.py`
- Modify: `services/api-server/app/main.py`
- Create: `services/api-server/tests/test_takeover.py`

- [ ] **Step 1: Criar realtime/router.py**

```python
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core import repository as repo
from app.channel import sender
from app.billing import tracker

logger = logging.getLogger(__name__)

router = APIRouter(tags=["realtime"])


class OperatorMessageCreate(BaseModel):
    text: str


@router.post("/conversations/{conversation_id}/takeover")
async def takeover_conversation(conversation_id: str):
    conversation = await repo.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # For now, operator_id is None (will come from JWT when auth_enabled)
    await repo.update_conversation_handled_by(conversation_id, "operator", operator_id=None)

    try:
        from app.realtime.manager import emit_to_tenant
        from app.realtime.events import ConversationUpdatedEvent

        tenant_id = str(conversation["tenant_id"])
        await emit_to_tenant(tenant_id, "conversation_updated", ConversationUpdatedEvent(
            conversation_id=conversation_id,
            state=conversation["state"],
            handled_by="operator",
        ).to_dict())
    except Exception as e:
        logger.warning("Failed to emit takeover event: %s", e)

    return {"status": "takeover", "conversation_id": conversation_id, "handled_by": "operator"}


@router.post("/conversations/{conversation_id}/release")
async def release_conversation(conversation_id: str):
    conversation = await repo.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await repo.update_conversation_handled_by(conversation_id, "ai", operator_id=None)

    try:
        from app.realtime.manager import emit_to_tenant
        from app.realtime.events import ConversationUpdatedEvent

        tenant_id = str(conversation["tenant_id"])
        await emit_to_tenant(tenant_id, "conversation_updated", ConversationUpdatedEvent(
            conversation_id=conversation_id,
            state=conversation["state"],
            handled_by="ai",
        ).to_dict())
    except Exception as e:
        logger.warning("Failed to emit release event: %s", e)

    return {"status": "released", "conversation_id": conversation_id, "handled_by": "ai"}


@router.post("/conversations/{conversation_id}/messages")
async def operator_send_message(conversation_id: str, body: OperatorMessageCreate):
    conversation = await repo.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    tenant_id = str(conversation["tenant_id"])
    channel = await repo.get_channel_by_id(str(conversation["channel_id"]))
    contact = await repo.get_contact_by_id(str(conversation["contact_id"]))
    if not channel or not contact:
        raise HTTPException(status_code=404, detail="Channel or contact not found")

    provider = channel["provider"]
    session_id = channel["external_session_id"]
    remote_jid = contact["external_contact_id"]

    # Send via WhatsApp
    await sender.send_text(provider, session_id, remote_jid, body.text)

    # Persist message
    msg = await repo.create_message(
        tenant_id, conversation_id, "outbound", "operator", body.text, "text", None,
    )

    # Track billing
    await tracker.track_message_sent(tenant_id, conversation_id, provider)

    # Emit realtime event
    try:
        from app.realtime.manager import emit_to_tenant
        from app.realtime.events import NewMessageEvent

        await emit_to_tenant(tenant_id, "new_message", NewMessageEvent(
            conversation_id=conversation_id,
            message={"direction": "outbound", "content": body.text, "content_type": "text", "role": "operator"},
        ).to_dict())
    except Exception as e:
        logger.warning("Failed to emit operator message event: %s", e)

    return {"status": "sent", "conversation_id": conversation_id}
```

- [ ] **Step 2: Registrar router no main.py**

Em `services/api-server/app/main.py`, dentro de `create_app()`, adicionar:

```python
    from app.realtime.router import router as realtime_router
    fastapi_app.include_router(realtime_router, prefix="/v1")
```

- [ ] **Step 3: Escrever testes**

`services/api-server/tests/test_takeover.py`:
```python
import pytest
import respx
from httpx import Response


@pytest.fixture
async def seeded_conversation(client):
    # Tenant
    t = await client.post("/v1/tenants", json={
        "name": "Takeover Corp", "slug": "takeover-corp", "plan_code": "starter",
    })
    tenant = t.json()
    tid = tenant["id"]

    # Channel
    ch = await client.post(f"/v1/tenants/{tid}/channels", json={
        "channel_type": "whatsapp", "provider": "uazapi",
        "external_session_id": "session-takeover",
    })
    channel = ch.json()

    from app.db import get_conn
    async with get_conn() as conn:
        await conn.execute(
            "UPDATE tenant_channels SET status = 'connected' WHERE id = %s",
            (channel["id"],),
        )

    # Contact
    ct = await client.post("/v1/contacts", json={
        "tenant_id": tid, "external_contact_id": "5511888880000@s.whatsapp.net",
        "display_name": "Cliente Takeover",
    })
    contact = ct.json()

    # Conversation
    cv = await client.post("/v1/conversations", json={
        "tenant_id": tid, "channel_id": channel["id"], "contact_id": contact["id"],
    })
    conversation = cv.json()

    return {"tenant": tenant, "channel": channel, "contact": contact, "conversation": conversation}


@pytest.mark.anyio
async def test_takeover_conversation(client, seeded_conversation):
    cid = seeded_conversation["conversation"]["id"]

    resp = await client.post(f"/v1/conversations/{cid}/takeover")
    assert resp.status_code == 200
    assert resp.json()["handled_by"] == "operator"

    # Verify conversation state
    conv = await client.get(f"/v1/conversations/{cid}")
    assert conv.json()["handled_by"] == "operator"


@pytest.mark.anyio
async def test_release_conversation(client, seeded_conversation):
    cid = seeded_conversation["conversation"]["id"]

    # First takeover
    await client.post(f"/v1/conversations/{cid}/takeover")

    # Then release
    resp = await client.post(f"/v1/conversations/{cid}/release")
    assert resp.status_code == 200
    assert resp.json()["handled_by"] == "ai"


@pytest.mark.anyio
@respx.mock
async def test_operator_send_message(client, seeded_conversation):
    cid = seeded_conversation["conversation"]["id"]

    respx.post("http://localhost:8080/message/sendText/session-takeover").mock(
        return_value=Response(200, json={"status": "sent"})
    )

    resp = await client.post(f"/v1/conversations/{cid}/messages", json={"text": "Ola, sou o operador!"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "sent"


@pytest.mark.anyio
async def test_takeover_not_found(client):
    resp = await client.post("/v1/conversations/00000000-0000-0000-0000-000000000000/takeover")
    assert resp.status_code == 404
```

- [ ] **Step 4: Rodar testes**

Run: `cd services/api-server && python -m pytest tests/test_takeover.py -v`
Expected: 4 tests PASSED

- [ ] **Step 5: Commit**

```bash
git add services/api-server/app/realtime/router.py services/api-server/app/main.py services/api-server/tests/test_takeover.py
git commit -m "feat: takeover/release endpoints and operator message sending"
```

---

## Task 10: Rodar suite completa e verificacao final

- [ ] **Step 1: Rodar todos os testes do api-server**

Run: `cd services/api-server && python -m pytest -v --tb=short`
Expected: todos os testes PASSED

- [ ] **Step 2: Verificar rotas registradas**

Run: `cd services/api-server && python -c "from app.main import create_app; app = create_app(); [print(f'  {getattr(r, \"methods\", set())} {r.path}') for r in app.routes if hasattr(r, 'path')]"`
Expected: rotas `/v1/conversations/{conversation_id}/takeover`, `/v1/conversations/{conversation_id}/release`, `/v1/conversations/{conversation_id}/messages` e mount `/socket.io` presentes

- [ ] **Step 3: Commit final se necessario**

```bash
git add -A
git commit -m "fix: adjustments from full test suite run"
```

---

## Self-Review Checklist

**Spec coverage:**
- [ ] Zitadel no docker-compose
- [ ] Auth schemas (AuthUser com roles)
- [ ] Auth middleware (JWT/JWKS do Zitadel)
- [ ] Auth dependencies (get_current_user, require_role, require_superadmin)
- [ ] Config settings (zitadel_issuer_url, zitadel_project_id, auth_enabled)
- [ ] Socket.IO manager com rooms por tenant
- [ ] Socket.IO eventos (new_message, job_updated, conversation_updated)
- [ ] Socket.IO montado no FastAPI
- [ ] Emissao de eventos no conversation_handler
- [ ] Emissao de eventos no job-completed
- [ ] Takeover/release endpoints
- [ ] Operador envia mensagem via REST
- [ ] Testes unitarios e integracao
