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


def _pending_asset(*, company_id, status: str = "active", ops: str | None = "PENDING_DISPOSAL"):
    return SimpleNamespace(
        id=uuid4(),
        company_id=company_id,
        status=status,
        operational_status=ops,
    )


def _clear_custody(validator: DisposalValidator):
    return (
        patch.object(validator._disposals, "find_pending_for_asset", return_value=None),
        patch.object(validator._maintenances, "find_open_for_asset", return_value=None),
        patch.object(
            validator._assignments,
            "find_pending_or_active_for_asset",
            return_value=None,
        ),
        patch.object(validator._transfers, "find_pending_for_asset", return_value=None),
    )


def test_create_requires_asset_id() -> None:
    validator = DisposalValidator(MagicMock())
    with pytest.raises(DisposalValidationError, match="asset_id is required"):
        validator.validate_create_fields(_ctx(), company_id=uuid4(), fields={})


def test_create_blocks_disposed_asset() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    asset = _pending_asset(company_id=ctx.company_id, status="disposed")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(DisposalValidationError, match="Disposed"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={"asset_id": asset.id, "disposal_type": "scrap"},
            )


@pytest.mark.parametrize(
    "ops,match",
    [
        ("READY_TO_MOVE", "PENDING_DISPOSAL"),
        ("ASSIGNED", "PENDING_DISPOSAL"),
        ("DISPOSED", "PENDING_DISPOSAL"),
        ("RETIRED", "Start Disposal"),
        (None, "PENDING_DISPOSAL"),
    ],
)
def test_create_blocks_non_pending_operational_status(ops: str | None, match: str) -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    asset = _pending_asset(company_id=ctx.company_id, ops=ops)
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(DisposalValidationError, match=match):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={"asset_id": asset.id, "disposal_type": "scrap"},
            )


def test_create_blocks_open_maintenance() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    asset = _pending_asset(company_id=ctx.company_id)
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
    asset = _pending_asset(company_id=ctx.company_id)
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
    asset = _pending_asset(company_id=ctx.company_id)
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
    asset = _pending_asset(company_id=ctx.company_id)
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


def test_create_accepts_pending_disposal_asset() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    asset = _pending_asset(company_id=ctx.company_id)
    with patch.object(validator._assets, "get", return_value=asset):
        patches = _clear_custody(validator)
        with patches[0], patches[1], patches[2], patches[3]:
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset.id,
                    "disposal_type": "scrap",
                    "disposal_date": date.today(),
                },
            )


def test_submit_rejects_when_no_longer_pending() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    asset = _pending_asset(company_id=ctx.company_id, ops="READY_TO_MOVE")
    row = SimpleNamespace(
        id=uuid4(),
        asset_id=asset.id,
        status="draft",
        disposal_type="scrap",
        disposal_date=date.today(),
        proceeds_amount=None,
        book_value_at_disposal=None,
    )
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(DisposalValidationError, match="no longer pending disposal"):
            validator.validate_submit_readiness(ctx, row)


def test_approve_rejects_when_no_longer_pending() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    asset = _pending_asset(company_id=ctx.company_id, ops="ASSIGNED")
    row = SimpleNamespace(
        id=uuid4(),
        asset_id=asset.id,
        status="submitted",
        disposal_type="scrap",
        disposal_date=date.today(),
        proceeds_amount=None,
        book_value_at_disposal=None,
    )
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(DisposalValidationError, match="cannot be approved"):
            validator.validate_approve_readiness(ctx, row)


def test_approve_accepts_pending_submitted() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    asset = _pending_asset(company_id=ctx.company_id)
    row = SimpleNamespace(
        id=uuid4(),
        asset_id=asset.id,
        status="submitted",
        disposal_type="scrap",
        disposal_date=date.today(),
        proceeds_amount=None,
        book_value_at_disposal=None,
    )
    with patch.object(validator._assets, "get", return_value=asset):
        patches = _clear_custody(validator)
        with patches[0], patches[1], patches[2], patches[3]:
            validator.validate_approve_readiness(ctx, row)


def test_post_rejects_when_no_longer_pending() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    asset = _pending_asset(company_id=ctx.company_id, ops="READY_TO_MOVE")
    row = SimpleNamespace(
        id=uuid4(),
        asset_id=asset.id,
        status="approved",
        disposal_type="scrap",
        disposal_date=date.today(),
        proceeds_amount=None,
        book_value_at_disposal=None,
        finance_journal_id=None,
    )
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(DisposalValidationError, match="cannot be posted"):
            validator.validate_post_readiness(ctx, row)
