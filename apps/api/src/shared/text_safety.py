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
_ANGLE_RE = re.compile(r"[<>]")
_WS_RE = re.compile(r"\s+")
_JS_NOISE_RE = re.compile(
    r"\b(?:alert|prompt|confirm)\s*\(|String\.fromCharCode|document\.cookie|<\s*/?\s*script",
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
    if _JS_NOISE_RE.search(text):
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


def scrub_unsafe_markup(value: str | None, *, fallback: str = "[invalid]") -> str:
    """Best-effort cleanup for legacy rows that already stored XSS payloads."""
    text = (value or "").strip()
    if not text:
        return ""
    if not contains_unsafe_markup(text):
        return text
    cleaned = _HTML_TAG_RE.sub(" ", text)
    cleaned = _EVENT_HANDLER_RE.sub(" ", cleaned)
    cleaned = _ACTIVE_SCHEME_RE.sub(" ", cleaned)
    cleaned = _ANGLE_RE.sub("", cleaned)
    cleaned = html.unescape(cleaned)
    cleaned = _WS_RE.sub(" ", cleaned).strip(" \t\r\n\"'`\\")
    # Tag stripping often leaves executable-looking leftovers (alert(...)).
    if not cleaned or contains_unsafe_markup(cleaned) or _JS_NOISE_RE.search(cleaned):
        return fallback
    return cleaned


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
