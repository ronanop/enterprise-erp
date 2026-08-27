"""Local-disk storage backend. Keys are opaque relative paths, never absolute."""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import BinaryIO


class LocalDiskStorage:
    def __init__(self, root: Path) -> None:
        self._root = root.expanduser().resolve()
        self._root.mkdir(parents=True, exist_ok=True)

    def save(self, file: BinaryIO, key: str) -> str:
        dest = self._resolve(key)
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_name(dest.name + ".tmp")
        with tmp.open("wb") as out:
            shutil.copyfileobj(file, out)
        tmp.replace(dest)
        return key

    def open(self, key: str) -> BinaryIO:
        return self._resolve(key).open("rb")

    def delete(self, key: str) -> None:
        path = self._resolve(key)
        if path.is_file():
            path.unlink()

    def exists(self, key: str) -> bool:
        return self._resolve(key).is_file()

    def _resolve(self, key: str) -> Path:
        if not key or key.startswith("/") or "\\" in key:
            raise ValueError("Invalid storage key")
        parts = Path(key).parts
        if not parts or any(part in {"", ".", ".."} for part in parts):
            raise ValueError("Invalid storage key")
        dest = (self._root / key).resolve()
        dest.relative_to(self._root)
        return dest
