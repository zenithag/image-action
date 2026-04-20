from typing import Literal

from pydantic import BaseModel, Field


SurfaceTarget = Literal["painted_wall", "wall", "floor", "ceiling", "foreground_objects", "objects"]


class SegmentationRequest(BaseModel):
    image: str = Field(..., description="Data URL or public URL of the source image.")
    target: SurfaceTarget
    prompt: str = ""
    exclude: list[str] = Field(default_factory=list)
    width: int | None = None
    height: int | None = None


class SegmentationResponse(BaseModel):
    ok: bool
    provider: str
    model: str | None = None
    target: SurfaceTarget
    mask: str | None = Field(default=None, description="PNG data URL. White means selected pixels.")
    confidence: float | None = None
    message: str | None = None
    raw: dict | list | str | None = None
