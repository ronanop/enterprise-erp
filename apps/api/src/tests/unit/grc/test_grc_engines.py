"""Unit tests for GRC engines."""

from types import SimpleNamespace

from modules.grc.service.engines import (
    AuditEngine,
    CorrectiveActionEngine,
    ExceptionEngine,
    IncidentEngine,
    PolicyEngine,
    RiskRegisterEngine,
)


def test_policy_lifecycle():
    engine = PolicyEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    assert row.status == "submitted"
    engine.approve(row)
    assert row.status == "approved"
    engine.publish(row)
    assert row.status == "published"


def test_risk_register_lifecycle():
    engine = RiskRegisterEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    assert row.status == "approved"


def test_audit_lifecycle():
    engine = AuditEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    assert row.status == "approved"


def test_corrective_action_complete():
    engine = CorrectiveActionEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    engine.complete(row)
    assert row.status == "completed"


def test_exception_approve():
    engine = ExceptionEngine()
    row = SimpleNamespace(status="draft")
    engine.approve(row)
    assert row.status == "approved"


def test_incident_review_close():
    engine = IncidentEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.review(row)
    engine.close(row)
    assert row.status == "closed"
