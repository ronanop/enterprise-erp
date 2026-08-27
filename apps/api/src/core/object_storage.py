"""MinIO / S3-compatible object storage with per-module key prefixes.

Object keys are namespaced as ``{module}/...`` so HRMS, payroll, CRM, and
other modules share one bucket without mixing blobs.
"""

from __future__ import annotations

from io import BytesIO
from typing import Any

from core.config import settings
from core.exceptions import AppException, NotFoundException

MINIO_URI_PREFIX = "minio:"

_client: Any = None


def is_enabled() -> bool:
    return settings.storage_backend.strip().lower() == "minio"


def is_minio_uri(uri: str) -> bool:
    return uri.startswith(MINIO_URI_PREFIX)


def module_key(module: str, *parts: str) -> str:
    chunks = [module.strip("/")]
    for part in parts:
        cleaned = str(part).replace("\\", "/").strip("/")
        if cleaned and ".." not in cleaned.split("/"):
            chunks.append(cleaned)
    return "/".join(chunks)


def build_uri(key: str) -> str:
    return f"{MINIO_URI_PREFIX}{key.lstrip('/')}"


def parse_key(uri: str) -> str:
    if not is_minio_uri(uri):
        raise NotFoundException("Object is not stored in MinIO")
    key = uri[len(MINIO_URI_PREFIX) :].lstrip("/")
    if not key or ".." in key.split("/"):
        raise NotFoundException("Invalid object storage key")
    return key


def get_client() -> Any:
    global _client
    if _client is None:
        from minio import Minio

        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_root_user,
            secret_key=settings.minio_root_password,
            secure=settings.minio_secure,
        )
    return _client


def ensure_bucket() -> None:
    client = get_client()
    bucket = settings.minio_bucket
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)


def put_bytes(key: str, data: bytes, content_type: str | None = None) -> str:
    try:
        ensure_bucket()
        client = get_client()
        client.put_object(
            settings.minio_bucket,
            key,
            BytesIO(data),
            length=len(data),
            content_type=content_type or "application/octet-stream",
        )
    except NotFoundException:
        raise
    except Exception as exc:
        raise AppException(f"Object storage upload failed: {exc}") from exc
    return build_uri(key)


def get_bytes(uri: str) -> bytes:
    key = parse_key(uri)
    try:
        client = get_client()
        response = client.get_object(settings.minio_bucket, key)
        try:
            return bytes(response.read())
        finally:
            response.close()
            response.release_conn()
    except NotFoundException:
        raise
    except Exception as exc:
        raise NotFoundException("Document file not found in object storage") from exc


def ping() -> bool:
    if not is_enabled():
        return False
    try:
        get_client().bucket_exists(settings.minio_bucket)
        return True
    except Exception:
        return False
