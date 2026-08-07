"""Tests for ESS employee document storage helpers."""

import uuid

import pytest

from core.exceptions import AppException, NotFoundException
from modules.ess.employee_document_storage import (
    ESS_DOC_PREFIX,
    save_employee_document_bytes,
    resolve_document_path,
)


def test_save_and_resolve_roundtrip(tmp_path, monkeypatch):
    import modules.ess.employee_document_storage as storage

    monkeypatch.setattr(storage, "UPLOAD_ROOT", tmp_path)
    cid = uuid.uuid4()
    eid = uuid.uuid4()
    uri = save_employee_document_bytes(
        company_id=cid,
        employee_id=eid,
        file_name="passport.pdf",
        raw=b"%PDF-1.4 test",
    )
    assert uri.startswith(ESS_DOC_PREFIX)
    path = resolve_document_path(uri)
    assert path.read_bytes() == b"%PDF-1.4 test"


def test_rejects_oversized_file(tmp_path, monkeypatch):
    import modules.ess.employee_document_storage as storage

    monkeypatch.setattr(storage, "UPLOAD_ROOT", tmp_path)
    monkeypatch.setattr(storage, "MAX_UPLOAD_BYTES", 10)
    with pytest.raises(AppException):
        save_employee_document_bytes(
            company_id=uuid.uuid4(),
            employee_id=uuid.uuid4(),
            file_name="big.pdf",
            raw=b"x" * 20,
        )


def test_resolve_unknown_uri_raises():
    with pytest.raises(NotFoundException):
        resolve_document_path("https://example.com/file.pdf")
