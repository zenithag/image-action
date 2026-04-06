from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://studio:studio_dev@localhost:5432/studio_app"
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_secure: bool = False
    minio_bucket: str = "tenant-assets"
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4.1-mini"
    openrouter_image_model: str = "google/gemini-3-pro-image-preview"
    uazapi_base_url: str = "http://localhost:8080"
    uazapi_api_key: str = ""

    model_config = {"env_prefix": "", "env_file": ".env"}


settings = Settings()
