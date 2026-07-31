"""Unit tests for DisposalValidator (FP-ASSET-005)."""

from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import DisposalValidationError
from modules.asset.service.disposal_validator import DisposalValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_create_requires_asset_id() -> None:
    validator = DisposalValidator(MagicMock())
    with pytest.raises(DisposalValidationError, match="asset_id is required"):
        validator.validate_create_fields(_ctx(), company_id=uuid4(), fields={})


def test_create_blocks_disposed_asset() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="disposed")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(DisposalValidationError, match="Disposed"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={"asset_id": asset.id, "disposal_type": "scrap"},
            )


def test_create_blocks_open_maintenance() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="active")
    open_wo = SimpleNamespace(document_number="AMNT-2026-000001")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._disposals, "find_pending_for_asset", return_value=None):
            with patch.object(validator._maintenances, "find_open_for_asset", return_value=open_wo):
                with pytest.raises(DisposalValidationError, match="open maintenance"):
                    validator.validate_create_fields(
                        ctx,
                        company_id=ctx.company_id,
                        fields={"asset_id": asset.id, "disposal_type": "sale"},
                    )


def test_create_blocks_open_assignment() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="active")
    open_asn = SimpleNamespace(document_number="AASN-2026-000001")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._disposals, "find_pending_for_asset", return_value=None):
            with patch.object(validator._maintenances, "find_open_for_asset", return_value=None):
                with patch.object(
                    validator._assignments,
                    "find_pending_or_active_for_asset",
                    return_value=open_asn,
                ):
                    with pytest.raises(DisposalValidationError, match="open assignment"):
                        validator.validate_create_fields(
                            ctx,
                            company_id=ctx.company_id,
                            fields={"asset_id": asset.id, "disposal_type": "donation"},
                        )


def test_create_blocks_pending_transfer() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="active")
    pending = SimpleNamespace(document_number="ATRF-2026-000001")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._disposals, "find_pending_for_asset", return_value=None):
            with patch.object(validator._maintenances, "find_open_for_asset", return_value=None):
                with patch.object(
                    validator._assignments,
                    "find_pending_or_active_for_asset",
                    return_value=None,
                ):
                    with patch.object(
                        validator._transfers, "find_pending_for_asset", return_value=pending
                    ):
                        with pytest.raises(DisposalValidationError, match="pending transfer"):
                            validator.validate_create_fields(
                                ctx,
                                company_id=ctx.company_id,
                                fields={"asset_id": asset.id, "disposal_type": "scrap"},
                            )


def test_create_blocks_second_open_disposal() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="active")
    open_dsp = SimpleNamespace(document_number="ADISP-2026-000001")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._disposals, "find_pending_for_asset", return_value=open_dsp):
            with pytest.raises(DisposalValidationError, match="open disposal"):
                validator.validate_create_fields(
                    ctx,
                    company_id=ctx.company_id,
                    fields={"asset_id": asset.id, "disposal_type": "write_off"},
                )


def test_update_only_draft() -> None:
    validator = DisposalValidator(MagicMock())
    row = SimpleNamespace(status="submitted", asset_id=uuid4())
    with pytest.raises(DisposalValidationError, match="Only draft"):
        validator.validate_update_fields(_ctx(), row, {"disposal_type": "sale"})


def test_post_requires_approved_and_date() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(
        status="submitted",
        disposal_date=None,
        asset_id=uuid4(),
        finance_journal_id=None,
    )
    with pytest.raises(DisposalValidationError, match="Only approved"):
        validator.validate_post_readiness(ctx, row)

    row = SimpleNamespace(
        status="approved",
        disposal_date=None,
        asset_id=uuid4(),
        finance_journal_id=None,
    )
    with pytest.raises(DisposalValidationError, match="disposal_date"):
        validator.validate_post_readiness(ctx, row)


def test_post_rejects_already_posted() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(
        status="posted",
        disposal_date=date.today(),
        asset_id=uuid4(),
        finance_journal_id=uuid4(),
    )
    with pytest.raises(DisposalValidationError, match="already posted"):
        validator.validate_post_readiness(ctx, row)

    row = SimpleNamespace(
        status="approved",
        disposal_date=date.today(),
        asset_id=uuid4(),
        finance_journal_id=uuid4(),
    )
    with pytest.raises(DisposalValidationError, match="already posted"):
        validator.validate_post_readiness(ctx, row)


def test_reopen_blocked_when_another_open_disposal_exists() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(id=uuid4(), asset_id=uuid4(), status="cancelled")
    other = SimpleNamespace(document_number="ADISP-2026-000099")
    with patch.object(validator._disposals, "find_pending_for_asset", return_value=other):
        with pytest.raises(DisposalValidationError, match="open disposal"):
            validator.validate_reopen_readiness(ctx, row)


def test_create_accepts_eligible_active_asset() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._disposals, "find_pending_for_asset", return_value=None):
            with patch.object(validator._maintenances, "find_open_for_asset", return_value=None):
                with patch.object(
                    validator._assignments,
                    "find_pending_or_active_for_asset",
                    return_value=None,
                ):
                    with patch.object(
                        validator._transfers, "find_pending_for_asset", return_value=None
                    ):
                        validator.validate_create_fields(
                            ctx,
                            company_id=ctx.company_id,
                            fields={
                                "asset_id": asset.id,
                                "disposal_type": "scrap",
                                "disposal_date": date.today(),
                            },
                        )
