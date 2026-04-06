import json

from app.db import get_conn


async def create_category(tenant_id: str, name: str, parent_id: str | None, sort_order: int) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """
            insert into catalog_categories (tenant_id, name, parent_id, sort_order)
            values (%s, %s, %s, %s)
            returning id, tenant_id, name, parent_id, sort_order
            """,
            (tenant_id, name, parent_id, sort_order),
        )
        return await cur.fetchone()


async def list_categories(tenant_id: str) -> list[dict]:
    async with get_conn() as conn:
        cur = await conn.execute(
            "select id, tenant_id, name, parent_id, sort_order from catalog_categories where tenant_id = %s order by sort_order",
            (tenant_id,),
        )
        return await cur.fetchall()


async def create_item(
    tenant_id: str, category_id: str, name: str, description: str,
    sku: str | None, tags: dict,
) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """
            insert into catalog_items (tenant_id, category_id, name, description, sku, tags)
            values (%s, %s, %s, %s, %s, %s)
            returning id, tenant_id, category_id, name, description, sku, status, tags
            """,
            (tenant_id, category_id, name, description, sku, json.dumps(tags)),
        )
        return await cur.fetchone()


async def list_items(tenant_id: str, tag_filters: dict[str, str] | None = None) -> list[dict]:
    async with get_conn() as conn:
        query = "select id, tenant_id, category_id, name, description, sku, status, tags from catalog_items where tenant_id = %s and status = 'active'"
        params: list = [tenant_id]

        if tag_filters:
            for key, value in tag_filters.items():
                query += " and tags->>%s = %s"
                params.extend([key, value])

        query += " order by created_at"
        cur = await conn.execute(query, params)
        return await cur.fetchall()


async def get_item(item_id: str) -> dict | None:
    async with get_conn() as conn:
        cur = await conn.execute(
            "select id, tenant_id, category_id, name, description, sku, status, tags from catalog_items where id = %s",
            (item_id,),
        )
        return await cur.fetchone()


async def create_item_image(
    tenant_id: str, catalog_item_id: str, asset_id: str, role: str, sort_order: int,
) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """
            insert into catalog_item_images (tenant_id, catalog_item_id, asset_id, role, sort_order)
            values (%s, %s, %s, %s, %s)
            returning id, tenant_id, catalog_item_id, asset_id, role, sort_order
            """,
            (tenant_id, catalog_item_id, asset_id, role, sort_order),
        )
        return await cur.fetchone()


async def list_item_images(catalog_item_id: str) -> list[dict]:
    async with get_conn() as conn:
        cur = await conn.execute(
            "select id, tenant_id, catalog_item_id, asset_id, role, sort_order from catalog_item_images where catalog_item_id = %s order by sort_order",
            (catalog_item_id,),
        )
        return await cur.fetchall()
