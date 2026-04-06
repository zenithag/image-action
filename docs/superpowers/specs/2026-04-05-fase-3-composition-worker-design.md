# Fase 3: Composition Worker + MinIO Storage — Design

## Resumo

Implementar o composition worker real (OpenRouter Nano Banana Pro), upload de imagens para MinIO no gateway, e endpoint interno no api-server para envio do resultado ao cliente.

## Componentes

### 1. MinIO Storage Module (`services/api-server/app/storage/`)

- `client.py` — wrapper MinIO (upload bytes, download bytes, presigned URL)
- Gateway usa para salvar imagens recebidas do WhatsApp (baixa da URL → sobe MinIO)
- Cria bucket `tenant-assets` no startup se nao existir

### 2. Gateway — upload real de imagens

- Ao receber mensagem com midia: baixa imagem via httpx da URL do WhatsApp
- Faz upload sincrono para MinIO com `storage_key` ja definido
- Atualiza `assets.metadata_json` com URL original

### 3. Composition Worker — processor real

- `processor.py` — chama OpenRouter com `google/gemini-3-pro-image-preview`
- Envia: imagem base (baixa do MinIO) + imagem referencia do catalogo (baixa do MinIO) + prompt descritivo
- Recebe imagem em base64, faz upload para MinIO
- Cria Asset (role=render) e Render no banco
- Retry: ate 2 tentativas com backoff de 5s
- `storage.py` — operacoes MinIO do worker
- `notifier.py` — chama `POST api-server/v1/internal/job-completed/{job_id}`

### 4. Api-server — endpoint interno de job completed

- `POST /v1/internal/job-completed/{job_id}`
- Busca job, render e asset
- Gera presigned URL do MinIO
- Envia imagem no WhatsApp via channel sender
- Atualiza conversation state (`composing` → `completed`)
- Persiste mensagem outbound (content_type=composition_result)
- Registra billing

## Fluxo de dados

```
Cliente envia foto (WhatsApp)
  -> Gateway: baixa imagem -> upload MinIO -> persiste Asset (storage_key real)
  -> Orchestrator: classifica, state machine -> cria CompositionJob (queued)

Worker (polling):
  -> Pega job (SELECT FOR UPDATE SKIP LOCKED)
  -> Baixa imagem base do MinIO (asset.storage_key)
  -> Baixa imagem referencia do catalogo do MinIO
  -> Chama OpenRouter Nano Banana Pro (base64 in/out)
  -> Upload render para MinIO
  -> INSERT Asset (role=render) + Render
  -> POST api-server/v1/internal/job-completed/{job_id}
  -> Falha? Retry 2x com backoff 5s, depois status=failed + notifica

Api-server (callback):
  -> Gera presigned URL do render
  -> Envia imagem no WhatsApp
  -> Atualiza conversation.state -> completed
  -> Persiste mensagem + billing
```

## Fora do escopo

- WebSocket notifications (Fase 4)
- Auth no endpoint interno (Fase 4 — por enquanto sem auth)
- Upload de imagens de catalogo (admin faz manualmente no MinIO por enquanto)
