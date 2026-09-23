"""AWS S3 object storage helpers.

Used by ESS, CRM attachments, and the asset StorageBackend when
``OBJECT_STORAGE_BACKEND=s3`` (or ``ASSET_STORAGE_BACKEND=s3``).
"""

from __future__ import annotations

import io
from functools import lru_cache
from typing import BinaryIO
from urllib.parse import unquote, urlparse

from core.config import get_settings, settings

S3_URI_PREFIX = "s3://"
# Legacy URI scheme from earlier MinIO experiments (read-only support).
MINIO_URI_PREFIX = "minio://"


def is_enabled() -> bool:
    """True when S3 is selected and bucket/region are configured."""
    cfg = get_settings()
    backend = (cfg.object_storage_backend or "local").strip().lower()
    return backend == "s3" and cfg.s3_configured


def is_object_uri(uri: str | None) -> bool:
    if not uri:
        return False
    value = uri.strip()
    return value.startswith(S3_URI_PREFIX) or value.startswith(MINIO_URI_PREFIX)


# Backward-compatible alias used by ESS.
is_minio_uri = is_object_uri


def module_key(*parts: str) -> str:
    """Join opaque key segments (no leading slash)."""
    cleaned: list[str] = []
    for part in parts:
        piece = str(part).strip().strip("/")
        if not piece or ".." in piece.replace("\\", "/"):
            raise ValueError(f"Invalid object key segment: {part!r}")
        cleaned.append(piece)
    if not cleaned:
        raise ValueError("Object key must not be empty")
    return "/".join(cleaned)


def to_uri(key: str, *, bucket: str | None = None) -> str:
    cfg = get_settings()
    bkt = (bucket or cfg.s3_bucket).strip()
    clean_key = key.lstrip("/")
    return f"{S3_URI_PREFIX}{bkt}/{clean_key}"


def parse_uri(uri: str) -> tuple[str, str]:
    """Return (bucket, key) from ``s3://bucket/key`` or ``minio://bucket/key``."""
    value = uri.strip()
    if value.startswith(MINIO_URI_PREFIX):
        value = S3_URI_PREFIX + value[len(MINIO_URI_PREFIX) :]
    if not value.startswith(S3_URI_PREFIX):
        raise ValueError(f"Not an object storage URI: {uri!r}")
    parsed = urlparse(value)
    bucket = unquote(parsed.netloc)
    key = unquote(parsed.path.lstrip("/"))
    if not bucket or not key:
        raise ValueError(f"Invalid object storage URI: {uri!r}")
    return bucket, key


@lru_cache
def _client():
    try:
        import boto3
        from botocore.config import Config
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "boto3 is required for S3 object storage. Install apps/api requirements."
        ) from exc

    cfg = get_settings()
    endpoint = cfg.s3_endpoint_url.strip()
    # Path-style required for MinIO / IP endpoints; virtual-hosted for AWS.
    s3_cfg: dict[str, str] = {"addressing_style": "path"} if endpoint else {}
    kwargs: dict[str, object] = {
        "service_name": "s3",
        "region_name": cfg.s3_region.strip() or None,
        "config": Config(signature_version="s3v4", s3=s3_cfg),
    }
    access = cfg.aws_access_key_id.strip()
    secret = cfg.aws_secret_access_key.strip()
    if access and secret:
        kwargs["aws_access_key_id"] = access
        kwargs["aws_secret_access_key"] = secret
    if cfg.aws_session_token.strip():
        kwargs["aws_session_token"] = cfg.aws_session_token.strip()
    # Optional custom endpoint (MinIO / LocalStack). Empty = real AWS S3.
    if endpoint:
        kwargs["endpoint_url"] = endpoint
    return boto3.client(**kwargs)


def reset_client_cache() -> None:
    _client.cache_clear()


def put_bytes(key: str, data: bytes, content_type: str | None = None) -> str:
    """Upload bytes and return ``s3://bucket/key``."""
    if not is_enabled():
        raise RuntimeError("S3 object storage is not enabled/configured")
    cfg = get_settings()
    clean_key = key.lstrip("/")
    extra: dict[str, str] = {}
    if content_type:
        extra["ContentType"] = content_type
    _client().put_object(
        Bucket=cfg.s3_bucket.strip(),
        Key=clean_key,
        Body=data,
        **extra,
    )
    return to_uri(clean_key)


def put_fileobj(key: str, fileobj: BinaryIO, content_type: str | None = None) -> str:
    if not is_enabled():
        raise RuntimeError("S3 object storage is not enabled/configured")
    cfg = get_settings()
    clean_key = key.lstrip("/")
    extra: dict[str, object] = {}
    if content_type:
        extra["ExtraArgs"] = {"ContentType": content_type}
    _client().upload_fileobj(
        fileobj,
        cfg.s3_bucket.strip(),
        clean_key,
        **extra,
    )
    return to_uri(clean_key)


def get_bytes(uri_or_key: str) -> bytes:
    bucket, key = _resolve_bucket_key(uri_or_key)
    response = _client().get_object(Bucket=bucket, Key=key)
    body = response["Body"].read()
    return body


def open_stream(uri_or_key: str) -> BinaryIO:
    """Return a readable BytesIO of the object (caller closes)."""
    return io.BytesIO(get_bytes(uri_or_key))


def delete_object(uri_or_key: str) -> None:
    bucket, key = _resolve_bucket_key(uri_or_key)
    _client().delete_object(Bucket=bucket, Key=key)


def exists(uri_or_key: str) -> bool:
    from botocore.exceptions import ClientError

    bucket, key = _resolve_bucket_key(uri_or_key)
    try:
        _client().head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code in {"404", "NoSuchKey", "NotFound"}:
            return False
        raise


def _resolve_bucket_key(uri_or_key: str) -> tuple[str, str]:
    value = uri_or_key.strip()
    if is_object_uri(value):
        return parse_uri(value)
    cfg = get_settings()
    return cfg.s3_bucket.strip(), value.lstrip("/")


def head_ok() -> tuple[bool, str]:
    """Health probe: HeadBucket when S3 is enabled."""
    if not is_enabled():
        return True, "S3 not enabled (skipped)"
    cfg = get_settings()
    bucket = cfg.s3_bucket.strip()
    try:
        _client().head_bucket(Bucket=bucket)
        return True, f"bucket={bucket} region={cfg.s3_region}"
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


def storage_diagnostics() -> dict[str, object]:
    """Safe summary for health/admin endpoints (no secrets)."""
    cfg = settings
    return {
        "object_storage_backend": cfg.object_storage_backend,
        "s3_configured": cfg.s3_configured,
        "s3_bucket": cfg.s3_bucket.strip() or None,
        "s3_region": cfg.s3_region.strip() or None,
        "s3_endpoint_url": cfg.s3_endpoint_url.strip() or None,
        "crm_upload_root": str(cfg.resolved_crm_upload_root),
        "asset_storage_backend": cfg.asset_storage_backend,
    }
