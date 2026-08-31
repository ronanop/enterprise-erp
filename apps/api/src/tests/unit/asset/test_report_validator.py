"""Unit tests for ReportValidator (FP-ASSET-018)."""

from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import ReportValidationError
from modules.asset.service.report_validator import ReportValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_unknown_report_key() -> None:
    with pytest.raises(ReportValidationError, match="Unknown report_key"):
        ReportValidator(None).validate_report_key("not_a_report")


def test_valid_report_keys() -> None:
    v = ReportValidator(None)
    assert v.validate_report_key("asset_inventory") == "asset_inventory"
    assert v.validate_report_key("executive_dashboard") == "executive_dashboard"


def test_period_order() -> None:
    with pytest.raises(ReportValidationError, match="period_start"):
        ReportValidator(None).validate_run_filters(
            period_start=date(2026, 6, 1),
            period_end=date(2026, 1, 1),
        )


def test_export_limit() -> None:
    with pytest.raises(ReportValidationError, match="Export limited"):
        ReportValidator(None).validate_run_filters(
            period_start=None,
            period_end=None,
            export=True,
            limit=10_000,
        )


def test_snapshot_mapping() -> None:
    v = ReportValidator(None)
    assert v.snapshot_type_for_key("warranty_expiry") == "warranty_expiry"
    assert v.snapshot_type_for_key("asset_inventory") == "register"


def test_finalize_requires_draft_and_metrics() -> None:
    v = ReportValidator(None)
    row = SimpleNamespace(status="finalized", metrics_json={"a": 1})
    with pytest.raises(ReportValidationError, match="draft"):
        v.validate_finalize_readiness(_ctx(), row)
    row2 = SimpleNamespace(status="draft", metrics_json=None)
    with pytest.raises(ReportValidationError, match="metrics_json"):
        v.validate_finalize_readiness(_ctx(), row2)


def test_update_rejects_finalized() -> None:
    v = ReportValidator(None)
    row = SimpleNamespace(
        status="finalized",
        period_start=None,
        period_end=None,
    )
    with pytest.raises(ReportValidationError, match="draft"):
        v.validate_update_fields(row, {"version": 1})
