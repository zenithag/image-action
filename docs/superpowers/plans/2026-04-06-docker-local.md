# Docker Compose Local Completo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Configurar docker-compose com todos os 6 containers para rodar o MVP localmente com `docker compose up --build`.

**Architecture:** Dockerfiles para api-server (Python 3.12-slim + uvicorn), composition-worker (Python 3.12-slim + polling), web (Node 22-alpine + Next.js standalone). Docker-compose orquestra boot order com depends_on/healthcheck. Auth desabilitado, seed expandido.

**Tech Stack:** Docker, Docker Compose, Python 3.12, Node 22, PostgreSQL 16, MinIO, Next.js standalone output

---

## Task 1: Dockerfile do api-server

**Files:**
- Create: `services/api-server/Dockerfile`
- Create: `services/api-server/.dockerignore`

- [ ] **Step 1: Criar .dockerignore**

`services/api-server/.dockerignore`:
```
__pycache__
*.pyc
*.egg-info
.env
.pytest_cache
tests/
```

- [ ] **Step 2: Criar Dockerfile**

`services/api-server/Dockerfile`:
```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY app/ app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: Testar build local**

Run: `docker build -t studio-api-server services/api-server/`
Expected: Build com sucesso

- [ ] **Step 4: Commit**

```bash
git add services/api-server/Dockerfile services/api-server/.dockerignore
git commit -m "infra: add Dockerfile for api-server"
```

---

## Task 2: Dockerfile do composition-worker

**Files:**
- Create: `services/composition-worker/Dockerfile`
- Create: `services/composition-worker/.dockerignore`

- [ ] **Step 1: Criar .dockerignore**

`services/composition-worker/.dockerignore`:
```
__pycache__
*.pyc
*.egg-info
.env
.pytest_cache
tests/
```

- [ ] **Step 2: Criar Dockerfile**

`services/composition-worker/Dockerfile`:
```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY worker/ worker/

CMD ["python", "-m", "worker.main"]
```

- [ ] **Step 3: Testar build local**

Run: `docker build -t studio-composition-worker services/composition-worker/`
Expected: Build com sucesso

- [ ] **Step 4: Commit**

```bash
git add services/composition-worker/Dockerfile services/composition-worker/.dockerignore
git commit -m "infra: add Dockerfile for composition-worker"
```

---

## Task 3: Configurar Next.js standalone output

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Adicionar output standalone**

Em `apps/web/next.config.ts`, adicionar `output: "standalone"` ao config:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@studio/contracts", "@studio/tenant-context"],
};

export default nextConfig;
```

- [ ] **Step 2: Verificar build**

Run: `cd apps/web && pnpm build`
Expected: Build com sucesso, diretorio `.next/standalone` criado

- [ ] **Step 3: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "feat: enable Next.js standalone output for Docker"
```

---

## Task 4: Dockerfile do web (Next.js)

**Files:**
- Create: `apps/web/Dockerfile`
- Create: `apps/web/.dockerignore`

- [ ] **Step 1: Criar .dockerignore**

`apps/web/.dockerignore`:
```
node_modules
.next
.env.local
```

- [ ] **Step 2: Criar Dockerfile multi-stage**

`apps/web/Dockerfile`:
```dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/tenant-context/package.json packages/tenant-context/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=deps /app/packages/tenant-context/node_modules ./packages/tenant-context/node_modules
COPY apps/web/ apps/web/
COPY packages/contracts/ packages/contracts/
COPY packages/tenant-context/ packages/tenant-context/
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
WORKDIR /app/apps/web
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

Nota: o Dockerfile fica na raiz do monorepo via context no docker-compose (`context: .`, `dockerfile: apps/web/Dockerfile`).

- [ ] **Step 3: Commit**

```bash
git add apps/web/Dockerfile apps/web/.dockerignore
git commit -m "infra: add multi-stage Dockerfile for Next.js web app"
```

---

## Task 5: Expandir seed.sql

**Files:**
- Modify: `db/seed.sql`

- [ ] **Step 1: Adicionar conversas, mensagens, itens de catalogo e job**

Substituir `db/seed.sql` com conteudo expandido:

