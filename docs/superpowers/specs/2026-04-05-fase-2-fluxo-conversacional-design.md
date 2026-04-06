# Fase 2: Fluxo Conversacional — Design

## Resumo

Implementar o fluxo completo: webhook WhatsApp chega, sistema normaliza, resolve tenant, persiste mensagem, classifica intencao com LLM, executa state machine, responde no WhatsApp, registra uso.

## Modulos

### Gateway (`app/gateway/`)

- POST `/v1/webhooks/{provider}` (uazapi/wuzapi)
- Normaliza payload para `InboundChannelEvent`
- Resolve tenant por `external_session_id` via lookup em `tenant_channels`
- Upsert contact (cria se nao existe)
- Cria ou recupera conversation
- Persiste message + assets (imagens: salva storage_key, upload MinIO fica para depois)
- Chama orchestrator internamente

### Orchestrator (`app/orchestrator/`)

- Verifica `conversation.handled_by` — se `operator`, nao faz nada
- Consulta `conversation.state` + historico de mensagens
- Chama OpenRouter (LLM texto) para classificar intencao
- State machine decide proxima acao baseada no estado atual
- Executa acao: responder, pedir imagem, mostrar catalogo, criar job
- Atualiza `conversation.state`

### Channel (`app/channel/`)

- Envia mensagem de volta via UAZAPI/WUZAPI HTTP API
- Envia texto e/ou imagens
- Persiste mensagem outbound

### Billing (`app/billing/`)

- `tracker.py` — registra `UsageEvent` para cada chamada LLM e envio de mensagem

## Fluxo de dados

```
WhatsApp -> UAZAPI webhook -> POST /v1/webhooks/uazapi
  -> gateway/normalizer.py (normaliza payload)
  -> gateway/router.py (resolve tenant, upsert contact, persiste)
  -> orchestrator/conversation_handler.py (verifica handled_by)
  -> orchestrator/intent.py (classifica via OpenRouter)
  -> orchestrator/state_machine.py (decide proxima acao)
  -> channel/sender.py (envia resposta no WhatsApp)
  -> billing/tracker.py (registra uso)
```

## State Machine

| Estado | Gatilho de entrada | Acao | Proximo estado |
|--------|-------------------|------|----------------|
| `idle` | nova conversa ou conversa concluida | LLM classifica intencao | `awaiting_base_image` (visual_edit), mantem `idle` (commercial_question/smalltalk), `handled_by=operator` (human_handoff) |
| `awaiting_base_image` | intencao visual identificada | LLM pede foto do ambiente/cena | `collecting_preferences` (foto recebida) |
| `collecting_preferences` | foto base recebida | LLM pergunta preferencias (cor, estilo, material) | `showing_options` (preferencias coletadas) |
| `showing_options` | preferencias extraidas | filtra CatalogItems por tags, envia 3-5 opcoes com imagens | `awaiting_selection` |
| `awaiting_selection` | opcoes enviadas | aguarda cliente escolher | `composing` (cliente escolheu) |
| `composing` | selecao feita | cria CompositionJob, worker processa | `completed` (render pronto e enviado) |
| `completed` | render enviado | LLM pergunta se gostou, oferece ver mais opcoes | `idle` (nova solicitacao) ou `showing_options` (quer ver mais) |

## OpenRouter

- `openrouter_client.py` — wrapper httpx async para chamadas a API
- Classificacao de intencao: envia historico + system prompt, recebe JSON estruturado
- Resposta conversacional: LLM gera texto natural para cada estado
- Modelo padrao: configuravel por tenant via `llm_profiles`

## Fora do escopo da Fase 2

- WebSocket/realtime (Fase 3)
- Auth/Zitadel (Fase 4)
- Composition worker real com Nano Banana Pro (Fase 3 — cria job como `queued`)
- Upload real de imagens para MinIO (stub com storage_key)
