"""AssetReportService — hybrid live reports + snapshots (FP-ASSET-018).

READ-ONLY on operational tables. Writes only to ast_asset_report.
"""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetReportStatus, AstEntityType
from modules.asset.models import AstAssetReport
from modules.asset.repository.asset_report_repository import (
    AssetReportListFilters,
    AssetReportRepository,
    LiveReportFilters,
)
from modules.asset.repository.base import utcnow
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.document_number_service import DocumentNumberService
from modules.asset.service.engines import AssetReportEngine
from modules.asset.service.report_validator import (
    MAX_EXPORT_ROWS,
    REPORT_CATALOG,
    ReportValidator,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

ENTITY_AST_REPORT = "ast_asset_report"


class AssetReportService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetReportRepository(db)
        self._scope = AssetScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = AssetReportEngine()
        self._audit = AuditService(db)
        self._validator = ReportValidator(db)

    def catalog(self) -> list[dict]:
        return list(REPORT_CATALOG)

    def _live_filters(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None,
        branch_id: UUID | None = None,
        category_id: UUID | None = None,
        department_id: UUID | None = None,
        period_start: date | None = None,
        period_end: date | None = None,
        status: str | None = None,
    ) -> LiveReportFilters:
        cid = self._scope.resolve_company_id(ctx, company_id)
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)
        self._validator.validate_run_filters(
            period_start=period_start, period_end=period_end
        )
        return LiveReportFilters(
            company_id=cid,
            branch_id=branch_id,
            category_id=category_id,
            department_id=department_id,
            period_start=period_start,
            period_end=period_end,
            status=status,
        )

    def dashboard(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        category_id: UUID | None = None,
        department_id: UUID | None = None,
        horizon_days: int = 30,
    ) -> dict:
        filters = self._live_filters(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            category_id=category_id,
            department_id=department_id,
        )
        raw = self._repo.build_dashboard_raw(ctx, filters, horizon_days=horizon_days)
        return self._engine.shape_dashboard(
            kpis=raw["kpis"],
            by_category=raw["by_category"],
            by_department=raw["by_department"],
            recent_transfers=raw["recent_transfers"],
            recent_notifications=raw["recent_notifications"],
            health={**raw["health"], "depreciation_summary": raw["depreciation_summary"]},
            horizon_days=horizon_days,
        )

    def run(
        self,
        ctx: TenantContext,
        report_key: str,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        category_id: UUID | None = None,
        department_id: UUID | None = None,
        period_start: date | None = None,
        period_end: date | None = None,
        status: str | None = None,
        page: int = 1,
        page_size: int = 25,
    ) -> dict:
        key = self._validator.validate_report_key(report_key)
        self._validator.validate_run_filters(
            period_start=period_start, period_end=period_end, page_size=page_size
        )
        filters = self._live_filters(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            category_id=category_id,
            department_id=department_id,
            period_start=period_start,
            period_end=period_end,
            status=status,
        )
        offset = max(page - 1, 0) * page_size
        items, total, totals = self._repo.run_report(
            ctx, key, filters, offset=offset, limit=page_size
        )
        return self._engine.shape_run_result(
            key,
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            totals=totals,
            filters=self._engine.filter_dict(
                company_id=filters.company_id,
                branch_id=branch_id,
                category_id=category_id,
                department_id=department_id,
                period_start=period_start,
                period_end=period_end,
                status=status,
            ),
        )

    def export(
        self,
        ctx: TenantContext,
        report_key: str,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        category_id: UUID | None = None,
        department_id: UUID | None = None,
        period_start: date | None = None,
        period_end: date | None = None,
        status: str | None = None,
        limit: int = MAX_EXPORT_ROWS,
    ) -> dict:
        key = self._validator.validate_report_key(report_key)
        self._validator.validate_run_filters(
            period_start=period_start, period_end=period_end, export=True, limit=limit
        )
        filters = self._live_filters(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            category_id=category_id,
            department_id=department_id,
            period_start=period_start,
            period_end=period_end,
            status=status,
        )
        columns, rows = self._repo.export_rows_for_key(
            ctx, key, filters, limit=min(limit, MAX_EXPORT_ROWS)
        )
        payload = self._engine.shape_export(
            key,
            columns=columns,
            rows=rows,
            filters=self._engine.filter_dict(
                company_id=filters.company_id,
                branch_id=branch_id,
                category_id=category_id,
                department_id=department_id,
                period_start=period_start,
                period_end=period_end,
                status=status,
            ),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_REPORT,
            entity_id=filters.company_id,
            operation="export",
            performed_by=ctx.user_id,
            new_value={"report_key": key, "row_count": len(rows)},
        )
        return payload

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        report_type: str | None = None,
        status: str | None = None,
        category_id: UUID | None = None,
        department_id: UUID | None = None,
        branch_id: UUID | None = None,
        search: str | None = None,
        sort: str = "generated_at",
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstAssetReport], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        if sort not in {"generated_at", "created_at", "report_code"}:
            sort = "generated_at"
        return self._repo.search(
            ctx,
            AssetReportListFilters(
                company_id=cid,
                report_type=report_type,
                status=status,
                category_id=category_id,
                department_id=department_id,
                branch_id=branch_id,
                search=search,
                sort=sort,
            ),
            offset=offset,
            limit=limit,
        )

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetReport:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Report not found")
        return row

    def generate(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        report_key = self._validator.validate_generate_fields(fields)
        snapshot_type = self._validator.snapshot_type_for_key(report_key)
        branch_id = fields.get("branch_id")
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)
        filters = self._live_filters(
            ctx,
            company_id=company_id or fields.get("company_id"),
            branch_id=branch_id,
            category_id=fields.get("category_id"),
            department_id=fields.get("department_id"),
            period_start=fields.get("period_start"),
            period_end=fields.get("period_end"),
            status=fields.get("status"),
        )
        if report_key == "executive_dashboard":
            dash = self.dashboard(
                ctx,
                company_id=filters.company_id,
                branch_id=branch_id,
                category_id=fields.get("category_id"),
                department_id=fields.get("department_id"),
            )
            metrics = self._engine.build_metrics(
                report_key,
                dashboard=dash,
                totals=dash.get("kpis"),
                filters=self._engine.filter_dict(company_id=filters.company_id),
            )
        else:
            items, total, totals = self._repo.run_report(
                ctx, report_key, filters, offset=0, limit=MAX_EXPORT_ROWS
            )
            metrics = self._engine.build_metrics(
                report_key,
                rows=items,
                totals={**totals, "row_count": total},
                filters=self._engine.filter_dict(
                    company_id=filters.company_id,
                    branch_id=branch_id,
                    category_id=fields.get("category_id"),
                    department_id=fields.get("department_id"),
                    period_start=fields.get("period_start"),
                    period_end=fields.get("period_end"),
                    status=fields.get("status"),
                ),
            )

        code = self._numbers.generate(
            AstEntityType.REPORT,
            filters.company_id,
            AstAssetReport,
            "report_code",
            ctx=ctx,
        )
        row = self._repo.create(
            ctx,
            company_id=filters.company_id,
            branch_id=branch_id,
            report_code=code,
            report_type=snapshot_type,
            period_start=fields.get("period_start"),
            period_end=fields.get("period_end"),
            department_id=fields.get("department_id"),
            category_id=fields.get("category_id"),
            metrics_json=metrics,
            generated_at=utcnow(),
            status=AssetReportStatus.DRAFT.value,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_REPORT,
            entity_id=row.id,
            operation="generate",
            performed_by=ctx.user_id,
            new_value={"report_key": report_key, "report_type": snapshot_type},
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        branch_id = fields.get("branch_id")
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)
        self._validator.validate_update_fields(row, fields)
        allowed = {
            k: v
            for k, v in fields.items()
            if k
            in {
                "branch_id",
                "department_id",
                "category_id",
                "period_start",
                "period_end",
                "version",
            }
        }
        updated = self._repo.update(ctx, row_id, **allowed)
        if updated is None:
            raise NotFoundException("Report not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_REPORT,
            entity_id=row_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return updated

    def finalize(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_finalize_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Report not found")
        self._engine.finalize(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_REPORT,
            entity_id=row_id,
            operation="finalize",
            performed_by=ctx.user_id,
        )
        return updated

    # Legacy create retained for ApplicationService compatibility — maps to generate.
    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        if "report_key" not in fields and "report_type" in fields:
            # Best-effort: treat report_type as live key if present in catalog
            fields = {**fields, "report_key": fields.get("report_type")}
        if "report_key" not in fields:
            fields = {**fields, "report_key": "asset_summary"}
        return self.generate(ctx, company_id=company_id, **fields)
