# MVP v1

## Resumo

O MVP v1 sera uma plataforma multi-tenant de atendimento conversacional que recebe mensagens e imagens de clientes via WhatsApp, interpreta a solicitacao com uma LLM e executa composicoes visuais para apoiar atendimento comercial.

O foco do MVP nao e um editor publico. O foco e:

- entrada conversacional
- orquestracao automatizada
- composicao visual assistida
- revisao humana quando necessario
- medicao por tenant

## Escopo do MVP

### Inclui

- superadmin com criacao manual de tenants
- tenant com configuracoes proprias de branding, limite e canal
- opcao de dominio proprio por tenant
- integracao com UAZAPI/WUZAPI para WhatsApp
- integracao com OpenRouter para classificacao e orquestracao
- pipelines `interior` e `product`
- painel interno de acompanhamento e revisao
- metering de mensagens, tokens, jobs e custo

### Fica para depois

- integracao com Instagram
- modo `fashion` em producao
- billing automatico
- self-service para onboarding de tenant

## Casos de uso do MVP

### Interior

- cliente envia foto da sala
- envia cor, revestimento, piso ou foto do movel
- sistema gera simulacao

### Produto

- cliente envia foto da pessoa ou cena
- envia foto do copo, garrafa ou objeto
- sistema gera composicao do produto no contexto

## Jornada principal

1. mensagem chega pelo WhatsApp
2. sistema identifica tenant, canal e contato
3. conversa e anexos sao persistidos
4. LLM identifica intencao
5. se faltar imagem ou referencia, o sistema pede
6. orquestrador cria job de composicao
7. pipeline visual gera o render
8. resultado vai para envio automatico ou revisao humana
9. resposta volta no mesmo canal

## Requisitos funcionais

- onboarding manual de tenant
- cadastro de dominio proprio por tenant
- cadastro de sessao WhatsApp por tenant
- historico de conversas por contato
- armazenamento de imagens recebidas e geradas
- criacao de jobs por modo
- reenvio de mensagens pelo canal de origem
- fila de revisao humana
- painel com metricas basicas por tenant

## Requisitos nao funcionais

- isolamento por `tenant_id` em todos os dados operacionais
- contratos estaveis entre gateway, orquestrador e motores
- jobs pesados fora do request principal
- rastreabilidade de uso e custo por conversa
- possibilidade de aplicar guardrails por tenant

## Modulos do sistema

### `services/channel-gateway`

Responsabilidades:

- receber webhooks do UAZAPI/WUZAPI
- validar e normalizar payloads
- resolver tenant por sessao, webhook ou numero conectado
- publicar eventos internos de conversa

### `services/orchestrator`

Responsabilidades:

- chamar OpenRouter
- classificar a intencao
- coletar dados faltantes
- selecionar o modo de composicao
- executar tools internas
- decidir se o caso pode ser enviado automaticamente

### `services/composition`

Responsabilidades:

- executar pipelines visuais por modo
- armazenar renders e artefatos auxiliares
- calcular sinais de confianca para revisao

### `services/billing-metering`

Responsabilidades:

- registrar tokens, custo, latencia, jobs e conversoes
- expor relatorios por tenant
- aplicar limites operacionais

### `apps/superadmin`

Responsabilidades:

- criar tenant manualmente
- configurar dominio, canal, plano e limites
- acompanhar saude da plataforma

### `apps/tenant-console`

Responsabilidades:

- visualizar inbox e jobs
- revisar imagens
- corrigir ou reenfileirar composicoes
- ajustar catalogo, prompts e branding

## Modos priorizados

### 1. `interior`

Entradas:

- imagem do ambiente
- referencia de cor, textura, movel ou produto

Saida:

- imagem com parede, piso, revestimento ou objeto aplicado

### 2. `product`

Entradas:

- imagem da pessoa ou cena
- imagem do produto

Saida:

- produto inserido e harmonizado no contexto

### 3. `print`

Mantido em backlog de implementacao curta.

### 4. `fashion`

Mantido atras de `feature flag` e de revisao de licenca.

## Regras de automacao

- `interior` simples pode seguir para `auto-send` se o score do pipeline for alto
- `product` com posicionamento mais complexo deve ir para revisao
- `fashion` vai para revisao obrigatoria no MVP

## Metricas do MVP

- mensagens recebidas por tenant
- conversas ativas por tenant
- jobs criados por modo
- taxa de revisao humana
- tempo medio ate primeira imagem
- custo LLM por tenant
- custo visual por tenant

## Decisao

O MVP deve nascer como uma esteira conversacional multi-tenant com pipelines visuais especializados, e nao como um editor self-service para o usuario final.
