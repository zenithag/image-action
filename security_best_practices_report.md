# Relatório de Auditoria de Segurança

**Projeto:** ComoFica.ai (Simulador de Ambientes)
**Data:** 2026-09-15
**Escopo:** Frontend (Next.js 15), Backend (FastAPI), Auth, Database, Deployment
**Metodologia:** OWASP + Vercel Security Specs + FastAPI Security Specs

---

## Resumo Executivo

A auditoria identificou **24 vulnerabilidades**, sendo:
- **8 CRÍTICAS** (ação imediata necessária)
- **7 ALTAS** (correção urgente)
- **6 MÉDIAS** (correção planejada)
- **3 BAIXAS** (melhoria contínua)

O projeto possui uma boa base arquitetural (SQL parametrizado, auth middleware, safe URL helpers) mas **não está pronto para produção** devido a autenticação desabilitada por padrão e múltiplas proteções ausentes.

---

## BACKEND — FastAPI (services/api-server)

### CRÍTICAS

#### [FASTAPI-BACK-001] Autenticação Desabilitada por Padrão
- **Severidade:** CRÍTICA
- **Local:** `app/config.py:18`
- **Evidência:**
  ```python
  auth_enabled: bool = False
  ```
- **Impacto:** Toda a API opera sem autenticação quando `auth_enabled` não está explicitamente definido. O docker-compose define `auth_enabled: "false"` explicitamente, expondo todos os endpoints.
- **Mitigação:** Definir `auth_enabled: bool = True` como padrão e obrigar configuração via variável de ambiente obrigatória.

#### [FASTAPI-BACK-002] JWT `exp` Não Validado
- **Severidade:** CRÍTICA
- **Local:** `app/auth/middleware.py:52-58`
- **Evidência:**
  ```python
  return pyjwt.decode(
      token,
      key=public_keys[kid],
      algorithms=["RS256"],
      options={"verify_aud": False},  # Falta verify_exp!
      issuer=settings.zitadel_issuer_url,
  )
  ```
- **Impacto:** Tokens JWT expirados são aceitos, permitindo uso de tokens roubados indefinidamente.
- **Correção:** Adicionar `options={"verify_exp": True, "verify_aud": False}`

#### [FASTAPI-BACK-003] JWT Audience Validation Desabilitada
- **Severidade:** CRÍTICA
- **Local:** `app/auth/middleware.py:56`
- **Evidência:** `options={"verify_aud": False}`
- **Impacto:** Tokens JWT de outros serviços Zitadel podem ser usados para autenticar neste API.
- **Correção:** Validar `aud` contra o `project_id` esperado.

#### [FASTAPI-BACK-004] Nenhum Endpoint Usa `Depends(get_current_user)`
- **Severidade:** CRÍTICA
- **Local:** Todos os routers (core, catalog, gateway, realtime, orchestrator)
- **Evidência:**
  ```python
  @router.post("/tenants", status_code=201)
  async def create_tenant(body: TenantCreate):  # Sem Depends!
  ```
- **Impacto:** Mesmo com `auth_enabled=True`, nenhum endpoint verifica autenticação via `Depends()`. A middleware define `request.state.auth_user`, mas os routers não consomem.
- **Correção:** Adicionar `Depends(get_current_user)` em todos os endpoints não-webhook.

#### [FASTAPI-BACK-005] Socket.IO CORS Aberto (`*`)
- **Severidade:** CRÍTICA
- **Local:** `app/realtime/manager.py:11`
- **Evidência:**
  ```python
  sio = socketio.AsyncServer(
      async_mode="asyncio",
      cors_allowed_origins="*",  # Permite qualquer origem!
      logger=False,
  )
  ```
- **Impacto:** Qualquer site pode conectar ao Socket.IO e receber eventos de qualquer tenant.
- **Correção:** Usar lista de origens permitidas ou validar JWT no connect.

