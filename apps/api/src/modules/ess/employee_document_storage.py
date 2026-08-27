"""Employee document storage — MinIO when enabled, local disk otherwise."""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from pathlib import Path

from core import object_storage
from core.exceptions import AppException, NotFoundException

ESS_DOC_PREFIX = "ess-doc:"
MAX_PHOTO_BYTES = 300 * 1024
MAX_UPLOAD_BYTES = 2 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}

UPLOAD_ROOT = Path(__file__).resolve().parents[3] / "var" / "ess-documents"


@dataclass(frozen=True)
class DocumentDownload:
    filename: str
    media_type: str
    path: str | None = None
    content: bytes | None = None


def _safe_filename(name: str) -> str:
    base = Path(name).name
    cleaned = re.sub(r"[^\w.\-]+", "_", base).strip("._")
    return cleaned[:200] or "document"


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
    if len(raw) > MAX_UPLOAD_BYTES:
        raise AppException(f"File exceeds maximum size of {MAX_UPLOAD_BYTES // (1024 * 1024)}MB")
    ext = Path(file_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise AppException("Allowed file types: PDF, PNG, JPG, JPEG")

    stored_name = f"{uuid.uuid4()}_{_safe_filename(file_name)}"
    rel = f"{company_id}/{employee_id}/{stored_name}"
    if object_storage.is_enabled():
        key = object_storage.module_key("hr", "ess", rel)
        return object_storage.put_bytes(key, raw, guess_media_type(file_name))

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    dest_dir = UPLOAD_ROOT / str(company_id) / str(employee_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / stored_name
    dest.write_bytes(raw)
    return f"{ESS_DOC_PREFIX}{rel}"


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
    if object_storage.is_minio_uri(storage_uri):
        content = object_storage.get_bytes(storage_uri)
        stored_name = storage_uri.rsplit("/", 1)[-1]
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
