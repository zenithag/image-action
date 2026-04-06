# Fase 4: WebSocket Realtime (Socket.IO) + Auth (Zitadel) — Design

## Resumo

Finalizar o backend do MVP adicionando autenticacao via Zitadel (JWT/JWKS) em todas as rotas, realtime via Socket.IO para o inbox do operador, e endpoints de takeover para o operador assumir/devolver conversas.

## Decisoes

- **Auth:** Zitadel self-hosted. Organizations = tenants. JWT validado via JWKS (cache local). Roles: superadmin, tenant_admin, operator.
- **Realtime:** python-socketio (AsyncServer) montado no FastAPI via ASGIApp. Rooms por tenant. JWT no handshake.
- **Takeover:** REST endpoints para assumir/devolver conversa. Socket.IO emite eventos de mudanca.

## Componentes

### 1. Auth Module (`services/api-server/app/auth/`)

- `middleware.py` — Middleware FastAPI que extrai JWT do header `Authorization: Bearer`, valida contra JWKS do Zitadel via PyJWKS (cache de chaves), extrai `tenant_id` da claim `urn:zitadel:iam:org:id` e roles da claim `urn:zitadel:iam:org:project:{project_id}:roles`.
- `dependencies.py` — FastAPI dependencies: `get_current_user()` retorna AuthUser do request state, `require_role("operator")` valida que o user tem a role, `require_superadmin()` valida role superadmin.
- `schemas.py` — `AuthUser(id: str, tenant_id: str, roles: list[str], email: str, name: str)`

**Fluxo:**
1. Request chega com `Authorization: Bearer <jwt>`
2. Middleware decodifica via PyJWKS (cache de chaves JWKS do Zitadel)
3. Extrai org_id como tenant_id, user roles do projeto
4. Injeta AuthUser no request.state
5. Dependencies de rotas validam roles

**Rotas protegidas:**
- Todas as rotas `/v1/*` exceto: webhooks (`/v1/webhooks/*`), health (`/v1/health`), internal (`/v1/internal/*`)
- Webhooks validam via webhook_secret no header (ja existente)
- Internal endpoints ficam sem auth (service-to-service, seguranca via rede)

**Config:**
- `zitadel_issuer_url` — URL do Zitadel (ex: `http://localhost:8080`)
- `zitadel_project_id` — ID do projeto OIDC no Zitadel

### 2. Realtime Module (`services/api-server/app/realtime/`)

- `manager.py` — Socket.IO AsyncServer com async_mode="asgi". Montado no FastAPI app. Gerencia rooms por tenant (`tenant:{tenant_id}`).
- `events.py` — Definicao dos tipos de eventos e funcoes helper para emitir.
- `router.py` — Endpoints REST de takeover.

**Eventos Socket.IO:**

| Evento | Payload | Quando |
|--------|---------|--------|
| `new_message` | `{ conversation_id, message }` | Mensagem inbound ou outbound processada |
| `job_updated` | `{ job_id, status, conversation_id }` | Job muda de status (done/failed) |
| `conversation_updated` | `{ conversation_id, state, handled_by, operator_id }` | Estado ou handled_by muda |

**Conexao:**
1. Operador conecta com `{ auth: { token: "jwt" } }`
2. Server valida JWT no evento `connect` (mesma logica do middleware)
3. Operador e adicionado ao room `tenant:{tenant_id}`
4. Desconexao remove do room automaticamente

### 3. Takeover pelo operador

**Endpoints REST:**
- `POST /v1/conversations/{id}/takeover` — Seta `handled_by=operator`, `operator_id` do JWT. Emite `conversation_updated` via Socket.IO.
- `POST /v1/conversations/{id}/release` — Seta `handled_by=ai`, limpa `operator_id`. Emite `conversation_updated`.
- `POST /v1/conversations/{id}/messages` — Operador envia mensagem de texto. Persiste no banco, envia no WhatsApp via channel sender, emite `new_message`.

### 4. Integracao nos fluxos existentes

- `conversation_handler.py` — Apos processar inbound e enviar reply, emite `new_message` para o room do tenant via Socket.IO.
- `orchestrator/router.py` (job-completed) — Apos enviar imagem no WhatsApp, emite `job_updated` e `conversation_updated`.
- Composition worker nao muda (ele so chama o endpoint interno).

### 5. Docker-compose

Adicionar container Zitadel ao docker-compose existente:
- Zitadel usa o mesmo PostgreSQL (schema separado) ou PostgreSQL dedicado
- Porta 8080 interna
- Seed script para criar projeto OIDC, org de exemplo, e usuario operador de teste

### 6. Dependencias novas

- `python-socketio[asyncio]` — Socket.IO server
- `PyJWKS` ou `python-jose[cryptography]` — Validacao JWT via JWKS
- `httpx` (ja existe) — Para buscar JWKS endpoint

## Fluxo de dados

```
Operador abre inbox no browser
  -> Conecta Socket.IO com JWT
  -> Server valida JWT, adiciona ao room tenant:{tenant_id}

Cliente envia mensagem no WhatsApp
  -> Webhook -> Gateway -> Orchestrator -> conversation_handler
  -> Persiste mensagem, classifica, responde
  -> Emite "new_message" no room tenant:{tenant_id}
  -> Operador ve mensagem em tempo real

Operador clica "Assumir conversa"
  -> POST /v1/conversations/{id}/takeover
  -> handled_by = operator
  -> Emite "conversation_updated"
  -> IA para de responder automaticamente

Operador envia mensagem pelo inbox
  -> POST /v1/conversations/{id}/messages
  -> Persiste + envia no WhatsApp
  -> Emite "new_message"

Operador clica "Devolver para IA"
  -> POST /v1/conversations/{id}/release
  -> handled_by = ai
  -> Emite "conversation_updated"
```

## Fora do escopo

- Frontend (Fase 5)
- Billing por tenant baseado em auth (usa metering existente)
- Rate limiting por tenant
- Refresh token flow (frontend cuida disso)