```sql
-- Tenant demo
insert into tenants (id, name, slug, status, plan_code)
values (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Loja Revestimentos Demo',
  'loja-revestimentos',
  'active',
  'starter'
) on conflict (slug) do nothing;

-- Canal WhatsApp
insert into tenant_channels (id, tenant_id, channel_type, provider, external_session_id, status)
values (
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'whatsapp',
  'uazapi',
  'session-demo-001',
  'connected'
) on conflict do nothing;

-- Contato teste
insert into contacts (id, tenant_id, external_contact_id, display_name, phone)
values (
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '5511999990000@s.whatsapp.net',
  'Cliente Teste',
  '+5511999990000'
) on conflict do nothing;

-- Contato 2
insert into contacts (id, tenant_id, external_contact_id, display_name, phone)
values (
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a34',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '5511988880000@s.whatsapp.net',
  'Maria Oliveira',
  '+5511988880000'
) on conflict do nothing;

-- Contato 3
insert into contacts (id, tenant_id, external_contact_id, display_name, phone)
values (
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a35',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '5511977770000@s.whatsapp.net',
  'Joao Santos',
  '+5511977770000'
) on conflict do nothing;

-- Conversa 1: idle
insert into conversations (id, tenant_id, channel_id, contact_id, status, state, handled_by)
values (
  'd3eebc99-0001-4ef8-bb6d-6bb9bd380a01',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'open',
  'collecting_preferences',
  'ai'
) on conflict do nothing;

-- Conversa 2: composing (operador)
insert into conversations (id, tenant_id, channel_id, contact_id, status, state, handled_by)
values (
  'd3eebc99-0001-4ef8-bb6d-6bb9bd380a02',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a34',
  'open',
  'composing',
  'operator'
) on conflict do nothing;

-- Conversa 3: completed
insert into conversations (id, tenant_id, channel_id, contact_id, status, state, handled_by)
values (
  'd3eebc99-0001-4ef8-bb6d-6bb9bd380a03',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a35',
  'open',
  'completed',
  'ai'
) on conflict do nothing;

-- Mensagens da conversa 1
insert into messages (id, tenant_id, conversation_id, direction, role, content, content_type) values
  ('e4eebc99-0001-4ef8-bb6d-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a01', 'inbound', 'customer', 'Oi, quero ver opcoes de revestimento para minha cozinha', 'text'),
  ('e4eebc99-0001-4ef8-bb6d-6bb9bd380002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a01', 'outbound', 'assistant', 'Ola! Que tipo de revestimento voce procura? Temos porcelanato, ceramica e mosaicos.', 'text'),
  ('e4eebc99-0001-4ef8-bb6d-6bb9bd380003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a01', 'inbound', 'customer', 'Porcelanato claro, estilo classico', 'text')
on conflict do nothing;

-- Mensagens da conversa 2
insert into messages (id, tenant_id, conversation_id, direction, role, content, content_type) values
  ('e4eebc99-0002-4ef8-bb6d-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a02', 'inbound', 'customer', 'Boa tarde, quero aplicar esse porcelanato na minha sala', 'text'),
  ('e4eebc99-0002-4ef8-bb6d-6bb9bd380002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a02', 'outbound', 'assistant', 'Perfeito! Me envie uma foto do ambiente e eu gero a composicao visual.', 'text'),
  ('e4eebc99-0002-4ef8-bb6d-6bb9bd380003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a02', 'inbound', 'customer', '[Foto da sala]', 'image'),
  ('e4eebc99-0002-4ef8-bb6d-6bb9bd380004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a02', 'outbound', 'assistant', 'Estou gerando a composicao, aguarde um momento...', 'text'),
  ('e4eebc99-0002-4ef8-bb6d-6bb9bd380005', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a02', 'outbound', 'operator', 'Oi Maria, aqui e o Pedro. Estou acompanhando seu pedido de composicao.', 'text')
on conflict do nothing;

-- Mensagens da conversa 3
insert into messages (id, tenant_id, conversation_id, direction, role, content, content_type) values
  ('e4eebc99-0003-4ef8-bb6d-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a03', 'inbound', 'customer', 'Oi, quero ver o mosaico hexagonal aplicado no banheiro', 'text'),
  ('e4eebc99-0003-4ef8-bb6d-6bb9bd380002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a03', 'outbound', 'assistant', 'Claro! Me envie a foto do banheiro.', 'text'),
  ('e4eebc99-0003-4ef8-bb6d-6bb9bd380003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a03', 'inbound', 'customer', '[Foto do banheiro]', 'image'),
  ('e4eebc99-0003-4ef8-bb6d-6bb9bd380004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a03', 'outbound', 'assistant', 'Aqui esta o resultado da composicao! O mosaico hexagonal ficou otimo no seu banheiro.', 'composition_result')
on conflict do nothing;

-- Categoria catalogo
insert into catalog_categories (id, tenant_id, name, sort_order)
values (
  'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Revestimentos',
  1
) on conflict do nothing;

-- Itens catalogo
insert into catalog_items (id, tenant_id, category_id, name, description, sku, tags) values
  ('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
   'Porcelanato Carrara 60x60', 'Porcelanato polido inspirado em marmore de Carrara', 'PRC-001',
   '{"cor": "claro", "material": "porcelanato", "estilo": "classico", "marca": "Portinari"}'),
  ('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a56', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
   'Ceramica Subway Branca', 'Ceramica retangular estilo metro para paredes', 'CER-002',
   '{"cor": "branco", "material": "ceramica", "estilo": "moderno", "marca": "Eliane"}'),
  ('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a57', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
   'Mosaico Hexagonal Cinza', 'Mosaico hexagonal em tons de cinza para banheiros', 'MOS-003',
   '{"cor": "cinza", "material": "mosaico", "estilo": "contemporaneo", "marca": "Atlas"}'),
  ('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a58', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
   'Porcelanato Madeira Carvalho', 'Porcelanato que reproduz madeira de carvalho', 'PRC-004',
   '{"cor": "madeira", "material": "porcelanato", "estilo": "rustico", "marca": "Portinari"}'),
  ('e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a59', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
   'Cimento Queimado Natural', 'Revestimento de cimento queimado para pisos e paredes', 'CIM-005',
   '{"cor": "cinza", "material": "cimento", "estilo": "industrial", "marca": "Bautech"}')
on conflict do nothing;

-- Asset fake para job de composicao
insert into assets (id, tenant_id, conversation_id, role, mime_type, storage_key) values
  ('f5eebc99-0001-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a03', 'base_image', 'image/jpeg', 'tenants/a0eebc99/conversations/d3eebc99-03/base.jpg')
on conflict do nothing;

-- Job de composicao (done)
insert into composition_jobs (id, tenant_id, conversation_id, mode, status, base_asset_id) values
  ('f6eebc99-0001-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd3eebc99-0001-4ef8-bb6d-6bb9bd380a03', 'interior', 'done', 'f5eebc99-0001-4ef8-bb6d-6bb9bd380a01')
on conflict do nothing;
```

