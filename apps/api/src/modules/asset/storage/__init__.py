"""Asset-module file storage factory.

Default backend is local disk. An S3 backend can be added later by implementing
the same StorageBackend protocol and switching ASSET_STORAGE_BACKEND.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from core.config import get_settings
from modules.asset.storage.base import StorageBackend
from modules.asset.storage.local import LocalDiskStorage
from modules.asset.storage.startup import validate_asset_storage_on_startup


@lru_cache
def get_storage() -> StorageBackend:
    settings = get_settings()
    backend = (settings.asset_storage_backend or "local").strip().lower()
    if backend != "local":
        raise RuntimeError(
            f"Unsupported ASSET_STORAGE_BACKEND={backend!r}; only 'local' is implemented"
        )
    root = settings.resolved_asset_storage_path
    return LocalDiskStorage(root)


def reset_storage_cache() -> None:
    get_storage.cache_clear()


__all__ = [
    "StorageBackend",
    "LocalDiskStorage",
    "get_storage",
    "reset_storage_cache",
    "validate_asset_storage_on_startup",
]
