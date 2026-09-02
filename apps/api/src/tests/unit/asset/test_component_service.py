"""Unit tests for AssetComponentService (FP-ASSET-019)."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.exceptions import ConflictException
from modules.asset.service.component_service import AssetComponentService
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
    svc = AssetComponentService(MagicMock())
    assert svc._validator is not None
    assert svc._engine is not None


def test_install_forces_active_status() -> None:
    svc = AssetComponentService(MagicMock())
    ctx = _ctx()
    created = MagicMock(status="active", asset_id=uuid4(), component_code="CMP-1", id=uuid4())
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._validator, "validate_install_fields", return_value=None),
        patch.object(svc._repo, "create", return_value=created) as create,
        patch.object(svc._engine, "install_defaults"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
    ):
        svc.install(
            ctx,
            asset_id=uuid4(),
            component_code="CMP-1",
            component_name="Motor",
            status="disposed",
        )
        assert create.call_args.kwargs["status"] == "active"


def test_dispose_claim_conflict_skips_engine() -> None:
    svc = AssetComponentService(MagicMock())
    ctx = _ctx()
    row = MagicMock(id=uuid4(), status="active", version=1)
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_dispose_readiness"):
            with patch.object(
                svc._repo,
                "update",
                side_effect=ConflictException("modified by another user"),
            ):
                with patch.object(svc._engine, "dispose") as dispose:
                    with pytest.raises(ConflictException):
                        svc.dispose(ctx, row.id)
                    dispose.assert_not_called()


def test_replace_claim_conflict_skips_engine() -> None:
    svc = AssetComponentService(MagicMock())
    ctx = _ctx()
    row = MagicMock(
        id=uuid4(),
        status="active",
        version=1,
        company_id=ctx.company_id,
        asset_id=uuid4(),
        component_code="CMP-1",
        component_name="Motor",
        branch_id=None,
        product_id=None,
        quantity=None,
    )
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_replace_readiness"):
            with patch.object(svc._validator, "validate_successor_fields"):
                with patch.object(
                    svc._repo,
                    "update",
                    side_effect=ConflictException("modified by another user"),
                ):
                    with patch.object(svc._engine, "replace") as replace:
                        with pytest.raises(ConflictException):
                            svc.replace(ctx, row.id)
                        replace.assert_not_called()


def test_tree_not_found_for_missing_asset() -> None:
    svc = AssetComponentService(MagicMock())
    ctx = _ctx()
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._repo, "get_parent_asset", return_value=None),
    ):
        from core.exceptions import NotFoundException

        with pytest.raises(NotFoundException):
            svc.tree(ctx, uuid4())
