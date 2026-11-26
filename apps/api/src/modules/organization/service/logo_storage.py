"""Persist company logo data-URLs into MinIO (or local var)."""

from __future__ import annotations

import base64
from uuid import UUID

from core.blob_store import store_bytes
from core.exceptions import ValidationException


def persist_logo_if_data_url(*, company_id: UUID | None, logo_url: str | None) -> str | None:
    """If ``logo_url`` is a data URL, upload bytes and return ``s3://`` / ``file:`` URI."""
    value = (logo_url or "").strip()
    if not value:
        return None
    if not value.startswith("data:"):
        return value
    comma = value.find(",")
    if comma < 0:
        raise ValidationException("Invalid logo data URL")
    header = value[:comma]
    payload = value[comma + 1 :]
    try:
        raw = base64.b64decode(payload, validate=False)
    except Exception as exc:  # noqa: BLE001
        raise ValidationException("Could not decode logo") from exc
    if not raw:
        raise ValidationException("Empty logo")
    if len(raw) > 2 * 1024 * 1024:
        raise ValidationException("Logo must be 2 MB or smaller")
    mime = "image/png"
    if "image/jpeg" in header or "image/jpg" in header:
        mime = "image/jpeg"
    elif "image/webp" in header:
        mime = "image/webp"
    ext = ".png" if "png" in mime else ".jpg" if "jpeg" in mime or "jpg" in mime else ".bin"
    owner = str(company_id) if company_id else "pending"
    return store_bytes(
        module="organization",
        category="logos",
        owner_id=owner,
        file_name=f"logo{ext}",
        data=raw,
        content_type=mime,
        stable_name=True,
    )
