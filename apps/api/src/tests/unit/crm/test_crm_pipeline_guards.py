"""CRM sales pipeline gate tests (quote / OVF / blueprint attach)."""

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from core.exceptions import ConflictException
from modules.crm.service.blueprint_service import OpportunityBlueprintService
from modules.crm.service.ovf_service import OvfService
from modules.crm.service.quote_service import QuoteService


def test_ovf_create_requires_accepted_quote() -> None:
    service = OvfService(MagicMock())
    ctx = MagicMock()
    opportunity = SimpleNamespace(
        id=uuid4(),
        company_id=uuid4(),
        branch_id=uuid4(),
        blueprint_state="ovf_ready",
        customer_po_approved=True,
        locked=False,
    )
    quote = SimpleNamespace(
        id=uuid4(),
        opportunity_id=opportunity.id,
        quote_stage="sent_to_customer",
    )
    service._quotes.get = MagicMock(return_value=quote)
    service._opportunities.get = MagicMock(return_value=opportunity)

    with pytest.raises(ConflictException, match="accepted"):
        service.create(ctx, quote_id=quote.id, branch_id=uuid4())


def test_ovf_create_rejects_when_ovf_already_exists() -> None:
    service = OvfService(MagicMock())
    ctx = MagicMock()
    opportunity = SimpleNamespace(
        id=uuid4(),
        company_id=uuid4(),
        branch_id=uuid4(),
        blueprint_state="ovf_ready",
        customer_po_approved=True,
        locked=False,
    )
    quote = SimpleNamespace(
        id=uuid4(),
        opportunity_id=opportunity.id,
        quote_stage="accepted",
    )
    service._quotes.get = MagicMock(return_value=quote)
    service._opportunities.get = MagicMock(return_value=opportunity)
    service._repo.list_ovfs = MagicMock(return_value=[SimpleNamespace(id=uuid4())])

    with pytest.raises(ConflictException, match="already exists"):
        service.create(ctx, quote_id=quote.id, branch_id=uuid4())


def test_quote_approve_internally_blocks_low_margin_without_force() -> None:
    service = QuoteService(MagicMock())
    ctx = MagicMock()
    quote = SimpleNamespace(
        id=uuid4(),
        quote_stage="draft",
        locked=False,
    )
    service.get = MagicMock(return_value=quote)
    service.margin_summary = MagicMock(
        return_value={
            "requires_management_approval": True,
            "avg_margin_pct": 5,
            "required_threshold_pct": 7,
        },
    )

    with pytest.raises(ConflictException, match="Management"):
        service.approve_internally(ctx, quote.id, force=False)


def test_attach_requires_file_content() -> None:
    service = OpportunityBlueprintService(MagicMock())
    ctx = MagicMock()
    opp = SimpleNamespace(
        id=uuid4(),
        company_id=uuid4(),
        branch_id=uuid4(),
        blueprint_state="open",
        locked=False,
        boq_attached=False,
        sow_attached=False,
        opportunity_name="Test Opp",
    )
    service.get = MagicMock(return_value=opp)
    service._require_blueprint = MagicMock(return_value="open")
    service._attachments = MagicMock()

    with pytest.raises(ConflictException, match="Upload file content"):
        service.perform_action(
            ctx,
            opp.id,
            "attach_boq",
            {"file_name": "boq.pdf"},
        )


def test_approve_po_requires_locked_opportunity() -> None:
    service = OpportunityBlueprintService(MagicMock())
    ctx = MagicMock()
    opp = SimpleNamespace(
        id=uuid4(),
        company_id=uuid4(),
        branch_id=uuid4(),
        blueprint_state="po_approval",
        locked=False,
        customer_po_attached=True,
        opportunity_name="Test Opp",
    )
    service.get = MagicMock(return_value=opp)
    service._require_blueprint = MagicMock(return_value="po_approval")

    with pytest.raises(ConflictException, match="My Jobs"):
        service.perform_action(ctx, opp.id, "approve_po", {})
