"""MinIO (S3-compatible) storage backend for the asset module."""

from __future__ import annotations

from typing import BinaryIO

from core import object_storage


class S3Storage:
    """Opaque keys stored in the configured MinIO bucket (same keys as local)."""

    def save(self, file: BinaryIO, key: str) -> str:
        self._validate_key(key)
        # DB stores opaque keys (same as local); not full s3:// URIs.
        object_storage.put_fileobj(key, file)
        return key

    def open(self, key: str) -> BinaryIO:
        self._validate_key(key)
        return object_storage.open_stream(key)

    def delete(self, key: str) -> None:
        self._validate_key(key)
        if object_storage.exists(key):
            object_storage.delete_object(key)

    def exists(self, key: str) -> bool:
        self._validate_key(key)
        return object_storage.exists(key)

    @staticmethod
    def _validate_key(key: str) -> None:
        if not key or key.startswith("/") or "\\" in key:
            raise ValueError("Invalid storage key")
        parts = key.split("/")
        if any(part in {"", ".", ".."} for part in parts):
            raise ValueError("Invalid storage key")