- [ ] **Step 2: Commit**

```bash
git add db/seed.sql
git commit -m "data: expand seed with conversations, messages, catalog items and job"
```

---

## Task 6: Atualizar docker-compose.yml com todos os servicos

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Reescrever docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: studio
      POSTGRES_PASSWORD: studio_dev
      POSTGRES_DB: studio_app
    ports:
      - "5433:5432"
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
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 3s
      retries: 5

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

  api-server:
    build:
      context: ./services/api-server
    ports:
      - "8000:8000"
    environment:
      database_url: postgresql://studio:studio_dev@postgres:5432/studio_app
      minio_endpoint: minio:9000
      minio_access_key: minioadmin
      minio_secret_key: minioadmin
      minio_secure: "false"
      minio_bucket: tenant-assets
      auth_enabled: "false"
      openrouter_api_key: ""
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_started

  composition-worker:
    build:
      context: ./services/composition-worker
    environment:
      database_url: postgresql://studio:studio_dev@postgres:5432/studio_app
      minio_endpoint: minio:9000
      minio_access_key: minioadmin
      minio_secret_key: minioadmin
      minio_secure: "false"
      minio_bucket_renders: tenant-renders
      api_server_url: http://api-server:8000
      openrouter_api_key: ""
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_started
      api-server:
        condition: service_started

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
      NEXT_PUBLIC_WS_URL: http://localhost:8000
      NEXTAUTH_URL: http://localhost:3000
      NEXTAUTH_SECRET: dev-secret-change-me
      HOSTNAME: "0.0.0.0"
    depends_on:
      api-server:
        condition: service_started

volumes:
  pgdata:
  miniodata:
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "infra: add api-server, composition-worker and web to docker-compose"
```

---

## Task 7: Testar docker compose up

- [ ] **Step 1: Limpar volumes antigos**

Run: `docker compose down -v`

- [ ] **Step 2: Build e subir tudo**

Run: `docker compose up --build -d`
Expected: Todos os 6 containers sobem sem erro

- [ ] **Step 3: Verificar saude dos servicos**

Run: `docker compose ps`
Expected: Todos os containers com status "Up" ou "healthy"

- [ ] **Step 4: Verificar api-server responde**

Run: `curl http://localhost:8000/v1/health`
Expected: Resposta 200

- [ ] **Step 5: Verificar web responde**

Run: `curl -s http://localhost:3000 | head -20`
Expected: HTML do Next.js

- [ ] **Step 6: Verificar seed no banco**

Run: `docker compose exec postgres psql -U studio -d studio_app -c "SELECT count(*) FROM conversations;"`
Expected: 3

- [ ] **Step 7: Fix e commit se necessario**

```bash
git add -A
git commit -m "fix: adjustments from docker compose testing"
```
