# Fase 3: Composition Worker + MinIO Storage — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar upload real de imagens para MinIO no gateway, composition worker com OpenRouter Nano Banana Pro, e endpoint interno no api-server para enviar resultado ao cliente.

**Architecture:** Storage module no api-server para upload/download MinIO. Gateway baixa imagens do WhatsApp e sobe para MinIO sincronamente. Composition worker busca imagens do MinIO, chama OpenRouter para gerar composicao, salva render no MinIO, e notifica api-server via HTTP callback. Api-server envia resultado no WhatsApp e atualiza estado.

**Tech Stack:** Python 3.12, FastAPI, MinIO (minio SDK), httpx, OpenRouter API (google/gemini-3-pro-image-preview), psycopg 3, pytest, respx

---

## Task 1: Storage module no api-server

**Files:**
- Create: `services/api-server/app/storage/__init__.py`
- Create: `services/api-server/app/storage/client.py`
- Create: `services/api-server/tests/test_storage.py`

- [ ] **Step 1: Criar storage/__init__.py vazio**

- [ ] **Step 2: Criar storage/client.py**

```python
import io
import logging
from urllib.parse import urljoin

from minio import Minio
from minio.error import S3Error

from app.config import settings

logger = logging.getLogger(__name__)

_client: Minio | None = None
BUCKET_NAME = "tenant-assets"


def get_minio_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
    return _client


def ensure_bucket() -> None:
    client = get_minio_client()
    if not client.bucket_exists(BUCKET_NAME):
        client.make_bucket(BUCKET_NAME)
        logger.info("Created bucket: %s", BUCKET_NAME)


def upload_bytes(storage_key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    client = get_minio_client()
    client.put_object(
        BUCKET_NAME,
        storage_key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
    return storage_key


def download_bytes(storage_key: str) -> bytes:
    client = get_minio_client()
    response = client.get_object(BUCKET_NAME, storage_key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def presigned_url(storage_key: str, expires_seconds: int = 3600) -> str:
    from datetime import timedelta
    client = get_minio_client()
    return client.presigned_get_object(
        BUCKET_NAME,
        storage_key,
        expires=timedelta(seconds=expires_seconds),
    )
```

- [ ] **Step 3: Adicionar minio_bucket ao config.py**

Em `services/api-server/app/config.py`, adicionar na classe Settings:

```python
    minio_bucket: str = "tenant-assets"
```

- [ ] **Step 4: Chamar ensure_bucket no startup**

Em `services/api-server/app/main.py`, dentro do lifespan, apos `await open_pool()`:

```python
    from app.storage.client import ensure_bucket
    try:
        ensure_bucket()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("MinIO bucket check failed (MinIO may not be running): %s", e)
```

- [ ] **Step 5: Escrever testes unitarios do storage**

`services/api-server/tests/test_storage.py`:
```python
from unittest.mock import MagicMock, patch

from app.storage.client import upload_bytes, download_bytes, presigned_url


@patch("app.storage.client.get_minio_client")
def test_upload_bytes(mock_get_client):
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client

    result = upload_bytes("tenants/t1/test.jpg", b"fake-image-data", "image/jpeg")

    assert result == "tenants/t1/test.jpg"
    mock_client.put_object.assert_called_once()
    call_args = mock_client.put_object.call_args
    assert call_args[0][0] == "tenant-assets"
    assert call_args[0][1] == "tenants/t1/test.jpg"


@patch("app.storage.client.get_minio_client")
def test_download_bytes(mock_get_client):
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.read.return_value = b"image-data"
    mock_client.get_object.return_value = mock_response
    mock_get_client.return_value = mock_client

    result = download_bytes("tenants/t1/test.jpg")

    assert result == b"image-data"
    mock_client.get_object.assert_called_once_with("tenant-assets", "tenants/t1/test.jpg")
    mock_response.close.assert_called_once()
    mock_response.release_conn.assert_called_once()


@patch("app.storage.client.get_minio_client")
def test_presigned_url(mock_get_client):
    mock_client = MagicMock()
    mock_client.presigned_get_object.return_value = "https://minio.local/tenant-assets/key?signature=abc"
    mock_get_client.return_value = mock_client

    result = presigned_url("tenants/t1/render.jpg")

    assert "minio.local" in result
    mock_client.presigned_get_object.assert_called_once()
```