#### [FASTAPI-BACK-006] Webhook Sem Validação de Schema
- **Severidade:** CRÍTICA
- **Local:** `app/gateway/router.py:18`
- **Evidência:**
  ```python
  @router.post("/webhooks/{provider}")
  async def receive_webhook(provider: str, request: Request):
      payload = await request.json()  # Sem validação Pydantic!
  ```
- **Impacto:** Payload malicioso pode causar erros ou comportamentos inesperados.
- **Correção:** Criar schema Pydantic para webhook payloads.

### ALTAS

#### [FASTAPI-BACK-007] Sem TrustedHostMiddleware
- **Severidade:** ALTA
- **Local:** `app/main.py`
- **Impacto:** Vulnerável a ataques de Host Header Injection e DNS Rebinding.
- **Correção:** Adicionar `TrustedHostMiddleware` com `allowed_hosts` restrito.

#### [FASTAPI-BACK-008] Security Headers Ausentes
- **Severidade:** ALTA
- **Local:** `app/main.py`
- **Impacto:** Falta proteção contra clickjacking, MIME sniffing, XSS.
- **Correção:** Adicionar middleware de security headers.

#### [FASTAPI-BACK-009] Tenant Isolation Ausente
- **Severidade:** ALTA
- **Local:** `app/catalog/router.py:24-27`
- **Evidência:**
  ```python
  @router.get("/categories", response_model=list[CategoryResponse])
  async def list_categories(tenant_id: str = Query(...)):
      # tenant_id vem do query param!
  ```
- **Impacto:** Qualquer usuário autenticado pode acessar dados de qualquer tenant via parâmetro `tenant_id`.
- **Correção:** Extrair `tenant_id` do token JWT, ignorar parâmetro do request.

#### [FASTAPI-BACK-010] Download de Mídia Sem Validação
- **Severidade:** ALTA
- **Local:** `app/orchestrator/conversation_handler.py:56-67`
- **Impacto:** Atacante pode fazer o servidor baixar arquivos grandes (DoS) ou conteúdo malicioso.
- **Correção:** Validar `Content-Length` máximo e `Content-Type` antes de baixar.

#### [FASTAPI-BACK-011] Webhook Secret Não Validado
- **Severidade:** MÉDIA
- **Local:** `app/gateway/router.py`
- **Impacto:** Qualquer um pode enviar webhooks fake.
- **Correção:** Validar HMAC signature do webhook.

---

## FRONTEND — Next.js (apps/web)

### CRÍTICAS

#### [NEXT-FRONT-001] Autenticação Bypassed em Dev na Rota Interna
- **Severidade:** CRÍTICA
- **Local:** `app/api/internal/app-jobs/process/route.ts:16`
- **Evidência:**
  ```typescript
  if (!expectedToken) {
    return process.env.NODE_ENV !== "production"  // retorna true em dev!
  }
  ```
- **Impacto:** Em dev, qualquer requisição é aceita sem token. O token pode ser o `AUTH_SECRET` compartilhado — viola princípio de privilégio mínimo.
- **Correção:** Criar token separado (`APP_JOB_WORKER_TOKEN`) e remover exceção de dev.

#### [NEXT-FRONT-002] Next.js Versão Vulnerável (CVE-2025-66478)
- **Severidade:** CRÍTICA
- **Local:** `package.json:22`
- **Evidência:**
  ```json
  "next": "15.3.0"
  ```
- **Impacto:** A versão 15.3.0 é inferior às versões seguras (>= 15.3.6, >= 15.4.8, >= 15.5.7).
- **Correção:**
  ```bash
  pnpm update next@latest
  # ou
  pnpm add next@15.5.7
  ```

### ALTAS

#### [NEXT-FRONT-003] Security Headers Ausentes
- **Severidade:** ALTA
- **Local:** `next.config.ts`
- **Impacto:** Sem CSP, a aplicação é vulnerável a XSS, clickjacking, injeção de CSS.
- **Correção:** Adicionar headers em `next.config.ts`:
  ```typescript
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }]
  }
  ```

