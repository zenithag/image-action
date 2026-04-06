import pytest


@pytest.mark.anyio
async def test_create_tenant(client):
    response = await client.post("/v1/tenants", json={
        "name": "Loja Teste",
        "slug": "loja-teste",
        "plan_code": "starter",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Loja Teste"
    assert data["slug"] == "loja-teste"
    assert data["status"] == "draft"
    assert "id" in data


@pytest.mark.anyio
async def test_list_tenants(client):
    await client.post("/v1/tenants", json={
        "name": "Loja A",
        "slug": "loja-a",
        "plan_code": "starter",
    })
    response = await client.get("/v1/tenants")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


@pytest.mark.anyio
async def test_get_tenant(client):
    create = await client.post("/v1/tenants", json={
        "name": "Loja B",
        "slug": "loja-b",
        "plan_code": "starter",
    })
    tenant_id = create.json()["id"]
    response = await client.get(f"/v1/tenants/{tenant_id}")
    assert response.status_code == 200
    assert response.json()["id"] == tenant_id


@pytest.mark.anyio
async def test_get_tenant_not_found(client):
    response = await client.get("/v1/tenants/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