- [ ] **Step 6: Rodar testes**

Run: `cd services/api-server && python -m pytest tests/test_storage.py -v`
Expected: 3 tests PASSED

- [ ] **Step 7: Commit**

```bash
git add services/api-server/app/storage/ services/api-server/app/config.py services/api-server/app/main.py services/api-server/tests/test_storage.py
git commit -m "feat: MinIO storage module with upload, download, and presigned URLs"
```

---

## Task 2: Gateway — upload de imagens para MinIO

**Files:**
- Modify: `services/api-server/app/orchestrator/conversation_handler.py`

- [ ] **Step 1: Modificar conversation_handler.py para baixar e subir imagens**

No bloco de persistencia de assets (linhas 45-55 do conversation_handler.py), substituir o loop de media por:

```python
    # 5. Persist assets if media present — download from WhatsApp, upload to MinIO
    has_image = False
    base_asset_id = None
    for media_item in inbound.media:
        storage_key = f"tenants/{tenant_id}/conversations/{conversation_id}/{inbound.external_message_id}"
        mime_type = media_item.get("mime_type", "image/jpeg")
        role = media_item.get("kind", "attachment")

        # Download image from WhatsApp URL and upload to MinIO
        image_url = media_item.get("url", "")
        image_data = None
        if image_url:
            try:
                async with httpx.AsyncClient(timeout=30) as http:
                    img_resp = await http.get(image_url)
                    img_resp.raise_for_status()
                    image_data = img_resp.content
            except Exception as e:
                logger.warning("Failed to download media from %s: %s", image_url, e)

        if image_data:
            from app.storage.client import upload_bytes
            upload_bytes(storage_key, image_data, mime_type)

        asset = await repo.create_asset(
            tenant_id, role, mime_type, storage_key,
            conversation_id=conversation_id,
            metadata_json={"url": image_url, "size": len(image_data) if image_data else 0},
        )
        if media_item.get("kind") == "image":
            has_image = True
            base_asset_id = str(asset["id"])
```

Tambem adicionar `import httpx` no topo do arquivo (apos os imports existentes).

E no bloco `create_composition_job` (por volta da linha 98), substituir o log stub por criacao real do job:

```python
    elif transition and transition.action == "create_composition_job":
        reply_text = intent_result.get("reply_text", "Estou gerando a composicao, aguarde um momento...")
        if base_asset_id:
            await repo.create_composition_job(
                tenant_id, conversation_id, intent_result.get("mode", "interior"),
                base_asset_id, catalog_item_id=None,
            )
            logger.info("Created composition job for conversation %s", conversation_id)
        else:
            logger.warning("No base_asset_id available for composition job in conversation %s", conversation_id)
```

- [ ] **Step 2: Rodar testes existentes**

Run: `cd services/api-server && python -m pytest tests/test_webhook_flow.py -v`
Expected: todos os testes PASSED (o mock do respx intercepta as chamadas HTTP)

- [ ] **Step 3: Commit**

```bash
git add services/api-server/app/orchestrator/conversation_handler.py
git commit -m "feat: gateway downloads WhatsApp images and uploads to MinIO"
```

---

## Task 3: Repository — queries para job completion

**Files:**
- Modify: `services/api-server/app/core/repository.py`

- [ ] **Step 1: Adicionar novas funcoes ao repository**

Adicionar ao final de `services/api-server/app/core/repository.py`:

