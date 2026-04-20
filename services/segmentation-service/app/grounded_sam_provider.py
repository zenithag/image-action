from functools import lru_cache
import base64
import io
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

from app.config import settings
from app.local_provider import _decode_image, _largest_components, _mask_to_data_url, segment_with_local_model
from app.schemas import SegmentationRequest, SegmentationResponse


def _target_text(target: str) -> str:
    if target in {"painted_wall", "wall"}:
        return "interior wall. painted wall. plaster wall. background wall. vertical wall surface. wall."

    if target == "floor":
        return "visible floor surface. floor."

    if target == "ceiling":
        return "visible ceiling surface. ceiling."

    return "foreground furniture. sofa. couch. armchair. chair. table. cabinet. appliance. curtain. blind. lamp. light fixture. plant. vase. pillow. cushion. door. window. frame. objects. people."


def _exclude_text(target: str) -> str:
    common = "furniture. appliance. chair. table. cabinet. sink. washing machine. refrigerator. sofa. bed. bucket. broom. clothes. person. object."

    if target in {"painted_wall", "wall"}:
        return common

    if target == "floor":
        return f"{common} rug."

    if target == "ceiling":
        return f"{common} lamp. lighting fixture."

    return ""


def _request_exclude_text(request: SegmentationRequest) -> str:
    items = [item.strip() for item in request.exclude if item.strip()]

    if not items:
        return ""

    return ". ".join(items) + "."


@lru_cache(maxsize=1)
def _load_detector():
    import torch
    from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor

    processor = AutoProcessor.from_pretrained(settings.grounded_sam_detector_model)
    model = AutoModelForZeroShotObjectDetection.from_pretrained(settings.grounded_sam_detector_model)
    model.eval()

    return processor, model, torch


@lru_cache(maxsize=1)
def _load_segmenter():
    import torch
    from transformers import SamModel, SamProcessor

    processor = SamProcessor.from_pretrained(settings.grounded_sam_segmenter_model)
    model = SamModel.from_pretrained(settings.grounded_sam_segmenter_model)
    model.eval()

    return processor, model, torch


def _boxes_from_detection(image, text: str) -> tuple[np.ndarray, list[str]]:
    processor, model, torch = _load_detector()
    inputs = processor(images=image, text=text.lower(), return_tensors="pt")

    with torch.no_grad():
        outputs = model(**inputs)

    results = processor.post_process_grounded_object_detection(
        outputs,
        input_ids=inputs.get("input_ids"),
        threshold=settings.grounded_sam_box_threshold,
        text_threshold=settings.grounded_sam_text_threshold,
        target_sizes=[(image.height, image.width)],
    )
    result = results[0] if results else {}
    boxes = result.get("boxes")
    labels = result.get("text_labels") or result.get("labels") or []

    if boxes is None:
        return np.empty((0, 4), dtype=np.float32), []

    boxes_array = boxes.detach().cpu().numpy() if hasattr(boxes, "detach") else np.asarray(boxes)
    return boxes_array.astype(np.float32).reshape((-1, 4)), [str(label) for label in labels]


def _mask_from_boxes(image, boxes: np.ndarray) -> np.ndarray:
    if boxes.size == 0:
        return np.zeros((image.height, image.width), dtype=bool)

    processor, model, torch = _load_segmenter()
    inputs = processor(images=image, input_boxes=[boxes.tolist()], return_tensors="pt")

    with torch.no_grad():
        outputs = model(**inputs)

    masks = processor.post_process_masks(
        outputs.pred_masks.detach().cpu(),
        inputs["original_sizes"].detach().cpu(),
        inputs["reshaped_input_sizes"].detach().cpu(),
    )[0]
    iou_scores = outputs.iou_scores.detach().cpu()[0] if hasattr(outputs, "iou_scores") else None

    if hasattr(masks, "numpy"):
        masks_array = masks.numpy()
    else:
        masks_array = np.asarray(masks)

    combined = np.zeros((image.height, image.width), dtype=bool)

    for index, candidates in enumerate(masks_array):
        if candidates.ndim == 2:
            chosen = candidates
        else:
            best_index = int(np.argmax(iou_scores[index].numpy())) if iou_scores is not None else 0
            chosen = candidates[best_index]
        combined |= chosen.astype(bool)

    return combined


def _bool_mask_from_data_url(value: str | None, width: int, height: int) -> np.ndarray | None:
    if not value or not value.startswith("data:image/"):
        return None

    _, encoded = value.split(",", 1)
    image = Image.open(io.BytesIO(base64.b64decode(encoded))).convert("L")

    if image.size != (width, height):
        image = image.resize((width, height))

    return np.asarray(image) > 127


