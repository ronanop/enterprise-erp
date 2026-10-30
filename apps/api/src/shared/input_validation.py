"""Platform input validation for data entries and upload file names (VAPT)."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any
from urllib.parse import unquote

from shared.text_safety import contains_unsafe_markup
from shared.upload_safety import BLOCKED_EXTENSIONS, sanitize_filename

# Keys that may legitimately hold markup / binary / secrets — skip XSS checks.
_EXEMPT_MARKUP_KEYS = frozenset(
    {
        "content_base64",
        "file_content_base64",
        "filedataurl",  # camelCase fileDataUrl (onboarding portal uploads)
        "signaturedataurl",
        "dataurl",
        "password",
        "new_password",
        "current_password",
        "token",
        "access_token",
        "refresh_token",
        "secret",
        "client_secret",
        "api_key",
        "html_body",
        "body_html",
        "email_html",
        "template_html",
        "rich_text",
        "content_html",
        "signature_html",
        "markdown",
        "raw_xml",
        "payload_json",
    }
)


def _is_large_binary_field(key_lower: str) -> bool:
    """True for base64 / data-URL payload fields that exceed normal text limits."""
    if key_lower in _EXEMPT_MARKUP_KEYS:
        return True
    if key_lower.endswith("_base64") or key_lower.endswith("base64"):
        return True
    if key_lower.endswith("dataurl") or key_lower.endswith("_data_url"):
        return True
    return False

_FILENAME_KEYS = frozenset(
    {
        "file_name",
        "filename",
        "original_filename",
        "original_file_name",
        "upload_file_name",
        "document_file_name",
        "attachment_file_name",
        "last_file_name",
    }
)

_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_MULTIPART_FILENAME_RE = re.compile(
    rb'filename\*\s*=\s*UTF-8\'\'([^;\r\n]+)|filename\s*=\s*"([^"]*)"|filename\s*=\s*([^;\r\n\s]+)',
    re.IGNORECASE,
)


class UnsafeInputError(ValueError):
    """Raised when a data-entry field or upload name fails validation."""


def assert_safe_filename(
    file_name: str | None,
    *,
    required: bool = True,
    require_extension: bool = True,
) -> str:
    """Validate and sanitize an uploaded file name (path traversal / XSS / blocked types).

    Does not enforce the business allow-list (PDF/Office/etc.) — callers that store
    bytes should also call ``validate_upload``. This rejects path tricks and active
    content extensions across every module.
    """
    raw = (file_name or "").strip()
    if not raw:
        if required:
            raise UnsafeInputError("File name is required")
        return ""
    if "\x00" in raw:
        raise UnsafeInputError("File name contains invalid characters")
    if len(raw) > 255:
        raise UnsafeInputError("File name is too long (max 255 characters)")

    normalized = raw.replace("\\", "/")
    if "/" in normalized or "\\" in raw or ".." in raw:
        raise UnsafeInputError("File name must not include path segments")
    if len(normalized) >= 2 and normalized[1] == ":" and normalized[0].isalpha():
        raise UnsafeInputError("File name must not include drive prefixes")

    safe = sanitize_filename(raw)
    if not safe or safe in {".", ".."}:
        raise UnsafeInputError("File name is invalid after sanitization")

    ext = Path(safe).suffix.lower()
    if require_extension and not ext:
        raise UnsafeInputError("Uploaded file must include a valid extension")
    if ext in BLOCKED_EXTENSIONS:
        raise UnsafeInputError(
            f"File type '{ext}' is not allowed. Upload documents or images only."
        )
    return safe


def assert_safe_entry_text(
    value: str,
    *,
    field: str = "value",
    max_length: int = 20_000,
    allow_markup: bool = False,
) -> str:
    """Validate a plain data-entry string (null bytes, control chars, XSS, length)."""
    if "\x00" in value:
        raise UnsafeInputError(f"{field} contains invalid null characters")
    if _CONTROL_CHAR_RE.search(value):
        raise UnsafeInputError(f"{field} contains invalid control characters")
    if len(value) > max_length:
        raise UnsafeInputError(f"{field} exceeds maximum length of {max_length} characters")
    if not allow_markup and contains_unsafe_markup(value):
        raise UnsafeInputError(f"{field} contains disallowed HTML or script content")
    return value


def validate_json_entries(
    payload: Any,
    *,
    max_string_length: int = 20_000,
    path: str = "",
) -> None:
    """Recursively validate JSON data-entry strings and file-name fields."""
    if isinstance(payload, dict):
        for key, value in payload.items():
            key_str = str(key)
            child = f"{path}.{key_str}" if path else key_str
            key_lower = key_str.lower()
            if isinstance(value, str):
                if key_lower in _FILENAME_KEYS or key_lower.endswith("_file_name"):
                    if value.strip():
                        assert_safe_filename(value, required=True)
                    continue
                # data:… base64 payloads (portal docs / signatures) — size-capped, no XSS scan
                if _is_large_binary_field(key_lower) or value.startswith("data:"):
                    limit = max(max_string_length * 4, 60 * 1024 * 1024)
                    if len(value) > limit:
                        raise UnsafeInputError(f"{child} exceeds maximum allowed size")
                    if "\x00" in value:
                        raise UnsafeInputError(f"{child} contains invalid null characters")
                    continue
                assert_safe_entry_text(
                    value,
                    field=child,
                    max_length=max_string_length,
                    allow_markup=False,
                )
            else:
                validate_json_entries(
                    value, max_string_length=max_string_length, path=child
                )
        return
    if isinstance(payload, list):
        for idx, item in enumerate(payload):
            validate_json_entries(
                item,
                max_string_length=max_string_length,
                path=f"{path}[{idx}]" if path else f"[{idx}]",
            )


def extract_multipart_filenames(body: bytes, *, head_limit: int = 256_000) -> list[str]:
    """Best-effort filename extraction from a multipart body prefix."""
    names: list[str] = []
    for match in _MULTIPART_FILENAME_RE.finditer(body[:head_limit]):
        raw = match.group(1) or match.group(2) or match.group(3) or b""
        try:
            text = unquote(raw.decode("utf-8", errors="replace")).strip().strip('"')
        except Exception:  # noqa: BLE001
            continue
        if text:
            names.append(text)
    return names