```python
async def get_composition_job(job_id: str) -> dict | None:
    async with get_conn() as conn:
        cur = await conn.execute(
            "SELECT * FROM composition_jobs WHERE id = %s",
            (job_id,),
        )
        return await cur.fetchone()


async def update_job_status(job_id: str, status: str, error_message: str | None = None) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            "UPDATE composition_jobs SET status = %s, error_message = %s WHERE id = %s RETURNING *",
            (status, error_message, job_id),
        )
        return await cur.fetchone()


async def create_render(tenant_id: str, job_id: str, asset_id: str, version: int = 1) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """INSERT INTO renders (tenant_id, job_id, asset_id, version)
               VALUES (%s, %s, %s, %s) RETURNING *""",
            (tenant_id, job_id, asset_id, version),
        )
        return await cur.fetchone()


async def get_render_by_job(job_id: str) -> dict | None:
    async with get_conn() as conn:
        cur = await conn.execute(
            "SELECT * FROM renders WHERE job_id = %s ORDER BY version DESC LIMIT 1",
            (job_id,),
        )
        return await cur.fetchone()


async def get_channel_by_id(channel_id: str) -> dict | None:
    async with get_conn() as conn:
        cur = await conn.execute(
            "SELECT * FROM tenant_channels WHERE id = %s",
            (channel_id,),
        )
        return await cur.fetchone()


async def get_contact_by_id(contact_id: str) -> dict | None:
    async with get_conn() as conn:
        cur = await conn.execute(
            "SELECT * FROM contacts WHERE id = %s",
            (contact_id,),
        )
        return await cur.fetchone()
```

- [ ] **Step 2: Commit**

```bash
git add services/api-server/app/core/repository.py
git commit -m "feat: add repository queries for job completion, renders, and lookups"
```

---

## Task 4: Api-server — endpoint interno job-completed

**Files:**
- Create: `services/api-server/app/orchestrator/router.py`
- Modify: `services/api-server/app/main.py`
- Create: `services/api-server/tests/test_job_completed.py`

- [ ] **Step 1: Criar orchestrator/router.py**

```python
import logging

from fastapi import APIRouter, HTTPException

from app.core import repository as repo
from app.channel import sender
from app.billing import tracker
from app.storage.client import presigned_url

logger = logging.getLogger(__name__)

router = APIRouter(tags=["internal"])


@router.post("/internal/job-completed/{job_id}")
async def job_completed(job_id: str):
    # 1. Get job
    job = await repo.get_composition_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    tenant_id = str(job["tenant_id"])
    conversation_id = str(job["conversation_id"])
    job_status = job["status"]

    # 2. Get conversation to find channel and contact
    conversation = await repo.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    channel = await repo.get_channel_by_id(str(conversation["channel_id"]))
    contact = await repo.get_contact_by_id(str(conversation["contact_id"]))
    if not channel or not contact:
        raise HTTPException(status_code=404, detail="Channel or contact not found")

    provider = channel["provider"]
    session_id = channel["external_session_id"]
    remote_jid = contact["external_contact_id"]

    if job_status == "done":
        # 3. Get render and generate presigned URL
        render = await repo.get_render_by_job(job_id)
        if not render:
            raise HTTPException(status_code=404, detail="Render not found")

        asset = await repo.get_asset(str(render["asset_id"]))
        if not asset:
            raise HTTPException(status_code=404, detail="Render asset not found")

        image_url = presigned_url(asset["storage_key"], expires_seconds=7200)

        # 4. Send image on WhatsApp
        await sender.send_image(
            provider, session_id, remote_jid, image_url,
            caption="Aqui esta o resultado da composicao!",
        )

        # 5. Persist outbound message
        await repo.create_message(
            tenant_id, conversation_id, "outbound", "assistant",
            f"[Composicao enviada: {asset['storage_key']}]",
            "composition_result", None,
        )

        # 6. Update conversation state
        await repo.update_conversation_state(conversation_id, "completed")

        # 7. Track billing
        await tracker.track_message_sent(tenant_id, conversation_id, provider)

        return {"status": "sent", "job_id": job_id}

    elif job_status == "failed":
        error_msg = job.get("error_message", "Erro desconhecido")

        # Send apology message
        await sender.send_text(
            provider, session_id, remote_jid,
            "Desculpe, houve um problema ao gerar a composicao. Pode tentar novamente?",
        )

        await repo.create_message(
            tenant_id, conversation_id, "outbound", "assistant",
            f"Composicao falhou: {error_msg}", "text", None,
        )

        await repo.update_conversation_state(conversation_id, "completed")

        return {"status": "failure_notified", "job_id": job_id}

    return {"status": "ignored", "job_id": job_id, "reason": f"job_status={job_status}"}
```

