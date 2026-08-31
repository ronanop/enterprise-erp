"""Asset report repository — snapshots + read-only aggregations (FP-ASSET-018).

WRITE: ast_asset_report only.
READ: other asset tables for aggregations (never mutated here).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException
from modules.asset.models import (
    AstAsset,
    AstAssetAssignment,
    AstAssetChecklist,
    AstAssetDepreciation,
    AstAssetDisposal,
    AstAssetDocument,
    AstAssetInsurance,
    AstAssetMaintenance,
    AstAssetMeterReading,
    AstAssetNotification,
    AstAssetReport,
    AstAssetTransfer,
    AstAssetWarranty,
)
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.asset.service.report_validator import DEFAULT_HORIZON_DAYS, MAX_EXPORT_ROWS
from modules.foundation.domain.value_objects import TenantContext

SORT_COLUMNS = {
    "generated_at": AstAssetReport.generated_at,
    "created_at": AstAssetReport.created_at,
    "report_code": AstAssetReport.report_code,
}


@dataclass(frozen=True)
class AssetReportListFilters:
    company_id: UUID
    report_type: str | None = None
    status: str | None = None
    category_id: UUID | None = None
    department_id: UUID | None = None
    branch_id: UUID | None = None
    search: str | None = None
    sort: str = "generated_at"


@dataclass(frozen=True)
class LiveReportFilters:
    company_id: UUID
    branch_id: UUID | None = None
    category_id: UUID | None = None
    department_id: UUID | None = None
    period_start: date | None = None
    period_end: date | None = None
    status: str | None = None


class AssetReportRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    # ── Snapshot persistence ──────────────────────────────────────────

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetReport | None:
        stmt = select(AstAssetReport).where(
            AstAssetReport.id == row_id,
            AstAssetReport.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetReport, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        items, _ = self.search(
            ctx,
            AssetReportListFilters(company_id=company_id),
            offset=0,
            limit=10_000,
        )
        return items

    def search(
        self,
        ctx: TenantContext,
        filters: AssetReportListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstAssetReport], int]:
        stmt = select(AstAssetReport).where(
            AstAssetReport.company_id == filters.company_id,
            AstAssetReport.is_deleted.is_(False),
        )
        if filters.report_type is not None:
            stmt = stmt.where(AstAssetReport.report_type == filters.report_type)
        if filters.status is not None:
            stmt = stmt.where(AstAssetReport.status == filters.status)
        if filters.category_id is not None:
            stmt = stmt.where(AstAssetReport.category_id == filters.category_id)
        if filters.department_id is not None:
            stmt = stmt.where(AstAssetReport.department_id == filters.department_id)
        if filters.branch_id is not None:
            stmt = stmt.where(AstAssetReport.branch_id == filters.branch_id)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstAssetReport.report_code.ilike(term),
                    AstAssetReport.report_type.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstAssetReport, ctx, branch_scoped=False)
        total = int(self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
        sort_col = SORT_COLUMNS.get(filters.sort, AstAssetReport.generated_at)
        rows = list(
            self.db.scalars(stmt.order_by(sort_col.desc()).offset(offset).limit(limit)).all()
        )
        return rows, total

    def create(self, ctx: TenantContext, **fields) -> AstAssetReport:
        row = AstAssetReport(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstAssetReport | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected_version = fields.pop("version", None)
        if expected_version is not None and int(row.version or 0) != int(expected_version):
            raise ConflictException(
                "Asset report has been modified by another user; reload and retry"
            )
        for key, value in fields.items():
            if value is not None or key in {
                "branch_id",
                "department_id",
                "category_id",
                "period_start",
                "period_end",
                "metrics_json",
                "generated_at",
            }:
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row

    # ── Read aggregations (operational tables — SELECT only) ──────────

    def _asset_base(self, ctx: TenantContext, filters: LiveReportFilters):
        stmt = select(AstAsset).where(
            AstAsset.company_id == filters.company_id,
            AstAsset.is_deleted.is_(False),
        )
        if filters.branch_id is not None:
            stmt = stmt.where(AstAsset.branch_id == filters.branch_id)
        if filters.category_id is not None:
            stmt = stmt.where(AstAsset.asset_category_id == filters.category_id)
        if filters.department_id is not None:
            stmt = stmt.where(AstAsset.department_id == filters.department_id)
        if filters.status is not None:
            stmt = stmt.where(AstAsset.status == filters.status)
        return self.apply_ast_filter(stmt, AstAsset, ctx, branch_scoped=False)

    def count_assets_by_status(
        self, ctx: TenantContext, filters: LiveReportFilters
    ) -> dict[str, int]:
        stmt = (
            select(AstAsset.status, func.count())
            .where(
                AstAsset.company_id == filters.company_id,
                AstAsset.is_deleted.is_(False),
            )
        )
        if filters.branch_id is not None:
            stmt = stmt.where(AstAsset.branch_id == filters.branch_id)
        if filters.category_id is not None:
            stmt = stmt.where(AstAsset.asset_category_id == filters.category_id)
        if filters.department_id is not None:
            stmt = stmt.where(AstAsset.department_id == filters.department_id)
        stmt = self.apply_ast_filter(stmt, AstAsset, ctx, branch_scoped=False)
        stmt = stmt.group_by(AstAsset.status)
        return {str(status): int(cnt) for status, cnt in self.db.execute(stmt).all()}

    def count_active_assignments(self, ctx: TenantContext, company_id: UUID) -> int:
        stmt = select(func.count()).where(
            AstAssetAssignment.company_id == company_id,
            AstAssetAssignment.is_deleted.is_(False),
            AstAssetAssignment.status == "active",
        )
        stmt = self.apply_ast_filter(stmt, AstAssetAssignment, ctx, branch_scoped=False)
        return int(self.db.scalar(stmt) or 0)

    def group_assets_by_category(
        self, ctx: TenantContext, filters: LiveReportFilters
    ) -> list[dict[str, Any]]:
        stmt = (
            select(
                AstAsset.asset_category_id,
                AstAssetCategory.category_code,
                AstAssetCategory.category_name,
                func.count(),
            )
            .outerjoin(AstAssetCategory, AstAssetCategory.id == AstAsset.asset_category_id)
            .where(
                AstAsset.company_id == filters.company_id,
                AstAsset.is_deleted.is_(False),
            )
            .group_by(
                AstAsset.asset_category_id,
                AstAssetCategory.category_code,
                AstAssetCategory.category_name,
            )
        )
        stmt = self.apply_ast_filter(stmt, AstAsset, ctx, branch_scoped=False)
        return [
            {
                "category_id": str(cid) if cid else None,
                "category_code": code,
                "category_name": name,
                "count": int(cnt),
            }
            for cid, code, name, cnt in self.db.execute(stmt).all()
        ]

    def group_assets_by_department(
        self, ctx: TenantContext, filters: LiveReportFilters
    ) -> list[dict[str, Any]]:
        stmt = (
            select(AstAsset.department_id, func.count())
            .where(
                AstAsset.company_id == filters.company_id,
                AstAsset.is_deleted.is_(False),
            )
            .group_by(AstAsset.department_id)
        )
        stmt = self.apply_ast_filter(stmt, AstAsset, ctx, branch_scoped=False)
        return [
            {"department_id": str(did) if did else None, "count": int(cnt)}
            for did, cnt in self.db.execute(stmt).all()
        ]

    def count_expiring_warranties(
        self, ctx: TenantContext, company_id: UUID, *, horizon_days: int = DEFAULT_HORIZON_DAYS
    ) -> int:
        today = date.today()
        end = today + timedelta(days=horizon_days)
        stmt = select(func.count()).where(
            AstAssetWarranty.company_id == company_id,
            AstAssetWarranty.is_deleted.is_(False),
            AstAssetWarranty.status.in_(["active", "extended"]),
            AstAssetWarranty.end_date >= today,
            AstAssetWarranty.end_date <= end,
        )
        stmt = self.apply_ast_filter(stmt, AstAssetWarranty, ctx, branch_scoped=False)
        return int(self.db.scalar(stmt) or 0)

    def count_expiring_insurance(
        self, ctx: TenantContext, company_id: UUID, *, horizon_days: int = DEFAULT_HORIZON_DAYS
    ) -> int:
        today = date.today()
        end = today + timedelta(days=horizon_days)
        stmt = select(func.count()).where(
            AstAssetInsurance.company_id == company_id,
            AstAssetInsurance.is_deleted.is_(False),
            AstAssetInsurance.status.in_(["active", "renewed"]),
            AstAssetInsurance.end_date >= today,
            AstAssetInsurance.end_date <= end,
        )
        stmt = self.apply_ast_filter(stmt, AstAssetInsurance, ctx, branch_scoped=False)
        return int(self.db.scalar(stmt) or 0)

    def count_maintenance_open(self, ctx: TenantContext, company_id: UUID) -> int:
        stmt = select(func.count()).where(
            AstAssetMaintenance.company_id == company_id,
            AstAssetMaintenance.is_deleted.is_(False),
            AstAssetMaintenance.status.in_(
                ["draft", "submitted", "approved", "scheduled", "in_progress"]
            ),
        )
        stmt = self.apply_ast_filter(stmt, AstAssetMaintenance, ctx, branch_scoped=False)
        return int(self.db.scalar(stmt) or 0)

    def count_depreciation_by_status(
        self, ctx: TenantContext, company_id: UUID
    ) -> dict[str, int]:
        stmt = (
            select(AstAssetDepreciation.status, func.count())
            .where(
                AstAssetDepreciation.company_id == company_id,
                AstAssetDepreciation.is_deleted.is_(False),
            )
            .group_by(AstAssetDepreciation.status)
        )
        stmt = self.apply_ast_filter(stmt, AstAssetDepreciation, ctx, branch_scoped=False)
        return {str(s): int(c) for s, c in self.db.execute(stmt).all()}

    def recent_transfers(
        self, ctx: TenantContext, company_id: UUID, *, limit: int = 10
    ) -> list[dict[str, Any]]:
        stmt = (
            select(AstAssetTransfer)
            .where(
                AstAssetTransfer.company_id == company_id,
                AstAssetTransfer.is_deleted.is_(False),
            )
            .order_by(AstAssetTransfer.created_at.desc())
            .limit(limit)
        )
        stmt = self.apply_ast_filter(stmt, AstAssetTransfer, ctx, branch_scoped=False)
        rows = list(self.db.scalars(stmt).all())
        return [
            {
                "id": str(r.id),
                "asset_id": str(r.asset_id),
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]

    def recent_notifications(
        self, ctx: TenantContext, company_id: UUID, *, limit: int = 10
    ) -> list[dict[str, Any]]:
        stmt = (
            select(AstAssetNotification)
            .where(
                AstAssetNotification.company_id == company_id,
                AstAssetNotification.is_deleted.is_(False),
            )
            .order_by(AstAssetNotification.created_at.desc())
            .limit(limit)
        )
        stmt = self.apply_ast_filter(stmt, AstAssetNotification, ctx, branch_scoped=False)
        rows = list(self.db.scalars(stmt).all())
        return [
            {
                "id": str(r.id),
                "notification_type": r.notification_type,
                "delivery_status": r.delivery_status,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]

    def run_inventory(
        self,
        ctx: TenantContext,
        filters: LiveReportFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[dict[str, Any]], int]:
        stmt = self._asset_base(ctx, filters)
        total = int(self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(AstAsset.asset_code.asc()).offset(offset).limit(limit)
            ).all()
        )
        items = [
            {
                "id": str(r.id),
                "asset_code": r.asset_code,
                "asset_name": r.asset_name,
                "status": r.status,
                "category_id": str(r.asset_category_id) if r.asset_category_id else None,
                "department_id": str(r.department_id) if r.department_id else None,
                "branch_id": str(r.branch_id) if r.branch_id else None,
            }
            for r in rows
        ]
        return items, total

    def run_status_grouped(
        self,
        ctx: TenantContext,
        model,
        filters: LiveReportFilters,
        *,
        offset: int,
        limit: int,
        date_column=None,
    ) -> tuple[list[dict[str, Any]], int, dict[str, int]]:
        stmt = select(model).where(
            model.company_id == filters.company_id,
            model.is_deleted.is_(False),
        )
        if filters.branch_id is not None and hasattr(model, "branch_id"):
            stmt = stmt.where(model.branch_id == filters.branch_id)
        if filters.status is not None and hasattr(model, "status"):
            stmt = stmt.where(model.status == filters.status)
        if date_column is not None:
            if filters.period_start is not None:
                stmt = stmt.where(date_column >= filters.period_start)
            if filters.period_end is not None:
                stmt = stmt.where(date_column <= filters.period_end)
        stmt = self.apply_ast_filter(stmt, model, ctx, branch_scoped=False)
        total = int(self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
        status_stmt = (
            select(model.status, func.count())
            .where(
                model.company_id == filters.company_id,
                model.is_deleted.is_(False),
            )
            .group_by(model.status)
        )
        status_stmt = self.apply_ast_filter(status_stmt, model, ctx, branch_scoped=False)
        totals = {str(s): int(c) for s, c in self.db.execute(status_stmt).all()}
        order_col = getattr(model, "created_at", None) or getattr(model, "id")
        rows = list(
            self.db.scalars(stmt.order_by(order_col.desc()).offset(offset).limit(limit)).all()
        )
        items = []
        for r in rows:
            item: dict[str, Any] = {"id": str(r.id), "status": getattr(r, "status", None)}
            if hasattr(r, "asset_id"):
                item["asset_id"] = str(r.asset_id)
            if hasattr(r, "document_number"):
                item["document_number"] = r.document_number
            if hasattr(r, "notification_type"):
                item["notification_type"] = r.notification_type
                item["delivery_status"] = r.delivery_status
            if hasattr(r, "document_type"):
                item["document_type"] = r.document_type
                item["document_name"] = getattr(r, "document_name", None)
            if hasattr(r, "meter_type"):
                item["meter_type"] = r.meter_type
                item["reading_value"] = str(getattr(r, "reading_value", ""))
            if hasattr(r, "end_date"):
                item["end_date"] = r.end_date.isoformat() if r.end_date else None
            if hasattr(r, "policy_number"):
                item["policy_number"] = r.policy_number
            items.append(item)
        return items, total, totals

    def export_rows_for_key(
        self,
        ctx: TenantContext,
        report_key: str,
        filters: LiveReportFilters,
        *,
        limit: int = MAX_EXPORT_ROWS,
    ) -> tuple[list[dict[str, str]], list[dict[str, Any]]]:
        """Return (columns, rows) for FE CSV/XLSX."""
        items, _, _ = self._dispatch_run(ctx, report_key, filters, offset=0, limit=limit)
        if not items:
            return [{"key": "message", "label": "Message"}], [{"message": "No rows"}]
        keys = list(items[0].keys())
        columns = [{"key": k, "label": k.replace("_", " ").title()} for k in keys]
        return columns, items

    def _dispatch_run(
        self,
        ctx: TenantContext,
        report_key: str,
        filters: LiveReportFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[dict[str, Any]], int, dict[str, int]]:
        if report_key in {"asset_summary", "asset_inventory", "executive_dashboard"}:
            items, total = self.run_inventory(ctx, filters, offset=offset, limit=limit)
            by_status = self.count_assets_by_status(ctx, filters)
            return items, total, by_status
        model_map = {
            "asset_allocation": (AstAssetAssignment, None),
            "asset_transfers": (AstAssetTransfer, None),
            "asset_maintenance": (AstAssetMaintenance, None),
            "maintenance_due": (AstAssetMaintenance, None),
            "warranty_expiry": (AstAssetWarranty, AstAssetWarranty.end_date),
            "insurance_expiry": (AstAssetInsurance, AstAssetInsurance.end_date),
            "asset_depreciation": (AstAssetDepreciation, None),
            "asset_disposal": (AstAssetDisposal, None),
            "asset_documents": (AstAssetDocument, None),
            "asset_checklists": (AstAssetChecklist, None),
            "asset_meter_readings": (AstAssetMeterReading, None),
            "asset_notifications": (AstAssetNotification, None),
        }
        model, date_col = model_map.get(report_key, (AstAsset, None))
        if model is AstAsset:
            items, total = self.run_inventory(ctx, filters, offset=offset, limit=limit)
            return items, total, {"row_count": total}
        return self.run_status_grouped(
            ctx, model, filters, offset=offset, limit=limit, date_column=date_col
        )

    def run_report(
        self,
        ctx: TenantContext,
        report_key: str,
        filters: LiveReportFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[dict[str, Any]], int, dict[str, int]]:
        return self._dispatch_run(ctx, report_key, filters, offset=offset, limit=limit)

    def build_dashboard_raw(
        self, ctx: TenantContext, filters: LiveReportFilters, *, horizon_days: int = DEFAULT_HORIZON_DAYS
    ) -> dict[str, Any]:
        by_status = self.count_assets_by_status(ctx, filters)
        total_assets = sum(by_status.values())
        assigned = self.count_active_assignments(ctx, filters.company_id)
        active = by_status.get("active", 0)
        disposed = by_status.get("disposed", 0) + by_status.get("written_off", 0)
        in_maint = by_status.get("in_maintenance", 0)
        available = max(active - assigned, 0)
        maint_due = self.count_maintenance_open(ctx, filters.company_id)
        warranty = self.count_expiring_warranties(
            ctx, filters.company_id, horizon_days=horizon_days
        )
        insurance = self.count_expiring_insurance(
            ctx, filters.company_id, horizon_days=horizon_days
        )
        dep = self.count_depreciation_by_status(ctx, filters.company_id)
        return {
            "kpis": {
                "asset_count": total_assets,
                "assigned_assets": assigned,
                "available_assets": available,
                "maintenance_due": maint_due,
                "warranty_expiry": warranty,
                "insurance_expiry": insurance,
                "disposed_assets": disposed,
                "in_maintenance": in_maint,
            },
            "by_category": self.group_assets_by_category(ctx, filters),
            "by_department": self.group_assets_by_department(ctx, filters),
            "recent_transfers": self.recent_transfers(ctx, filters.company_id),
            "recent_notifications": self.recent_notifications(ctx, filters.company_id),
            "depreciation_summary": dep,
            "health": {
                "pct_in_maintenance": round((in_maint / total_assets) * 100, 1)
                if total_assets
                else 0.0,
                "open_maintenance": maint_due,
                "policies_expiring": warranty + insurance,
                "status_breakdown": by_status,
            },
        }
