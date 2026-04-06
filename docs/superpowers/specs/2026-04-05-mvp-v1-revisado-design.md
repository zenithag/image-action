# MVP v1 — Design Revisado

## Resumo

Plataforma B2B multi-tenant de atendimento conversacional via WhatsApp com composicao visual automatizada. O sistema recebe mensagens de clientes, conduz a conversa com IA, apresenta opcoes do catalogo do tenant, e gera composicoes visuais usando o modelo Nano Banana Pro (Gemini 3 Pro Image Preview) via OpenRouter. Operadores acompanham e podem assumir conversas em tempo real pelo inbox do sistema.

## Decisoes de arquitetura

### Abordagem: 2 servicos Python + 1 frontend

Backend consolidado em 2 servicos:

- **api-server** — FastAPI com modulos: gateway, core, catalog, orchestrator, channel, billing, realtime, auth. Tudo que e request-response e WebSocket.
- **composition-worker** — worker standalone que consome jobs da fila PostgreSQL e chama OpenRouter (Nano Banana Pro) para gerar composicoes visuais.

Frontend em 1 app Next.js com rotas por role: superadmin e tenant console com inbox.

Justificativa: microservicos separados sao over-engineering para o MVP. A separacao logica por modulos permite extrair servicos futuramente sem refatoracao grande. O worker de composicao e o unico que precisa ser fisicamente separado por ser assincrono.

### Comunicacao entre componentes

- **Caminho sincrono** (HTTP): webhook chega no api-server, que normaliza, persiste, classifica intencao, atualiza state machine e responde — tudo no mesmo request.
- **Caminho assincrono** (fila PostgreSQL): quando o orchestrator decide criar um job, insere na tabela `composition_jobs` com status `queued`. O composition-worker faz polling com `SELECT ... FOR UPDATE SKIP LOCKED`.
- **Tempo real** (WebSocket): api-server notifica o frontend sobre mensagens novas, atualizacoes de jobs e mudancas de estado de conversas.

### Composicao visual: OpenRouter Nano Banana Pro

Sem GPU propria. O composition-worker chama a API do OpenRouter usando o modelo `google/gemini-3-pro-image-preview` (Nano Banana Pro) com `modalities: ["image", "text"]`. Envia a imagem base do cliente + imagem de referencia do catalogo + prompt descritivo. Recebe a imagem composta em base64, salva no MinIO.

Fallback disponivel: Nano Banana 2 (Gemini 3.1 Flash Image) para composicoes mais simples com menor custo e latencia.

Tratamento de falhas: se a chamada ao OpenRouter falhar (timeout, erro de API, imagem invalida), o worker atualiza o job para `status = 'failed'` com `error_message` preenchido. O api-server notifica via WebSocket e a IA envia mensagem ao cliente pedindo desculpas e sugerindo tentar novamente. Retry automatico: ate 2 tentativas com backoff de 5s antes de marcar como failed.

### Autenticacao: Zitadel self-hosted

- Organizations no Zitadel = tenants na plataforma
- Roles: superadmin (organizacao Platform), tenant_admin e operator (por organizacao)
- JWT validado no api-server via JWKS (sem chamada de rede por request)
- WebSocket autenticado via JWT no handshake
- Service-to-service via machine users com client credentials

### Infraestrutura: VPS Hostinger + Dokploy