- [ ] **Step 2: Registrar router no main.py**

Em `services/api-server/app/main.py`, dentro de `create_app()`, adicionar:

```python
    from app.orchestrator.router import router as orchestrator_router
    app.include_router(orchestrator_router, prefix="/v1")
```

- [ ] **Step 3: Escrever teste do endpoint**

`services/api-server/tests/test_job_completed.py`:
```python
import pytest
import respx
from httpx import Response
from unittest.mock import patch


@pytest.fixture
async def seeded_job(client):
    """Cria tenant, channel, contact, conversation, asset, job, e render."""
    # Tenant
    t = await client.post("/v1/tenants", json={
        "name": "Job Corp", "slug": "job-corp", "plan_code": "starter",
    })
    tenant = t.json()
    tid = tenant["id"]

    # Channel
    ch = await client.post(f"/v1/tenants/{tid}/channels", json={
        "channel_type": "whatsapp", "provider": "uazapi",
        "external_session_id": "session-job-test",
    })
    channel = ch.json()

    # Set channel to connected
    from app.db import get_conn
    async with get_conn() as conn:
        await conn.execute(
            "UPDATE tenant_channels SET status = 'connected' WHERE id = %s",
            (channel["id"],),
        )

    # Contact
    ct = await client.post("/v1/contacts", json={
        "tenant_id": tid, "external_contact_id": "5511999990000@s.whatsapp.net",
        "display_name": "Teste",
    })
    contact = ct.json()

    # Conversation
    cv = await client.post("/v1/conversations", json={
        "tenant_id": tid, "channel_id": channel["id"], "contact_id": contact["id"],
    })
    conversation = cv.json()

    # Set conversation to composing state
    async with get_conn() as conn:
        await conn.execute(
            "UPDATE conversations SET state = 'composing' WHERE id = %s",
            (conversation["id"],),
        )

    # Base asset
    a = await client.post("/v1/assets", json={
        "tenant_id": tid, "role": "base_image", "mime_type": "image/jpeg",
        "storage_key": f"tenants/{tid}/base.jpg",
    })
    base_asset = a.json()

    # Render asset
    ra = await client.post("/v1/assets", json={
        "tenant_id": tid, "role": "render", "mime_type": "image/jpeg",
        "storage_key": f"tenants/{tid}/render.jpg",
    })
    render_asset = ra.json()

    # Composition job
    async with get_conn() as conn:
        cur = await conn.execute(
            """INSERT INTO composition_jobs
               (tenant_id, conversation_id, mode, base_asset_id, status)
               VALUES (%s, %s, 'interior', %s, 'done') RETURNING *""",
            (tid, conversation["id"], base_asset["id"]),
        )
        job = await cur.fetchone()

        # Render
        await conn.execute(
            """INSERT INTO renders (tenant_id, job_id, asset_id, version)
               VALUES (%s, %s, %s, 1)""",
            (tid, str(job["id"]), render_asset["id"]),
        )

    return {
        "tenant": tenant, "channel": channel, "contact": contact,
        "conversation": conversation, "job": job, "render_asset": render_asset,
    }


@pytest.mark.anyio
@respx.mock
@patch("app.orchestrator.router.presigned_url", return_value="https://minio.local/render.jpg?sig=abc")
async def test_job_completed_success(mock_presigned, client, seeded_job):
    job_id = str(seeded_job["job"]["id"])

    respx.post("http://localhost:8080/message/sendImage/session-job-test").mock(
        return_value=Response(200, json={"status": "sent"})
    )

    response = await client.post(f"/v1/internal/job-completed/{job_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "sent"


@pytest.mark.anyio
async def test_job_completed_not_found(client):
    response = await client.post("/v1/internal/job-completed/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
```

