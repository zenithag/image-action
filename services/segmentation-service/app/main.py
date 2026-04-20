from fastapi import FastAPI, HTTPException

from app.providers import SegmentationError, segment
from app.schemas import SegmentationRequest, SegmentationResponse

app = FastAPI(title="Studio Segmentation Service", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/segment", response_model=SegmentationResponse)
async def create_segmentation(request: SegmentationRequest) -> SegmentationResponse:
    try:
        return await segment(request)
    except SegmentationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
