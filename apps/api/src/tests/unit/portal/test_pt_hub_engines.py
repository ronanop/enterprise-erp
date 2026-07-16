"""Unit tests for Customer Portal engines."""

from types import SimpleNamespace

from modules.portal.service.engines import (
    CustomerProfileEngine,
    DocumentAccessEngine,
    PortalAccountEngine,
    SupportTicketEngine,
)


def test_portal_account_lifecycle():
    row = SimpleNamespace(status="draft")
    eng = PortalAccountEngine()
    eng.submit(row)
    assert row.status == "submitted"
    eng.approve(row)
    assert row.status == "approved"


def test_customer_profile_lifecycle():
    row = SimpleNamespace(status="draft")
    eng = CustomerProfileEngine()
    eng.submit(row)
    eng.approve(row)
    assert row.status == "approved"


def test_document_access_lifecycle():
    row = SimpleNamespace(status="draft")
    eng = DocumentAccessEngine()
    eng.submit(row)
    eng.approve(row)
    assert row.status == "approved"


def test_support_ticket_submit():
    row = SimpleNamespace(status="draft")
    eng = SupportTicketEngine()
    eng.submit(row)
    assert row.status == "submitted"