- [ ] **Step 4: Rodar testes**

Run: `cd services/api-server && python -m pytest tests/test_job_completed.py -v`
Expected: 2 tests PASSED

- [ ] **Step 5: Commit**

```bash
git add services/api-server/app/orchestrator/router.py services/api-server/app/main.py services/api-server/tests/test_job_completed.py
git commit -m "feat: internal endpoint POST /v1/internal/job-completed for WhatsApp delivery"
```

---

## Task 5: Composition worker — storage module

**Files:**
- Create: `services/composition-worker/worker/storage.py`

- [ ] **Step 1: Criar worker/storage.py**

```python
import io
import logging
from datetime import timedelta

from minio import Minio

from worker.config import settings

logger = logging.getLogger(__name__)

_client: Minio | None = None


def get_minio_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
    return _client


def download_bytes(storage_key: str) -> bytes:
    client = get_minio_client()
    response = client.get_object(settings.minio_bucket_renders, storage_key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def upload_bytes(storage_key: str, data: bytes, content_type: str = "image/jpeg") -> str:
    client = get_minio_client()
    client.put_object(
        settings.minio_bucket_renders,
        storage_key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
    return storage_key
```

- [ ] **Step 2: Commit**

```bash
git add services/composition-worker/worker/storage.py
git commit -m "feat: composition worker MinIO storage module"
```

---

## Task 6: Composition worker — processor (OpenRouter Nano Banana Pro)

**Files:**
- Create: `services/composition-worker/worker/processor.py`
- Create: `services/composition-worker/tests/__init__.py`
- Create: `services/composition-worker/tests/test_processor.py`

- [ ] **Step 1: Criar processor.py**

```python
import base64
import json
import logging

import httpx

from worker.config import settings

logger = logging.getLogger(__name__)


async def generate_composition(
    base_image_bytes: bytes,
    reference_image_bytes: bytes | None,
    mode: str,
    input_payload: dict | None = None,
) -> bytes:
    """Call OpenRouter Nano Banana Pro to generate a visual composition.

    Returns the generated image as bytes.
    """
    base_b64 = base64.b64encode(base_image_bytes).decode()

    content_parts = []

    # Base image
    content_parts.append({
        "type": "image_url",
        "image_url": {"url": f"data:image/jpeg;base64,{base_b64}"},
    })

    # Reference image (catalog item)
    if reference_image_bytes:
        ref_b64 = base64.b64encode(reference_image_bytes).decode()
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{ref_b64}"},
        })

    # Build prompt based on mode
    prompt = _build_prompt(mode, input_payload)
    content_parts.append({"type": "text", "text": prompt})

    body = {
        "model": settings.openrouter_image_model,
        "messages": [
            {"role": "user", "content": content_parts},
        ],
        "modalities": ["image", "text"],
    }

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            json=body,
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    # Extract image from response
    choice = data["choices"][0]["message"]
    content = choice.get("content", [])

    if isinstance(content, list):
        for part in content:
            if isinstance(part, dict) and part.get("type") == "image_url":
                img_url = part["image_url"]["url"]
                if img_url.startswith("data:"):
                    # Extract base64 data
                    _, b64_data = img_url.split(",", 1)
                    return base64.b64decode(b64_data)

    raise ValueError("No image found in OpenRouter response")


def _build_prompt(mode: str, input_payload: dict | None) -> str:
    payload = input_payload or {}

    if mode == "interior":
        item_name = payload.get("item_name", "o produto selecionado")
        item_desc = payload.get("item_description", "")
        tags = payload.get("tags", {})

        parts = [
            f"Aplique {item_name} neste ambiente.",
            f"Descricao: {item_desc}." if item_desc else "",
            f"Cor: {tags.get('cor', '')}." if tags.get("cor") else "",
            f"Material: {tags.get('material', '')}." if tags.get("material") else "",
            f"Estilo: {tags.get('estilo', '')}." if tags.get("estilo") else "",
            "Mantenha a perspectiva e iluminacao originais do ambiente.",
            "Gere uma imagem fotorrealista com o produto aplicado.",
        ]
        return " ".join(p for p in parts if p)

    elif mode == "product":
        item_name = payload.get("item_name", "o produto")
        return (
            f"Insira {item_name} nesta cena de forma natural e harmonizada. "
            "Mantenha a iluminacao e perspectiva coerentes. "
            "Gere uma imagem fotorrealista."
        )

    return "Gere uma composicao visual combinando estas imagens de forma fotorrealista."
```

