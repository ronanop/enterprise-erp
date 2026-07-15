"""Unit tests for document engines."""

from types import SimpleNamespace

from modules.document.service.engines import (
    ArchiveEngine,
    DocumentApprovalEngine,
    DocumentCheckoutEngine,
    DocumentEngine,
    RetentionPolicyEngine,
)


def test_document_lifecycle():
    engine = DocumentEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    assert row.status == "submitted"
    engine.approve(row)
    assert row.status == "approved"
    engine.publish(row)
    assert row.status == "published"


def test_approval_complete():
    engine = DocumentApprovalEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.complete(row)
    assert row.status == "completed"


def test_checkout_checkin():
    engine = DocumentCheckoutEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.activate(row)
    engine.checkin(row)
    assert row.status == "completed"


def test_retention_approve():
    engine = RetentionPolicyEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    assert row.status == "approved"


def test_archive_approve():
    engine = ArchiveEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    assert row.status == "archived"
