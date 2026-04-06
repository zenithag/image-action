# Plataforma Conversacional de Composicao Visual

Monorepo inicial para uma plataforma B2B multi-tenant de atendimento conversacional com geracao de composicoes visuais.

## Posicionamento do produto

O produto nao sera um editor publico para clientes finais. Ele sera usado por empresas que atendem via WhatsApp e, depois, Instagram.

Fluxo principal:

1. o cliente entra em contato por um canal de mensagem
2. a LLM conduz a conversa
3. o sistema coleta texto, imagens e referencias
4. o orquestrador escolhe o pipeline visual adequado
5. o motor de composicao gera a imagem
6. o resultado volta ao canal ou vai para revisao humana

## Canais e provedores assumidos

- WhatsApp: UAZAPI/WUZAPI
- LLM gateway: OpenRouter

## Casos de uso suportados

- interiores: tinta, revestimento, piso, moveis e objetos em ambientes
- produto: copos, garrafas e objetos inseridos em pessoas ou cenas
- estampa: aplicacao de arte em camiseta e outras pecas
- vestuario: roupa no corpo

## Principios de arquitetura

- multi-tenant desde o inicio
- onboarding de tenant manual via superadmin
- dominio proprio opcional por tenant
- custo e uso medidos por tenant
- human-in-the-loop para casos sensiveis
- motores visuais desacoplados do orquestrador conversacional

## Estrutura

```text
simulador-ambientes/
  apps/
    superadmin/       # backoffice global para operacao dos tenants
    tenant-console/   # painel interno de cada tenant
    web/              # shell web existente, a ser absorvido pelo tenant-console
  services/
    api/              # API principal
    channel-gateway/  # webhooks, normalizacao de mensagens e dispatch por tenant
    orchestrator/     # LLM orchestration, tools e regras de fluxo
    composition/      # motores visuais por modo
    billing-metering/ # uso, custo, limites e analytics
  packages/
    contracts/        # contratos compartilhados
    tenant-context/   # resolucao de tenant, dominio e isolamento
  docs/
    architecture.md
    data-model.md
    flows.md
    mvp-v1.md
```

## Stack assumida

- frontend operacional: Next.js + TypeScript
- backend: FastAPI + Python
- processamento: OpenCV + Pillow + NumPy
- editor interno: Fabric.js
- IA visual opcional: SAM 3, AnyDoor, libcom
- mensageria: UAZAPI/WUZAPI
- LLM orchestration: OpenRouter
- storage: S3 ou MinIO
- banco: PostgreSQL

## Perfis de acesso

### Superadmin

- cria tenant manualmente
- configura plano, limites e canais
- registra dominio proprio
- acompanha saude, uso e custos

### Tenant admin

- gerencia branding, catalogo e prompts-base
- acompanha conversas, jobs e resultados
- habilita operadores

### Operador

- revisa conversas
- corrige composicoes
- aprova e reenfileira jobs

## Prioridade do MVP

1. base multi-tenant e superadmin manual
2. ingestao de WhatsApp via UAZAPI/WUZAPI
3. orquestrador LLM via OpenRouter
4. pipeline `interior`
5. pipeline `product`
6. fila de revisao humana
7. metering e limites por tenant

## Proximos passos tecnicos

1. modelar banco e contratos multi-tenant
2. receber webhooks do canal com isolamento por tenant
3. classificar intencao e coletar anexos faltantes
4. criar jobs de composicao por modo
5. entregar resultado no mesmo canal

## Estado atual do scaffold

- frontend com `shadcn/ui` e camadas `ui -> atoms -> molecules -> organisms`
- rotas de demonstracao em `/`, `/superadmin` e `/tenant/[slug]`
- `services/api` com contratos multi-tenant e schema PostgreSQL inicial
- `services/channel-gateway` com normalizacao de webhooks
- `services/orchestrator` com heuristica local e fallback para OpenRouter via JSON schema

## Observacoes

- try-on de roupa continua dependendo de revisao de licenca dos modelos escolhidos
- o `apps/web` atual deve ser tratado como base temporaria para o futuro `tenant-console`
