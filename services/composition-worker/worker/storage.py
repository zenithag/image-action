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
