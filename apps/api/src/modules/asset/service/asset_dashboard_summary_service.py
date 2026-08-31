"""Asset operational dashboard summary (CR-004 Phase 2C) — read aggregation only."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.repository.asset_repository import AssetRepository, BranchOperationalSummary
from modules.asset.schemas import (
    AssetDashboardBranchSummary,
    AssetDashboardLocationSummary,
    AssetDashboardSummaryResponse,
)
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.foundation.domain.value_objects import TenantContext


class AssetDashboardSummaryService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetRepository(db)
        self._scope = AssetScopeValidator(db)

    def get_summary(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        location_id: UUID | None = None,
        asset_domain: str | None = None,
    ) -> AssetDashboardSummaryResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)

        domain = (asset_domain or "").strip().upper() or "IT"
        counts = self._repo.dashboard_summary(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            location_id=location_id,
            asset_domain=domain,
        )
        by_branch: list[AssetDashboardBranchSummary] = []
        by_location: list[AssetDashboardLocationSummary] = []
        if branch_id is None and location_id is None:
            by_branch = [
                self._map_branch_row(row)
                for row in self._repo.summary_by_branch(
                    ctx, company_id=cid, asset_domain=domain
                )
            ]
            by_location = [
                self._map_location_row(row)
                for row in self._repo.summary_by_location(
                    ctx, company_id=cid, asset_domain=domain
                )
            ]

        return AssetDashboardSummaryResponse(
            company_id=cid,
            branch_id=branch_id,
            location_id=location_id,
            total_assets=counts.total_assets,
            ready_to_move=counts.ready_to_move,
            assigned=counts.assigned,
            retired=counts.retired,
            pending_disposal=counts.pending_disposal,
            disposed=counts.disposed,
            in_use_as_component=counts.in_use_as_component,
            by_branch=by_branch,
            by_location=by_location,
        )

    @staticmethod
    def _map_branch_row(row: BranchOperationalSummary) -> AssetDashboardBranchSummary:
        return AssetDashboardBranchSummary(
            branch_id=row.branch_id,
            total_assets=row.total_assets,
            ready_to_move=row.ready_to_move,
            assigned=row.assigned,
            retired=row.retired,
            pending_disposal=row.pending_disposal,
            disposed=row.disposed,
            in_use_as_component=row.in_use_as_component,
        )

    @staticmethod
    def _map_location_row(row) -> AssetDashboardLocationSummary:
        return AssetDashboardLocationSummary(
            location_id=row.location_id,
            label=row.label,
            total_assets=row.total_assets,
            ready_to_move=row.ready_to_move,
            assigned=row.assigned,
            retired=row.retired,
            pending_disposal=row.pending_disposal,
            disposed=row.disposed,
            in_use_as_component=row.in_use_as_component,
        )
