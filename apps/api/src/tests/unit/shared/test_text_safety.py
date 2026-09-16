"""Unit tests for XSS plain-text safety helpers."""

import pytest

from shared.text_safety import (
    assert_safe_plain_text,
    contains_unsafe_markup,
    escape_html_text,
    sanitize_plain_text_list,
)


def test_rejects_iframe_javascript_payload():
    payload = "25KVIVPDUOJL1Z — <iframe src=\"javascript:alert('XSS')\"></iframe>"
    assert contains_unsafe_markup(payload)
    with pytest.raises(ValueError, match="disallowed HTML"):
        assert_safe_plain_text(payload, field="serial_number")


def test_allows_plain_serial():
    assert assert_safe_plain_text("25KVIVPDUOJL1Z", field="serial_number") == "25KVIVPDUOJL1Z"


def test_sanitize_list_rejects_bad_item():
    with pytest.raises(ValueError):
        sanitize_plain_text_list(["OK", "<script>alert(1)</script>"])


def test_escape_html_text():
    assert escape_html_text("<b>x</b>") == "&lt;b&gt;x&lt;/b&gt;"
    assert escape_html_text(None) == ""
