"""Unit tests for AssetNotificationService (FP-ASSET-017)."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.exceptions import ConflictException
from modules.asset.service.notification_service import AssetNotificationService
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_service_wires_validator_and_engine() -> None:
    svc = AssetNotificationService(MagicMock())
    assert svc._validator is not None
    assert svc._engine is not None


def test_create_forces_pending_active() -> None:
    svc = AssetNotificationService(MagicMock())
    ctx = _ctx()
    created = MagicMock(
        status="active",
        delivery_status="pending",
        asset_id=uuid4(),
        notification_type="maintenance_due",
        id=uuid4(),
    )
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._validator, "validate_create_fields", return_value=None),
        patch.object(svc._repo, "create", return_value=created) as create,
        patch.object(svc._audit, "log_entity_change", return_value=None),
    ):
        svc.create(
            ctx,
            asset_id=uuid4(),
            notification_type="maintenance_due",
            recipient_user_id=uuid4(),
            delivery_status="sent",
            status="archived",
        )
        assert create.call_args.kwargs["status"] == "active"
        assert create.call_args.kwargs["delivery_status"] == "pending"


def test_archive_claim_conflict_skips_engine() -> None:
    svc = AssetNotificationService(MagicMock())
    ctx = _ctx()
    row = MagicMock(id=uuid4(), status="active", version=1)
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_archive_readiness"):
            with patch.object(
                svc._repo,
                "update",
                side_effect=ConflictException("modified by another user"),
            ):
                with patch.object(svc._engine, "archive") as archive:
                    with pytest.raises(ConflictException):
                        svc.archive(ctx, row.id)
                    archive.assert_not_called()


def test_mark_sent_audits() -> None:
    svc = AssetNotificationService(MagicMock())
    ctx = _ctx()
    row = MagicMock(id=uuid4(), status="active", delivery_status="pending", version=1, sent_at=None)
    claimed = MagicMock(
        id=row.id,
        status="active",
        delivery_status="sent",
        version=2,
        sent_at="ts",
    )
    with (
        patch.object(svc, "get", return_value=row),
        patch.object(svc._validator, "validate_mark_sent_readiness"),
        patch.object(svc._repo, "update", side_effect=[claimed, claimed]),
        patch.object(svc._engine, "mark_sent"),
        patch.object(svc._audit, "log_entity_change") as audit,
    ):
        result = svc.mark_sent(ctx, row.id)
        assert result is claimed
        assert audit.call_args.kwargs["operation"] == "mark_sent"
