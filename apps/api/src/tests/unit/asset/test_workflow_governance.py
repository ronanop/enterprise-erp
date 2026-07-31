"""Unit tests for AssetGovernanceService notification wiring."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

from modules.asset.domain.workflow_codes import ENTITY_AST_ASSET
from modules.asset.service.governance_service import AssetGovernanceService
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_governance_approve_calls_on_approved_only_when_terminal() -> None:
    db = MagicMock()
    gov = AssetGovernanceService(db)
    ctx = _ctx()
    entity_id = uuid4()
    instance_id = uuid4()
    instance = MagicMock()
    instance.status = WorkflowStatus.APPROVED
    called = {"ok": False}

    def on_approved() -> None:
        called["ok"] = True

    with patch.object(gov._workflow, "approve", return_value=instance):
        with patch.object(gov, "_notify"):
            gov.approve(
                ctx,
                instance_id=instance_id,
                entity_name=ENTITY_AST_ASSET,
                entity_id=entity_id,
                on_approved=on_approved,
            )
    assert called["ok"] is True


def test_governance_approve_skips_on_approved_for_intermediate_step() -> None:
    db = MagicMock()
    gov = AssetGovernanceService(db)
    ctx = _ctx()
    instance = MagicMock()
    instance.status = WorkflowStatus.IN_PROGRESS
    called = {"ok": False}

    with patch.object(gov._workflow, "approve", return_value=instance):
        with patch.object(gov, "_notify"):
            gov.approve(
                ctx,
                instance_id=uuid4(),
                entity_name=ENTITY_AST_ASSET,
                entity_id=uuid4(),
                on_approved=lambda: called.update(ok=True),
            )
    assert called["ok"] is False
