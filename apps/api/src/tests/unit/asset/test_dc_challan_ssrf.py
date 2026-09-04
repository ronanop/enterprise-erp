"""SSRF guards for SCM document URL download."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.config import get_settings
from modules.asset.domain.exceptions import DcChallanValidationError
from modules.asset.domain.enums import DcChallanStatus
from modules.asset.storage.http_fetch import (
    SsrfBlockedError,
    download_document_bytes,
    guard_document_url,
    host_allowed,
)
from modules.asset.service.dc_challan_service import DcChallanService

PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"


class _FakeResponse:
    def __init__(self, status_code: int, body: bytes = b"", headers: dict | None = None) -> None:
        self.status_code = status_code
        self.headers = headers or {}
        self._body = body

    def iter_bytes(self, _size: int):
        yield self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class _FakeClient:
    def __init__(self, responses: list[_FakeResponse]) -> None:
        self._responses = list(responses)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def stream(self, _method: str, _url: str):
        return self._responses.pop(0)


def _addr(ip: str):
    return [(0, 0, 0, "", (ip, 0))]


def test_host_allowed_matches_suffix() -> None:
    allowed = ("scm.example.com",)
    assert host_allowed("files.scm.example.com", allowed)
    assert host_allowed("scm.example.com", allowed)
    assert not host_allowed("evil.com", allowed)


def test_blocked_loopback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "environment", "development")
    monkeypatch.setattr(get_settings(), "asset_dc_challan_scm_allowed_hosts", "")
    with pytest.raises(SsrfBlockedError, match="not a public address"):
        guard_document_url("http://127.0.0.1/secret.pdf")


def test_blocked_private_ip(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "environment", "development")
    monkeypatch.setattr(get_settings(), "asset_dc_challan_scm_allowed_hosts", "")
    with patch(
        "modules.asset.storage.http_fetch.socket.getaddrinfo",
        return_value=_addr("10.0.0.8"),
    ):
        with pytest.raises(SsrfBlockedError, match="not a public address"):
            guard_document_url("https://internal.example.com/dc.pdf")


def test_blocked_link_local(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "environment", "development")
    monkeypatch.setattr(get_settings(), "asset_dc_challan_scm_allowed_hosts", "")
    with pytest.raises(SsrfBlockedError, match="not a public address"):
        guard_document_url("http://169.254.169.254/latest/meta-data")


def test_blocked_non_http_scheme() -> None:
    with pytest.raises(SsrfBlockedError, match="http or https"):
        guard_document_url("file:///etc/passwd")


def test_blocked_redirect_to_internal(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "environment", "development")
    monkeypatch.setattr(get_settings(), "asset_dc_challan_scm_allowed_hosts", "")

    def resolve(hostname: str) -> list[str]:
        if hostname == "files.example.com":
            return ["8.8.8.8"]
        return [hostname]

    responses = [
        _FakeResponse(302, headers={"location": "http://169.254.169.254/latest"}),
    ]
    with (
        patch("modules.asset.storage.http_fetch.resolve_host_ips", side_effect=resolve),
        patch("modules.asset.storage.http_fetch.httpx.Client", return_value=_FakeClient(responses)),
    ):
        with pytest.raises(SsrfBlockedError, match="not a public address"):
            download_document_bytes("https://files.example.com/dc.pdf", max_bytes=1024)


def test_allowed_host_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "environment", "development")
    monkeypatch.setattr(
        get_settings(), "asset_dc_challan_scm_allowed_hosts", "files.example.com"
    )
    responses = [_FakeResponse(200, body=PDF)]
    with (
        patch("modules.asset.storage.http_fetch.resolve_host_ips", return_value=["8.8.8.8"]),
        patch("modules.asset.storage.http_fetch.httpx.Client", return_value=_FakeClient(responses)),
    ):
        assert download_document_bytes("https://files.example.com/dc.pdf", max_bytes=1024 * 1024) == PDF


def test_disallowed_public_host_when_allowlist_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "environment", "development")
    monkeypatch.setattr(get_settings(), "asset_dc_challan_scm_allowed_hosts", "scm.example.com")
    with pytest.raises(SsrfBlockedError, match="not in ASSET_DC_CHALLAN_SCM_ALLOWED_HOSTS"):
        guard_document_url("https://evil.example.net/dc.pdf")


def test_production_empty_allowlist_rejects_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "environment", "production")
    monkeypatch.setattr(get_settings(), "asset_dc_challan_scm_allowed_hosts", "")
    with pytest.raises(SsrfBlockedError, match="URL-based SCM document intake is disabled"):
        guard_document_url("https://files.example.com/dc.pdf")


def test_callback_blocked_url_audits_and_does_not_transition() -> None:
    svc = DcChallanService(MagicMock())
    svc._audit.log_entity_change = MagicMock()
    svc._docs = MagicMock()
    svc._docs.get_active.return_value = None
    svc._storage = MagicMock()
    row = MagicMock()
    row.id = uuid4()
    row.status = DcChallanStatus.SENT_TO_SCM.value
    row.tenant_id = uuid4()
    row.company_id = uuid4()
    row.branch_id = uuid4()
    row.created_by = uuid4()
    row.updated_by = uuid4()
    row.scm_document_url = None
    row.scm_reference_number = None
    with (
        patch.object(svc._repo, "get_by_id_unscoped", return_value=row),
        patch.object(svc._repo, "update_row") as update_row,
        patch(
            "modules.asset.service.dc_challan_service.download_document_bytes",
            side_effect=SsrfBlockedError("blocked", blocked_host="127.0.0.1"),
        ),
    ):
        with pytest.raises(DcChallanValidationError):
            svc.apply_scm_callback(row.id, document_url="http://127.0.0.1/x.pdf")
    update_row.assert_not_called()
    assert any(
        call.kwargs.get("operation") == "document_url_blocked"
        for call in svc._audit.log_entity_change.call_args_list
    )


def test_startup_probe_writes_and_deletes(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    from modules.asset.storage.startup import validate_asset_storage_on_startup
    from modules.asset.storage import reset_storage_cache

    monkeypatch.setattr(get_settings(), "asset_storage_backend", "local")
    monkeypatch.setattr(get_settings(), "asset_storage_path", str(tmp_path / "store"))
    reset_storage_cache()
    validate_asset_storage_on_startup()
    root = tmp_path / "store"
    assert root.is_dir()
    assert not list(root.glob(".storage-probe-*"))
