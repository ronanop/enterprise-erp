"""Local file storage for ESS employee document uploads."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from core.exceptions import AppException, NotFoundException

ESS_DOC_PREFIX = "ess-doc:"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}

UPLOAD_ROOT = Path(__file__).resolve().parents[3] / "var" / "ess-documents"


def _safe_filename(name: str) -> str:
    base = Path(name).name
    cleaned = re.sub(r"[^\w.\-]+", "_", base).strip("._")
    return cleaned[:200] or "document"


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

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    rel_dir = Path(str(company_id)) / str(employee_id)
    dest_dir = UPLOAD_ROOT / rel_dir
    dest_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4()}_{_safe_filename(file_name)}"
    dest = dest_dir / stored_name
    dest.write_bytes(raw)
    rel = rel_dir / stored_name
    return f"{ESS_DOC_PREFIX}{rel.as_posix()}"


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


def guess_media_type(file_name: str) -> str:
    ext = Path(file_name).suffix.lower()
    if ext == ".pdf":
        return "application/pdf"
    if ext in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if ext == ".png":
        return "image/png"
    return "application/octet-stream"
