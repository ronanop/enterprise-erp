"""Persist HRMS / ESS employee profile photos to object or local storage."""

from __future__ import annotations

import base64
import binascii
import re
from uuid import UUID

from core.exceptions import AppException
from modules.ess.employee_document_storage import save_employee_document_bytes

_DATA_URL_RE = re.compile(
    r"^data:(image/(?:jpeg|jpg|png|webp));base64,(.+)$",
    re.IGNORECASE | re.DOTALL,
)

_EXT_BY_MIME = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def save_profile_photo_data_url(
    *,
    company_id: UUID,
    employee_id: UUID,
    data_url: str,
) -> str:
    """Decode a browser data-URL photo and store it. Returns storage URI."""
    raw = (data_url or "").strip()
    if not raw:
        raise AppException("Profile photo is empty")
    match = _DATA_URL_RE.match(raw)
    if not match:
        raise AppException("Profile photo must be a JPG or PNG data URL")
    mime = match.group(1).lower()
    try:
        content = base64.b64decode(match.group(2), validate=False)
    except (binascii.Error, ValueError) as exc:
        raise AppException("Invalid profile photo encoding") from exc
    if not content:
        raise AppException("Profile photo is empty")
    # Cap ~1.5 MB so ESS inbox payloads stay reasonable.
    if len(content) > 1_500_000:
        raise AppException("Profile photo is too large (max 1.5 MB)")
    ext = _EXT_BY_MIME.get(mime, ".jpg")
    return save_employee_document_bytes(
        company_id=company_id,
        employee_id=employee_id,
        file_name=f"profile-photo{ext}",
        raw=content,
    )
