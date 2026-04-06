# Docker Compose Local Completo — Design

## Resumo

Configurar docker-compose com todos os 6 containers (PostgreSQL, MinIO, Zitadel, api-server, composition-worker, web) para rodar o MVP localmente com `docker compose up --build`. Auth desabilitado para dev, seed expandido com conversas e mensagens.

## Decisoes

- **Abordagem:** Docker Compose completo — todos os servicos em containers, zero deps na maquina alem do Docker.
- **Auth:** Desabilitado (`auth_enabled=false` no api-server, frontend sem OIDC real). Zitadel sobe mas nao e usado pelos apps.
- **Seed:** Expandido — 1 tenant, 3 conversas com mensagens, 5 itens de catalogo com tags variados, 1 job de composicao.
- **Next.js:** Output standalone para build otimizado sem node_modules no container.

## Containers

| Servico | Imagem | Porta | Detalhes |
|---------|--------|-------|----------|
| postgres | postgres:16-alpine | 5433:5432 | DB studio_app + zitadel |
| minio | minio/minio:latest | 9000, 9001 | Object storage |
| zitadel | zitadel:v2.71.6 | 8080 | Auth (desabilitado nos apps) |
| api-server | Dockerfile Python 3.12-slim | 8000:8000 | FastAPI + Socket.IO |
| composition-worker | Dockerfile Python 3.12-slim | — | Worker polling jobs |
| web | Dockerfile Node 22-alpine | 3000:3000 | Next.js standalone |

## Dockerfiles

### api-server (`services/api-server/Dockerfile`)

- Base: python:3.12-slim
- Copia pyproject.toml, instala deps com pip
- Copia codigo fonte
- CMD: uvicorn app.main:app --host 0.0.0.0 --port 8000

### composition-worker (`services/composition-worker/Dockerfile`)

- Base: python:3.12-slim
- Copia pyproject.toml, instala deps com pip
- Copia codigo fonte
- CMD: python -m worker.main

### web (`apps/web/Dockerfile`)

- Multi-stage: Node 22-alpine
- Stage 1 (deps): pnpm install
- Stage 2 (build): pnpm build (standalone output)
- Stage 3 (run): node server.js
- Requer output: "standalone" no next.config.ts

## Configuracao

### Variaveis de ambiente (via docker-compose)

**api-server:**
- database_url=postgresql://studio:studio_dev@postgres:5432/studio_app
- minio_endpoint=minio:9000
- auth_enabled=false

**composition-worker:**
- database_url=postgresql://studio:studio_dev@postgres:5432/studio_app
- minio_endpoint=minio:9000
- api_server_url=http://api-server:8000

**web:**
- NEXT_PUBLIC_API_URL=http://localhost:8000
- NEXT_PUBLIC_WS_URL=http://localhost:8000
- NEXTAUTH_URL=http://localhost:3000
- NEXTAUTH_SECRET=dev-secret

## Seed expandido

Adicionar ao db/seed.sql:
- 3 conversas (idle, awaiting_base_image, completed) com mensagens de exemplo
- 4 itens adicionais de catalogo com tags variados
- 1 job de composicao (status done)

## Ordem de boot

postgres (healthcheck) → minio + zitadel → api-server → composition-worker + web

## Fora do escopo

- Hot-reload (este e o modo "producao local", nao dev)
- Seed automatico do Zitadel (auth desabilitado)
- HTTPS/SSL
- Volumes para codigo fonte
