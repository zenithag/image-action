from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://studio:studio_dev@localhost:5432/studio_app"
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_secure: bool = False
    minio_bucket_renders: str = "tenant-renders"
    openrouter_api_key: str = ""
    openrouter_image_model: str = "google/gemini-3-pro-image-preview"
    api_server_url: str = "http://localhost:8000"
    poll_interval_seconds: int = 2
    max_retries: int = 2
    retry_backoff_seconds: int = 5

    model_config = {"env_prefix": "", "env_file": ".env"}


settings = Settings()
