# Architecture

## Visao geral

O sistema sera orientado por eventos curtos e jobs assicronos:

1. `channel-gateway` recebe mensagem
2. `api` persiste conversa e assets
3. `orchestrator` chama OpenRouter e decide o proximo passo
4. `composition` executa o render quando necessario
5. `tenant-console` ou `superadmin` acompanham o resultado
6. `channel-gateway` devolve a resposta ao cliente

## Componentes

### `services/api`

- identidade do tenant
- CRUD operacional
- assets, projetos de composicao e jobs
- auth interna para consoles

### `services/channel-gateway`

- adaptadores de canais
- webhooks
- envio de mensagens
- normalizacao de anexos

### `services/orchestrator`

- prompts de sistema por tenant
- tool calling
- state machine conversacional
- politicas de handoff humano

### `services/composition`

- pipelines `interior`, `product`, `print`, `fashion`
- harmonizacao, shadowing, warping e blending
- fila de execucao GPU/CPU

### `services/billing-metering`

- uso de LLM
- custo estimado e realizado
- limites e alertas
- analytics operacionais

## Resolucao de tenant

Tenant pode ser resolvido por:

- dominio acessado no console
- chave de API interna
- sessao do canal vinculada ao tenant
- webhook source do canal

## Isolamento

- `tenant_id` em todas as entidades operacionais
- storage prefixado por tenant
- configuracoes e prompts separados por tenant
- limites aplicados por tenant

## Dominio proprio

Cada tenant pode ter:

- subdominio padrao da plataforma
- dominio proprio primario
- dominios secundarios de apoio

Estados de dominio:

- `pending_verification`
- `verified`
- `failed`
- `disabled`