6 containers: postgresql, minio, zitadel, api-server, composition-worker, web. VPS com 4-8GB RAM. Dokploy gerencia deploy, proxy reverso (Traefik) e certificados SSL (Let's Encrypt).

## Escopo do MVP

### Inclui

- Superadmin: criacao manual de tenants, configuracao de dominio, canal, plano e limites
- Catalogo de produtos por tenant: categorias, items com tags estruturados, imagens de referencia
- Integracao WhatsApp bidirecional via UAZAPI/WUZAPI (receber e enviar mensagens)
- Classificacao de intencao via OpenRouter (LLM texto)
- State machine hibrida: estados explicitos para marcos do fluxo + LLM para conversa natural
- Filtragem de catalogo por tags extraidos da conversa, envio de 3-5 opcoes no WhatsApp
- Composicao visual via Nano Banana Pro (OpenRouter) — sem GPU propria
- Envio automatico do resultado ao cliente (sem gate de revisao humana)
- Inbox em tempo real (WebSocket) no tenant console: chat espelhando WhatsApp
- Takeover pelo operador: assumir e devolver conversa para IA
- Metering de mensagens, tokens, jobs e custo por tenant
- Pipelines: `interior` e `product`

### Nao inclui (fica para depois)

- Integracao com Instagram
- Pipeline `fashion` em producao (feature flag)
- Pipeline `print` (backlog)
- Billing automatico (cobranca)
- Self-service para onboarding de tenant
- Busca semantica com embeddings no catalogo
- Editor visual manual (Fabric.js)

## Modelo de dados

### Entidades mantidas sem alteracao

**Tenant**
- `id` UUID PK
- `name` TEXT
- `slug` TEXT UNIQUE
- `status` TEXT: draft, active, suspended, archived
- `plan_code` TEXT
- `created_at` TIMESTAMPTZ

**TenantDomain**
- `id` UUID PK
- `tenant_id` UUID FK → tenants
- `hostname` TEXT UNIQUE
- `is_primary` BOOLEAN
- `status` TEXT: pending_verification, verified, failed, disabled
- `verified_at` TIMESTAMPTZ

**TenantChannel**
- `id` UUID PK
- `tenant_id` UUID FK → tenants
- `channel_type` TEXT: whatsapp, instagram
- `provider` TEXT: uazapi, wuzapi
- `external_session_id` TEXT
- `webhook_secret` TEXT — para validacao de webhooks recebidos
- `status` TEXT: pending, connected, disconnected, error

**LlmProfile**
- `id` UUID PK
- `tenant_id` UUID FK → tenants
- `provider` TEXT: openrouter
- `default_model` TEXT
- `fallback_model` TEXT (nullable)
- `system_prompt` TEXT
- `guardrail_config` JSONB

**Contact**
- `id` UUID PK
- `tenant_id` UUID FK → tenants
- `external_contact_id` TEXT
- `display_name` TEXT
- `phone` TEXT (nullable)
- UNIQUE(tenant_id, external_contact_id)

**UsageEvent**
- `id` UUID PK
- `tenant_id` UUID FK → tenants
- `kind` TEXT
- `provider` TEXT
- `reference_id` TEXT (nullable)
- `quantity` NUMERIC(18,4)
- `unit_cost` NUMERIC(18,8)
- `total_cost` NUMERIC(18,8)
- `metadata_json` JSONB

### Entidades ajustadas

**Conversation**
- `id` UUID PK
- `tenant_id` UUID FK → tenants
- `channel_id` UUID FK → tenant_channels
- `contact_id` UUID FK → contacts
- `status` TEXT: open, waiting_customer, waiting_operator, closed
- `state` TEXT: idle, awaiting_base_image, collecting_preferences, showing_options, awaiting_selection, composing, completed
- `handled_by` TEXT: ai, operator
- `operator_id` UUID (nullable) — operador que assumiu
- `last_message_at` TIMESTAMPTZ
- `created_at` TIMESTAMPTZ

**Message**
- `id` UUID PK
- `tenant_id` UUID FK → tenants
- `conversation_id` UUID FK → conversations
- `direction` TEXT: inbound, outbound
- `role` TEXT: customer, assistant, operator, system
- `content` TEXT
- `content_type` TEXT: text, image, catalog_options, composition_result
- `provider_message_id` TEXT (nullable)
- `created_at` TIMESTAMPTZ

**Asset**
- `id` UUID PK
- `tenant_id` UUID FK → tenants
- `conversation_id` UUID FK → conversations (nullable)
- `role` TEXT: reference, base_image, overlay, mask, render, attachment, catalog
- `mime_type` TEXT
- `storage_key` TEXT
- `metadata_json` JSONB

**CompositionJob**
- `id` UUID PK
- `tenant_id` UUID FK → tenants
- `conversation_id` UUID FK → conversations
- `mode` TEXT: interior, product, print, fashion
- `status` TEXT: queued, processing, done, failed
- `catalog_item_id` UUID FK → catalog_items
- `base_asset_id` UUID FK → assets
- `overlay_asset_id` UUID FK → assets (nullable)
- `mask_asset_id` UUID FK → assets (nullable)
- `input_payload` JSONB
- `error_message` TEXT (nullable)
- `created_at` TIMESTAMPTZ

**Render**
- `id` UUID PK
- `tenant_id` UUID FK → tenants
- `job_id` UUID FK → composition_jobs
- `asset_id` UUID FK → assets
- `version` INTEGER
- `created_at` TIMESTAMPTZ

### Novas entidades

**CatalogCategory**
- `id` UUID PK
- `tenant_id` UUID FK → tenants
- `name` TEXT
- `parent_id` UUID FK → catalog_categories (nullable)
- `sort_order` INTEGER
- UNIQUE(tenant_id, name, parent_id)

**CatalogItem**
- `id` UUID PK
- `tenant_id` UUID FK → tenants
- `category_id` UUID FK → catalog_categories
- `name` TEXT
- `description` TEXT
- `sku` TEXT (nullable)
- `status` TEXT: active, inactive
- `tags` JSONB — atributos estruturados: cor, material, estilo, marca, dimensao
- `created_at` TIMESTAMPTZ

**CatalogItemImage**
- `id` UUID PK
- `tenant_id` UUID FK → tenants
- `catalog_item_id` UUID FK → catalog_items
- `asset_id` UUID FK → assets
- `role` TEXT: primary, swatch, applied_example
- `sort_order` INTEGER

## Fluxo conversacional

### Fluxo principal: WhatsApp para composicao

1. Cliente envia mensagem e/ou midia no WhatsApp
2. UAZAPI/WUZAPI envia webhook ao api-server
3. Gateway module: normaliza payload, resolve tenant por session_id do canal, faz upsert de Contact, cria ou recupera Conversation
4. Core module: persiste Message e Assets (imagens vao para MinIO)
5. Orchestrator module verifica `conversation.handled_by`:
   - Se `operator`: nao faz nada, operador esta no controle
   - Se `ai`: continua processamento
6. Orchestrator consulta `conversation.state` e envia historico para LLM (OpenRouter)
7. LLM decide proxima acao baseada no estado:

**State machine:**

| Estado | Gatilho de entrada | Acao | Proximo estado |
|--------|-------------------|------|----------------|
| `idle` | nova conversa ou conversa concluida | LLM classifica intencao | `awaiting_base_image` (visual_edit), mantém `idle` (commercial_question), `handed_by=operator` (human_handoff) |
| `awaiting_base_image` | intencao visual identificada | LLM pede foto do ambiente/cena | `collecting_preferences` (foto recebida) |
| `collecting_preferences` | foto base recebida | LLM pergunta preferencias (cor, estilo, material) | `showing_options` (preferencias coletadas) |
| `showing_options` | preferencias extraidas | filtra CatalogItems por tags, envia 3-5 opcoes com imagens | `awaiting_selection` |
| `awaiting_selection` | opcoes enviadas | aguarda cliente escolher | `composing` (cliente escolheu) |
| `composing` | selecao feita | cria CompositionJob, worker processa | `completed` (render pronto e enviado) |
| `completed` | render enviado | LLM pergunta se gostou, oferece ver mais opcoes | `idle` (nova solicitacao) ou `showing_options` (quer ver mais) |

8. Channel module envia resposta no WhatsApp via UAZAPI/WUZAPI
9. Billing module registra UsageEvent
10. WebSocket notifica tenant console

### Fluxo de envio de opcoes do catalogo

1. Orchestrator extrai tags da mensagem do cliente (cor, material, estilo)
2. Catalog search filtra CatalogItems por tags via query JSONB
3. Seleciona top 3-5 por relevancia
4. Para cada item: busca CatalogItemImage (role = primary) no MinIO
5. Channel module envia sequencialmente no WhatsApp: imagem + descricao numerada
6. Mensagem final: "Qual opcao voce prefere? Responda com o numero."
7. Cada envio e persistido como Message (content_type = catalog_options)

### Fluxo de takeover pelo operador

1. Operador ve conversa no inbox do tenant console
2. Clica em "Assumir conversa"
3. api-server atualiza: `conversation.handled_by = 'operator'`, `operator_id = UUID`
4. IA para de responder automaticamente
5. Operador conversa pelo inbox — mensagens vao para WhatsApp via channel module
6. Operador clica em "Devolver para IA"
7. api-server atualiza: `handled_by = 'ai'`, `operator_id = null`
8. IA retoma com base no `conversation.state` atual

### Fluxo de onboarding de tenant

1. Superadmin cria tenant no painel
2. Zitadel: cria Organization correspondente
3. Cadastra plano e limites iniciais
4. Conecta sessao do WhatsApp (external_session_id do UAZAPI/WUZAPI)
5. Define dominio principal
6. Configura LlmProfile e system prompt
7. Tenant admin cadastra catalogo de produtos com imagens
8. Publica tenant para operacao (status = active)

## Estrutura de modulos

### api-server

```
services/api-server/
├── pyproject.toml
├── app/
│   ├── main.py
│   ├── config.py
│   ├── db.py
│   ├── gateway/
│   │   ├── router.py
│   │   ├── schemas.py
│   │   └── normalizer.py
│   ├── core/
│   │   ├── router.py
│   │   ├── schemas.py
│   │   └── repository.py
│   ├── catalog/
│   │   ├── router.py
│   │   ├── schemas.py
│   │   ├── repository.py
│   │   └── search.py
│   ├── orchestrator/
│   │   ├── router.py
│   │   ├── schemas.py
│   │   ├── intent.py
│   │   ├── state_machine.py
│   │   ├── conversation_handler.py
│   │   └── openrouter_client.py
│   ├── channel/
│   │   ├── router.py
│   │   ├── schemas.py
│   │   └── sender.py
│   ├── billing/
│   │   ├── router.py
│   │   ├── schemas.py
│   │   └── tracker.py
│   ├── realtime/
│   │   ├── manager.py
│   │   ├── router.py
│   │   └── events.py
│   └── auth/
│       ├── middleware.py
│       ├── dependencies.py
│       └── schemas.py
```

### composition-worker

```
services/composition-worker/
├── pyproject.toml
├── worker/
│   ├── main.py
│   ├── config.py
│   ├── processor.py
│   ├── openrouter_client.py
│   ├── storage.py
│   └── notifier.py
```

Comportamento do worker:
- Polling interval: 2 segundos
- Concorrencia: 1 job por vez (simplifica o MVP, aumentavel depois)
- Ao concluir um job: atualiza `composition_jobs.status` no banco, chama `POST api-server/v1/internal/job-completed/{job_id}` para disparar envio da imagem no WhatsApp e notificacao WebSocket
- Ao falhar: ate 2 retries com backoff de 5s. Se todas falham: `status = 'failed'`, `error_message` preenchido, mesma chamada ao api-server para notificar falha

### Frontend (apps/web)

```
apps/web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── superadmin/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── tenants/page.tsx
│   │   └── tenants/[id]/page.tsx
│   └── tenant/[slug]/
│       ├── layout.tsx
│       ├── page.tsx
│       ├── inbox/page.tsx
│       ├── inbox/[conversationId]/page.tsx
│       ├── catalog/page.tsx
│       ├── catalog/[itemId]/page.tsx
│       ├── jobs/page.tsx
│       └── settings/page.tsx
├── components/
│   ├── ui/
│   ├── inbox/
│   ├── catalog/
│   └── dashboard/
├── hooks/
│   ├── use-websocket.ts
│   └── use-auth.ts
└── lib/
    ├── api.ts
    └── utils.ts
```

## Infraestrutura

### Containers no Dokploy

| Container | Porta | Depende de |
|-----------|-------|------------|
| postgresql | 5432 (interna) | — |
| minio | 9000, 9001 (interna) | — |
| zitadel | 8080 (interna) | postgresql |
| api-server | 8000 | postgresql, minio, zitadel |
| composition-worker | sem porta | postgresql, minio |
| web | 3000 | api-server, zitadel |

### Dominios (Traefik via Dokploy)

| Dominio | Destino |
|---------|---------|
| app.seudominio.com | web (3000) |
| api.seudominio.com | api-server (8000) |
| auth.seudominio.com | zitadel (8080) |
| storage.seudominio.com | minio (9000) |
| {tenant-slug}.seudominio.com | web (resolve por hostname) |
| {dominio-proprio}.com.br | web (lookup TenantDomain) |

SSL automatico via Let's Encrypt.

### Recursos estimados

VPS com 4GB RAM minimo, 8GB recomendado. Total estimado dos 6 containers: ~1.7GB RAM.

### Backup

- PostgreSQL: pg_dump diario via cron
- MinIO: rclone sync para storage externo (opcional)

## Seguranca

### Autenticacao

- Zitadel: Organizations = tenants, roles por organizacao (tenant_admin, operator)
- JWT validado via JWKS no api-server (middleware FastAPI)
- WebSocket: JWT no handshake, conexao rejeitada se invalido
- Service-to-service: machine users com client credentials

### Isolamento de dados

- `tenant_id` em todas as tabelas operacionais
- tenant_id extraido do JWT, nunca do request body
- Todas as queries filtradas por tenant_id

### Webhooks

- Validacao por token secreto no header (configurado por TenantChannel)
- IP whitelist quando o provider suportar

## Metricas do MVP

- Mensagens recebidas e enviadas por tenant
- Conversas ativas por tenant
- Jobs criados por modo (interior, product)
- Tempo medio de composicao (queue → done)
- Custo LLM (tokens texto) por tenant
- Custo composicao (tokens imagem) por tenant
- Taxa de takeover pelo operador

## Stack tecnologica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Backend API | FastAPI, Python 3.12, Pydantic v2, Uvicorn |
| Worker | Python 3.12 standalone |
| Banco de dados | PostgreSQL 16 |
| Storage | MinIO |
| Auth | Zitadel (self-hosted) |
| LLM texto | OpenRouter (modelo configuravel por tenant) |
| LLM imagem | OpenRouter — Nano Banana Pro (google/gemini-3-pro-image-preview) |
| WhatsApp | UAZAPI / WUZAPI |
| Deploy | Dokploy (VPS Hostinger) |
| Proxy/SSL | Traefik (via Dokploy) + Let's Encrypt |

## Contratos TypeScript (packages/contracts)

Tipos a atualizar no `packages/contracts/src/index.ts`:

- Adicionar: `CatalogCategory`, `CatalogItem`, `CatalogItemImage`
- Adicionar a `ConversationState`: tipo union dos estados da state machine
- Adicionar `handled_by` e `operator_id` em `Conversation`
- Adicionar `content_type` em `Message`
- Adicionar `catalog_item_id` em `CompositionJob`
- Remover `review_required` de `CompositionJob`
- Adicionar role `catalog` em `AssetRole`
- Adicionar tipos de eventos WebSocket

## Modos priorizados

### 1. interior

Entradas: imagem do ambiente + CatalogItem (revestimento, tinta, piso, movel)
Saida: imagem com o produto aplicado no ambiente
Prompt para Nano Banana Pro: descreve a transformacao desejada com base na categoria e atributos do item

### 2. product

Entradas: imagem da pessoa ou cena + CatalogItem (copo, garrafa, objeto)
Saida: produto inserido e harmonizado no contexto
Prompt para Nano Banana Pro: descreve posicionamento e harmonizacao do produto na cena

### 3. print (backlog)

Em backlog de implementacao curta.

### 4. fashion (feature flag)

Atras de feature flag e revisao de licenca.
