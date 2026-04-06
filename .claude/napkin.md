# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-04-05] Monorepo pnpm — scripts ficam na raiz**
   Do instead: usar `pnpm dev:web`, `pnpm build:web`, `pnpm typecheck:web` da raiz. Python services rodam independentemente via uvicorn.

2. **[2026-04-05] API usa store em memória (não PostgreSQL em runtime)**
   Do instead: lembrar que `services/api/app/core/store.py` é in-memory. Schema SQL existe em `services/api/db/schema.sql` para futura migração.

## Shell & Command Reliability
1. **[2026-04-05] pnpm 10.30.0 é o package manager**
   Do instead: sempre usar `pnpm` (não npm/yarn). Workspace definido em `pnpm-workspace.yaml` com `apps/*` e `packages/*`.

2. **[2026-04-05] Python services requerem >= 3.12**
   Do instead: usar `python3` e verificar versão antes de rodar serviços FastAPI.

## Domain Behavior Guardrails
1. **[2026-04-05] Multi-tenant: isolamento por tenant é princípio core**
   Do instead: todo dado, asset e job deve ser isolado por `tenant_id`. Usar `@studio/tenant-context` para prefixos de storage.

2. **[2026-04-05] Contratos TS são fonte de verdade para tipos do domínio**
   Do instead: alterar tipos em `packages/contracts/src/index.ts` e propagar para consumers.

3. **[2026-04-05] Fluxo: canal → gateway → API → orchestrator → composition**
   Do instead: respeitar essa cadeia ao adicionar funcionalidades. Cada serviço tem responsabilidade única.

## User Directives
1. **[2026-04-05] Sempre responder em Português**
   Do instead: todas as respostas devem ser em português brasileiro.
