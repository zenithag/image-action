from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="SEGMENTATION_", extra="ignore")

    provider: str = "grounded_sam"
    local_model: str = "nvidia/segformer-b2-finetuned-ade-512-512"
    grounded_sam_detector_model: str = Field(
        default="IDEA-Research/grounding-dino-tiny",
        validation_alias=AliasChoices("GROUNDING_DINO_MODEL", "SEGMENTATION_GROUNDED_SAM_DETECTOR_MODEL"),
    )
    grounded_sam_segmenter_model: str = Field(
        default="facebook/sam-vit-base",
        validation_alias=AliasChoices("SAM_MODEL", "SEGMENTATION_GROUNDED_SAM_SEGMENTER_MODEL"),
    )
    grounded_sam_box_threshold: float = 0.25
    grounded_sam_text_threshold: float = 0.25
    replicate_api_token: str = Field(
        default="",
        validation_alias=AliasChoices("REPLICATE_API_TOKEN", "SEGMENTATION_REPLICATE_API_TOKEN"),
    )
    replicate_model: str = Field(
        default="idea-research/ram-grounded-sam",
        validation_alias=AliasChoices("REPLICATE_MODEL", "SEGMENTATION_REPLICATE_MODEL"),
    )
    request_timeout_seconds: float = 90.0


settings = Settings()
