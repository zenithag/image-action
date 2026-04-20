import base64
import io
import unicodedata
from functools import lru_cache
from collections import deque

import httpx
import numpy as np
from PIL import Image, ImageChops, ImageFilter

from app.config import settings
from app.schemas import SegmentationRequest, SegmentationResponse


def _decode_image(value: str) -> Image.Image:
    if value.startswith("data:image/"):
        _, encoded = value.split(",", 1)
        return Image.open(io.BytesIO(base64.b64decode(encoded))).convert("RGB")

    if value.startswith(("http://", "https://")):
        response = httpx.get(value, timeout=settings.request_timeout_seconds)
        response.raise_for_status()
        return Image.open(io.BytesIO(response.content)).convert("RGB")

    raise ValueError("Imagem deve ser uma data URL ou URL publica.")


@lru_cache(maxsize=1)
def _load_model():
    import torch
    from transformers import SegformerForSemanticSegmentation, SegformerImageProcessor

    processor = SegformerImageProcessor.from_pretrained(settings.local_model)
    model = SegformerForSemanticSegmentation.from_pretrained(settings.local_model)
    model.eval()

    return processor, model, torch


def _target_labels(target: str) -> set[str]:
    if target in {"painted_wall", "wall"}:
        return {"wall"}

    if target == "floor":
        return {"floor"}

    if target == "ceiling":
        return {"ceiling"}

    return {
        "bed",
        "chair",
        "sofa",
        "table",
        "desk",
        "armchair",
        "seat",
        "swivel chair",
        "stool",
        "ottoman",
        "wardrobe",
        "lamp",
        "person",
    }


def _excluded_labels(target: str) -> set[str]:
    common = {
        "person",
        "chair",
        "armchair",
        "swivel chair",
        "seat",
        "stool",
        "table",
        "desk",
        "coffee table",
        "sofa",
        "bed",
        "cabinet",
        "wardrobe",
        "sink",
        "washer",
        "dishwasher",
        "plant",
        "lamp",
        "rug",
    }

    if target in {"painted_wall", "wall"}:
        return common | {"floor", "ceiling", "door", "windowpane", "curtain", "screen door", "base"}

    if target == "floor":
        return common | {"wall", "ceiling", "door", "windowpane", "curtain", "screen door", "base"}

    if target == "ceiling":
        return common | {"wall", "floor", "door", "windowpane", "curtain", "screen door", "base"}

    return set()


def _largest_components(mask: np.ndarray, max_components: int) -> np.ndarray:
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    components: list[list[tuple[int, int]]] = []

    for y in range(height):
        for x in range(width):
            if not mask[y, x] or visited[y, x]:
                continue

            queue: deque[tuple[int, int]] = deque([(y, x)])
            visited[y, x] = True
            pixels: list[tuple[int, int]] = []

            while queue:
                cy, cx = queue.popleft()
                pixels.append((cy, cx))

                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if ny < 0 or nx < 0 or ny >= height or nx >= width:
                        continue
                    if visited[ny, nx] or not mask[ny, nx]:
                        continue
                    visited[ny, nx] = True
                    queue.append((ny, nx))

            components.append(pixels)

    refined = np.zeros_like(mask, dtype=bool)
    min_area = max(64, int(mask.size * 0.001))

    for pixels in sorted(components, key=len, reverse=True)[:max_components]:
        if len(pixels) < min_area:
            continue

        for y, x in pixels:
            refined[y, x] = True

    return refined


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value).encode("ascii", "ignore").decode("ascii")

    return normalized.lower()


def _wants_single_wall(request: SegmentationRequest) -> bool:
    if request.target not in {"painted_wall", "wall"}:
        return False

    prompt = _normalize_text(request.prompt)

    return any(term in prompt for term in ("essa parede", "esta parede", "nessa parede", "nesta parede"))


def _remove_wall_baseboard(mask: np.ndarray, segmentation: np.ndarray, label_to_id: dict[str, int]) -> np.ndarray:
    base_id = label_to_id.get("base")

    if base_id is None:
        return mask

    base_rows = np.where(segmentation == base_id)[0]

    if base_rows.size == 0:
        return mask

    refined = mask.copy()
    height = mask.shape[0]
    cutoff = max(0, int(base_rows.min()) - max(2, height // 120))
    refined[cutoff:, :] = False

    return refined


def _refine_mask(target: str, mask: np.ndarray, segmentation: np.ndarray, label_to_id: dict[str, int]) -> np.ndarray:
    excluded_ids = {label_to_id[label] for label in _excluded_labels(target) if label in label_to_id}
    refined = mask & ~np.isin(segmentation, list(excluded_ids))

    if target in {"painted_wall", "wall"}:
        refined = _remove_wall_baseboard(refined, segmentation, label_to_id)
        refined = _largest_components(refined, max_components=3)
    elif target == "floor":
        refined = _largest_components(refined, max_components=2)
    elif target == "ceiling":
        refined = _largest_components(refined, max_components=1)

    return refined


def _mask_to_data_url(mask: np.ndarray) -> str:
    image = Image.fromarray(mask.astype(np.uint8) * 255, mode="L")
    image = image.filter(ImageFilter.MedianFilter(3))
    image = ImageChops.lighter(image.filter(ImageFilter.MinFilter(3)), image.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(5)))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode('ascii')}"


def _single_surface_component(mask: np.ndarray) -> np.ndarray:
    image = Image.fromarray(mask.astype(np.uint8) * 255, mode="L")
    eroded = np.asarray(image.filter(ImageFilter.MinFilter(17))) > 127
    main = _largest_components(eroded, max_components=1)
    expanded = np.asarray(
        Image.fromarray(main.astype(np.uint8) * 255, mode="L").filter(ImageFilter.MaxFilter(23))
    ) > 127

    return mask & expanded


async def segment_with_local_model(request: SegmentationRequest) -> SegmentationResponse:
    image = _decode_image(request.image)
    processor, model, torch = _load_model()
    inputs = processor(images=image, return_tensors="pt")

    with torch.no_grad():
        outputs = model(**inputs)

    logits = torch.nn.functional.interpolate(
        outputs.logits,
        size=(image.height, image.width),
        mode="bilinear",
        align_corners=False,
    )
    segmentation = logits.argmax(dim=1)[0].cpu().numpy()
    label_names = {
        int(index): str(label).lower().replace("_", " ")
        for index, label in model.config.id2label.items()
    }
    label_to_id = {label: index for index, label in label_names.items()}
    wanted = _target_labels(request.target)
    wanted_ids = {index for index, label in label_names.items() if label in wanted}

    if not wanted_ids:
        raise RuntimeError(f"Modelo local nao possui labels para o alvo {request.target}.")

    mask = _refine_mask(request.target, np.isin(segmentation, list(wanted_ids)), segmentation, label_to_id)

    if _wants_single_wall(request):
        mask = _single_surface_component(mask)
    selected_pixels = int(mask.sum())
    coverage = selected_pixels / max(mask.size, 1)

    if selected_pixels == 0:
        raise RuntimeError(f"Modelo local nao encontrou pixels para {request.target}.")

    return SegmentationResponse(
        ok=True,
        provider="local",
        model=settings.local_model,
        target=request.target,
        mask=_mask_to_data_url(mask),
        confidence=min(0.99, max(0.5, coverage * 4)),
        raw={
            "labels": sorted(wanted),
            "coverage": coverage,
        },
    )
