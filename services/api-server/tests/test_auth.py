import pytest
from unittest.mock import patch, MagicMock

from app.auth.schemas import AuthUser
from app.auth.middleware import _extract_auth_user


def test_auth_user_is_superadmin():
    user = AuthUser(id="u1", tenant_id="t1", roles=["superadmin"], email="a@b.com", name="Admin")
    assert user.is_superadmin is True
    assert user.is_operator is False


def test_auth_user_is_operator():
    user = AuthUser(id="u2", tenant_id="t1", roles=["operator"], email="op@b.com", name="Op")
    assert user.is_superadmin is False
    assert user.is_operator is True


def test_auth_user_tenant_admin_is_operator():
    user = AuthUser(id="u3", tenant_id="t1", roles=["tenant_admin"], email="ta@b.com", name="TA")
    assert user.is_operator is True


def test_extract_auth_user():
    claims = {
        "sub": "user-123",
        "email": "test@example.com",
        "name": "Test User",
        "urn:zitadel:iam:org:id": "org-456",
        "urn:zitadel:iam:org:project:proj-1:roles": {
            "operator": {"org-456": "org-456"},
        },
    }
    with patch("app.auth.middleware.settings") as mock_settings:
        mock_settings.zitadel_project_id = "proj-1"
        user = _extract_auth_user(claims)

    assert user.id == "user-123"
    assert user.tenant_id == "org-456"
    assert "operator" in user.roles
    assert user.email == "test@example.com"


@pytest.mark.anyio
async def test_unprotected_routes_pass_without_token(client):
    resp = await client.get("/v1/health")
    assert resp.status_code == 200
