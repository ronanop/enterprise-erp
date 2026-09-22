"""Unit tests for permission-safe notification hrefs."""

from modules.foundation.service.notification_href import sanitize_inbox_href


def test_relative_app_path_allowed() -> None:
    assert sanitize_inbox_href("/hr/ess-inbox") == "/hr/ess-inbox"
    assert sanitize_inbox_href("/hr/recruitment") == "/hr/recruitment"


def test_rejects_open_redirects() -> None:
    assert sanitize_inbox_href("//evil.example/phish") is None
    assert sanitize_inbox_href("https://evil.example/phish") is None
    assert sanitize_inbox_href("http://evil.example") is None
    assert sanitize_inbox_href("/\\evil") is None
    assert sanitize_inbox_href("javascript:alert(1)") is None


def test_kind_fallback_when_href_missing() -> None:
    assert sanitize_inbox_href(None, kind="leave") == "/hr/ess-inbox"
    assert sanitize_inbox_href("", kind="birthday") == "/hr"
    assert sanitize_inbox_href("//evil", kind="interview") == "/hr/recruitment"


def test_strips_whitespace() -> None:
    assert sanitize_inbox_href("  /hr  ") == "/hr"
