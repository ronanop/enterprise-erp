"""Unit tests for AssetReportService (FP-ASSET-018)."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.exceptions import ConflictException
from modules.asset.service.asset_report_service import AssetReportService
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_service_wires_layers() -> None:
    svc = AssetReportService(MagicMock())
    assert svc._validator is not None
    assert svc._engine is not None
    assert svc._repo is not None


def test_catalog_returns_keys() -> None:
    svc = AssetReportService(MagicMock())
    items = svc.catalog()
    keys = {i["key"] for i in items}
    assert "asset_inventory" in keys
    assert "executive_dashboard" in keys


def test_finalize_conflict_skips_engine() -> None:
    svc = AssetReportService(MagicMock())
    ctx = _ctx()
    row = MagicMock(id=uuid4(), status="draft", metrics_json={"x": 1}, version=1)
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_finalize_readiness"):
            with patch.object(
                svc._repo,
                "update",
                side_effect=ConflictException("modified"),
            ):
                with patch.object(svc._engine, "finalize") as finalize:
                    with pytest.raises(ConflictException):
                        svc.finalize(ctx, row.id)
                    finalize.assert_not_called()


def test_export_audits() -> None:
    svc = AssetReportService(MagicMock())
    ctx = _ctx()
    with (
        patch.object(svc._validator, "validate_report_key", return_value="asset_summary"),
        patch.object(svc._validator, "validate_run_filters"),
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(
            svc._repo,
            "export_rows_for_key",
            return_value=([{"key": "a", "label": "A"}], [{"a": 1}]),
        ),
        patch.object(svc._audit, "log_entity_change") as audit,
    ):
        payload = svc.export(ctx, "asset_summary")
        assert payload["row_count"] == 1
        assert audit.call_args.kwargs["operation"] == "export"
