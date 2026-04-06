import pytest


async def _setup_tenant(client) -> str:
    r = await client.post("/v1/tenants", json={
        "name": "Catalog Corp", "slug": "catalog-corp", "plan_code": "starter",
    })
    return r.json()["id"]


@pytest.mark.anyio
async def test_create_category(client):
    tenant_id = await _setup_tenant(client)
    r = await client.post("/v1/catalog/categories", json={
        "tenant_id": tenant_id, "name": "Revestimentos", "sort_order": 1,
    })
    assert r.status_code == 201
    assert r.json()["name"] == "Revestimentos"


@pytest.mark.anyio
async def test_create_subcategory(client):
    tenant_id = await _setup_tenant(client)
    parent = await client.post("/v1/catalog/categories", json={
        "tenant_id": tenant_id, "name": "Pisos", "sort_order": 1,
    })
    parent_id = parent.json()["id"]
    r = await client.post("/v1/catalog/categories", json={
        "tenant_id": tenant_id, "name": "Porcelanato", "parent_id": parent_id, "sort_order": 1,
    })
    assert r.status_code == 201
    assert r.json()["parent_id"] == parent_id


@pytest.mark.anyio
async def test_list_categories(client):
    tenant_id = await _setup_tenant(client)
    await client.post("/v1/catalog/categories", json={
        "tenant_id": tenant_id, "name": "Tintas", "sort_order": 1,
    })
    r = await client.get(f"/v1/catalog/categories?tenant_id={tenant_id}")
    assert r.status_code == 200
    assert len(r.json()) >= 1


@pytest.mark.anyio
async def test_create_item(client):
    tenant_id = await _setup_tenant(client)
    cat = await client.post("/v1/catalog/categories", json={
        "tenant_id": tenant_id, "name": "Revest", "sort_order": 1,
    })
    r = await client.post("/v1/catalog/items", json={
        "tenant_id": tenant_id,
        "category_id": cat.json()["id"],
        "name": "Porcelanato Carrara 60x60",
        "description": "Porcelanato polido",
        "tags": {"cor": "claro", "material": "porcelanato", "estilo": "classico"},
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Porcelanato Carrara 60x60"
    assert data["tags"]["cor"] == "claro"
    assert data["status"] == "active"


@pytest.mark.anyio
async def test_list_items_with_tag_filter(client):
    tenant_id = await _setup_tenant(client)
    cat = await client.post("/v1/catalog/categories", json={
        "tenant_id": tenant_id, "name": "Pisos2", "sort_order": 1,
    })
    cat_id = cat.json()["id"]

    await client.post("/v1/catalog/items", json={
        "tenant_id": tenant_id, "category_id": cat_id,
        "name": "Carrara Claro", "description": "claro",
        "tags": {"cor": "claro", "material": "porcelanato"},
    })
    await client.post("/v1/catalog/items", json={
        "tenant_id": tenant_id, "category_id": cat_id,
        "name": "Grafite Escuro", "description": "escuro",
        "tags": {"cor": "escuro", "material": "porcelanato"},
    })

    r = await client.get(f"/v1/catalog/items?tenant_id={tenant_id}&tag_cor=claro")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["name"] == "Carrara Claro"
