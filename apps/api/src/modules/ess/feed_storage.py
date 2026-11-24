"""Workplace feed photo storage — MinIO only (no local disk fallback)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

from core import object_storage
from core.exceptions import AppException, NotFoundException
from shared.upload_safety import UnsafeUploadError, sanitize_filename, validate_upload

MAX_FEED_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_EXTENSIONS = frozenset({".png", ".jpg", ".jpeg", ".webp"})


@dataclass(frozen=True)
class FeedImageDownload:
    filename: str
    media_type: str
    content: bytes


def _guess_media_type(file_name: str) -> str:
    ext = Path(file_name).suffix.lower()
    if ext in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if ext == ".png":
        return "image/png"
    if ext == ".webp":
        return "image/webp"
    return "application/octet-stream"


def save_feed_image_bytes(
    *,
    company_id: uuid.UUID,
    post_id: uuid.UUID,
    file_name: str,
    raw: bytes,
    content_type: str | None = None,
) -> tuple[str, str, str]:
    """Validate + put to MinIO. Returns (storage_uri, safe_name, media_type)."""
    if not object_storage.is_enabled():
        raise AppException(
            "Object storage unavailable. MinIO must be configured for company feed photos.",
            status_code=503,
        )
    try:
        safe_name, media = validate_upload(
            file_name=file_name,
            content_type=content_type,
            raw=raw,
            max_bytes=MAX_FEED_IMAGE_BYTES,
            allowed_extensions=ALLOWED_EXTENSIONS,
        )
    except UnsafeUploadError as exc:
        raise AppException(str(exc)) from exc

    stored_name = f"{uuid.uuid4()}_{sanitize_filename(safe_name, max_length=180)}"
    rel = f"{company_id}/{post_id}/{stored_name}"
    key = object_storage.module_key("hr", "social-feed", rel)
    media_type = media or _guess_media_type(stored_name)
    try:
        uri = object_storage.put_bytes(key, raw, media_type)
    except Exception as exc:  # noqa: BLE001 — surface MinIO failures cleanly
        raise AppException(
            f"Failed to store feed image in MinIO: {exc}",
            status_code=503,
        ) from exc
    return uri, stored_name, media_type


def load_feed_image(storage_uri: str, file_name: str) -> FeedImageDownload:
    if not object_storage.is_object_uri(storage_uri):
        raise NotFoundException("Feed image is not available")
    try:
        content = object_storage.get_bytes(storage_uri)
    except Exception as exc:  # noqa: BLE001
        raise NotFoundException("Feed image not found in object storage") from exc
    stored = storage_uri.rsplit("/", 1)[-1]
    download_name = file_name or stored
    suffix = Path(stored).suffix
    if suffix and not download_name.lower().endswith(suffix.lower()):
        download_name = f"{download_name}{suffix}"
    return FeedImageDownload(
        filename=download_name,
        media_type=_guess_media_type(stored),
        content=content,
    )
