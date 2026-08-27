"""Magic-byte sniffing and filename sanitisation for DC challan uploads."""

from __future__ import annotations

import re
from pathlib import Path

from core.config import get_settings
from modules.asset.domain.exceptions import DcChallanValidationError

ALLOWED_CONTENT_TYPES: frozenset[str] = frozenset(
    {"application/pdf", "image/jpeg", "image/png"}
)
_PDF_MAGIC = b"%PDF"
_JPEG_MAGIC = b"\xff\xd8\xff"
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_EXE_MAGIC = b"MZ"

_EXT_BY_TYPE = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
}

_UNSAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def max_upload_bytes() -> int:
    mb = int(get_settings().asset_dc_challan_max_upload_mb or 10)
    return max(mb, 1) * 1024 * 1024


def upload_limits_payload() -> dict:
    mb = max(int(get_settings().asset_dc_challan_max_upload_mb or 10), 1)
    return {
        "max_upload_mb": mb,
        "allowed_content_types": sorted(ALLOWED_CONTENT_TYPES),
    }


def allowed_types_message() -> str:
    mb = max(int(get_settings().asset_dc_challan_max_upload_mb or 10), 1)
    return (
        f"Only PDF, JPEG, and PNG files are allowed, up to {mb} MB. "
        "The file contents must match the declared type."
    )


def sanitise_original_filename(name: str | None) -> str:
    raw = Path(str(name or "").replace("\\", "/")).name.strip()
    if not raw or raw in {".", ".."}:
        return "document"
    cleaned = _UNSAFE_NAME.sub("_", raw)
    cleaned = cleaned.strip("._") or "document"
    return cleaned[:255]


def sniff_content_type(data: bytes) -> str:
    if data.startswith(_EXE_MAGIC):
        raise DcChallanValidationError(
            "File is not a PDF, JPEG, or PNG (executable content detected). "
            + allowed_types_message()
        )
    if data.startswith(_PDF_MAGIC):
        return "application/pdf"
    if data.startswith(_JPEG_MAGIC):
        return "image/jpeg"
    if data.startswith(_PNG_MAGIC):
        return "image/png"
    raise DcChallanValidationError(
        "File is not a recognised PDF, JPEG, or PNG. " + allowed_types_message()
    )


def extension_for_content_type(content_type: str) -> str:
    return _EXT_BY_TYPE.get(content_type, "")


def validate_upload_bytes(
    data: bytes,
    *,
    declared_content_type: str | None = None,
    original_filename: str | None = None,
) -> tuple[str, str, int]:
    """Return (sniffed_content_type, sanitised_filename, size_bytes)."""
    limit = max_upload_bytes()
    size = len(data)
    if size == 0:
        raise DcChallanValidationError("Uploaded file is empty. " + allowed_types_message())
    if size > limit:
        mb = limit // (1024 * 1024)
        raise DcChallanValidationError(
            f"File is larger than the {mb} MB upload limit. " + allowed_types_message()
        )

    sniffed = sniff_content_type(data)
    declared = (declared_content_type or "").split(";")[0].strip().lower()
    if declared in {"image/jpg", "image/pjpeg"}:
        declared = "image/jpeg"
    if declared and declared not in {"application/octet-stream", "binary/octet-stream"}:
        if declared not in ALLOWED_CONTENT_TYPES:
            raise DcChallanValidationError(
                f"Content type {declared!r} is not allowed. " + allowed_types_message()
            )
        if declared != sniffed:
            raise DcChallanValidationError(
                "File contents do not match the declared content type. "
                + allowed_types_message()
            )

    filename = sanitise_original_filename(original_filename)
    expected_ext = extension_for_content_type(sniffed)
    if "." not in filename:
        filename = f"{filename}{expected_ext}"
    return sniffed, filename, size
