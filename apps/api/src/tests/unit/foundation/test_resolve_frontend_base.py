"""Tests for Microsoft OAuth frontend redirect host resolution."""

from modules.foundation.service.microsoft_oauth_service import resolve_frontend_base


def test_resolve_frontend_base_falls_back_to_settings(monkeypatch):
    from core import config as config_mod

    monkeypatch.setattr(config_mod.settings, "frontend_url", "https://172.16.200.30:8443")
    monkeypatch.setattr(config_mod.settings, "cors_origins", ["http://localhost:3000"])
    monkeypatch.setattr(
        config_mod.settings,
        "cors_origin_regex",
        r"https?://(172\.16\.\d{1,3}\.\d{1,3}|localhost|127\.0\.0\.1)(:\d+)?",
    )

    assert resolve_frontend_base(None) == "https://172.16.200.30:8443"
    assert resolve_frontend_base("not-a-url") == "https://172.16.200.30:8443"
    assert resolve_frontend_base("https://evil.example") == "https://172.16.200.30:8443"


def test_resolve_frontend_base_allows_localhost(monkeypatch):
    from core import config as config_mod

    monkeypatch.setattr(config_mod.settings, "frontend_url", "https://172.16.200.30:8443")
    monkeypatch.setattr(
        config_mod.settings,
        "cors_origins",
        ["http://localhost:3000", "https://172.16.200.30:8443"],
    )
    monkeypatch.setattr(
        config_mod.settings,
        "cors_origin_regex",
        r"https?://(172\.16\.\d{1,3}\.\d{1,3}|localhost|127\.0\.0\.1)(:\d+)?",
    )

    assert resolve_frontend_base("http://localhost:3000") == "http://localhost:3000"
    assert resolve_frontend_base("http://127.0.0.1:3000/") == "http://127.0.0.1:3000"
    assert resolve_frontend_base("https://172.16.200.30:8443") == "https://172.16.200.30:8443"
