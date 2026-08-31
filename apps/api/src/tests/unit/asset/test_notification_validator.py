"""Unit tests for NotificationValidator (FP-ASSET-017)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import NotificationValidationError
from modules.asset.service.notification_validator import NotificationValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx(user_type: str = "employee") -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type=user_type,
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_create_requires_asset_id() -> None:
    validator = NotificationValidator(MagicMock())
    with pytest.raises(NotificationValidationError, match="asset_id"):
        validator.validate_create_fields(_ctx(), company_id=uuid4(), fields={})


def test_create_requires_recipient() -> None:
    validator = NotificationValidator(MagicMock())
    with pytest.raises(NotificationValidationError, match="recipient"):
        validator.validate_create_fields(
            _ctx(),
            company_id=uuid4(),
            fields={"asset_id": uuid4(), "notification_type": "maintenance_due"},
        )


def test_create_rejects_invalid_type() -> None:
    validator = NotificationValidator(MagicMock())
    with pytest.raises(NotificationValidationError, match="notification_type"):
        validator.validate_create_fields(
            _ctx(),
            company_id=uuid4(),
            fields={
                "asset_id": uuid4(),
                "notification_type": "email",
                "recipient_user_id": uuid4(),
            },
        )


def test_create_rejects_company_mismatch() -> None:
    validator = NotificationValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(id=asset_id, company_id=uuid4(), status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(NotificationValidationError, match="does not belong"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset_id,
                    "notification_type": "maintenance_due",
                    "recipient_user_id": uuid4(),
                },
            )


def test_create_rejects_disposed_unless_disposal_subtype() -> None:
    validator = NotificationValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id, status="disposed")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(NotificationValidationError, match="disposed"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset_id,
                    "notification_type": "maintenance_due",
                    "recipient_user_id": uuid4(),
                },
            )
        fields = {
            "asset_id": asset_id,
            "notification_type": "other",
            "recipient_user_id": uuid4(),
            "payload_json": {"event_subtype": "disposal"},
        }
        validator.validate_create_fields(ctx, company_id=ctx.company_id, fields=fields)
        assert fields["payload_json"]["event_subtype"] == "disposal"


def test_other_requires_subtype() -> None:
    validator = NotificationValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(NotificationValidationError, match="event_subtype"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset_id,
                    "notification_type": "other",
                    "recipient_user_id": uuid4(),
                },
            )


def test_payload_rejects_secret_keys() -> None:
    with pytest.raises(NotificationValidationError, match="secret"):
        NotificationValidator.validate_payload(
            {"api_key": "x"},
            notification_type="maintenance_due",
            require_subtype=False,
        )


def test_payload_rejects_excessive_depth() -> None:
    nested = {"a": {"b": {"c": {"d": {"e": 1}}}}}
    with pytest.raises(NotificationValidationError, match="depth"):
        NotificationValidator.validate_payload(
            nested,
            notification_type="maintenance_due",
            require_subtype=False,
        )


def test_immutability_after_sent() -> None:
    validator = NotificationValidator(MagicMock())
    row = SimpleNamespace(
        status="active",
        delivery_status="sent",
        asset_id=uuid4(),
        notification_type="maintenance_due",
        recipient_user_id=uuid4(),
        recipient_employee_id=None,
        payload_json={"x": 1},
        company_id=uuid4(),
    )
    with pytest.raises(NotificationValidationError, match="immutable"):
        validator.validate_update_fields(
            _ctx(),
            row,
            {"payload_json": {"x": 2}, "version": 1},
        )


def test_mark_read_requires_sent() -> None:
    validator = NotificationValidator(MagicMock())
    row = SimpleNamespace(status="active", delivery_status="pending")
    with pytest.raises(NotificationValidationError, match="sent"):
        validator.validate_mark_read_readiness(_ctx(), row)
