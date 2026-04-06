# Fase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestruturar o monorepo, criar schema PostgreSQL completo, scaffoldar api-server com CRUD operacional e catalogo, atualizar contratos TypeScript e scaffoldar composition-worker.

**Architecture:** Backend consolidado em 2 servicos Python (api-server + composition-worker). PostgreSQL como banco unico. MinIO para storage. Docker Compose para dev local. api-server usa FastAPI com modulos separados por dominio, cada um com router/schemas/repository.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, pydantic-settings, psycopg 3 (async), MinIO Python SDK, Docker Compose, pytest, httpx (test client)

---

## File Structure

### Novos arquivos

```
docker-compose.yml                              # PostgreSQL + MinIO para dev local
services/api-server/
├── pyproject.toml
├── Dockerfile
├── app/
│   ├── __init__.py
│   ├── main.py                                  # FastAPI app factory
│   ├── config.py                                # Settings via pydantic-settings
│   ├── db.py                                    # Pool psycopg async, lifespan
│   ├── core/
│   │   ├── __init__.py
│   │   ├── router.py                            # Rotas CRUD: tenants, domains, channels, contacts, conversations, messages, assets
│   │   ├── schemas.py                           # Request/response models Pydantic
│   │   └── repository.py                        # Queries SQL
│   └── catalog/
│       ├── __init__.py
│       ├── router.py                            # Rotas CRUD: categories, items, item_images
│       ├── schemas.py
│       └── repository.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py                              # Fixtures: test client, test db
│   ├── test_health.py
│   ├── test_tenants.py
│   ├── test_core.py
│   └── test_catalog.py

services/composition-worker/
├── pyproject.toml
├── Dockerfile
├── worker/
│   ├── __init__.py
│   ├── main.py
│   └── config.py

db/
├── schema.sql                                   # Schema completo atualizado
└── seed.sql                                     # Dados de teste
```

### Arquivos modificados

```
packages/contracts/src/index.ts                  # Tipos atualizados
package.json                                     # Scripts atualizados
pnpm-workspace.yaml                              # Sem alteracao
```

### Arquivos removidos

```
services/api/                                    # Substituido por api-server
services/channel-gateway/                        # Absorvido pelo api-server
services/orchestrator/                           # Absorvido pelo api-server
services/composition/                            # Substituido por composition-worker
services/billing-metering/                       # Absorvido pelo api-server
```

---

## Task 1: Docker Compose para dev local

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Criar docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: studio
      POSTGRES_PASSWORD: studio_dev
      POSTGRES_DB: studio_app
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U studio"]
      interval: 5s
      timeout: 3s
      retries: 5

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data

volumes:
  pgdata:
  miniodata:
```

- [ ] **Step 2: Verificar que sobe**

Run: `docker compose up -d`
Expected: ambos containers rodando sem erro

Run: `docker compose ps`
Expected: postgres e minio com status "running" ou "healthy"

- [ ] **Step 3: Commit**

```bash
git init
git add docker-compose.yml
git commit -m "infra: add docker-compose with PostgreSQL 16 and MinIO"
```

---

## Task 2: Schema PostgreSQL completo

**Files:**
- Create: `db/schema.sql`
- Create: `db/seed.sql`
- Remove: `services/api/db/schema.sql`

- [ ] **Step 1: Criar db/schema.sql**

```sql
create extension if not exists "pgcrypto";

-- Tenants

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'suspended', 'archived')),
  plan_code text not null,
  created_at timestamptz not null default now()
);

create table if not exists tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  hostname text not null unique,
  is_primary boolean not null default false,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'verified', 'failed', 'disabled')),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists tenant_channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  channel_type text not null check (channel_type in ('whatsapp', 'instagram')),
  provider text not null check (provider in ('uazapi', 'wuzapi')),
  external_session_id text not null,
  webhook_secret text,
  status text not null default 'pending'
    check (status in ('pending', 'connected', 'disconnected', 'error')),
  created_at timestamptz not null default now()
);

create table if not exists llm_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null default 'openrouter',
  default_model text not null,
  fallback_model text,
  system_prompt text not null,
  guardrail_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Contacts & Conversations

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  external_contact_id text not null,
  display_name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create unique index if not exists contacts_tenant_external_idx
  on contacts (tenant_id, external_contact_id);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  channel_id uuid not null references tenant_channels(id) on delete restrict,
  contact_id uuid not null references contacts(id) on delete restrict,
  status text not null default 'open'
    check (status in ('open', 'waiting_customer', 'waiting_operator', 'closed')),
  state text not null default 'idle'
    check (state in ('idle', 'awaiting_base_image', 'collecting_preferences',
                     'showing_options', 'awaiting_selection', 'composing', 'completed')),
  handled_by text not null default 'ai' check (handled_by in ('ai', 'operator')),
  operator_id uuid,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  role text not null check (role in ('customer', 'assistant', 'operator', 'system')),
  content text not null,
  content_type text not null default 'text'
    check (content_type in ('text', 'image', 'catalog_options', 'composition_result')),
  provider_message_id text,
  created_at timestamptz not null default now()
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  role text not null
    check (role in ('reference', 'base_image', 'overlay', 'mask', 'render', 'attachment', 'catalog')),
  mime_type text not null,
  storage_key text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Catalog

create table if not exists catalog_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  parent_id uuid references catalog_categories(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, name, parent_id)
);