- [ ] **Step 2: Escrever testes**

`services/composition-worker/tests/__init__.py` — vazio

`services/composition-worker/tests/test_processor.py`:
```python
import base64
import json

import pytest
import respx
from httpx import Response

from worker.processor import generate_composition, _build_prompt


@pytest.fixture
def fake_image() -> bytes:
    return b"\xff\xd8\xff\xe0fake-jpeg-data"


@pytest.fixture
def fake_response_image() -> str:
    img_bytes = b"\xff\xd8\xff\xe0generated-image"
    return base64.b64encode(img_bytes).decode()


@pytest.mark.anyio
@respx.mock
async def test_generate_composition(fake_image, fake_response_image):
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(200, json={
            "choices": [{
                "message": {
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{fake_response_image}"}},
                        {"type": "text", "text": "Aqui esta a composicao."},
                    ],
                },
            }],
            "model": "google/gemini-3-pro-image-preview",
            "usage": {"prompt_tokens": 100, "completion_tokens": 200},
        })
    )

    result = await generate_composition(fake_image, None, "interior", {"item_name": "piso ceramico"})
    assert result == base64.b64decode(fake_response_image)


@pytest.mark.anyio
@respx.mock
async def test_generate_composition_no_image_raises(fake_image):
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(200, json={
            "choices": [{
                "message": {"content": "Desculpe, nao consegui gerar a imagem."},
            }],
        })
    )

    with pytest.raises(ValueError, match="No image found"):
        await generate_composition(fake_image, None, "interior")


def test_build_prompt_interior():
    prompt = _build_prompt("interior", {"item_name": "piso ceramico", "tags": {"cor": "bege"}})
    assert "piso ceramico" in prompt
    assert "bege" in prompt


def test_build_prompt_product():
    prompt = _build_prompt("product", {"item_name": "copo personalizado"})
    assert "copo personalizado" in prompt
```

- [ ] **Step 3: Adicionar respx e pytest-asyncio ao dev deps do worker**

Em `services/composition-worker/pyproject.toml`, alterar a secao dev:
```toml
dev = [
    "pytest>=8.3.0",
    "pytest-asyncio>=1.3.0",
    "respx>=0.22.0",
]
```

E adicionar configuracao pytest:
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

- [ ] **Step 4: Instalar deps e rodar testes**

Run: `cd services/composition-worker && pip install -e ".[dev]"`
Run: `cd services/composition-worker && python -m pytest tests/test_processor.py -v`
Expected: 4 tests PASSED

- [ ] **Step 5: Commit**

