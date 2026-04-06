from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    tenant_id: str
    name: str = Field(min_length=1, max_length=200)
    parent_id: str | None = None
    sort_order: int = 0


class CategoryResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    parent_id: str | None
    sort_order: int


class ItemCreate(BaseModel):
    tenant_id: str
    category_id: str
    name: str = Field(min_length=1, max_length=300)
    description: str = ""
    sku: str | None = None
    tags: dict = {}


class ItemResponse(BaseModel):
    id: str
    tenant_id: str
    category_id: str
    name: str
    description: str
    sku: str | None
    status: str
    tags: dict


class ItemImageCreate(BaseModel):
    tenant_id: str
    catalog_item_id: str
    asset_id: str
    role: str = "primary"
    sort_order: int = 0


class ItemImageResponse(BaseModel):
    id: str
    tenant_id: str
    catalog_item_id: str
    asset_id: str
    role: str
    sort_order: int
