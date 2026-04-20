from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_segment_requires_provider() -> None:
    settings.provider = "disabled"
    response = client.post("/segment", json={
        "image": "data:image/png;base64,invalid",
        "target": "painted_wall",
    })

    assert response.status_code == 422
    assert response.json()["detail"]