```bash
git add services/composition-worker/worker/processor.py services/composition-worker/tests/ services/composition-worker/pyproject.toml
git commit -m "feat: composition processor calling OpenRouter Nano Banana Pro"
```

---

## Task 7: Composition worker — notifier

**Files:**
- Create: `services/composition-worker/worker/notifier.py`

- [ ] **Step 1: Criar notifier.py**

```python
import logging

import httpx

from worker.config import settings

logger = logging.getLogger(__name__)


async def notify_job_completed(job_id: str) -> bool:
    url = f"{settings.api_server_url}/v1/internal/job-completed/{job_id}"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url)
            resp.raise_for_status()
            logger.info("Notified api-server of job %s completion", job_id)
            return True
    except Exception as e:
        logger.error("Failed to notify api-server of job %s: %s", job_id, e)
        return False
```

- [ ] **Step 2: Commit**

```bash
git add services/composition-worker/worker/notifier.py
git commit -m "feat: composition worker notifier for api-server callback"
```

---

## Task 8: Composition worker — main loop real

**Files:**
- Modify: `services/composition-worker/worker/main.py`

- [ ] **Step 1: Reescrever main.py com processor, storage e notifier reais**

```python
import asyncio
import json
import logging

import psycopg
from psycopg.rows import dict_row

from worker.config import settings
from worker.processor import generate_composition
from worker.storage import download_bytes, upload_bytes
from worker.notifier import notify_job_completed

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("composition-worker")


async def process_job(conn, job: dict) -> None:
    job_id = str(job["id"])
    tenant_id = str(job["tenant_id"])
    mode = job["mode"]
    base_asset_id = str(job["base_asset_id"])
    catalog_item_id = job.get("catalog_item_id")
    input_payload = job.get("input_payload", {})
    if isinstance(input_payload, str):
        input_payload = json.loads(input_payload)

    attempt = 0
    max_retries = settings.max_retries

    while attempt <= max_retries:
        try:
            # 1. Download base image from MinIO
            async with conn.transaction():
                cur = await conn.execute(
                    "SELECT storage_key FROM assets WHERE id = %s", (base_asset_id,),
                )
                base_asset = await cur.fetchone()
            if not base_asset:
                raise ValueError(f"Base asset {base_asset_id} not found")

            base_image = download_bytes(base_asset["storage_key"])

            # 2. Download reference image if catalog item exists
            reference_image = None
            if catalog_item_id:
                async with conn.transaction():
                    cur = await conn.execute(
                        """SELECT a.storage_key FROM catalog_item_images ci
                           JOIN assets a ON a.id = ci.asset_id
                           WHERE ci.catalog_item_id = %s AND ci.role = 'primary'
                           ORDER BY ci.sort_order LIMIT 1""",
                        (str(catalog_item_id),),
                    )
                    ref_row = await cur.fetchone()
                if ref_row:
                    reference_image = download_bytes(ref_row["storage_key"])

            # 3. Call OpenRouter
            logger.info("Job %s: calling OpenRouter (attempt %d)", job_id, attempt + 1)
            result_image = await generate_composition(
                base_image, reference_image, mode, input_payload,
            )

            # 4. Upload render to MinIO
            render_key = f"tenants/{tenant_id}/renders/{job_id}.jpg"
            upload_bytes(render_key, result_image, "image/jpeg")

            # 5. Create asset and render in DB
            async with conn.transaction():
                cur = await conn.execute(
                    """INSERT INTO assets (tenant_id, conversation_id, role, mime_type, storage_key, metadata_json)
                       VALUES (%s, %s, 'render', 'image/jpeg', %s, '{}'::jsonb) RETURNING *""",
                    (tenant_id, str(job["conversation_id"]), render_key),
                )
                render_asset = await cur.fetchone()

                await conn.execute(
                    """INSERT INTO renders (tenant_id, job_id, asset_id, version)
                       VALUES (%s, %s, %s, 1)""",
                    (tenant_id, job_id, str(render_asset["id"])),
                )

                await conn.execute(
                    "UPDATE composition_jobs SET status = 'done' WHERE id = %s",
                    (job["id"],),
                )

            logger.info("Job %s completed successfully", job_id)

            # 6. Notify api-server
            await notify_job_completed(job_id)
            return

        except Exception as e:
            attempt += 1
            logger.error("Job %s failed (attempt %d/%d): %s", job_id, attempt, max_retries + 1, e)

            if attempt <= max_retries:
                await asyncio.sleep(settings.retry_backoff_seconds)
            else:
                # Mark as failed
                async with conn.transaction():
                    await conn.execute(
                        "UPDATE composition_jobs SET status = 'failed', error_message = %s WHERE id = %s",
                        (str(e), job["id"]),
                    )
                logger.error("Job %s permanently failed after %d attempts", job_id, max_retries + 1)
                await notify_job_completed(job_id)


async def poll_and_process() -> None:
    conninfo = settings.database_url
    async with await psycopg.AsyncConnection.connect(conninfo, row_factory=dict_row) as conn:
        while True:
            async with conn.transaction():
                cur = await conn.execute(
                    """
                    SELECT id, tenant_id, conversation_id, mode, catalog_item_id,
                           base_asset_id, overlay_asset_id, mask_asset_id, input_payload
                    FROM composition_jobs
                    WHERE status = 'queued'
                    ORDER BY created_at
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                    """
                )
                job = await cur.fetchone()

                if job is None:
                    await asyncio.sleep(settings.poll_interval_seconds)
                    continue

                job_id = str(job["id"])
                logger.info("Processing job %s (mode=%s)", job_id, job["mode"])

                await conn.execute(
                    "UPDATE composition_jobs SET status = 'processing' WHERE id = %s",
                    (job["id"],),
                )

            await process_job(conn, job)


async def main() -> None:
    logger.info("Composition worker starting (poll_interval=%ds)", settings.poll_interval_seconds)
    await poll_and_process()


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Commit**

```bash
git add services/composition-worker/worker/main.py
git commit -m "feat: composition worker with real processor, storage, and retry logic"
```

---

## Task 9: Rodar suite completa e verificacao final

- [ ] **Step 1: Rodar todos os testes do api-server**

Run: `cd services/api-server && python -m pytest -v --tb=short`
Expected: todos os testes PASSED

- [ ] **Step 2: Rodar todos os testes do composition-worker**

Run: `cd services/composition-worker && python -m pytest -v --tb=short`
Expected: todos os testes PASSED

- [ ] **Step 3: Verificar que a API inicia**

Run: `cd services/api-server && python -c "from app.main import create_app; app = create_app(); print('Routes:'); [print(f'  {getattr(r, \"methods\", set())} {r.path}') for r in app.routes if hasattr(r, 'path')]"`
Expected: rota `/v1/internal/job-completed/{job_id}` presente

- [ ] **Step 4: Commit final se necessario**

Se houver ajustes pendentes:
```bash
git add -A
git commit -m "fix: adjustments from full test suite run"
```

---

## Self-Review Checklist

**Spec coverage:**
- [ ] Storage module MinIO (upload, download, presigned URL)
- [ ] Gateway download de imagens do WhatsApp e upload MinIO
- [ ] Repository queries para job completion e renders
- [ ] Endpoint interno /v1/internal/job-completed
- [ ] Composition worker processor (OpenRouter Nano Banana Pro)
- [ ] Composition worker storage MinIO
- [ ] Composition worker notifier (callback api-server)
- [ ] Composition worker main loop com retry
- [ ] Testes unitarios e integracao

**Placeholder scan:**
- conversation_handler.py: catalog_item_id=None no create_composition_job (precisa de selecao do catalogo — ja funciona via state machine)
- Worker: sem upload de imagens de catalogo (admin faz manualmente no MinIO)
