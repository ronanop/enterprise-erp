"""Repository dashboard aggregation tests (CR-004 Phase 2C) — mocked SQL layer."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

from modules.asset.repository.asset_repository import AssetListFilters, AssetRepository
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_count_by_operational_status_executes_scoped_count() -> None:
    repo = AssetRepository(MagicMock())
    ctx = _ctx()
    repo.db.scalar.return_value = 7
    with patch.object(repo, "apply_ast_filter", side_effect=lambda stmt, *a, **k: stmt):
        count = repo.count_by_operational_status(
            ctx,
            company_id=ctx.company_id,
            operational_status="ASSIGNED",
            branch_id=ctx.branch_id,
        )
    assert count == 7
    repo.db.scalar.assert_called_once()


def test_dashboard_summary_maps_group_rows() -> None:
    repo = AssetRepository(MagicMock())
    ctx = _ctx()
    repo.db.execute.return_value.all.return_value = [
        ("READY_TO_MOVE", 2),
        ("ASSIGNED", 3),
        (None, 1),
    ]
    repo.db.scalar.return_value = 6
    with patch.object(repo, "apply_ast_filter", side_effect=lambda stmt, *a, **k: stmt):
        summary = repo.dashboard_summary(ctx, company_id=ctx.company_id)
    assert summary.total_assets == 6
    assert summary.ready_to_move == 2
    assert summary.assigned == 3
    assert summary.retired == 0


def test_dashboard_summary_branch_filter_passed() -> None:
    repo = AssetRepository(MagicMock())
    ctx = _ctx()
    branch_id = uuid4()
    repo.db.execute.return_value.all.return_value = []
    repo.db.scalar.return_value = 0
    with patch.object(repo, "apply_ast_filter", side_effect=lambda stmt, *a, **k: stmt):
        repo.dashboard_summary(ctx, company_id=ctx.company_id, branch_id=branch_id)
    assert repo.db.execute.called
    assert repo.db.scalar.called


def test_summary_by_branch_builds_rows() -> None:
    repo = AssetRepository(MagicMock())
    ctx = _ctx()
    branch_id = uuid4()
    repo.db.execute.side_effect = [
        MagicMock(all=lambda: [(branch_id, "DISPOSED", 2)]),
        MagicMock(all=lambda: [(branch_id, 2)]),
    ]
    with patch.object(repo, "apply_ast_filter", side_effect=lambda stmt, *a, **k: stmt):
        rows = repo.summary_by_branch(ctx, company_id=ctx.company_id)
    assert len(rows) == 1
    assert rows[0].branch_id == branch_id
    assert rows[0].disposed == 2
    assert rows[0].total_assets == 2


def test_search_passes_operational_status_to_where() -> None:
    repo = AssetRepository(MagicMock())
    ctx = _ctx()
    repo.db.scalar.return_value = 1
    repo.db.scalars.return_value.all.return_value = []
    filters = AssetListFilters(company_id=ctx.company_id, operational_status="RETIRED")
    with patch.object(repo, "apply_ast_filter", side_effect=lambda stmt, *a, **k: stmt):
        _, total = repo.search(ctx, filters, offset=0, limit=5)
    assert total == 1
