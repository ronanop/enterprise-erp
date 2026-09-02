"""DC challan stored-document intake, validation, and serving."""

from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.exceptions import ConflictException, ForbiddenException, NotFoundException
from modules.asset.domain.enums import DcChallanDocKind, DcChallanDocSource, DcChallanStatus
from modules.asset.domain.exceptions import DcChallanValidationError, InvalidDcChallanState
from modules.asset.permissions import ASSET_AUDITOR_PERMISSIONS
from modules.asset.routers.dc_challan import dc_challan_router
from modules.asset.service.dc_challan_file import validate_upload_bytes
from modules.asset.service.dc_challan_service import DcChallanService, to_dc_challan_response
from modules.asset.storage.local import LocalDiskStorage
from modules.foundation.domain.value_objects import TenantContext

PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 32
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
EXE = b"MZ" + b"\x00" * 64


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def _row(**overrides):
    base = dict(
        id=uuid4(),
        dc_number="DC-2026-000001",
        asset_id=uuid4(),
        assignment_id=None,
        employee_id=uuid4(),
        status=DcChallanStatus.PENDING.value,
        company_id=uuid4(),
        branch_id=uuid4(),
        tenant_id=uuid4(),
        created_by=uuid4(),
        updated_by=uuid4(),
        employee_code="E-100",
        employee_name="Ada Lovelace",
        employee_phone="9999999999",
        employee_email="ada@example.com",
        asset_name="Laptop",
        asset_tag="AST-1",
        make="Dell",
        model="XPS",
        serial_number="SN-1",
        purchase_cost=None,
        scm_document_url=None,
        scm_reference_number=None,
        remarks=None,
        sent_to_scm_at=None,
        version=1,
        signed_document_url=None,
        scm_document_uploaded_at=None,
        signed_document_uploaded_at=None,
        signed_at=None,
        received_at=None,
        created_at=None,
        updated_at=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _svc() -> DcChallanService:
    svc = DcChallanService(MagicMock())
    svc._audit.log_entity_change = MagicMock()
    svc._scm.send_dc_request = MagicMock()
    svc._scm.push_status_update = MagicMock()
    svc._docs = MagicMock()
    svc._docs.list_active.return_value = []
    svc._docs.get_active.return_value = None
    svc._docs.map_active.return_value = {}
    svc._storage = MagicMock()
    return svc


def test_sniff_accepts_pdf_jpeg_png() -> None:
    assert validate_upload_bytes(PDF, original_filename="a.pdf")[0] == "application/pdf"
    assert validate_upload_bytes(JPEG, original_filename="a.jpg")[0] == "image/jpeg"
    assert validate_upload_bytes(PNG, original_filename="a.png")[0] == "image/png"


def test_sniff_rejects_oversized(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "modules.asset.service.dc_challan_file.max_upload_bytes", lambda: 100
    )
    with pytest.raises(DcChallanValidationError, match="larger than"):
        validate_upload_bytes(PDF * 20, declared_content_type="application/pdf")


def test_sniff_rejects_magic_mismatch() -> None:
    with pytest.raises(DcChallanValidationError, match="do not match"):
        validate_upload_bytes(
            JPEG, declared_content_type="application/pdf", original_filename="a.pdf"
        )


def test_sniff_rejects_exe_renamed_pdf() -> None:
    with pytest.raises(DcChallanValidationError, match="not a PDF"):
        validate_upload_bytes(
            EXE, declared_content_type="application/pdf", original_filename="payload.pdf"
        )


def test_local_storage_roundtrip(tmp_path) -> None:
    store = LocalDiskStorage(tmp_path)
    key = "dc-challan/abc/scm-issued/file.pdf"
    store.save(BytesIO(PDF), key)
    assert store.exists(key)
    with store.open(key) as handle:
        assert handle.read() == PDF
    with pytest.raises(ValueError):
        store.save(BytesIO(PDF), "../escape.pdf")


def test_upload_scm_issued_transitions(tmp_path) -> None:
    svc = _svc()
    ctx = _ctx()
    row = _row(status=DcChallanStatus.SENT_TO_SCM.value)
    updated = _row(status=DcChallanStatus.DOCUMENT_RECEIVED.value)
    svc._storage = LocalDiskStorage(tmp_path)
    with (
        patch.object(svc, "get", return_value=row),
        patch.object(svc._repo, "update_row", return_value=updated) as update_row,
    ):
        result = svc.upload_scm_issued_document(
            ctx,
            row.id,
            file_bytes=PDF,
            original_filename="challan.pdf",
            declared_content_type="application/pdf",
        )
    assert result.status == DcChallanStatus.DOCUMENT_RECEIVED.value
    assert update_row.call_args.kwargs["status"] == DcChallanStatus.DOCUMENT_RECEIVED.value
    svc._docs.create.assert_called_once()
    created = svc._docs.create.call_args.kwargs
    assert created["doc_kind"] == DcChallanDocKind.SCM_ISSUED.value
    assert created["source"] == DcChallanDocSource.MANUAL_UPLOAD.value
    assert created["checksum_sha256"]


def test_upload_signed_transitions() -> None:
    svc = _svc()
    ctx = _ctx()
    row = _row(status=DcChallanStatus.DOCUMENT_RECEIVED.value)
    signed_row = _row(status=DcChallanStatus.SIGNED.value)

    svc._docs.get_active.side_effect = [
        None,
        SimpleNamespace(
            id=uuid4(),
            original_filename="s.pdf",
            checksum_sha256="abc",
            content_type="application/pdf",
            file_size_bytes=32,
        ),
        SimpleNamespace(
            id=uuid4(),
            original_filename="s.pdf",
            checksum_sha256="abc",
            content_type="application/pdf",
            file_size_bytes=32,
        ),
    ]
    with (
        patch.object(svc, "get", return_value=row),
        patch.object(svc._repo, "update", return_value=signed_row),
        patch.object(svc._repo, "update_row", return_value=row),
    ):
        result = svc.upload_signed_document(
            ctx,
            row.id,
            file_bytes=PDF,
            original_filename="signed.pdf",
            declared_content_type="application/pdf",
        )
    assert result.status == DcChallanStatus.SIGNED.value
    svc._scm.push_status_update.assert_called()


def test_callback_multipart_from_sent_transitions() -> None:
    svc = _svc()
    row = _row(status=DcChallanStatus.SENT_TO_SCM.value, tenant_id=uuid4())
    updated = _row(status=DcChallanStatus.DOCUMENT_RECEIVED.value)
    with (
        patch.object(svc._repo, "get_by_id_unscoped", return_value=row),
        patch.object(svc._repo, "update_row", return_value=updated) as update_row,
    ):
        result = svc.apply_scm_callback(
            row.id, file_bytes=PDF, original_filename="issued.pdf"
        )
    assert result.status == DcChallanStatus.DOCUMENT_RECEIVED.value
    assert update_row.call_args.kwargs["status"] == DcChallanStatus.DOCUMENT_RECEIVED.value
    created = svc._docs.create.call_args.kwargs
    assert created["source"] == DcChallanDocSource.SCM_CALLBACK.value
    assert created["doc_kind"] == DcChallanDocKind.SCM_ISSUED.value


def test_callback_multipart_idempotent_same_checksum() -> None:
    svc = _svc()
    row = _row(status=DcChallanStatus.DOCUMENT_RECEIVED.value, tenant_id=uuid4())
    checksum = __import__("hashlib").sha256(PDF).hexdigest()
    svc._docs.get_active.return_value = SimpleNamespace(
        checksum_sha256=checksum, external_url=None
    )
    with patch.object(svc._repo, "get_by_id_unscoped", return_value=row):
        result = svc.apply_scm_callback(row.id, file_bytes=PDF, original_filename="a.pdf")
    assert result is row
    svc._docs.create.assert_not_called()


def test_callback_conflict_different_checksum() -> None:
    svc = _svc()
    row = _row(status=DcChallanStatus.DOCUMENT_RECEIVED.value, tenant_id=uuid4())
    svc._docs.get_active.return_value = SimpleNamespace(
        checksum_sha256="deadbeef", external_url=None
    )
    with patch.object(svc._repo, "get_by_id_unscoped", return_value=row):
        with pytest.raises(ConflictException, match="different SCM document"):
            svc.apply_scm_callback(row.id, file_bytes=PDF, original_filename="a.pdf")


def test_callback_url_download_failure_leaves_status() -> None:
    svc = _svc()
    row = _row(status=DcChallanStatus.SENT_TO_SCM.value, tenant_id=uuid4())
    with (
        patch.object(svc._repo, "get_by_id_unscoped", return_value=row),
        patch(
            "modules.asset.service.dc_challan_service.download_document_bytes",
            side_effect=DcChallanValidationError(
                "Could not download SCM document: the URL returned 404"
            ),
        ),
        patch.object(svc._repo, "update_row") as update_row,
    ):
        with pytest.raises(DcChallanValidationError, match="404"):
            svc.apply_scm_callback(
                row.id, document_url="https://files.example.com/missing.pdf"
            )
    update_row.assert_not_called()
    assert row.status == DcChallanStatus.SENT_TO_SCM.value


def test_manual_reupload_soft_deletes_previous() -> None:
    svc = _svc()
    ctx = _ctx()
    row = _row(status=DcChallanStatus.DOCUMENT_RECEIVED.value)
    previous = SimpleNamespace(id=uuid4(), checksum_sha256="old", storage_key="old-key")
    svc._docs.get_active.return_value = previous
    with (
        patch.object(svc, "get", return_value=row),
        patch.object(svc._repo, "update_row", return_value=row),
    ):
        svc.upload_scm_issued_document(
            ctx,
            row.id,
            file_bytes=PDF,
            original_filename="new.pdf",
            declared_content_type="application/pdf",
        )
    svc._docs.soft_delete.assert_called_once()
    svc._docs.create.assert_called_once()


def test_legacy_url_serialises_without_child_row() -> None:
    row = _row(
        scm_document_url="https://files.example.com/dc.pdf",
        scm_document_uploaded_at=None,
        signed_document_url=None,
    )
    payload = to_dc_challan_response(row, [])
    assert payload.scm_issued_document is not None
    assert payload.scm_issued_document.is_legacy is True
    assert payload.scm_issued_document.external_url == "https://files.example.com/dc.pdf"
    assert payload.signed_document is None


def test_content_out_of_branch_is_forbidden() -> None:
    svc = _svc()
    ctx = _ctx()
    other = _row()
    with (
        patch.object(svc._repo, "get", return_value=None),
        patch.object(svc._repo, "get_by_id_unscoped", return_value=other),
    ):
        with pytest.raises(ForbiddenException, match="Document not found"):
            svc.document_content(ctx, other.id, "scm-issued")


def test_content_missing_is_not_found() -> None:
    svc = _svc()
    ctx = _ctx()
    with (
        patch.object(svc._repo, "get", return_value=None),
        patch.object(svc._repo, "get_by_id_unscoped", return_value=None),
    ):
        with pytest.raises(NotFoundException, match="Document not found"):
            svc.document_content(ctx, uuid4(), "scm-issued")


def test_auditor_has_read_not_receive() -> None:
    assert "asset.dc_challan:read" in ASSET_AUDITOR_PERMISSIONS
    assert "asset.dc_challan:receive" not in ASSET_AUDITOR_PERMISSIONS


def test_content_route_uses_read_upload_uses_receive() -> None:
    import inspect

    content = next(
        route
        for route in dc_challan_router.routes
        if getattr(route, "path", "").endswith("/content")
    )
    upload = next(
        route
        for route in dc_challan_router.routes
        if getattr(route, "path", "").endswith("/documents/signed")
    )
    assert "asset.dc_challan:read" in inspect.getsource(content.endpoint)
    assert "asset.dc_challan:receive" in inspect.getsource(upload.endpoint)
    mark_signed = next(
        route
        for route in dc_challan_router.routes
        if getattr(route, "path", "").endswith("/mark-signed")
    )
    assert "asset.dc_challan:receive" in inspect.getsource(mark_signed.endpoint)
    assert mark_signed.deprecated is True


def test_replace_scm_issued_soft_deletes_previous() -> None:
    svc = _svc()
    ctx = _ctx()
    row = _row(status=DcChallanStatus.DOCUMENT_RECEIVED.value)
    previous = SimpleNamespace(id=uuid4(), checksum_sha256="old", storage_key="old-key")
    svc._docs.get_active.return_value = previous
    with (
        patch.object(svc, "get", return_value=row),
        patch.object(svc._repo, "update_row", return_value=row) as update_row,
    ):
        result = svc.upload_scm_issued_document(
            ctx,
            row.id,
            file_bytes=PDF,
            original_filename="new.pdf",
            declared_content_type="application/pdf",
        )
    assert result.status == DcChallanStatus.DOCUMENT_RECEIVED.value
    assert "status" not in (update_row.call_args.kwargs or {})
    svc._docs.soft_delete.assert_called_once()
    ops = [call.kwargs.get("operation") for call in svc._audit.log_entity_change.call_args_list]
    assert "document_replaced" in ops
    replaced = next(
        call.kwargs["new_value"]
        for call in svc._audit.log_entity_change.call_args_list
        if call.kwargs.get("operation") == "document_replaced"
        and "previous_checksum" in (call.kwargs.get("new_value") or {})
    )
    assert replaced["previous_checksum"] == "old"


def test_replace_signed_keeps_status_and_skips_scm_push() -> None:
    svc = _svc()
    ctx = _ctx()
    row = _row(status=DcChallanStatus.SIGNED.value)
    previous = SimpleNamespace(id=uuid4(), checksum_sha256="old-signed", storage_key="old-signed")
    svc._docs.get_active.return_value = previous
    with (
        patch.object(svc, "get", return_value=row),
        patch.object(svc._repo, "update_row", return_value=row),
        patch.object(svc._repo, "update") as update,
    ):
        result = svc.upload_signed_document(
            ctx,
            row.id,
            file_bytes=JPEG,
            original_filename="signed.jpg",
            declared_content_type="image/jpeg",
        )
    assert result.status == DcChallanStatus.SIGNED.value
    svc._docs.soft_delete.assert_called_once()
    svc._scm.push_status_update.assert_not_called()
    update.assert_not_called()


def test_replace_blocked_on_cancelled() -> None:
    svc = _svc()
    ctx = _ctx()
    row = _row(status=DcChallanStatus.CANCELLED.value)
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(InvalidDcChallanState, match="cancelled"):
            svc.upload_signed_document(
                ctx,
                row.id,
                file_bytes=PDF,
                original_filename="signed.pdf",
                declared_content_type="application/pdf",
            )
        with pytest.raises(InvalidDcChallanState, match="cancelled"):
            svc.upload_scm_issued_document(
                ctx,
                row.id,
                file_bytes=PDF,
                original_filename="issued.pdf",
                declared_content_type="application/pdf",
            )


def test_mark_received_pushes_status_once() -> None:
    svc = _svc()
    ctx = _ctx()
    row = _row(status=DcChallanStatus.SIGNED.value)
    received = _row(status=DcChallanStatus.RECEIVED.value, dc_number=row.dc_number, id=row.id)
    svc._docs.get_active.return_value = SimpleNamespace(
        original_filename="s.pdf",
        checksum_sha256="abc",
        file_size_bytes=12,
        content_type="application/pdf",
    )
    with (
        patch.object(svc, "get", return_value=row),
        patch.object(svc._repo, "update", return_value=received),
    ):
        svc.mark_received(ctx, row.id)
    svc._scm.push_status_update.assert_called_once()
    kwargs = svc._scm.push_status_update.call_args.kwargs
    assert kwargs["status"] == DcChallanStatus.RECEIVED.value
    assert kwargs["signed_document"]["original_filename"] == "s.pdf"
    assert kwargs["signed_document"]["file_size_bytes"] == 12
    assert kwargs["signed_document"]["checksum_sha256"] == "abc"