create table if not exists catalog_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  category_id uuid not null references catalog_categories(id) on delete restrict,
  name text not null,
  description text not null default '',
  sku text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  tags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists catalog_item_images (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  catalog_item_id uuid not null references catalog_items(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete restrict,
  role text not null default 'primary'
    check (role in ('primary', 'swatch', 'applied_example')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Composition Jobs & Renders

create table if not exists composition_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  mode text not null check (mode in ('interior', 'product', 'print', 'fashion')),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'done', 'failed')),
  catalog_item_id uuid references catalog_items(id) on delete set null,
  base_asset_id uuid not null references assets(id) on delete restrict,
  overlay_asset_id uuid references assets(id) on delete restrict,
  mask_asset_id uuid references assets(id) on delete restrict,
  input_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists renders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_id uuid not null references composition_jobs(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete restrict,
  version integer not null default 1,
  created_at timestamptz not null default now()
);

-- Usage / Billing

create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null,
  provider text not null,
  reference_id text,
  quantity numeric(18, 4) not null,
  unit_cost numeric(18, 8) not null default 0,
  total_cost numeric(18, 8) not null default 0,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Criar db/seed.sql com dados de teste**

```sql
insert into tenants (id, name, slug, status, plan_code)
values (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Loja Revestimentos Demo',
  'loja-revestimentos',
  'active',
  'starter'
) on conflict (slug) do nothing;

insert into tenant_channels (id, tenant_id, channel_type, provider, external_session_id, status)
values (
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'whatsapp',
  'uazapi',
  'session-demo-001',
  'connected'
) on conflict do nothing;

insert into contacts (id, tenant_id, external_contact_id, display_name, phone)
values (
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '5511999990000@s.whatsapp.net',
  'Cliente Teste',
  '+5511999990000'
) on conflict do nothing;

insert into catalog_categories (id, tenant_id, name, sort_order)
values (
  'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Revestimentos',
  1
) on conflict do nothing;

insert into catalog_items (id, tenant_id, category_id, name, description, tags)
values (
  'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
  'Porcelanato Carrara 60x60',
  'Porcelanato polido inspirado em marmore de Carrara',
  '{"cor": "claro", "material": "porcelanato", "estilo": "classico", "marca": "Portinari", "dimensao": "60x60"}'
) on conflict do nothing;
```

- [ ] **Step 3: Recriar containers para aplicar schema**

Run: `docker compose down -v && docker compose up -d`
Expected: containers reiniciam, schema aplicado automaticamente (initdb.d)

Run: `docker compose exec postgres psql -U studio -d studio_app -c "\dt"`
Expected: lista todas as tabelas criadas

- [ ] **Step 4: Commit**

```bash
mkdir -p db
git add db/schema.sql db/seed.sql
git rm -r --cached services/api/db/ 2>/dev/null || true
git commit -m "db: complete PostgreSQL schema with catalog, state machine, and usage tables"
```

---

## Task 3: api-server scaffold

**Files:**
- Create: `services/api-server/pyproject.toml`
- Create: `services/api-server/app/__init__.py`
- Create: `services/api-server/app/config.py`
- Create: `services/api-server/app/db.py`
- Create: `services/api-server/app/main.py`
- Create: `services/api-server/tests/__init__.py`
- Create: `services/api-server/tests/conftest.py`
- Create: `services/api-server/tests/test_health.py`

- [ ] **Step 1: Criar pyproject.toml**

```toml
[project]
name = "studio-api-server"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "pydantic>=2.10.0",
    "pydantic-settings>=2.7.0",
    "psycopg[binary,pool]>=3.2.0",
    "minio>=7.2.0",
    "python-multipart>=0.0.18",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3.0",
    "pytest-asyncio>=0.24.0",
    "httpx>=0.28.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 2: Criar app/config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://studio:studio_dev@localhost:5432/studio_app"
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_secure: bool = False
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4.1-mini"
    openrouter_image_model: str = "google/gemini-3-pro-image-preview"

    model_config = {"env_prefix": "", "env_file": ".env"}


settings = Settings()
```

- [ ] **Step 3: Criar app/db.py**

```python
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from app.config import settings

pool: AsyncConnectionPool | None = None


async def open_pool() -> None:
    global pool
    pool = AsyncConnectionPool(
        conninfo=settings.database_url,
        min_size=2,
        max_size=10,
        kwargs={"row_factory": dict_row},
    )
    await pool.open()


async def close_pool() -> None:
    global pool
    if pool:
        await pool.close()
        pool = None


@asynccontextmanager
async def get_conn() -> AsyncGenerator[psycopg.AsyncConnection, None]:
    assert pool is not None, "Database pool not initialized"
    async with pool.connection() as conn:
        yield conn
```

- [ ] **Step 4: Criar app/main.py**

```python
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

    app.include_router(core_router, prefix="/v1")
    app.include_router(catalog_router, prefix="/v1/catalog")

    return app


app = create_app()
```

- [ ] **Step 5: Criar app/__init__.py vazio e stubs de modulos**

Criar arquivos vazios:
- `services/api-server/app/__init__.py`
- `services/api-server/app/core/__init__.py`
- `services/api-server/app/catalog/__init__.py`

Criar stubs temporarios para os routers (para o app iniciar):

`services/api-server/app/core/router.py`:
```python
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}
```

`services/api-server/app/catalog/router.py`:
```python
from fastapi import APIRouter

router = APIRouter(tags=["catalog"])
```

- [ ] **Step 6: Criar tests/conftest.py**

```python
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
```

Criar `services/api-server/tests/__init__.py` vazio.

- [ ] **Step 7: Criar tests/test_health.py**

```python
import pytest


@pytest.mark.anyio
async def test_health_returns_ok(client):
    response = await client.get("/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 8: Instalar dependencias e rodar teste**

Run: `cd services/api-server && pip install -e ".[dev]"`
Expected: instalacao sem erro

Run: `cd services/api-server && pytest tests/test_health.py -v`
Expected: 1 test PASSED

- [ ] **Step 9: Commit**

```bash
git add services/api-server/
git commit -m "feat: scaffold api-server with FastAPI, psycopg3, config and health endpoint"
```

---

## Task 4: Core module — Tenant CRUD

**Files:**
- Create: `services/api-server/app/core/schemas.py`
- Create: `services/api-server/app/core/repository.py`
- Modify: `services/api-server/app/core/router.py`
- Create: `services/api-server/tests/test_tenants.py`

- [ ] **Step 1: Escrever o teste**

`services/api-server/tests/test_tenants.py`:
```python
import pytest


@pytest.mark.anyio
async def test_create_tenant(client):
    response = await client.post("/v1/tenants", json={
        "name": "Loja Teste",
        "slug": "loja-teste",
        "plan_code": "starter",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Loja Teste"
    assert data["slug"] == "loja-teste"
    assert data["status"] == "draft"
    assert "id" in data


@pytest.mark.anyio
async def test_list_tenants(client):
    await client.post("/v1/tenants", json={
        "name": "Loja A",
        "slug": "loja-a",
        "plan_code": "starter",
    })
    response = await client.get("/v1/tenants")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


@pytest.mark.anyio
async def test_get_tenant(client):
    create = await client.post("/v1/tenants", json={
        "name": "Loja B",
        "slug": "loja-b",
        "plan_code": "starter",
    })
    tenant_id = create.json()["id"]
    response = await client.get(f"/v1/tenants/{tenant_id}")
    assert response.status_code == 200
    assert response.json()["id"] == tenant_id


@pytest.mark.anyio
async def test_get_tenant_not_found(client):
    response = await client.get("/v1/tenants/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
```

- [ ] **Step 2: Rodar teste para verificar que falha**

Run: `cd services/api-server && pytest tests/test_tenants.py -v`
Expected: FAIL (rotas nao existem, 404 ou 405)

- [ ] **Step 3: Criar schemas**

`services/api-server/app/core/schemas.py`:
```python
from pydantic import BaseModel, Field


class TenantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    plan_code: str = Field(min_length=1, max_length=50)


class TenantResponse(BaseModel):
    id: str
    name: str
    slug: str
    status: str
    plan_code: str


class TenantDomainCreate(BaseModel):
    hostname: str = Field(min_length=1, max_length=255)
    is_primary: bool = False


class TenantDomainResponse(BaseModel):
    id: str
    tenant_id: str
    hostname: str
    is_primary: bool
    status: str


class TenantChannelCreate(BaseModel):
    channel_type: str = Field(pattern=r"^(whatsapp|instagram)$")
    provider: str = Field(pattern=r"^(uazapi|wuzapi)$")
    external_session_id: str = Field(min_length=1)
    webhook_secret: str | None = None


class TenantChannelResponse(BaseModel):
    id: str
    tenant_id: str
    channel_type: str
    provider: str
    external_session_id: str
    status: str


class ContactCreate(BaseModel):
    tenant_id: str
    external_contact_id: str = Field(min_length=1)
    display_name: str = Field(min_length=1, max_length=200)
    phone: str | None = None


class ContactResponse(BaseModel):
    id: str
    tenant_id: str
    external_contact_id: str
    display_name: str
    phone: str | None


class ConversationCreate(BaseModel):
    tenant_id: str
    channel_id: str
    contact_id: str


class ConversationResponse(BaseModel):
    id: str
    tenant_id: str
    channel_id: str
    contact_id: str
    status: str
    state: str
    handled_by: str
    operator_id: str | None


class MessageCreate(BaseModel):
    tenant_id: str
    conversation_id: str
    direction: str = Field(pattern=r"^(inbound|outbound)$")
    role: str = Field(pattern=r"^(customer|assistant|operator|system)$")
    content: str = Field(min_length=1)
    content_type: str = "text"
    provider_message_id: str | None = None


class MessageResponse(BaseModel):
    id: str
    tenant_id: str
    conversation_id: str
    direction: str
    role: str
    content: str
    content_type: str
    provider_message_id: str | None


class AssetCreate(BaseModel):
    tenant_id: str
    conversation_id: str | None = None
    role: str
    mime_type: str
    storage_key: str
    metadata_json: dict = {}


class AssetResponse(BaseModel):
    id: str
    tenant_id: str
    conversation_id: str | None
    role: str
    mime_type: str
    storage_key: str
    metadata_json: dict
```

- [ ] **Step 4: Criar repository**

`services/api-server/app/core/repository.py`:
```python
from app.db import get_conn


async def create_tenant(name: str, slug: str, plan_code: str) -> dict:
    async with get_conn() as conn:
        row = await conn.execute(
            """
            insert into tenants (name, slug, plan_code)
            values (%s, %s, %s)
            returning id, name, slug, status, plan_code
            """,
            (name, slug, plan_code),
        )
        return await row.fetchone()


async def list_tenants() -> list[dict]:
    async with get_conn() as conn:
        cur = await conn.execute("select id, name, slug, status, plan_code from tenants order by created_at")
        return await cur.fetchall()


async def get_tenant(tenant_id: str) -> dict | None:
    async with get_conn() as conn:
        cur = await conn.execute(
            "select id, name, slug, status, plan_code from tenants where id = %s",
            (tenant_id,),
        )
        return await cur.fetchone()


async def create_tenant_domain(tenant_id: str, hostname: str, is_primary: bool) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """
            insert into tenant_domains (tenant_id, hostname, is_primary)
            values (%s, %s, %s)
            returning id, tenant_id, hostname, is_primary, status
            """,
            (tenant_id, hostname, is_primary),
        )
        return await cur.fetchone()


async def create_tenant_channel(
    tenant_id: str, channel_type: str, provider: str,
    external_session_id: str, webhook_secret: str | None,
) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """
            insert into tenant_channels (tenant_id, channel_type, provider, external_session_id, webhook_secret)
            values (%s, %s, %s, %s, %s)
            returning id, tenant_id, channel_type, provider, external_session_id, status
            """,
            (tenant_id, channel_type, provider, external_session_id, webhook_secret),
        )
        return await cur.fetchone()


async def create_contact(
    tenant_id: str, external_contact_id: str, display_name: str, phone: str | None,
) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """
            insert into contacts (tenant_id, external_contact_id, display_name, phone)
            values (%s, %s, %s, %s)
            returning id, tenant_id, external_contact_id, display_name, phone
            """,
            (tenant_id, external_contact_id, display_name, phone),
        )
        return await cur.fetchone()


async def get_contact(contact_id: str) -> dict | None:
    async with get_conn() as conn:
        cur = await conn.execute(
            "select id, tenant_id, external_contact_id, display_name, phone from contacts where id = %s",
            (contact_id,),
        )
        return await cur.fetchone()


async def create_conversation(tenant_id: str, channel_id: str, contact_id: str) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """
            insert into conversations (tenant_id, channel_id, contact_id)
            values (%s, %s, %s)
            returning id, tenant_id, channel_id, contact_id, status, state, handled_by, operator_id
            """,
            (tenant_id, channel_id, contact_id),
        )
        return await cur.fetchone()


