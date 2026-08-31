"""CR-004 Phase 2C read API tests."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.enums import ASSET_OPERATIONAL_STATUS_VALUES, AssetOperationalStatus
from modules.asset.domain.operational_status_exceptions import UnknownOperationalStatus
from modules.asset.repository.asset_repository import (
    AssetListFilters,
    AssetRepository,
    BranchOperationalSummary,
    OperationalStatusCounts,
)
from modules.asset.schemas import AssetDashboardSummaryResponse, AssetResponse
from modules.asset.service.asset_dashboard_summary_service import AssetDashboardSummaryService
from modules.asset.service.asset_service import AssetService
from modules.asset.service.operational_status_read import coerce_operational_status_filter
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


@pytest.mark.parametrize("value", sorted(ASSET_OPERATIONAL_STATUS_VALUES))
def test_coerce_operational_status_filter_accepts_enum(value: str) -> None:
    assert coerce_operational_status_filter(value) == value
    assert coerce_operational_status_filter(value.lower()) == value


def test_coerce_operational_status_filter_none() -> None:
    assert coerce_operational_status_filter(None) is None
    assert coerce_operational_status_filter("  ") is None


def test_coerce_operational_status_filter_invalid() -> None:
    with pytest.raises(UnknownOperationalStatus):
        coerce_operational_status_filter("FLYING")


def test_asset_list_filters_includes_operational_status() -> None:
    cid = uuid4()
    filters = AssetListFilters(company_id=cid, operational_status="ASSIGNED")
    assert filters.operational_status == "ASSIGNED"


def test_asset_response_includes_operational_status_field() -> None:
    row = SimpleNamespace(
        id=uuid4(),
        document_number="D1",
        asset_code="A1",
        asset_name="Laptop",
        asset_category_id=uuid4(),
        asset_type="fixed",
        master_asset_id=None,
        product_id=None,
        supplier_vendor_id=None,
        serial_number=None,
        barcode=None,
        qr_code=None,
        rfid_tag=None,
        purchase_date=None,
        purchase_cost=None,
        current_book_value=None,
        salvage_value=None,
        currency_code="USD",
        depreciation_method=None,
        useful_life_months=None,
        department_id=None,
        custodian_employee_id=None,
        purchase_order_id=None,
        grn_id=None,
        inventory_receipt_id=None,
        inventory_issue_id=None,
        project_id=None,
        production_order_id=None,
        quality_inspection_id=None,
        is_shared=False,
        status="active",
        operational_status="READY_TO_MOVE",
        workflow_status=None,
        workflow_instance_id=None,
        company_id=uuid4(),
        branch_id=uuid4(),
        version=1,
        discovery_profile_json=None,
    )
    parsed = AssetResponse.model_validate(row)
    assert parsed.operational_status == "READY_TO_MOVE"


def test_asset_service_search_passes_operational_filter() -> None:
    svc = AssetService(MagicMock())
    ctx = _ctx()
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._repo, "search", return_value=([], 0)) as search,
    ):
        svc.search(ctx, operational_status="assigned")
    assert search.call_args.args[1].operational_status == "ASSIGNED"


@pytest.mark.parametrize("status", sorted(ASSET_OPERATIONAL_STATUS_VALUES))
def test_asset_service_search_each_status(status: str) -> None:
    svc = AssetService(MagicMock())
    ctx = _ctx()
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._repo, "search", return_value=([], 0)) as search,
    ):
        svc.search(ctx, operational_status=status)
    assert search.call_args.args[1].operational_status == status


def test_asset_service_search_pagination_args() -> None:
    svc = AssetService(MagicMock())
    ctx = _ctx()
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._repo, "search", return_value=([], 0)) as search,
    ):
        svc.search(ctx, offset=10, limit=5)
    assert search.call_args.kwargs["offset"] == 10
    assert search.call_args.kwargs["limit"] == 5


def test_dashboard_service_maps_counts() -> None:
    svc = AssetDashboardSummaryService(MagicMock())
    ctx = _ctx()
    counts = OperationalStatusCounts(
        total_assets=10,
        ready_to_move=3,
        assigned=4,
        retired=1,
        pending_disposal=1,
        disposed=1,
        in_use_as_component=0,
    )
    branch = BranchOperationalSummary(
        branch_id=ctx.branch_id,
        total_assets=5,
        ready_to_move=2,
        assigned=2,
        retired=0,
        pending_disposal=1,
        disposed=0,
        in_use_as_component=0,
    )
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._repo, "dashboard_summary", return_value=counts),
        patch.object(svc._repo, "summary_by_branch", return_value=[branch]),
    ):
        result = svc.get_summary(ctx)
    assert isinstance(result, AssetDashboardSummaryResponse)
    assert result.total_assets == 10
    assert result.ready_to_move == 3
    assert len(result.by_branch) == 1
    assert result.by_branch[0].branch_id == ctx.branch_id


def test_dashboard_service_branch_scope_skips_by_branch() -> None:
    svc = AssetDashboardSummaryService(MagicMock())
    ctx = _ctx()
    counts = OperationalStatusCounts(1, 1, 0, 0, 0, 0, 0)
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._scope, "validate_branch_access", return_value=None),
        patch.object(svc._repo, "dashboard_summary", return_value=counts) as dash,
        patch.object(svc._repo, "summary_by_branch") as by_branch,
    ):
        result = svc.get_summary(ctx, branch_id=ctx.branch_id)
    by_branch.assert_not_called()
    assert result.branch_id == ctx.branch_id
    assert result.by_branch == []
    dash.assert_called_once()


def test_repository_search_applies_operational_status_filter() -> None:
    repo = AssetRepository(MagicMock())
    ctx = _ctx()
    db = repo.db
    db.scalar.return_value = 0
    db.scalars.return_value.all.return_value = []
    filters = AssetListFilters(company_id=ctx.company_id, operational_status="ASSIGNED")
    with patch.object(repo, "apply_ast_filter", side_effect=lambda stmt, *a, **k: stmt):
        repo.search(ctx, filters, offset=0, limit=10)
    assert db.scalar.called
    assert db.scalars.called


def test_openapi_lists_dashboard_summary_and_operational_filter() -> None:
    from main import create_app

    app = create_app()
    paths = app.openapi()["paths"]
    assets_list = "/api/v1/assets/assets"
    assert assets_list in paths
    params = {p["name"] for p in paths[assets_list]["get"].get("parameters", [])}
    assert "operational_status" in params
    assert "/api/v1/assets/assets/dashboard-summary" in paths


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("ready_to_move", 1),
        ("assigned", 2),
        ("retired", 3),
        ("pending_disposal", 4),
        ("disposed", 5),
    ],
)
def test_operational_status_counts_dataclass(field: str, value: int) -> None:
    counts = OperationalStatusCounts(
        total_assets=15,
        ready_to_move=1,
        assigned=2,
        retired=3,
        pending_disposal=4,
        disposed=5,
        in_use_as_component=0,
    )
    assert getattr(counts, field) == value


def test_all_operational_status_enum_values_covered_in_filter() -> None:
    for status in AssetOperationalStatus:
        assert status.value in ASSET_OPERATIONAL_STATUS_VALUES


def test_dashboard_response_schema_defaults_by_branch() -> None:
    payload = AssetDashboardSummaryResponse(
        company_id=uuid4(),
        total_assets=0,
        ready_to_move=0,
        assigned=0,
        retired=0,
        pending_disposal=0,
        disposed=0,
    )
    assert payload.by_branch == []


def test_asset_service_invalid_operational_filter_raises() -> None:
    svc = AssetService(MagicMock())
    with pytest.raises(UnknownOperationalStatus):
        svc.search(_ctx(), operational_status="NOT_A_STATUS")


def test_asset_service_search_passes_branch_id() -> None:
    svc = AssetService(MagicMock())
    ctx = _ctx()
    branch_id = uuid4()
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._repo, "search", return_value=([], 0)) as search,
    ):
        svc.search(ctx, branch_id=branch_id)
    assert search.call_args.args[1].branch_id == branch_id


def test_dashboard_and_list_routes_use_asset_read_permission() -> None:
    import inspect

    import modules.asset.routers as routers_mod

    src = inspect.getsource(routers_mod)
    assert 'require_permission("asset.asset:read")' in src
    assert "/dashboard-summary" in src
    assert "operational_status" in src
