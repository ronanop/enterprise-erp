"""Reject HTML / script injection in plain-text fields (XSS hardening)."""

from __future__ import annotations

import html
import re
from typing import Iterable

# Tags, event handlers, and active URL schemes commonly used in XSS payloads.
_HTML_TAG_RE = re.compile(r"</?[a-zA-Z][^>]*>", re.IGNORECASE)
_EVENT_HANDLER_RE = re.compile(r"\bon[a-z]+\s*=", re.IGNORECASE)
_ACTIVE_SCHEME_RE = re.compile(
    r"(?:^|[\s\"'`(=])(?:javascript|vbscript|data\s*:\s*text/html)\s*:",
    re.IGNORECASE,
)


def contains_unsafe_markup(value: str | None) -> bool:
    """True when value looks like HTML/script rather than plain text."""
    text = (value or "").strip()
    if not text:
        return False
    if _HTML_TAG_RE.search(text):
        return True
    if _EVENT_HANDLER_RE.search(text):
        return True
    if _ACTIVE_SCHEME_RE.search(text):
        return True
    # Angle-bracket iframe/script fragments without a full closing tag.
    lowered = text.lower()
    if "<script" in lowered or "<iframe" in lowered or "<img" in lowered or "<svg" in lowered:
        return True
    return False


def assert_safe_plain_text(value: str, *, field: str = "value") -> str:
    """Strip outer whitespace and reject XSS-style markup."""
    text = (value or "").strip()
    if contains_unsafe_markup(text):
        raise ValueError(f"{field} contains disallowed HTML or script content")
    return text


def sanitize_plain_text_list(
    values: Iterable[str] | None,
    *,
    field: str = "value",
) -> list[str] | None:
    if values is None:
        return None
    out: list[str] = []
    for item in values:
        text = assert_safe_plain_text(str(item), field=field)
        if text:
            out.append(text)
    return out or None


def escape_html_text(value: object | None) -> str:
    """HTML-escape values interpolated into email / HTML templates."""
    if value is None:
        return ""
    return html.escape(str(value), quote=True)
