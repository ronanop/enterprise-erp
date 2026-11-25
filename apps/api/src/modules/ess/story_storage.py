"""ESS Stories media storage — isolated from feed and other ERP objects.

Keys: ``hr/ess/stories/...`` (MinIO) or ``var/ess-stories/`` (local).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

from core import object_storage
from core.exceptions import AppException, NotFoundException
from shared.upload_safety import UnsafeUploadError, sanitize_filename, validate_upload

STORY_LOCAL_PREFIX = "ess-stories:"
MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_VIDEO_BYTES = 40 * 1024 * 1024
# Instagram Stories classic clip length.
MAX_VIDEO_SECONDS = 15

IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp"})
VIDEO_EXTENSIONS = frozenset({".mp4", ".mov", ".m4v", ".webm"})

UPLOAD_ROOT = Path(__file__).resolve().parents[3] / "var" / "ess-stories"


@dataclass(frozen=True)
class StoryMediaDownload:
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


def save_story_media_bytes(
    *,
    company_id: uuid.UUID,
    employee_id: uuid.UUID,
    file_name: str,
    raw: bytes,
    media_kind: str,
) -> tuple[str, str, int]:
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
    rel = f"{company_id}/{employee_id}/{stored_name}"
    content_type = media_type or guess_media_type(file_name)

    if object_storage.is_enabled():
        key = object_storage.module_key("hr", "ess", "stories", rel)
        uri = object_storage.put_bytes(key, raw, content_type)
        return uri, content_type, len(raw)

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    dest_dir = UPLOAD_ROOT / str(company_id) / str(employee_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / stored_name
    dest.write_bytes(raw)
    return f"{STORY_LOCAL_PREFIX}{rel}", content_type, len(raw)


def resolve_local_path(storage_uri: str) -> Path:
    if not storage_uri.startswith(STORY_LOCAL_PREFIX):
        raise NotFoundException("Story media is not available for download")
    rel = storage_uri[len(STORY_LOCAL_PREFIX) :]
    if ".." in rel.replace("\\", "/"):
        raise NotFoundException("Invalid story storage path")
    full = (UPLOAD_ROOT / rel).resolve()
    root = UPLOAD_ROOT.resolve()
    try:
        full.relative_to(root)
    except ValueError as exc:
        raise NotFoundException("Invalid story storage path") from exc
    if not full.is_file():
        raise NotFoundException("Story media file not found on server")
    return full


def load_story_media_download(storage_uri: str, file_name: str) -> StoryMediaDownload:
    if object_storage.is_object_uri(storage_uri):
        content = object_storage.get_bytes(storage_uri)
        return StoryMediaDownload(
            filename=file_name,
            media_type=guess_media_type(file_name),
            content=content,
        )
    path = resolve_local_path(storage_uri)
    return StoryMediaDownload(
        filename=file_name,
        media_type=guess_media_type(file_name),
        path=str(path),
    )