async def get_conversation(conversation_id: str) -> dict | None:
    async with get_conn() as conn:
        cur = await conn.execute(
            """
            select id, tenant_id, channel_id, contact_id, status, state, handled_by, operator_id
            from conversations where id = %s
            """,
            (conversation_id,),
        )
        return await cur.fetchone()


async def create_message(
    tenant_id: str, conversation_id: str, direction: str,
    role: str, content: str, content_type: str, provider_message_id: str | None,
) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """
            insert into messages (tenant_id, conversation_id, direction, role, content, content_type, provider_message_id)
            values (%s, %s, %s, %s, %s, %s, %s)
            returning id, tenant_id, conversation_id, direction, role, content, content_type, provider_message_id
            """,
            (tenant_id, conversation_id, direction, role, content, content_type, provider_message_id),
        )
        return await cur.fetchone()


async def create_asset(
    tenant_id: str, conversation_id: str | None, role: str,
    mime_type: str, storage_key: str, metadata_json: dict,
) -> dict:
    async with get_conn() as conn:
        import json
        cur = await conn.execute(
            """
            insert into assets (tenant_id, conversation_id, role, mime_type, storage_key, metadata_json)
            values (%s, %s, %s, %s, %s, %s)
            returning id, tenant_id, conversation_id, role, mime_type, storage_key, metadata_json
            """,
            (tenant_id, conversation_id, role, mime_type, storage_key, json.dumps(metadata_json)),
        )
        return await cur.fetchone()


