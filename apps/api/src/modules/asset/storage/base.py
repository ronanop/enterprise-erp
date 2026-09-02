"""Storage backend protocol for asset-module files."""

from __future__ import annotations

from typing import BinaryIO, Protocol


class StorageBackend(Protocol):
    def save(self, file: BinaryIO, key: str) -> str:
        """Persist bytes at ``key`` and return the stored key."""

    def open(self, key: str) -> BinaryIO:
        """Open stored bytes for reading. Caller closes the handle."""

    def delete(self, key: str) -> None:
        """Remove the object if it exists. Missing keys are a no-op."""

    def exists(self, key: str) -> bool: ...
