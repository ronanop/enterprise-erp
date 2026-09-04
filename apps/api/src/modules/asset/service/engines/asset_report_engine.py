"""AssetReportEngine — aggregation shaping and snapshot finalize (FP-ASSET-018).

No persistence. No HTTP. No writes to operational tables.
"""

from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from modules.asset.domain.enums import AssetReportStatus
from modules.asset.domain.exceptions import InvalidAssetReportState
from modules.asset.repository.base import utcnow
from modules.asset.service.report_validator import DEFAULT_HORIZON_DAYS


class AssetReportEngine:
    def finalize(self, row) -> None:
        if row.status != AssetReportStatus.DRAFT.value:
            raise InvalidAssetReportState("Only draft reports can be finalized")
        row.status = AssetReportStatus.FINALIZED.value

    def build_metrics(
        self,
        report_key: str,
        *,
        dashboard: dict[str, Any] | None = None,
        rows: list[dict[str, Any]] | None = None,
        totals: dict[str, Any] | None = None,
        filters: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            "report_key": report_key,
            "generated_at": utcnow().isoformat(),
            "filters": filters or {},
            "totals": totals or {},
            "rows": rows or [],
            "dashboard": dashboard,
        }

    def shape_dashboard(
        self,
        *,
        kpis: dict[str, int],
        by_category: list[dict[str, Any]],
        by_department: list[dict[str, Any]],
        recent_transfers: list[dict[str, Any]],
        recent_notifications: list[dict[str, Any]],
        health: dict[str, Any],
        horizon_days: int = DEFAULT_HORIZON_DAYS,
    ) -> dict[str, Any]:
        return {
            "generated_at": utcnow().isoformat(),
            "horizon_days": horizon_days,
            "kpis": kpis,
            "by_category": by_category,
            "by_department": by_department,
            "recent_transfers": recent_transfers,
            "recent_notifications": recent_notifications,
            "health": health,
        }

    def shape_run_result(
        self,
        report_key: str,
        *,
        items: list[dict[str, Any]],
        total: int,
        page: int,
        page_size: int,
        totals: dict[str, Any] | None = None,
        filters: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            "report_key": report_key,
            "generated_at": utcnow().isoformat(),
            "filters": filters or {},
            "totals": totals or {"row_count": total},
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    def shape_export(
        self,
        report_key: str,
        *,
        columns: list[dict[str, str]],
        rows: list[dict[str, Any]],
        filters: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            "report_key": report_key,
            "generated_at": utcnow().isoformat(),
            "format_hints": ["csv", "xlsx"],
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
            "filters": filters or {},
        }

    @staticmethod
    def filter_dict(
        *,
        company_id: UUID,
        branch_id: UUID | None = None,
        category_id: UUID | None = None,
        department_id: UUID | None = None,
        period_start: date | None = None,
        period_end: date | None = None,
        status: str | None = None,
    ) -> dict[str, Any]:
        return {
            "company_id": str(company_id),
            "branch_id": str(branch_id) if branch_id else None,
            "category_id": str(category_id) if category_id else None,
            "department_id": str(department_id) if department_id else None,
            "period_start": period_start.isoformat() if period_start else None,
            "period_end": period_end.isoformat() if period_end else None,
            "status": status,
        }
