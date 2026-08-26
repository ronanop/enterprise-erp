"""Unit tests for CRM engines."""

from decimal import Decimal
from types import SimpleNamespace

import pytest

from modules.crm.domain.exceptions import (
    InvalidCampaignState,
    InvalidLeadState,
    InvalidOpportunityState,
    InvalidSatisfactionState,
    InvalidTaskState,
)
from modules.crm.service.engines import (
    CampaignEngine,
    CustomerSatisfactionEngine,
    LeadEngine,
    OpportunityEngine,
    TaskEngine,
    sales_blueprint_engine,
)


def test_lead_convert_requires_mobile_and_contact():
    engine = LeadEngine()
    lead = SimpleNamespace(status="qualified", mobile="", email=None, company_name=None)
    with pytest.raises(InvalidLeadState):
        engine.validate_convertible(lead)


def test_opportunity_win_requires_customer():
    engine = OpportunityEngine()
    opp = SimpleNamespace(
        status="open", customer_id=None, expected_revenue=100, probability_percent=50
    )
    with pytest.raises(InvalidOpportunityState):
        engine.validate_closeable(opp, won=True)


def test_opportunity_forecast():
    engine = OpportunityEngine()
    opp = SimpleNamespace(expected_revenue=Decimal("1000"), probability_percent=Decimal("25"))
    assert engine.compute_forecast(opp) == Decimal("250.0000")


def test_cloud_opportunity_contract_and_discount_approval_states():
    actions = sales_blueprint_engine.allowed_actions("opportunity", "open")
    assert "attach_contract" in actions
    assert "send_cloud_discount_approval" in actions
    assert sales_blueprint_engine.transition("opportunity", "open", "attach_contract") == "cloud_docs"
    assert (
        sales_blueprint_engine.transition("opportunity", "open", "send_cloud_discount_approval")
        == "cloud_discount_approval"
    )
    assert (
        sales_blueprint_engine.transition("opportunity", "cloud_discount_approval", "approve_cloud_discount")
        == "cloud_onboarding"
    )
    assert (
        sales_blueprint_engine.transition("opportunity", "cloud_onboarding", "mark_onboarding_done")
        == "won"
    )


def test_opportunity_document_step_offers_boq_or_sow():
    actions = sales_blueprint_engine.allowed_actions("opportunity", "open")

    assert "attach_boq" in actions
    assert "attach_sow" in actions
    assert sales_blueprint_engine.transition("opportunity", "open", "attach_sow") == "boq_pending"


def test_document_approval_reaches_deal_reg_state():
    assert (
        sales_blueprint_engine.transition("opportunity", "boq_approval", "approve_boq")
        == "deal_reg"
    )
    assert (
        sales_blueprint_engine.transition("opportunity", "sow_approval", "approve_sow")
        == "deal_reg"
    )
    assert (
        sales_blueprint_engine.transition("opportunity", "sow_approval", "reject_sow")
        == "boq_pending"
    )
    assert (
        sales_blueprint_engine.transition("opportunity", "boq_approval", "reject_sow")
        == "boq_pending"
    )
    assert (
        sales_blueprint_engine.transition("opportunity", "boq_approval", "approve_sow")
        == "deal_reg"
    )
    assert (
        sales_blueprint_engine.transition("opportunity", "boq_pending", "send_sow_approval")
        == "sow_approval"
    )
    assert (
        sales_blueprint_engine.transition("opportunity", "boq_pending", "send_boq_approval")
        == "boq_approval"
    )


def test_boq_pending_keeps_deal_reg_transition_for_approved_docs():
    actions = sales_blueprint_engine.allowed_actions("opportunity", "boq_pending")
    assert "deal_reg" in actions
    assert "send_boq_approval" in actions
    assert "send_sow_approval" in actions


def test_campaign_activate_from_draft_only():
    engine = CampaignEngine()
    with pytest.raises(InvalidCampaignState):
        engine.validate_activatable(SimpleNamespace(status="active"))


def test_task_complete_from_pending():
    engine = TaskEngine()
    task = SimpleNamespace(status="pending")
    engine.complete(task)
    assert task.status == "completed"
    with pytest.raises(InvalidTaskState):
        engine.complete(task)


def test_satisfaction_publish():
    engine = CustomerSatisfactionEngine()
    row = SimpleNamespace(status="draft")
    engine.publish(row)
    assert row.status == "published"
    with pytest.raises(InvalidSatisfactionState):
        engine.publish(row)
