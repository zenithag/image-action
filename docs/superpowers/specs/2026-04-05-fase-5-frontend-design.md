# Fase 5: Frontend (Inbox + Catalogo + Dashboard) — Design

## Resumo

Construir o frontend do MVP no Next.js 15.3 existente (`apps/web/`), com autenticacao OIDC via Zitadel (next-auth v5), inbox do operador em tempo real (Socket.IO + Zustand), catalogo com filtros, e dashboard melhorado com metricas.

## Decisoes

- **Auth:** next-auth v5 com OIDC provider generico apontando para Zitadel. Claims custom (org_id, roles) extraidas no callback `jwt`. Middleware Next.js protege rotas.
- **Estado:** Zustand store para conversas, mensagens e jobs. Socket.IO middleware atualiza store em tempo real.
- **Layout inbox:** 2 colunas (lista de conversas | chat ativo). Painel de detalhes colapsavel dentro do chat.
- **UI:** Shadcn/ui + Tailwind (ja configurados).
- **OIDC lib:** next-auth (Auth.js v5) com adapter OIDC generico.

## Componentes

### 1. Auth (`apps/web/lib/auth/`)

- next-auth v5 com OIDC provider apontando para Zitadel (`zitadel_issuer_url`)
- Callback `jwt` extrai `urn:zitadel:iam:org:id` como `tenant_id` e roles do projeto
- Middleware Next.js protege `/tenant/*` (requer operator ou tenant_admin) e `/superadmin/*` (requer superadmin)
- SessionProvider no layout root

### 2. Socket.IO + Zustand (`apps/web/lib/realtime/`)

- `SocketProvider` — Conecta Socket.IO com JWT do next-auth session no handshake
- `useConversationStore` (Zustand) — Store com:
  - `conversations: Conversation[]`
  - `activeConversationId: string | null`
  - `messages: Record<string, Message[]>`
  - Actions: `setConversations`, `addMessage`, `updateConversation`, `setActive`
- Socket.IO middleware: escuta `new_message`, `job_updated`, `conversation_updated` e atualiza store

### 3. Inbox do Operador (`/tenant/[slug]/inbox`)

- **ConversationList** (coluna esquerda): lista de conversas com badge de estado (idle, composing, completed), filtro por handled_by (ai/operator/all), ordenado por ultima mensagem
- **ChatPanel** (coluna direita): mensagens do chat ativo, input de texto para operador, botoes takeover/release
- **ContactDetails** (painel colapsavel): dados do contato, estado do job de composicao, preview da imagem resultado

### 4. Catalogo (`/tenant/[slug]/catalog`)

- **CatalogBrowser**: grid de items com filtros por tags (cor, material, estilo, marca). Usa `GET /v1/catalog/items?tenant_id=&tag_cor=&...`
- **CatalogItemDetail**: detalhe do item com imagens. Usa `GET /v1/catalog/items/{id}` e `GET /v1/catalog/items/{id}/images`

### 5. Dashboard melhorado

- **Tenant dashboard** (`/tenant/[slug]`): cards com metricas — conversas ativas, jobs em progresso, mensagens hoje, conversas por estado
- **Superadmin dashboard** (`/superadmin`): metricas globais — tenants ativos, conversas totais, jobs totais

### 6. Rotas Next.js

| Rota | Acesso | Conteudo |
|---|---|---|
| `/` | Publico | Landing page (ja existe) |
| `/auth/signin` | Publico | Redirect para Zitadel |
| `/tenant/[slug]/inbox` | operator, tenant_admin | Inbox 2 colunas |
| `/tenant/[slug]/catalog` | operator, tenant_admin | Catalogo com filtros |
| `/tenant/[slug]` | operator, tenant_admin | Dashboard do tenant |
| `/superadmin` | superadmin | Dashboard global |

### 7. Dependencias novas

- `next-auth@5` (Auth.js v5) — OIDC auth
- `zustand` — State management
- `socket.io-client` — Socket.IO client
- Shadcn/ui components adicionais conforme necessario

## Data flow

```
Zitadel OIDC login -> next-auth session (JWT com org_id + roles)
  -> Socket.IO connect com token JWT
  -> Eventos atualizam Zustand store
  -> Componentes React reagem ao store

REST calls (fetch com Authorization header do session):
  GET /v1/conversations -> lista conversas
  GET /v1/conversations/{id} -> detalhes conversa
  POST /v1/conversations/{id}/takeover -> assumir
  POST /v1/conversations/{id}/release -> devolver
  POST /v1/conversations/{id}/messages -> operador envia
  GET /v1/catalog/items -> catalogo com filtros
  GET /v1/catalog/items/{id} -> detalhe item
  GET /v1/catalog/items/{id}/images -> imagens do item
  GET /v1/tenants -> dashboard metricas
```

## Fora do escopo

- Upload de imagens pelo frontend (cliente envia via WhatsApp)
- Billing/planos no frontend
- Gerenciamento de canais/dominios (admin API)
- Responsive mobile (desktop first para operador)
- Refresh token flow avancado (next-auth cuida)
