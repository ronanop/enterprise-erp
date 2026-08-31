"""Asset report request validation (FP-ASSET-018)."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.domain.enums import (
    LIVE_TO_SNAPSHOT_TYPE,
    AssetLiveReportKey,
    AssetReportSnapshotType,
    AssetReportStatus,
)
from modules.asset.domain.exceptions import ReportValidationError
from modules.asset.models import AstAssetReport
from modules.foundation.domain.value_objects import TenantContext

LIVE_REPORT_KEYS = frozenset(k.value for k in AssetLiveReportKey)
SNAPSHOT_TYPES = frozenset(t.value for t in AssetReportSnapshotType)
MAX_EXPORT_ROWS = 5_000
MAX_PAGE_SIZE = 100
DEFAULT_HORIZON_DAYS = 30

REPORT_CATALOG: list[dict[str, str]] = [
    {"key": "asset_summary", "title": "Asset Summary", "category": "register"},
    {"key": "asset_inventory", "title": "Asset Inventory / Register", "category": "register"},
    {"key": "asset_allocation", "title": "Asset Allocation", "category": "custody"},
    {"key": "asset_transfers", "title": "Asset Transfers", "category": "custody"},
    {"key": "asset_maintenance", "title": "Asset Maintenance", "category": "maintenance"},
    {"key": "maintenance_due", "title": "Maintenance Due", "category": "maintenance"},
    {"key": "warranty_expiry", "title": "Warranty Expiry", "category": "policies"},
    {"key": "insurance_expiry", "title": "Insurance Expiry", "category": "policies"},
    {"key": "asset_depreciation", "title": "Asset Depreciation", "category": "valuation"},
    {"key": "asset_disposal", "title": "Asset Disposal", "category": "valuation"},
    {"key": "asset_documents", "title": "Asset Documents", "category": "collaboration"},
    {"key": "asset_checklists", "title": "Asset Checklists", "category": "collaboration"},
    {"key": "asset_meter_readings", "title": "Meter Readings", "category": "collaboration"},
    {"key": "asset_notifications", "title": "Asset Notifications", "category": "collaboration"},
    {"key": "executive_dashboard", "title": "Executive Dashboard", "category": "dashboard"},
]


class ReportValidator:
    def __init__(self, db: Session) -> None:
        self._db = db

    def validate_report_key(self, report_key: str) -> str:
        key = str(report_key or "").strip()
        if key not in LIVE_REPORT_KEYS:
            raise ReportValidationError(f"Unknown report_key: {report_key}")
        return key

    def validate_run_filters(
        self,
        *,
        period_start: date | None,
        period_end: date | None,
        page_size: int | None = None,
        export: bool = False,
        limit: int | None = None,
    ) -> None:
        if period_start is not None and period_end is not None and period_start > period_end:
            raise ReportValidationError("period_start must be on or before period_end")
        if page_size is not None and (page_size < 1 or page_size > MAX_PAGE_SIZE):
            raise ReportValidationError(f"page_size must be between 1 and {MAX_PAGE_SIZE}")
        if export and limit is not None and limit > MAX_EXPORT_ROWS:
            raise ReportValidationError(f"Export limited to {MAX_EXPORT_ROWS} rows")

    def validate_generate_fields(self, fields: dict) -> str:
        report_key = self.validate_report_key(fields.get("report_key") or fields.get("report_type", ""))
        period_start = fields.get("period_start")
        period_end = fields.get("period_end")
        self.validate_run_filters(period_start=period_start, period_end=period_end)
        return report_key

    def snapshot_type_for_key(self, report_key: str) -> str:
        mapped = LIVE_TO_SNAPSHOT_TYPE.get(report_key)
        if mapped is None or mapped not in SNAPSHOT_TYPES:
            raise ReportValidationError(f"No snapshot type mapping for report_key: {report_key}")
        return mapped

    def validate_update_fields(self, row: AstAssetReport, fields: dict) -> None:
        if row.status != AssetReportStatus.DRAFT.value:
            raise ReportValidationError("Only draft snapshots can be updated")
        if "status" in fields and fields["status"] is not None and fields["status"] != row.status:
            raise ReportValidationError("status cannot be changed via update; use finalize")
        if "report_type" in fields and fields["report_type"] is not None:
            raise ReportValidationError("report_type cannot be changed")
        if "metrics_json" in fields and fields["metrics_json"] is not None:
            raise ReportValidationError("metrics_json cannot be changed via update; regenerate")
        period_start = fields.get("period_start", row.period_start)
        period_end = fields.get("period_end", row.period_end)
        self.validate_run_filters(period_start=period_start, period_end=period_end)

    def validate_finalize_readiness(self, ctx: TenantContext, row: AstAssetReport) -> None:
        if row.status != AssetReportStatus.DRAFT.value:
            raise ReportValidationError("Only draft snapshots can be finalized")
        if not row.metrics_json:
            raise ReportValidationError("Cannot finalize a snapshot without metrics_json")