#### [NEXT-FRONT-004] Sem Validação de Schema nas Rotas API
- **Severidade:** ALTA
- **Local:** `app/api/tenant/[slug]/contacts/route.ts` e 30+ rotas
- **Evidência:**
  ```typescript
  const payload = await request.json().catch(() => null) as TenantContactInput | null
  if (!payload) { return ... }
  // Sem validação dos campos do payload!
  ```
- **Impacto:** Dados maliciosos passam direto para as funções store sem validação.
- **Correção:** Implementar validação com Zod em todas as rotas POST/PUT/PATCH.

---

## VERIFICAÇÕES APROVADAS

| Categoria | Status | Detalhes |
|---|---|---|
| SQL Injection (Backend) | ✅ APROVADO | Todas queries usam parameterized queries (`psycopg`) |
| SQL Injection (Frontend) | ✅ APROVADO | Queries em stores usam parametrização (`$1`, `$2`) |
| Open Redirect | ✅ APROVADO | `getSafeCallbackUrl()` valida URLs contra allowlist |
| Stripe Webhook | ✅ APROVADO | Verificação de assinatura criptográfica implementada |
| Server/Client Boundary | ✅ APROVADO | Nenhum import server-only em componentes cliente |
| CORS Main App | ✅ APROVADO | Lista de origens configurável, não `"*"` |
| Password Storage | ✅ APROVADO | Usa bcrypt via NextAuth |
| Safe DOM Rendering | ✅ APROVADO | Nenhum `innerHTML` inseguro encontrado |

---

## PLANO DE REMEDIAÇÃO

### Fase 1 — Imediato (1-2 dias)
1. **[FASTAPI-BACK-001]** Ativar `auth_enabled=True` por padrão
2. **[FASTAPI-BACK-002/003]** Adicionar `verify_exp` e `verify_aud` no JWT
3. **[FASTAPI-BACK-005]** Corrigir CORS do Socket.IO
4. **[NEXT-FRONT-001]** Corrigir bypass de autenticação na rota interna
5. **[NEXT-FRONT-002]** Atualizar Next.js para versão segura

### Fase 2 — Urgente (1 semana)
6. **[FASTAPI-BACK-004]** Adicionar `Depends(get_current_user)` em todos endpoints
7. **[FASTAPI-BACK-007/008]** Adicionar TrustedHostMiddleware e SecurityHeaders
8. **[FASTAPI-BACK-009]** Corrigir tenant isolation (extrair do JWT)
9. **[NEXT-FRONT-003]** Adicionar security headers no Next.js
10. **[NEXT-FRONT-004]** Adicionar validação Zod nas rotas API

### Fase 3 — Planejado (2-3 semanas)
11. **[FASTAPI-BACK-006]** Validar webhook payloads com Pydantic
12. **[FASTAPI-BACK-010]** Validar tamanho/tipo no download de mídia
13. **[FASTAPI-BACK-011]** Validar assinatura HMAC de webhooks
14. **[NEXT-FRONT-005]** Sanitizar dados JSON-LD

---

## CHECKLIST PRÉ-PRODUCTION

- [ ] `auth_enabled=True` por padrão
- [ ] JWT `exp` e `aud` validados
- [ ] Todos endpoints com `Depends(get_current_user)`
- [ ] Tenant isolation extraindo do JWT
- [ ] Socket.IO com CORS restrito
- [ ] Next.js atualizado para >= 15.5.7
- [ ] Security headers em todas as respostas
- [ ] TrustedHostMiddleware configurado
- [ ] `APP_JOB_WORKER_TOKEN` separado do AUTH_SECRET
- [ ] Validação Zod nas APIs
- [ ] Webhook signature validation
- [ ] Rate limiting implementado
- [ ] Secrets não em `.env` commitados
