"""Unit tests for helpdesk engines."""

from types import SimpleNamespace

from modules.helpdesk.service.engines import (
    KnowledgeArticleEngine,
    ResolutionEngine,
    TicketAssignmentEngine,
    TicketEngine,
    TicketEscalationEngine,
)


def test_ticket_lifecycle():
    engine = TicketEngine()
    row = SimpleNamespace(status="draft", customer_id="c1", requester_employee_id=None)
    engine.submit(row)
    assert row.status == "submitted"
    engine.approve(row)
    assert row.status == "approved"


def test_assignment_complete():
    engine = TicketAssignmentEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    engine.activate(row)
    engine.complete(row)
    assert row.status == "completed"


def test_escalation():
    engine = TicketEscalationEngine()
    row = SimpleNamespace(status="open", escalation_level=1)
    engine.escalate(row)
    assert row.escalation_level == 2
    engine.acknowledge(row)
    assert row.status == "acknowledged"


def test_resolution_complete():
    engine = ResolutionEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.complete(row)
    assert row.status == "completed"


def test_knowledge_publish():
    engine = KnowledgeArticleEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    engine.publish(row)
    assert row.status == "published"