def _component_boxes(mask: np.ndarray, max_components: int = 10) -> np.ndarray:
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    components: list[tuple[int, int, int, int, int]] = []

    for y in range(height):
        for x in range(width):
            if not mask[y, x] or visited[y, x]:
                continue

            queue: deque[tuple[int, int]] = deque([(y, x)])
            visited[y, x] = True
            min_x = max_x = x
            min_y = max_y = y
            area = 0

            while queue:
                cy, cx = queue.popleft()
                area += 1
                min_x = min(min_x, cx)
                max_x = max(max_x, cx)
                min_y = min(min_y, cy)
                max_y = max(max_y, cy)

                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if ny < 0 or nx < 0 or ny >= height or nx >= width:
                        continue
                    if visited[ny, nx] or not mask[ny, nx]:
                        continue
                    visited[ny, nx] = True
                    queue.append((ny, nx))

            components.append((area, min_x, min_y, max_x, max_y))

    min_area = max(256, int(mask.size * 0.001))
    boxes: list[list[float]] = []

    for area, min_x, min_y, max_x, max_y in sorted(components, reverse=True)[:max_components]:
        if area < min_area:
            continue

        padding = 8
        boxes.append([
            float(max(0, min_x - padding)),
            float(max(0, min_y - padding)),
            float(min(width - 1, max_x + padding)),
            float(min(height - 1, max_y + padding)),
        ])

    if not boxes:
        return np.empty((0, 4), dtype=np.float32)

    return np.asarray(boxes, dtype=np.float32)


def _precise_mask_to_data_url(mask: np.ndarray) -> str:
    image = Image.fromarray(mask.astype(np.uint8) * 255, mode="L")
    image = (
        image
        .filter(ImageFilter.MaxFilter(5))
        .filter(ImageFilter.MinFilter(5))
        .filter(ImageFilter.MedianFilter(3))
        .filter(ImageFilter.GaussianBlur(0.45))
    )
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode('ascii')}"


async def _semantic_surface_mask(request: SegmentationRequest, width: int, height: int) -> np.ndarray | None:
    if request.target not in {"painted_wall", "wall", "floor", "ceiling"}:
        return None

    try:
        response = await segment_with_local_model(request)
    except Exception:
        return None

    return _bool_mask_from_data_url(response.mask, width, height)


def _refine_mask(target: str, mask: np.ndarray) -> np.ndarray:
    if target in {"painted_wall", "wall"}:
        return _largest_components(mask, max_components=8)

    if target == "floor":
        return _largest_components(mask, max_components=2)

    if target == "ceiling":
        return _largest_components(mask, max_components=1)

    return mask


async def segment_with_grounded_sam(request: SegmentationRequest) -> SegmentationResponse:
    image = _decode_image(request.image)
    target_boxes, target_labels = _boxes_from_detection(image, _target_text(request.target))

    if target_boxes.size == 0:
        fallback = await segment_with_local_model(request)
        fallback.provider = "grounded_sam:fallback_local"
        return fallback

    target_mask = _mask_from_boxes(image, target_boxes)
    semantic_mask = await _semantic_surface_mask(request, image.width, image.height)

    if semantic_mask is not None:
        semantic_boxes = _component_boxes(semantic_mask)
        semantic_refined_mask = _mask_from_boxes(image, semantic_boxes)
        target_mask |= semantic_refined_mask if semantic_refined_mask.any() else semantic_mask
    exclude_prompt = ". ".join(
        part for part in (_exclude_text(request.target), _request_exclude_text(request)) if part
    )

    if exclude_prompt:
        exclude_boxes, exclude_labels = _boxes_from_detection(image, exclude_prompt)
        exclude_mask = _mask_from_boxes(image, exclude_boxes)
    else:
        exclude_labels = []
        exclude_mask = np.zeros_like(target_mask, dtype=bool)

    mask = _refine_mask(request.target, target_mask & ~exclude_mask)
    selected_pixels = int(mask.sum())
    coverage = selected_pixels / max(mask.size, 1)

    if selected_pixels == 0:
        fallback = await segment_with_local_model(request)
        fallback.provider = "grounded_sam:fallback_local"
        return fallback

    return SegmentationResponse(
        ok=True,
        provider="grounded_sam",
        model=f"{settings.grounded_sam_detector_model}+{settings.grounded_sam_segmenter_model}",
        target=request.target,
        mask=_precise_mask_to_data_url(mask),
        confidence=min(0.99, max(0.5, coverage * 4)),
        raw={
            "target_labels": target_labels,
            "target_boxes": target_boxes.tolist(),
            "exclude_labels": exclude_labels,
            "semantic_union": semantic_mask is not None,
            "coverage": coverage,
        },
    )
