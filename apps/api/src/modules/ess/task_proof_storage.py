"""Workplace task proof file storage — MinIO only."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

from core import object_storage
from core.exceptions import AppException, NotFoundException
from shared.upload_safety import (
    ALLOWED_EXTENSIONS,
    UnsafeUploadError,
    sanitize_filename,
    validate_upload,
)

MAX_TASK_PROOF_BYTES = 10 * 1024 * 1024
MAX_TASK_PROOF_FILES = 5
# Plan allow-list: images, PDF, office docs, plain text (subset of shared allow-list).
PROOF_ALLOWED_EXTENSIONS = frozenset(
    {
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".tif",
        ".tiff",
        ".bmp",
        ".pdf",
        ".txt",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".odt",
        ".ods",
        ".odp",
        ".rtf",
        ".csv",
    }
) & ALLOWED_EXTENSIONS


@dataclass(frozen=True)
class TaskProofDownload:
    filename: str
    media_type: str
    content: bytes


def _guess_media_type(file_name: str) -> str:
    ext = Path(file_name).suffix.lower()
    mapping = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".tif": "image/tiff",
        ".tiff": "image/tiff",
        ".pdf": "application/pdf",
        ".txt": "text/plain",
        ".csv": "text/csv",
        ".doc": "application/msword",
        ".docx": (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        ".xls": "application/vnd.ms-excel",
        ".xlsx": (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        ".ppt": "application/vnd.ms-powerpoint",
        ".pptx": (
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        ),
        ".rtf": "application/rtf",
        ".odt": "application/vnd.oasis.opendocument.text",
        ".ods": "application/vnd.oasis.opendocument.spreadsheet",
        ".odp": "application/vnd.oasis.opendocument.presentation",
    }
    return mapping.get(ext, "application/octet-stream")


def save_task_proof_bytes(
    *,
    company_id: uuid.UUID,
    task_id: uuid.UUID,
    assignee_id: uuid.UUID,
    file_name: str,
    raw: bytes,
    content_type: str | None = None,
) -> tuple[str, str, str, int]:
    """Validate + put to MinIO. Returns (storage_uri, safe_name, media_type, byte_size)."""
    if not object_storage.is_enabled():
        raise AppException(
            "Object storage unavailable. MinIO must be configured for task proof uploads.",
            status_code=503,
        )
    try:
        safe_name, media = validate_upload(
            file_name=file_name,
            content_type=content_type,
            raw=raw,
            max_bytes=MAX_TASK_PROOF_BYTES,
            allowed_extensions=PROOF_ALLOWED_EXTENSIONS,
        )
    except UnsafeUploadError as exc:
        raise AppException(str(exc)) from exc

    stored_name = f"{uuid.uuid4()}_{sanitize_filename(safe_name, max_length=180)}"
    rel = f"{company_id}/{task_id}/{assignee_id}/{stored_name}"
    key = object_storage.module_key("hr", "workplace-task", rel)
    media_type = media or _guess_media_type(stored_name)
    try:
        uri = object_storage.put_bytes(key, raw, media_type)
    except Exception as exc:  # noqa: BLE001
        raise AppException(
            f"Failed to store task proof in MinIO: {exc}",
            status_code=503,
        ) from exc
    return uri, stored_name, media_type, len(raw)


def load_task_proof(storage_uri: str, file_name: str) -> TaskProofDownload:
    if not object_storage.is_object_uri(storage_uri):
        raise NotFoundException("Task proof is not available")
    try:
        content = object_storage.get_bytes(storage_uri)
    except Exception as exc:  # noqa: BLE001
        raise NotFoundException("Task proof not found in object storage") from exc
    stored = storage_uri.rsplit("/", 1)[-1]
    download_name = file_name or stored
    suffix = Path(stored).suffix
    if suffix and not download_name.lower().endswith(suffix.lower()):
        download_name = f"{download_name}{suffix}"
    return TaskProofDownload(
        filename=download_name,
        media_type=_guess_media_type(stored),
        content=content,
    )
