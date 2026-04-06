from fastapi import APIRouter, HTTPException, Query, status

from app.catalog import repository as repo
from app.catalog.schemas import (
    CategoryCreate, CategoryResponse,
    ItemCreate, ItemImageCreate, ItemImageResponse, ItemResponse,
)

router = APIRouter(tags=["catalog"])


def _str_keys(row: dict) -> dict:
    return {k: str(v) if hasattr(v, "hex") else v for k, v in row.items()}


# --- Categories ---

@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(payload: CategoryCreate):
    row = await repo.create_category(payload.tenant_id, payload.name, payload.parent_id, payload.sort_order)
    return CategoryResponse(**_str_keys(row))


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(tenant_id: str = Query(...)):
    rows = await repo.list_categories(tenant_id)
    return [CategoryResponse(**_str_keys(r)) for r in rows]


# --- Items ---

@router.post("/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(payload: ItemCreate):
    row = await repo.create_item(
        payload.tenant_id, payload.category_id, payload.name,
        payload.description, payload.sku, payload.tags,
    )
    return ItemResponse(**_str_keys(row))


@router.get("/items", response_model=list[ItemResponse])
async def list_items(
    tenant_id: str = Query(...),
    tag_cor: str | None = Query(None),
    tag_material: str | None = Query(None),
    tag_estilo: str | None = Query(None),
    tag_marca: str | None = Query(None),
):
    tag_filters = {}
    if tag_cor:
        tag_filters["cor"] = tag_cor
    if tag_material:
        tag_filters["material"] = tag_material
    if tag_estilo:
        tag_filters["estilo"] = tag_estilo
    if tag_marca:
        tag_filters["marca"] = tag_marca

    rows = await repo.list_items(tenant_id, tag_filters or None)
    return [ItemResponse(**_str_keys(r)) for r in rows]


@router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: str):
    row = await repo.get_item(item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Item not found")
    return ItemResponse(**_str_keys(row))


# --- Item Images ---

@router.post("/item-images", response_model=ItemImageResponse, status_code=status.HTTP_201_CREATED)
async def create_item_image(payload: ItemImageCreate):
    row = await repo.create_item_image(
        payload.tenant_id, payload.catalog_item_id, payload.asset_id, payload.role, payload.sort_order,
    )
    return ItemImageResponse(**_str_keys(row))


@router.get("/items/{item_id}/images", response_model=list[ItemImageResponse])
async def list_item_images(item_id: str):
    rows = await repo.list_item_images(item_id)
    return [ItemImageResponse(**_str_keys(r)) for r in rows]
