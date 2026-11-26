"""Employee document storage - S3 when enabled, local disk otherwise."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

from core import object_storage
from core.exceptions import AppException, NotFoundException
from shared.upload_safety import UnsafeUploadError, sanitize_filename, validate_upload

ESS_DOC_PREFIX = "ess-doc:"
MAX_PHOTO_BYTES = 300 * 1024
MAX_UPLOAD_BYTES = 2 * 1024 * 1024
ALLOWED_EXTENSIONS = frozenset({".pdf", ".png", ".jpg", ".jpeg"})

UPLOAD_ROOT = Path(__file__).resolve().parents[3] / "var" / "ess-documents"


@dataclass(frozen=True)
class DocumentDownload:
    filename: str
    media_type: str
    path: str | None = None
    content: bytes | None = None


def _safe_filename(name: str) -> str:
    return sanitize_filename(name, max_length=200)


def guess_media_type(file_name: str) -> str:
    ext = Path(file_name).suffix.lower()
    if ext == ".pdf":
        return "application/pdf"
    if ext in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if ext == ".png":
        return "image/png"
    return "application/octet-stream"


def save_employee_document_bytes(
    *,
    company_id: uuid.UUID,
    employee_id: uuid.UUID,
    file_name: str,
    raw: bytes,
) -> str:
    try:
        safe_name, _media = validate_upload(
            file_name=file_name,
            content_type=None,
            raw=raw,
            max_bytes=MAX_UPLOAD_BYTES,
            allowed_extensions=ALLOWED_EXTENSIONS,
        )
    except UnsafeUploadError as exc:
        raise AppException(str(exc)) from exc

    from core.blob_store import store_bytes

    return store_bytes(
        module="hr",
        category="ess",
        owner_id=str(employee_id),
        company_id=str(company_id),
        file_name=safe_name,
        data=raw,
        content_type=guess_media_type(file_name),
    )


def resolve_document_path(storage_uri: str) -> Path:
    if not storage_uri.startswith(ESS_DOC_PREFIX):
        raise NotFoundException("Document file is not available for download")
    rel = storage_uri[len(ESS_DOC_PREFIX) :]
    if ".." in rel.replace("\\", "/"):
        raise NotFoundException("Invalid document storage path")
    full = (UPLOAD_ROOT / rel).resolve()
    root = UPLOAD_ROOT.resolve()
    try:
        full.relative_to(root)
    except ValueError as exc:
        raise NotFoundException("Invalid document storage path") from exc
    if not full.is_file():
        raise NotFoundException("Document file not found on server")
    return full


def load_document_download(storage_uri: str, document_name: str) -> DocumentDownload:
    from core.blob_store import FILE_URI_PREFIX, load_bytes

    if object_storage.is_object_uri(storage_uri) or storage_uri.startswith(FILE_URI_PREFIX):
        content, stored_name = load_bytes(storage_uri)
        suffix = Path(stored_name).suffix
        download_name = document_name
        if suffix and not download_name.lower().endswith(suffix.lower()):
            download_name = f"{download_name}{suffix}"
        return DocumentDownload(
            filename=download_name,
            media_type=guess_media_type(stored_name),
            content=content,
        )
    path = resolve_document_path(storage_uri)
    download_name = document_name
    if path.suffix and not download_name.lower().endswith(path.suffix.lower()):
        download_name = f"{download_name}{path.suffix}"
    return DocumentDownload(
        filename=download_name,
        media_type=guess_media_type(path.name),
        path=str(path),
    )
