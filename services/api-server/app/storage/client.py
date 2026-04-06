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
