# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

B2B multi-tenant conversational platform for visual composition generation via WhatsApp. Businesses receive customer messages, an LLM orchestrates the conversation, collects images/preferences, triggers visual composition pipelines, and returns results through the same channel or for human review.

Language: Portuguese (BR) for product copy and UI labels. Code and comments in English.

## Monorepo Structure

- **pnpm workspaces** with `apps/*` and `packages/*`
- **Package manager:** pnpm v10.30.0
- Frontend apps in `apps/`, backend services in `services/`, shared code in `packages/`

### Apps

- `apps/web` — Main Next.js 15 app (React 19, TypeScript, Tailwind CSS 4, shadcn/ui). Serves tenant console and superadmin routes. Uses App Router.
- `apps/superadmin`, `apps/tenant-console` — Skeleton placeholders (not yet implemented).

### Services (Python 3.12+)

- `services/api-server` — FastAPI REST API. Orchestrator, gateway, catalog, realtime (Socket.IO), billing, storage. Raw SQL via `psycopg` async (no ORM). Repository pattern in `app.core.repository`.
- `services/composition-worker` — Async image composition worker. Polls DB for jobs, processes via OpenRouter image models, uploads to MinIO.

### Packages (TypeScript)

- `packages/contracts` — Shared type definitions (Tenant, Conversation, Message, Asset, CompositionJob, etc.)
- `packages/tenant-context` — Tenant resolution utilities, `formatTenantStoragePrefix()`

## Commands

### Frontend

```bash
pnpm dev:web          # Next.js dev server (port 3000)
pnpm build:web        # Production build
pnpm typecheck:web    # TypeScript type check (tsc --noEmit)
```

### Backend

```bash
pnpm dev:api          # FastAPI dev server with reload (port 8000)
pnpm dev:worker       # Composition worker
pnpm test:api         # pytest -v (services/api-server)
```

### Infrastructure

```bash
docker compose up -d                    # Full local stack
docker compose up -d postgres minio     # Just DB + storage
```

### Running a single Python test

```bash
cd services/api-server && pytest tests/test_specific.py -v
```

Pytest config: `asyncio_mode = "auto"`, test dir: `tests/`.

## Architecture

### Multi-Tenant Design

All database tables include `tenant_id`. Storage is prefixed per tenant (`tenants/{slug}-{id}/`). Socket.IO uses per-tenant namespaces. Tenant resolution comes from JWT claims (org ID) or channel webhook source.

### Authentication

- **Frontend:** NextAuth v5 (beta.30) with Zitadel OIDC provider. Config in `apps/web/lib/auth.ts`. Middleware (`apps/web/middleware.ts`) protects `/tenant/*` and `/superadmin/*` routes.
- **Backend:** JWT verification via Zitadel JWKS in `app/auth/middleware.py`. `auth_enabled` defaults to `false` in dev. Unprotected: `/v1/health`, `/v1/webhooks/*`, `/v1/internal/*`, `/docs`, `/socket.io`.

### Database

PostgreSQL 16. No ORM — raw async SQL with `psycopg[pool]` and `dict_row` factory. Schema in `db/schema.sql`, seed data in `db/seed.sql`. Docker exposes on port **5433** (not 5432).

### Key Data Flow

1. WhatsApp webhook → API gateway normalizes message
2. Message persisted, orchestrator classifies intent via OpenRouter LLM
3. Conversation state machine: `idle → awaiting_base_image → collecting_preferences → showing_options → awaiting_selection → composing → completed`
4. Composition job queued → worker processes → uploads to MinIO
5. API callback → sends result back through channel
6. Socket.IO emits real-time updates to tenant UI

### Real-time

Socket.IO mounted at `/socket.io`. Events: `new_message`, `job_updated`, `conversation_updated`. Manager in `app.realtime.manager`.

## Environment Variables

Frontend env example at `apps/web/.env.local.example`. Backend config via `pydantic-settings` in `app/config.py` (api-server) and `worker/config.py` (composition-worker). All settings have dev defaults.

Key services in docker-compose: PostgreSQL (:5433), MinIO (:9000/:9001), Zitadel (:8080), API (:8000), Web (:3000).

## UI Stack

shadcn/ui with New York style variant. Components in `apps/web/components/ui/`. Config in `apps/web/components.json`. Uses `class-variance-authority`, `clsx`, `tailwind-merge`. State management via Zustand. Charts via Recharts.
