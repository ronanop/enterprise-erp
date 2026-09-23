"""Upload validation and asset-doc URI helpers for Asset Documents."""

from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

from core.config import get_settings
from modules.asset.domain.exceptions import DocumentValidationError

ALLOWED_CONTENT_TYPES: frozenset[str] = frozenset(
    {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/jpeg",
        "image/png",
    }
)

_EXT_BY_TYPE = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "image/jpeg": ".jpg",
    "image/png": ".png",
}

_TYPE_BY_EXT = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
}

_PDF_MAGIC = b"%PDF"
_JPEG_MAGIC = b"\xff\xd8\xff"
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_OLE_MAGIC = b"\xd0\xcf\x11\xe0"
_ZIP_MAGIC = b"PK"
_EXE_MAGIC = b"MZ"

_CONTROL_OR_FORBIDDEN = re.compile(r'[\x00-\x1f\x7f<>:"|?*\\]')
_ASSET_DOC_SCHEME = "asset-doc"
_STORAGE_PREFIX = "asset-documents/"


@dataclass(frozen=True)
class AssetDocUriMeta:
    storage_key: str | None
    content_type: str | None
    file_size_bytes: int | None
    is_stored: bool


def max_upload_bytes() -> int:
    mb = int(get_settings().asset_document_max_upload_mb or 10)
    return max(mb, 1) * 1024 * 1024


def upload_limits_payload() -> dict:
    mb = max(int(get_settings().asset_document_max_upload_mb or 10), 1)
    return {
        "max_upload_mb": mb,
        "allowed_content_types": sorted(ALLOWED_CONTENT_TYPES),
        "accepted_extensions": sorted({ext.lstrip(".") for ext in _TYPE_BY_EXT}),
    }


def allowed_types_message() -> str:
    mb = max(int(get_settings().asset_document_max_upload_mb or 10), 1)
    return (
        f"Only PDF, DOC, DOCX, XLS, XLSX, PNG, and JPEG files are allowed, up to {mb} MB. "
        "The file contents must match the declared type."
    )


def display_filename(name: str | None) -> str:
    """Keep the user-facing original filename; strip path/control chars only."""
    raw = Path(str(name or "").replace("\\", "/")).name.strip()
    if not raw or raw in {".", ".."}:
        return "document"
    cleaned = _CONTROL_OR_FORBIDDEN.sub("_", raw).strip(" .") or "document"
    return cleaned[:255]


def extension_for_content_type(content_type: str) -> str:
    return _EXT_BY_TYPE.get(content_type, "")


def document_type_for_content_type(content_type: str) -> str:
    if content_type.startswith("image/"):
        return "photo"
    return "other"


def _normalize_declared(declared: str | None) -> str:
    value = (declared or "").split(";")[0].strip().lower()
    if value in {"image/jpg", "image/pjpeg"}:
        return "image/jpeg"
    return value


def _sniff_ooxml(data: bytes) -> str | None:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            names = {name.replace("\\", "/") for name in zf.namelist()}
    except zipfile.BadZipFile as exc:
        raise DocumentValidationError(
            "File is not a recognised Office document. " + allowed_types_message()
        ) from exc
    if any(name.startswith("word/") for name in names):
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if any(name.startswith("xl/") for name in names):
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    raise DocumentValidationError(
        "File is not a recognised DOCX or XLSX document. " + allowed_types_message()
    )


def sniff_content_type(data: bytes, *, original_filename: str | None = None) -> str:
    if data.startswith(_EXE_MAGIC):
        raise DocumentValidationError(
            "Executable content is not allowed. " + allowed_types_message()
        )
    if data.startswith(_PDF_MAGIC):
        return "application/pdf"
    if data.startswith(_JPEG_MAGIC):
        return "image/jpeg"
    if data.startswith(_PNG_MAGIC):
        return "image/png"
    if data.startswith(_OLE_MAGIC):
        ext = Path(display_filename(original_filename)).suffix.lower()
        if ext == ".xls":
            return "application/vnd.ms-excel"
        return "application/msword"
    if data.startswith(_ZIP_MAGIC):
        return _sniff_ooxml(data)
    raise DocumentValidationError(
        "File type is not supported. " + allowed_types_message()
    )


def validate_upload_bytes(
    data: bytes,
    *,
    declared_content_type: str | None = None,
    original_filename: str | None = None,
) -> tuple[str, str, int]:
    """Return (content_type, display_filename, size_bytes)."""
    limit = max_upload_bytes()
    size = len(data)
    if size == 0:
        raise DocumentValidationError("Uploaded file is empty. " + allowed_types_message())
    if size > limit:
        mb = limit // (1024 * 1024)
        raise DocumentValidationError(
            f"File is larger than the {mb} MB upload limit. " + allowed_types_message()
        )

    sniffed = sniff_content_type(data, original_filename=original_filename)
    declared = _normalize_declared(declared_content_type)
    if declared and declared not in {"application/octet-stream", "binary/octet-stream"}:
        if declared not in ALLOWED_CONTENT_TYPES:
            raise DocumentValidationError(
                f"Content type {declared!r} is not allowed. " + allowed_types_message()
            )
        if declared != sniffed:
            raise DocumentValidationError(
                "File contents do not match the declared content type. "
                + allowed_types_message()
            )

    filename = display_filename(original_filename)
    expected_ext = extension_for_content_type(sniffed)
    if "." not in filename and expected_ext:
        filename = f"{filename}{expected_ext}"
    return sniffed, filename, size


def build_storage_key(asset_id: str, content_type: str) -> str:
    from uuid import uuid4

    ext = extension_for_content_type(content_type) or ".bin"
    return f"{_STORAGE_PREFIX}{asset_id}/{uuid4()}{ext}"


def build_asset_doc_uri(
    storage_key: str,
    *,
    content_type: str,
    file_size_bytes: int,
) -> str:
    return (
        f"{_ASSET_DOC_SCHEME}://local/{storage_key}"
        f"?size={int(file_size_bytes)}&ctype={quote(content_type, safe='')}"
    )


def parse_asset_doc_uri(storage_uri: str | None) -> AssetDocUriMeta:
    if not storage_uri:
        return AssetDocUriMeta(None, None, None, False)
    value = str(storage_uri).strip()
    parsed = urlparse(value)
    scheme = (parsed.scheme or "").lower()

    if scheme == _ASSET_DOC_SCHEME:
        # asset-doc://local/asset-documents/... → netloc=local, path=/asset-documents/...
        key = unquote(parsed.path.lstrip("/"))
        qs = parse_qs(parsed.query)
        size_raw = (qs.get("size") or [None])[0]
        ctype = unquote((qs.get("ctype") or [None])[0] or "") or None
        size = int(size_raw) if size_raw and str(size_raw).isdigit() else None
        if key.startswith(_STORAGE_PREFIX):
            return AssetDocUriMeta(key, ctype, size, True)
        return AssetDocUriMeta(key or None, ctype, size, bool(key))

    if not scheme and value.startswith(_STORAGE_PREFIX):
        return AssetDocUriMeta(value, None, None, True)

    return AssetDocUriMeta(None, None, None, False)


def is_https_pointer(storage_uri: str | None) -> bool:
    if not storage_uri:
        return False
    return urlparse(str(storage_uri).strip()).scheme.lower() == "https"
