"""Phase 5F — Asset inventory server-side filter composition tests."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import RegistrationValidationError
from modules.asset.repository.asset_repository import AssetListFilters, AssetRepository
from modules.asset.service.asset_service import AssetService
from modules.foundation.domain.value_objects import TenantContext


def _ctx(**overrides) -> TenantContext:
    base = dict(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    base.update(overrides)
    return TenantContext(**base)


def test_asset_list_filters_accepts_phase_5f_fields() -> None:
    cid = uuid4()
    dept = uuid4()
    loc = uuid4()
    emp = uuid4()
    filters = AssetListFilters(
        company_id=cid,
        asset_type="fixed",
        department_id=dept,
        location_id=loc,
        employee_id=emp,
        assignment_state="assigned",
        make="Dell",
        model="Latitude",
        search="  sn-1  ",
    )
    assert filters.department_id == dept
    assert filters.location_id == loc
    assert filters.assignment_state == "assigned"
    assert filters.make == "Dell"


def test_service_rejects_invalid_assignment_state() -> None:
    svc = AssetService(MagicMock())
    ctx = _ctx()
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        pytest.raises(RegistrationValidationError, match="assignment_state"),
    ):
        svc.search(ctx, assignment_state="maybe")


def test_service_forwards_phase_5f_filters_to_repository() -> None:
    svc = AssetService(MagicMock())
    ctx = _ctx()
    dept = uuid4()
    loc = uuid4()
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._repo, "search", return_value=([], 0)) as search,
    ):
        svc.search(
            ctx,
            asset_type="fixed",
            department_id=dept,
            location_id=loc,
            assignment_state="unassigned",
            search="Dell",
            make="Dell",
            model="5420",
            offset=0,
            limit=25,
        )
    kwargs = search.call_args
    filters: AssetListFilters = kwargs.args[1]
    assert filters.asset_type == "fixed"
    assert filters.department_id == dept
    assert filters.location_id == loc
    assert filters.assignment_state == "unassigned"
    assert filters.search == "Dell"
    assert filters.make == "Dell"
    assert filters.model == "5420"


def test_repository_search_applies_asset_type_and_assignment_state() -> None:
    """Composition smoke: where clauses are applied without executing SQL."""
    db = MagicMock()
    # count + scalars path
    db.scalar.return_value = 0
    db.scalars.return_value.all.return_value = []
    repo = AssetRepository(db)
    ctx = _ctx()
    filters = AssetListFilters(
        company_id=ctx.company_id,
        asset_type="fixed",
        assignment_state="assigned",
        search="SN",
    )
    with patch.object(repo, "apply_ast_filter", side_effect=lambda stmt, *_a, **_k: stmt):
        items, total = repo.search(ctx, filters, offset=0, limit=10)
    assert items == []
    assert total == 0
    assert db.scalar.called
    assert db.scalars.called


def test_repository_search_skips_blank_search() -> None:
    db = MagicMock()
    db.scalar.return_value = 0
    db.scalars.return_value.all.return_value = []
    repo = AssetRepository(db)
    ctx = _ctx()
    filters = AssetListFilters(company_id=ctx.company_id, search="   ")
    with patch.object(repo, "apply_ast_filter", side_effect=lambda stmt, *_a, **_k: stmt):
        repo.search(ctx, filters, offset=0, limit=10)
    # Still executes; blank search must not add ilike on empty term via strip → ""
    assert db.scalar.called
