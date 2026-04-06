from unittest.mock import MagicMock, patch

from app.storage.client import upload_bytes, download_bytes, presigned_url


@patch("app.storage.client.get_minio_client")
def test_upload_bytes(mock_get_client):
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client

    result = upload_bytes("tenants/t1/test.jpg", b"fake-image-data", "image/jpeg")

    assert result == "tenants/t1/test.jpg"
    mock_client.put_object.assert_called_once()
    call_args = mock_client.put_object.call_args
    assert call_args[0][0] == "tenant-assets"
    assert call_args[0][1] == "tenants/t1/test.jpg"


@patch("app.storage.client.get_minio_client")
def test_download_bytes(mock_get_client):
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.read.return_value = b"image-data"
    mock_client.get_object.return_value = mock_response
    mock_get_client.return_value = mock_client

    result = download_bytes("tenants/t1/test.jpg")

    assert result == b"image-data"
    mock_client.get_object.assert_called_once_with("tenant-assets", "tenants/t1/test.jpg")
    mock_response.close.assert_called_once()
    mock_response.release_conn.assert_called_once()


@patch("app.storage.client.get_minio_client")
def test_presigned_url(mock_get_client):
    mock_client = MagicMock()
    mock_client.presigned_get_object.return_value = "https://minio.local/tenant-assets/key?signature=abc"
    mock_get_client.return_value = mock_client

    result = presigned_url("tenants/t1/render.jpg")

    assert "minio.local" in result
    mock_client.presigned_get_object.assert_called_once()
