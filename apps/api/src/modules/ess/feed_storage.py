"""ESS social feed media storage — isolated MinIO/local prefix from other ERP objects.

Object keys live under ``hr/ess/feed/...`` (MinIO) or ``var/ess-feed/`` (local),
never mixed with ``hr/ess/{company}/{employee}`` document paths.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

from core import object_storage
from core.exceptions import AppException, NotFoundException
from shared.upload_safety import UnsafeUploadError, sanitize_filename, validate_upload

FEED_LOCAL_PREFIX = "ess-feed:"
# Photos: Instagram-style JPEG/PNG/WebP carousel (client crops before upload).
MAX_IMAGE_BYTES = 12 * 1024 * 1024
# Videos: raw upload before FFmpeg compress (≤ ~1 min phone capture).
MAX_VIDEO_BYTES = 80 * 1024 * 1024
MAX_PHOTOS_PER_POST = 10
MAX_VIDEO_SECONDS = 60

IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp"})
VIDEO_EXTENSIONS = frozenset({".mp4", ".mov", ".m4v", ".webm"})

UPLOAD_ROOT = Path(__file__).resolve().parents[3] / "var" / "ess-feed"


@dataclass(frozen=True)
class FeedMediaDownload:
    filename: str
    media_type: str
    path: str | None = None
    content: bytes | None = None


def guess_media_type(file_name: str) -> str:
    ext = Path(file_name).suffix.lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".m4v": "video/x-m4v",
        ".webm": "video/webm",
    }.get(ext, "application/octet-stream")


def save_feed_media_bytes(
    *,
    company_id: uuid.UUID,
    employee_id: uuid.UUID,
    file_name: str,
    raw: bytes,
    media_kind: str,
) -> tuple[str, str, int]:
    """Persist feed media under the isolated feed prefix.

    Returns ``(storage_uri, content_type, byte_size)``.
    """
    allowed = IMAGE_EXTENSIONS if media_kind == "image" else VIDEO_EXTENSIONS
    max_bytes = MAX_IMAGE_BYTES if media_kind == "image" else MAX_VIDEO_BYTES
    try:
        safe_name, media_type = validate_upload(
            file_name=file_name,
            content_type=None,
            raw=raw,
            max_bytes=max_bytes,
            allowed_extensions=allowed,
        )
    except UnsafeUploadError as exc:
        raise AppException(str(exc)) from exc

    stored_name = f"{uuid.uuid4()}_{sanitize_filename(safe_name, max_length=180)}"
    # Dedicated segment ``feed`` keeps objects separate from ESS documents.
    rel = f"{company_id}/{employee_id}/{stored_name}"
    content_type = media_type or guess_media_type(file_name)

    if object_storage.is_enabled():
        key = object_storage.module_key("hr", "ess", "feed", rel)
        uri = object_storage.put_bytes(key, raw, content_type)
        return uri, content_type, len(raw)

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    dest_dir = UPLOAD_ROOT / str(company_id) / str(employee_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / stored_name
    dest.write_bytes(raw)
    return f"{FEED_LOCAL_PREFIX}{rel}", content_type, len(raw)


def replace_feed_media_bytes(
    *,
    company_id: uuid.UUID,
    employee_id: uuid.UUID,
    file_name: str,
    raw: bytes,
    content_type: str,
) -> str:
    """Write processed (e.g. FFmpeg-compressed) bytes next to originals."""
    stored_name = f"{uuid.uuid4()}_compressed_{sanitize_filename(file_name, max_length=160)}"
    rel = f"{company_id}/{employee_id}/{stored_name}"
    if object_storage.is_enabled():
        key = object_storage.module_key("hr", "ess", "feed", rel)
        return object_storage.put_bytes(key, raw, content_type)

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    dest_dir = UPLOAD_ROOT / str(company_id) / str(employee_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / stored_name
    dest.write_bytes(raw)
    return f"{FEED_LOCAL_PREFIX}{rel}"


def resolve_local_path(storage_uri: str) -> Path:
    if not storage_uri.startswith(FEED_LOCAL_PREFIX):
        raise NotFoundException("Feed media is not available for download")
    rel = storage_uri[len(FEED_LOCAL_PREFIX) :]
    if ".." in rel.replace("\\", "/"):
        raise NotFoundException("Invalid feed storage path")
    full = (UPLOAD_ROOT / rel).resolve()
    root = UPLOAD_ROOT.resolve()
    try:
        full.relative_to(root)
    except ValueError as exc:
        raise NotFoundException("Invalid feed storage path") from exc
    if not full.is_file():
        raise NotFoundException("Feed media file not found on server")
    return full


def load_feed_media_download(storage_uri: str, file_name: str) -> FeedMediaDownload:
    if object_storage.is_object_uri(storage_uri):
        content = object_storage.get_bytes(storage_uri)
        return FeedMediaDownload(
            filename=file_name,
            media_type=guess_media_type(file_name),
            content=content,
        )
    path = resolve_local_path(storage_uri)
    return FeedMediaDownload(
        filename=file_name,
        media_type=guess_media_type(file_name),
        path=str(path),
    )
