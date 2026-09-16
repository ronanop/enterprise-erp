"""Asset-module file storage factory.

Supports local disk and AWS S3 via ``ASSET_STORAGE_BACKEND`` /
``OBJECT_STORAGE_BACKEND``.
"""

from __future__ import annotations

from functools import lru_cache

from core.config import get_settings
from modules.asset.storage.base import StorageBackend
from modules.asset.storage.local import LocalDiskStorage
from modules.asset.storage.s3 import S3Storage
from modules.asset.storage.startup import validate_asset_storage_on_startup


@lru_cache
def get_storage() -> StorageBackend:
    settings = get_settings()
    backend = (settings.asset_storage_backend or "local").strip().lower()
    object_backend = (settings.object_storage_backend or "local").strip().lower()
    if backend == "local" and object_backend == "s3" and settings.s3_configured:
        backend = "s3"
    if backend == "s3":
        if not settings.s3_configured:
            # Soft-fallback so empty S3_* during rollout does not crash imports.
            import logging

            logging.getLogger(__name__).warning(
                "ASSET_STORAGE_BACKEND=s3 but S3_BUCKET/S3_REGION unset; "
                "falling back to local disk at %s",
                settings.resolved_asset_storage_path,
            )
            return LocalDiskStorage(settings.resolved_asset_storage_path)
        return S3Storage()
    if backend != "local":
        raise RuntimeError(
            f"Unsupported ASSET_STORAGE_BACKEND={backend!r}; use 'local' or 's3'"
        )
    root = settings.resolved_asset_storage_path
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