async def get_asset(asset_id: str) -> dict | None:
    async with get_conn() as conn:
        cur = await conn.execute(
            "select id, tenant_id, conversation_id, role, mime_type, storage_key, metadata_json from assets where id = %s",
            (asset_id,),
        )
        return await cur.fetchone()
```

- [ ] **Step 5: Atualizar router com rotas de tenant**

`services/api-server/app/core/router.py`:
```python
from fastapi import APIRouter, HTTPException, status

from app.core import repository as repo
from app.core.schemas import (
    AssetCreate, AssetResponse,
    ContactCreate, ContactResponse,
    ConversationCreate, ConversationResponse,
    MessageCreate, MessageResponse,
    TenantChannelCreate, TenantChannelResponse,
    TenantCreate, TenantDomainCreate, TenantDomainResponse,
    TenantResponse,
)

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}


# --- Tenants ---

@router.post("/tenants", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(payload: TenantCreate):
    row = await repo.create_tenant(payload.name, payload.slug, payload.plan_code)
    return TenantResponse(**_str_keys(row))


@router.get("/tenants", response_model=list[TenantResponse])
async def list_tenants():
    rows = await repo.list_tenants()
    return [TenantResponse(**_str_keys(r)) for r in rows]


@router.get("/tenants/{tenant_id}", response_model=TenantResponse)
async def get_tenant(tenant_id: str):
    row = await repo.get_tenant(tenant_id)
    if not row:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return TenantResponse(**_str_keys(row))


# --- Tenant Domains ---

@router.post(
    "/tenants/{tenant_id}/domains",
    response_model=TenantDomainResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_tenant_domain(tenant_id: str, payload: TenantDomainCreate):
    tenant = await repo.get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    row = await repo.create_tenant_domain(tenant_id, payload.hostname, payload.is_primary)
    return TenantDomainResponse(**_str_keys(row))


# --- Tenant Channels ---

@router.post(
    "/tenants/{tenant_id}/channels",
    response_model=TenantChannelResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_tenant_channel(tenant_id: str, payload: TenantChannelCreate):
    tenant = await repo.get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    row = await repo.create_tenant_channel(
        tenant_id, payload.channel_type, payload.provider,
        payload.external_session_id, payload.webhook_secret,
    )
    return TenantChannelResponse(**_str_keys(row))


# --- Contacts ---

@router.post("/contacts", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(payload: ContactCreate):
    tenant = await repo.get_tenant(payload.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    row = await repo.create_contact(
        payload.tenant_id, payload.external_contact_id, payload.display_name, payload.phone,
    )
    return ContactResponse(**_str_keys(row))


# --- Conversations ---

@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(payload: ConversationCreate):
    row = await repo.create_conversation(payload.tenant_id, payload.channel_id, payload.contact_id)
    return ConversationResponse(**_str_keys(row))


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str):
    row = await repo.get_conversation(conversation_id)
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ConversationResponse(**_str_keys(row))


# --- Messages ---

@router.post("/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_message(payload: MessageCreate):
    row = await repo.create_message(
        payload.tenant_id, payload.conversation_id, payload.direction,
        payload.role, payload.content, payload.content_type, payload.provider_message_id,
    )
    return MessageResponse(**_str_keys(row))


# --- Assets ---

@router.post("/assets", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
async def create_asset(payload: AssetCreate):
    row = await repo.create_asset(
        payload.tenant_id, payload.conversation_id, payload.role,
        payload.mime_type, payload.storage_key, payload.metadata_json,
    )
    return AssetResponse(**_str_keys(row))


def _str_keys(row: dict) -> dict:
    return {k: str(v) if hasattr(v, "hex") else v for k, v in row.items()}
```

- [ ] **Step 6: Atualizar conftest.py para conectar ao banco de teste**

`services/api-server/tests/conftest.py`:
```python
import pytest
from httpx import ASGITransport, AsyncClient

from app.db import get_conn, open_pool, close_pool
from app.main import create_app


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await _cleanup_test_data()


async def _cleanup_test_data():
    """Remove dados de teste ao final de cada test function."""
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
```

- [ ] **Step 7: Rodar testes de tenant**

Run: `cd services/api-server && pytest tests/test_tenants.py -v`
Expected: 4 tests PASSED

- [ ] **Step 8: Commit**

```bash
cd services/api-server
git add app/core/ tests/
git commit -m "feat: core module with tenant, domain, channel, contact, conversation, message, asset CRUD"
```

---

## Task 5: Core module — testes de entidades dependentes

**Files:**
- Create: `services/api-server/tests/test_core.py`

- [ ] **Step 1: Escrever testes para fluxo completo**

`services/api-server/tests/test_core.py`:
```python
import pytest


async def _create_tenant(client) -> dict:
    r = await client.post("/v1/tenants", json={
        "name": "Test Corp", "slug": "test-corp", "plan_code": "starter",
    })
    return r.json()


async def _create_channel(client, tenant_id: str) -> dict:
    r = await client.post(f"/v1/tenants/{tenant_id}/channels", json={
        "channel_type": "whatsapp", "provider": "uazapi", "external_session_id": "sess-001",
    })
    return r.json()


async def _create_contact(client, tenant_id: str) -> dict:
    r = await client.post("/v1/contacts", json={
        "tenant_id": tenant_id, "external_contact_id": "5511999990001@s.whatsapp.net",
        "display_name": "Joao", "phone": "+5511999990001",
    })
    return r.json()


@pytest.mark.anyio
async def test_create_domain(client):
    tenant = await _create_tenant(client)
    r = await client.post(f"/v1/tenants/{tenant['id']}/domains", json={
        "hostname": "test.example.com", "is_primary": True,
    })
    assert r.status_code == 201
    assert r.json()["hostname"] == "test.example.com"
    assert r.json()["status"] == "pending_verification"


@pytest.mark.anyio
async def test_create_channel(client):
    tenant = await _create_tenant(client)
    r = await client.post(f"/v1/tenants/{tenant['id']}/channels", json={
        "channel_type": "whatsapp", "provider": "uazapi", "external_session_id": "sess-002",
    })
    assert r.status_code == 201
    assert r.json()["channel_type"] == "whatsapp"
    assert r.json()["status"] == "pending"


@pytest.mark.anyio
async def test_create_contact(client):
    tenant = await _create_tenant(client)
    r = await client.post("/v1/contacts", json={
        "tenant_id": tenant["id"], "external_contact_id": "5511999990002@s.whatsapp.net",
        "display_name": "Maria", "phone": "+5511999990002",
    })
    assert r.status_code == 201
    assert r.json()["display_name"] == "Maria"


@pytest.mark.anyio
async def test_create_conversation(client):
    tenant = await _create_tenant(client)
    channel = await _create_channel(client, tenant["id"])
    contact = await _create_contact(client, tenant["id"])

    r = await client.post("/v1/conversations", json={
        "tenant_id": tenant["id"], "channel_id": channel["id"], "contact_id": contact["id"],
    })
    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "open"
    assert data["state"] == "idle"
    assert data["handled_by"] == "ai"


@pytest.mark.anyio
async def test_create_message(client):
    tenant = await _create_tenant(client)
    channel = await _create_channel(client, tenant["id"])
    contact = await _create_contact(client, tenant["id"])
    conv_r = await client.post("/v1/conversations", json={
        "tenant_id": tenant["id"], "channel_id": channel["id"], "contact_id": contact["id"],
    })
    conv = conv_r.json()

    r = await client.post("/v1/messages", json={
        "tenant_id": tenant["id"], "conversation_id": conv["id"],
        "direction": "inbound", "role": "customer", "content": "Oi, quero trocar o piso",
    })
    assert r.status_code == 201
    assert r.json()["content_type"] == "text"


@pytest.mark.anyio
async def test_create_asset(client):
    tenant = await _create_tenant(client)

    r = await client.post("/v1/assets", json={
        "tenant_id": tenant["id"], "role": "catalog",
        "mime_type": "image/jpeg", "storage_key": "tenants/test-corp/catalog/img.jpg",
    })
    assert r.status_code == 201
    assert r.json()["role"] == "catalog"
```

- [ ] **Step 2: Rodar testes**

Run: `cd services/api-server && pytest tests/test_core.py -v`
Expected: 6 tests PASSED

- [ ] **Step 3: Commit**

```bash
cd services/api-server
git add tests/test_core.py
git commit -m "test: integration tests for core entities (domain, channel, contact, conversation, message, asset)"
```

---

## Task 6: Catalog module

**Files:**
- Create: `services/api-server/app/catalog/schemas.py`
- Create: `services/api-server/app/catalog/repository.py`
- Modify: `services/api-server/app/catalog/router.py`
- Create: `services/api-server/tests/test_catalog.py`

- [ ] **Step 1: Escrever testes do catalogo**

`services/api-server/tests/test_catalog.py`:
```python
import pytest


async def _setup_tenant(client) -> str:
    r = await client.post("/v1/tenants", json={
        "name": "Catalog Corp", "slug": "catalog-corp", "plan_code": "starter",
    })
    return r.json()["id"]


@pytest.mark.anyio
async def test_create_category(client):
    tenant_id = await _setup_tenant(client)
    r = await client.post(f"/v1/catalog/categories", json={
        "tenant_id": tenant_id, "name": "Revestimentos", "sort_order": 1,
    })
    assert r.status_code == 201
    assert r.json()["name"] == "Revestimentos"


@pytest.mark.anyio
async def test_create_subcategory(client):
    tenant_id = await _setup_tenant(client)
    parent = await client.post("/v1/catalog/categories", json={
        "tenant_id": tenant_id, "name": "Pisos", "sort_order": 1,
    })
    parent_id = parent.json()["id"]
    r = await client.post("/v1/catalog/categories", json={
        "tenant_id": tenant_id, "name": "Porcelanato", "parent_id": parent_id, "sort_order": 1,
    })
    assert r.status_code == 201
    assert r.json()["parent_id"] == parent_id


@pytest.mark.anyio
async def test_list_categories(client):
    tenant_id = await _setup_tenant(client)
    await client.post("/v1/catalog/categories", json={
        "tenant_id": tenant_id, "name": "Tintas", "sort_order": 1,
    })
    r = await client.get(f"/v1/catalog/categories?tenant_id={tenant_id}")
    assert r.status_code == 200
    assert len(r.json()) >= 1


@pytest.mark.anyio
async def test_create_item(client):
    tenant_id = await _setup_tenant(client)
    cat = await client.post("/v1/catalog/categories", json={
        "tenant_id": tenant_id, "name": "Revest", "sort_order": 1,
    })
    r = await client.post("/v1/catalog/items", json={
        "tenant_id": tenant_id,
        "category_id": cat.json()["id"],
        "name": "Porcelanato Carrara 60x60",
        "description": "Porcelanato polido",
        "tags": {"cor": "claro", "material": "porcelanato", "estilo": "classico"},
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Porcelanato Carrara 60x60"
    assert data["tags"]["cor"] == "claro"
    assert data["status"] == "active"


@pytest.mark.anyio
async def test_list_items_with_tag_filter(client):
    tenant_id = await _setup_tenant(client)
    cat = await client.post("/v1/catalog/categories", json={
        "tenant_id": tenant_id, "name": "Pisos2", "sort_order": 1,
    })
    cat_id = cat.json()["id"]

    await client.post("/v1/catalog/items", json={
        "tenant_id": tenant_id, "category_id": cat_id,
        "name": "Carrara Claro", "description": "claro",
        "tags": {"cor": "claro", "material": "porcelanato"},
    })
    await client.post("/v1/catalog/items", json={
        "tenant_id": tenant_id, "category_id": cat_id,
        "name": "Grafite Escuro", "description": "escuro",
        "tags": {"cor": "escuro", "material": "porcelanato"},
    })

    r = await client.get(f"/v1/catalog/items?tenant_id={tenant_id}&tag_cor=claro")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["name"] == "Carrara Claro"
```

- [ ] **Step 2: Rodar testes para verificar que falham**

Run: `cd services/api-server && pytest tests/test_catalog.py -v`
Expected: FAIL (rotas nao implementadas)

- [ ] **Step 3: Criar catalog/schemas.py**

```python
from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    tenant_id: str
    name: str = Field(min_length=1, max_length=200)
    parent_id: str | None = None
    sort_order: int = 0


class CategoryResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    parent_id: str | None
    sort_order: int


class ItemCreate(BaseModel):
    tenant_id: str
    category_id: str
    name: str = Field(min_length=1, max_length=300)
    description: str = ""
    sku: str | None = None
    tags: dict = {}


class ItemResponse(BaseModel):
    id: str
    tenant_id: str
    category_id: str
    name: str
    description: str
    sku: str | None
    status: str
    tags: dict


class ItemImageCreate(BaseModel):
    tenant_id: str
    catalog_item_id: str
    asset_id: str
    role: str = "primary"
    sort_order: int = 0


class ItemImageResponse(BaseModel):
    id: str
    tenant_id: str
    catalog_item_id: str
    asset_id: str
    role: str
    sort_order: int
```

- [ ] **Step 4: Criar catalog/repository.py**

```python
import json

from app.db import get_conn


async def create_category(tenant_id: str, name: str, parent_id: str | None, sort_order: int) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """
            insert into catalog_categories (tenant_id, name, parent_id, sort_order)
            values (%s, %s, %s, %s)
            returning id, tenant_id, name, parent_id, sort_order
            """,
            (tenant_id, name, parent_id, sort_order),
        )
        return await cur.fetchone()


async def list_categories(tenant_id: str) -> list[dict]:
    async with get_conn() as conn:
        cur = await conn.execute(
            "select id, tenant_id, name, parent_id, sort_order from catalog_categories where tenant_id = %s order by sort_order",
            (tenant_id,),
        )
        return await cur.fetchall()


async def create_item(
    tenant_id: str, category_id: str, name: str, description: str,
    sku: str | None, tags: dict,
) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """
            insert into catalog_items (tenant_id, category_id, name, description, sku, tags)
            values (%s, %s, %s, %s, %s, %s)
            returning id, tenant_id, category_id, name, description, sku, status, tags
            """,
            (tenant_id, category_id, name, description, sku, json.dumps(tags)),
        )
        return await cur.fetchone()


async def list_items(tenant_id: str, tag_filters: dict[str, str] | None = None) -> list[dict]:
    async with get_conn() as conn:
        query = "select id, tenant_id, category_id, name, description, sku, status, tags from catalog_items where tenant_id = %s and status = 'active'"
        params: list = [tenant_id]

        if tag_filters:
            for key, value in tag_filters.items():
                query += " and tags->>%s = %s"
                params.extend([key, value])

        query += " order by created_at"
        cur = await conn.execute(query, params)
        return await cur.fetchall()


async def get_item(item_id: str) -> dict | None:
    async with get_conn() as conn:
        cur = await conn.execute(
            "select id, tenant_id, category_id, name, description, sku, status, tags from catalog_items where id = %s",
            (item_id,),
        )
        return await cur.fetchone()


async def create_item_image(
    tenant_id: str, catalog_item_id: str, asset_id: str, role: str, sort_order: int,
) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """
            insert into catalog_item_images (tenant_id, catalog_item_id, asset_id, role, sort_order)
            values (%s, %s, %s, %s, %s)
            returning id, tenant_id, catalog_item_id, asset_id, role, sort_order
            """,
            (tenant_id, catalog_item_id, asset_id, role, sort_order),
        )
        return await cur.fetchone()


async def list_item_images(catalog_item_id: str) -> list[dict]:
    async with get_conn() as conn:
        cur = await conn.execute(
            "select id, tenant_id, catalog_item_id, asset_id, role, sort_order from catalog_item_images where catalog_item_id = %s order by sort_order",
            (catalog_item_id,),
        )
        return await cur.fetchall()
```

- [ ] **Step 5: Implementar catalog/router.py**

```python
from fastapi import APIRouter, HTTPException, Query, status

from app.catalog import repository as repo
from app.catalog.schemas import (
    CategoryCreate, CategoryResponse,
    ItemCreate, ItemImageCreate, ItemImageResponse, ItemResponse,
)

router = APIRouter(tags=["catalog"])


def _str_keys(row: dict) -> dict:
    return {k: str(v) if hasattr(v, "hex") else v for k, v in row.items()}


# --- Categories ---

@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(payload: CategoryCreate):
    row = await repo.create_category(payload.tenant_id, payload.name, payload.parent_id, payload.sort_order)
    return CategoryResponse(**_str_keys(row))


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(tenant_id: str = Query(...)):
    rows = await repo.list_categories(tenant_id)
    return [CategoryResponse(**_str_keys(r)) for r in rows]


# --- Items ---

@router.post("/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(payload: ItemCreate):
    row = await repo.create_item(
        payload.tenant_id, payload.category_id, payload.name,
        payload.description, payload.sku, payload.tags,
    )
    return ItemResponse(**_str_keys(row))


@router.get("/items", response_model=list[ItemResponse])
async def list_items(
    tenant_id: str = Query(...),
    tag_cor: str | None = Query(None),
    tag_material: str | None = Query(None),
    tag_estilo: str | None = Query(None),
    tag_marca: str | None = Query(None),
):
    tag_filters = {}
    if tag_cor:
        tag_filters["cor"] = tag_cor
    if tag_material:
        tag_filters["material"] = tag_material
    if tag_estilo:
        tag_filters["estilo"] = tag_estilo
    if tag_marca:
        tag_filters["marca"] = tag_marca

    rows = await repo.list_items(tenant_id, tag_filters or None)
    return [ItemResponse(**_str_keys(r)) for r in rows]


@router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: str):
    row = await repo.get_item(item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Item not found")
    return ItemResponse(**_str_keys(row))


# --- Item Images ---

@router.post("/item-images", response_model=ItemImageResponse, status_code=status.HTTP_201_CREATED)
async def create_item_image(payload: ItemImageCreate):
    row = await repo.create_item_image(
        payload.tenant_id, payload.catalog_item_id, payload.asset_id, payload.role, payload.sort_order,
    )
    return ItemImageResponse(**_str_keys(row))


@router.get("/items/{item_id}/images", response_model=list[ItemImageResponse])
async def list_item_images(item_id: str):
    rows = await repo.list_item_images(item_id)
    return [ItemImageResponse(**_str_keys(r)) for r in rows]
```

- [ ] **Step 6: Rodar testes do catalogo**

Run: `cd services/api-server && pytest tests/test_catalog.py -v`
Expected: 5 tests PASSED

- [ ] **Step 7: Rodar todos os testes**

Run: `cd services/api-server && pytest -v`
Expected: todos os testes PASSED (health + tenants + core + catalog)

- [ ] **Step 8: Commit**

```bash
cd services/api-server
git add app/catalog/ tests/test_catalog.py
git commit -m "feat: catalog module with categories, items, item images and tag-based filtering"
```

---

## Task 7: Atualizar contratos TypeScript

**Files:**
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Atualizar index.ts com novos tipos**

Substituir o conteudo completo de `packages/contracts/src/index.ts`:

```typescript
export type TenantStatus = "draft" | "active" | "suspended" | "archived"
export type DomainStatus = "pending_verification" | "verified" | "failed" | "disabled"
export type ChannelType = "whatsapp" | "instagram"
export type ChannelProvider = "uazapi" | "wuzapi"
export type ChannelStatus = "pending" | "connected" | "disconnected" | "error"
export type ConversationStatus = "open" | "waiting_customer" | "waiting_operator" | "closed"
export type ConversationState =
  | "idle"
  | "awaiting_base_image"
  | "collecting_preferences"
  | "showing_options"
  | "awaiting_selection"
  | "composing"
  | "completed"
export type HandledBy = "ai" | "operator"
export type MessageDirection = "inbound" | "outbound"
export type MessageRole = "customer" | "assistant" | "operator" | "system"
export type MessageContentType = "text" | "image" | "catalog_options" | "composition_result"
export type AssetRole = "reference" | "base_image" | "overlay" | "mask" | "render" | "attachment" | "catalog"
export type CatalogItemImageRole = "primary" | "swatch" | "applied_example"
export type Mode = "product" | "interior" | "print" | "fashion"
export type JobStatus = "queued" | "processing" | "done" | "failed"

export type Tenant = {
  id: string
  name: string
  slug: string
  status: TenantStatus
  plan_code: string
}

export type TenantDomain = {
  id: string
  tenant_id: string
  hostname: string
  is_primary: boolean
  status: DomainStatus
}

export type TenantChannel = {
  id: string
  tenant_id: string
  channel_type: ChannelType
  provider: ChannelProvider
  external_session_id: string
  status: ChannelStatus
}

export type Contact = {
  id: string
  tenant_id: string
  external_contact_id: string
  display_name: string
  phone?: string | null
}

export type Conversation = {
  id: string
  tenant_id: string
  channel_id: string
  contact_id: string
  status: ConversationStatus
  state: ConversationState
  handled_by: HandledBy
  operator_id?: string | null
}

export type Message = {
  id: string
  tenant_id: string
  conversation_id: string
  direction: MessageDirection
  role: MessageRole
  content: string
  content_type: MessageContentType
  provider_message_id?: string | null
}

export type Asset = {
  id: string
  tenant_id: string
  conversation_id?: string | null
  role: AssetRole
  mime_type: string
  storage_key: string
  metadata: Record<string, unknown>
}

export type CatalogCategory = {
  id: string
  tenant_id: string
  name: string
  parent_id?: string | null
  sort_order: number
}

export type CatalogItem = {
  id: string
  tenant_id: string
  category_id: string
  name: string
  description: string
  sku?: string | null
  status: "active" | "inactive"
  tags: Record<string, string>
}

export type CatalogItemImage = {
  id: string
  tenant_id: string
  catalog_item_id: string
  asset_id: string
  role: CatalogItemImageRole
  sort_order: number
}

export type CompositionJob = {
  id: string
  tenant_id: string
  conversation_id: string
  mode: Mode
  status: JobStatus
  catalog_item_id?: string | null
  base_asset_id: string
  overlay_asset_id?: string | null
  mask_asset_id?: string | null
  input_payload: Record<string, unknown>
  error_message?: string | null
}

export type Render = {
  id: string
  tenant_id: string
  job_id: string
  asset_id: string
  version: number
}

export type UsageEvent = {
  id: string
  tenant_id: string
  kind: string
  provider: string
  reference_id?: string | null
  quantity: number
  unit_cost: number
  total_cost: number
  metadata: Record<string, unknown>
}

// --- Channel Events ---

export type InboundMediaItem = {
  mime_type: string
  url: string
  caption?: string | null
  kind: "image" | "audio" | "video" | "document"
}

export type InboundChannelMessage = {
  external_message_id: string
  external_contact_id: string
  contact_name: string
  phone?: string | null
  text?: string | null
  media: InboundMediaItem[]
  tenant_id?: string | null
  channel_id?: string | null
}

export type TenantResolution = {
  tenant_id: string
  channel_id: string
  resolved_by: "session_lookup" | "payload_override"
}

export type InboundChannelEvent = {
  provider: ChannelProvider
  tenant: TenantResolution
  message: InboundChannelMessage
  media: InboundMediaItem[]
  normalized_type: "text" | "image" | "audio" | "video" | "document" | "mixed" | "unknown"
  raw_payload: Record<string, unknown>
}

// --- Orchestrator ---

export type Intent = "visual_edit" | "commercial_question" | "smalltalk" | "human_handoff"
export type NextAction =
  | "reply_in_chat"
  | "ask_for_base_image"
  | "ask_for_reference_image"
  | "create_composition_job"
  | "handoff_to_operator"
  | "show_catalog_options"

export type ClassificationResponse = {
  intent: Intent
  mode?: Mode | null
  next_action: NextAction
  confidence: number
  needs_human_review: boolean
  missing_inputs: string[]
  rationale: string
  source: "heuristic" | "openrouter"
}

// --- WebSocket Events ---

export type WsEventType = "new_message" | "job_update" | "conversation_update"

export type WsNewMessage = {
  type: "new_message"
  data: {
    conversation_id: string
    message: Message
  }
}

export type WsJobUpdate = {
  type: "job_update"
  data: {
    job_id: string
    conversation_id: string
    status: JobStatus
    render_url?: string | null
  }
}

export type WsConversationUpdate = {
  type: "conversation_update"
  data: {
    conversation_id: string
    handled_by: HandledBy
    operator_id?: string | null
    state: ConversationState
  }
}

export type WsEvent = WsNewMessage | WsJobUpdate | WsConversationUpdate
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm typecheck:web`
Expected: sem erros de tipo (ou ajustar imports no frontend se necessario)

- [ ] **Step 3: Commit**

```bash
git add packages/contracts/src/index.ts
git commit -m "feat: update TypeScript contracts with catalog, state machine, WebSocket events"
```

---

## Task 8: composition-worker scaffold

**Files:**
- Create: `services/composition-worker/pyproject.toml`
- Create: `services/composition-worker/worker/__init__.py`
- Create: `services/composition-worker/worker/config.py`
- Create: `services/composition-worker/worker/main.py`

- [ ] **Step 1: Criar pyproject.toml**

```toml
[project]
name = "studio-composition-worker"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "psycopg[binary]>=3.2.0",
    "minio>=7.2.0",
    "httpx>=0.28.0",
    "pydantic-settings>=2.7.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3.0",
]
```

- [ ] **Step 2: Criar worker/config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://studio:studio_dev@localhost:5432/studio_app"
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_secure: bool = False
    minio_bucket_renders: str = "tenant-renders"
    openrouter_api_key: str = ""
    openrouter_image_model: str = "google/gemini-3-pro-image-preview"
    api_server_url: str = "http://localhost:8000"
    poll_interval_seconds: int = 2
    max_retries: int = 2
    retry_backoff_seconds: int = 5

    model_config = {"env_prefix": "", "env_file": ".env"}


settings = Settings()
```

- [ ] **Step 3: Criar worker/main.py**

```python
import asyncio
import logging

import psycopg
from psycopg.rows import dict_row

from worker.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("composition-worker")


async def poll_and_process() -> None:
    conninfo = settings.database_url
    async with await psycopg.AsyncConnection.connect(conninfo, row_factory=dict_row) as conn:
        while True:
            async with conn.transaction():
                cur = await conn.execute(
                    """
                    select id, tenant_id, conversation_id, mode, catalog_item_id,
                           base_asset_id, overlay_asset_id, mask_asset_id, input_payload
                    from composition_jobs
                    where status = 'queued'
                    order by created_at
                    limit 1
                    for update skip locked
                    """
                )
                job = await cur.fetchone()

                if job is None:
                    await asyncio.sleep(settings.poll_interval_seconds)
                    continue

                job_id = str(job["id"])
                logger.info("Processing job %s (mode=%s)", job_id, job["mode"])

                await conn.execute(
                    "update composition_jobs set status = 'processing' where id = %s",
                    (job["id"],),
                )

            # TODO: Fase 6 implementa processor.py com chamada ao Nano Banana Pro
            logger.info("Job %s: processor not yet implemented, marking as done (stub)", job_id)

            async with conn.transaction():
                await conn.execute(
                    "update composition_jobs set status = 'done' where id = %s",
                    (job["id"],),
                )

            logger.info("Job %s completed", job_id)


async def main() -> None:
    logger.info("Composition worker starting (poll_interval=%ds)", settings.poll_interval_seconds)
    await poll_and_process()


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 4: Criar worker/__init__.py vazio**

- [ ] **Step 5: Testar que o worker inicia**

Run: `cd services/composition-worker && pip install -e ".[dev]"`
Expected: instalacao sem erro

Run: `cd services/composition-worker && timeout 5 python -m worker.main || true`
Expected: log "Composition worker starting" aparece, worker roda por 5s e e interrompido pelo timeout

- [ ] **Step 6: Commit**

```bash
git add services/composition-worker/
git commit -m "feat: scaffold composition-worker with job polling loop"
```

---

## Task 9: Limpar servicos antigos e atualizar scripts

**Files:**
- Remove: `services/api/`
- Remove: `services/channel-gateway/`
- Remove: `services/orchestrator/`
- Remove: `services/composition/`
- Remove: `services/billing-metering/`
- Modify: `package.json`

- [ ] **Step 1: Remover servicos antigos**

```bash
rm -rf services/api services/channel-gateway services/orchestrator services/composition services/billing-metering
```

- [ ] **Step 2: Atualizar package.json na raiz**

```json
{
  "name": "studio-composicao-visual",
  "private": true,
  "packageManager": "pnpm@10.30.0",
  "scripts": {
    "dev:web": "pnpm --dir apps/web dev",
    "build:web": "pnpm --dir apps/web build",
    "typecheck:web": "pnpm --dir apps/web exec tsc --noEmit -p tsconfig.typecheck.json",
    "dev:api": "cd services/api-server && uvicorn app.main:app --reload --port 8000",
    "dev:worker": "cd services/composition-worker && python -m worker.main",
    "test:api": "cd services/api-server && pytest -v",
    "dev": "echo 'Run: docker compose up -d && pnpm dev:api & pnpm dev:worker & pnpm dev:web'"
  }
}
```

- [ ] **Step 3: Verificar que tudo funciona**

Run: `docker compose up -d`
Expected: postgres e minio rodando

Run: `pnpm dev:api &`
Expected: api-server inicia na porta 8000

Run: `curl http://localhost:8000/v1/health`
Expected: `{"status":"ok"}`

Parar o servidor: `kill %1`

- [ ] **Step 4: Commit final da Fase 1**

```bash
git add -A
git commit -m "refactor: remove old services, consolidate into api-server + composition-worker

- Removed: services/api, channel-gateway, orchestrator, composition, billing-metering
- Added: services/api-server (FastAPI with core + catalog modules)
- Added: services/composition-worker (job polling stub)
- Updated: root package.json scripts
- Updated: TypeScript contracts with catalog, state machine, WebSocket types
- Updated: PostgreSQL schema with all entities"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- [x] Reestruturacao do monorepo → Task 9
- [x] Schema PostgreSQL completo → Task 2
- [x] api-server scaffold → Task 3
- [x] CRUD tenants, domains, channels → Task 4
- [x] CRUD contacts, conversations, messages, assets → Task 4, 5
- [x] CRUD catalogo (categories, items, item_images) → Task 6
- [x] Filtragem por tags JSONB → Task 6
- [x] Contratos TypeScript atualizados → Task 7
- [x] composition-worker scaffold → Task 8
- [x] Docker Compose para dev local → Task 1
- [x] Scripts atualizados → Task 9

**2. Placeholder scan:**
- O `worker/main.py` tem um TODO para Fase 6 (processor) — intencional, sera implementado na Fase 6.
- Nenhum outro TBD, TODO ou placeholder.

**3. Type consistency:**
- `_str_keys()` usado consistentemente em core/router.py e catalog/router.py
- Schemas Pydantic alinham com colunas SQL
- Contratos TS alinham com schemas Python
