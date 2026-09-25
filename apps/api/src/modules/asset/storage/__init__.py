"""Asset-module file storage factory.

Default backend is local disk. Set ``ASSET_STORAGE_BACKEND=minio`` to use the
VM MinIO bucket via ``core.object_storage`` (requires ``S3_ENDPOINT_URL``).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from core.config import get_settings
from modules.asset.storage.base import StorageBackend
from modules.asset.storage.local import LocalDiskStorage
from modules.asset.storage.s3 import S3Storage
from modules.asset.storage.startup import validate_asset_storage_on_startup


@lru_cache
def get_storage() -> StorageBackend:
    settings = get_settings()
    backend = (settings.asset_storage_backend or "local").strip().lower()
    if backend in {"minio", "s3"}:
        if not settings.s3_configured:
            raise RuntimeError(
                "ASSET_STORAGE_BACKEND=minio requires S3_ENDPOINT_URL, S3_BUCKET, "
                "and MinIO access keys"
            )
        return S3Storage()
    if backend != "local":
        raise RuntimeError(
            f"Unsupported ASSET_STORAGE_BACKEND={backend!r}; use 'local' or 'minio'"
        )
    root = Path(settings.asset_storage_path or "./var/asset-storage")
    return LocalDiskStorage(root)


def reset_storage_cache() -> None:
    get_storage.cache_clear()


__all__ = [
    "StorageBackend",
    "LocalDiskStorage",
    "S3Storage",
    "get_storage",
    "reset_storage_cache",
    "validate_asset_storage_on_startup",
]
