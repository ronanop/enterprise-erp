"""HRMS blob store — MinIO when configured, local ``var/`` fallback otherwise.

All callers should persist the returned URI in DB (``s3://…`` or ``file:…``).
"""

from __future__ import annotations

import mimetypes
import re
import uuid
from pathlib import Path

from core import object_storage
from core.config import get_settings

FILE_URI_PREFIX = "file:"
_API_ROOT = Path(__file__).resolve().parents[2]  # apps/api
_VAR_ROOT = _API_ROOT / "var"


def _safe_name(file_name: str, *, default: str = "file.bin") -> str:
    raw = (file_name or "").strip() or default
    cleaned = re.sub(r"[^\w.\- ]+", "_", raw).strip() or default
    return cleaned[:180]


def guess_content_type(file_name: str) -> str:
    ctype, _ = mimetypes.guess_type(file_name)
    return ctype or "application/octet-stream"


def store_bytes(
    *,
    module: str,
    category: str,
    owner_id: str,
    file_name: str,
    data: bytes,
    content_type: str | None = None,
    company_id: str | None = None,
    stable_name: bool = False,
) -> str:
    """Persist bytes and return a durable URI (``s3://`` or ``file:``).

    When ``stable_name`` is True the file name is kept as-is (no UUID prefix) —
    use for replaceable indexes such as offer-template catalogs.
    """
    if not data:
        raise ValueError("Empty file")
    safe = _safe_name(file_name)
    stored = safe if stable_name else f"{uuid.uuid4().hex[:12]}_{safe}"
    parts = [module, category]
    if company_id:
        parts.append(str(company_id))
    parts.append(str(owner_id))
    parts.append(stored)
    rel = "/".join(parts)
    ctype = content_type or guess_content_type(safe)

    if object_storage.is_enabled():
        key = object_storage.module_key(*parts)
        return object_storage.put_bytes(key, data, ctype)

    dest_dir = _VAR_ROOT.joinpath(*parts[:-1])
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / stored
    dest.write_bytes(data)
    return f"{FILE_URI_PREFIX}{rel}"


def load_bytes(uri: str) -> tuple[bytes, str]:
    """Return ``(content, filename_hint)`` for an object or file URI / legacy absolute path."""
    value = (uri or "").strip()
    if not value:
        raise FileNotFoundError("Empty storage URI")

    if object_storage.is_object_uri(value):
        raw = object_storage.get_bytes(value)
        name = value.rsplit("/", 1)[-1]
        return raw, name

    if value.startswith(FILE_URI_PREFIX):
        rel = value[len(FILE_URI_PREFIX) :].lstrip("/").replace("\\", "/")
        if ".." in rel:
            raise FileNotFoundError("Invalid file URI")
        path = (_VAR_ROOT / rel).resolve()
        root = _VAR_ROOT.resolve()
        path.relative_to(root)
        if not path.is_file():
            raise FileNotFoundError(str(path))
        return path.read_bytes(), path.name

    # Legacy absolute / relative disk paths from older recruitment uploads
    path = Path(value)
    candidates = [path] if path.is_absolute() else [_API_ROOT / path, _API_ROOT / "src" / path, path]
    for candidate in candidates:
        try:
            resolved = candidate.resolve()
        except OSError:
            continue
        if resolved.is_file():
            return resolved.read_bytes(), resolved.name
    raise FileNotFoundError(value)


def is_blob_uri(uri: str | None) -> bool:
    if not uri:
        return False
    value = uri.strip()
    return (
        object_storage.is_object_uri(value)
        or value.startswith(FILE_URI_PREFIX)
        or Path(value).is_file()
    )
