"""KpiService."""

from __future__ import annotations

import re
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException, ValidationException
from modules.analytics.domain.enums import AnalyticsEntityType, SourceKpiKey
from modules.analytics.domain.exceptions import UnknownKpiSource
from modules.analytics.models import BiKpi
from modules.analytics.repository.kpi_repository import KpiRepository
from modules.analytics.service.analytics_number_service import AnalyticsNumberService
from modules.analytics.service.analytics_scope_validator import AnalyticsScopeValidator
from modules.analytics.service.engines import KpiEngine
from modules.analytics.service.integration_service import AnalyticsIntegrationService
from modules.analytics.service.kpi_snapshot_service import KpiDailySnapshotService
from modules.analytics.service.owner_resolver import resolve_owner_employee_id
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

_KPI_CREATE_FIELDS = {
    "kpi_code",
    "kpi_name",
    "owner_employee_id",
    "department_id",
    "target_value",
    "warning_threshold",
    "critical_threshold",
    "direction",
    "period_grain",
    "source_kpi_key",
    "status",
    "metric_id",
    "branch_id",
}
_KPI_UPDATE_FIELDS = {
    "kpi_name",
    "target_value",
    "warning_threshold",
    "critical_threshold",
    "direction",
    "period_grain",
    "source_kpi_key",
}
_VALID_DIRECTIONS = {"higher_better", "lower_better"}
_VALID_GRAINS = {"day", "week", "month", "quarter", "year"}
_SOURCE_KEYS = {item.value for item in SourceKpiKey}


class KpiService:
    def __init__(self, db: Session) -> None:
        self._repo = KpiRepository(db)
        self._scope = AnalyticsScopeValidator(db)
        self._numbers = AnalyticsNumberService(db)
        self._engine = KpiEngine()
        self._audit = AuditService(db)
        self._integration = AnalyticsIntegrationService(db)
        self._snapshots = KpiDailySnapshotService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> BiKpi:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("KpiService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id or fields.pop("company_id", None))
        payload = {k: v for k, v in fields.items() if k in _KPI_CREATE_FIELDS}
        name = str(payload.get("kpi_name") or "").strip()
        if not name:
            raise ValidationException("KPI name is required")
        payload["kpi_name"] = name
        source = str(payload.get("source_kpi_key") or "").strip() or None
        if source:
            self._validate_source_key(source)
        payload["source_kpi_key"] = source
        code = str(payload.get("kpi_code") or "").strip().upper()
        if not code:
            code = self._unique_kpi_code(ctx, cid, source or name)
        payload["kpi_code"] = code[:50]
        if self._repo.code_exists(ctx, cid, payload["kpi_code"]):
            raise ValidationException(f"KPI code already exists: {payload['kpi_code']}")
        direction = payload.get("direction")
        if direction and direction not in _VALID_DIRECTIONS:
            raise ValidationException("direction must be higher_better or lower_better")
        grain = payload.get("period_grain")
        if grain and grain not in _VALID_GRAINS:
            raise ValidationException("Invalid period_grain")
        payload["owner_employee_id"] = resolve_owner_employee_id(
            self._repo.db, ctx, cid, payload.get("owner_employee_id")
        )
        payload.setdefault("status", "draft")
        payload.setdefault("direction", "higher_better")
        payload.setdefault("period_grain", "month")
        doc = self._numbers.generate(AnalyticsEntityType.KPI, cid, BiKpi, "kpi_number")
        return self._repo.create(ctx, company_id=cid, kpi_number=doc, **payload)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        payload = {k: v for k, v in fields.items() if k in _KPI_UPDATE_FIELDS}
        if "kpi_name" in payload and payload["kpi_name"] is not None:
            name = str(payload["kpi_name"]).strip()
            if not name:
                raise ValidationException("KPI name is required")
            payload["kpi_name"] = name
        if "source_kpi_key" in payload:
            source = str(payload["source_kpi_key"] or "").strip() or None
            if source:
                self._validate_source_key(source)
            payload["source_kpi_key"] = source
        if payload.get("direction") and payload["direction"] not in _VALID_DIRECTIONS:
            raise ValidationException("direction must be higher_better or lower_better")
        if payload.get("period_grain") and payload["period_grain"] not in _VALID_GRAINS:
            raise ValidationException("Invalid period_grain")
        row = self._repo.update(ctx, row_id, **payload)
        if row is None:
            raise NotFoundException("KpiService not found")
        return row

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.approve(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def compute_current_value(self, ctx: TenantContext, row_id: UUID) -> BiKpi:
        row = self.get(ctx, row_id)
        total, _breakdown = self._aggregate(ctx, row)
        return self._repo.update(ctx, row_id, current_value=Decimal(total))

    def get_detail(self, ctx: TenantContext, row_id: UUID) -> dict:
        row = self.get(ctx, row_id)
        total, breakdown = self._aggregate(ctx, row)
        current = row.current_value
        if current is None:
            current = Decimal(total)
        history = []
        snapshots = getattr(self, "_snapshots", None)
        if snapshots is not None:
            history = snapshots.history_for_kpi(ctx, row.company_id, row.id)
        return {
            "kpi_code": row.kpi_code,
            "current_value": current,
            "target_value": row.target_value,
            "breakdown": breakdown,
            "history": history,
        }

    def _aggregate(self, ctx: TenantContext, row: BiKpi) -> tuple[int, list[dict]]:
        key = (row.source_kpi_key or "").strip()
        company_id = row.company_id
        if key == SourceKpiKey.ORG_HEADCOUNT_BY_DEPARTMENT.value:
            return self._integration.headcount_by_department(ctx, company_id)
        if key == SourceKpiKey.MASTER_ACTIVE_CUSTOMERS.value:
            return self._integration.count_active_customers(ctx, company_id), []
        if key == SourceKpiKey.MASTER_ACTIVE_VENDORS.value:
            return self._integration.count_active_vendors(ctx, company_id), []
        if key == SourceKpiKey.FINANCE_TOTAL_REVENUE.value:
            return self._integration.get_total_revenue(ctx, company_id)
        if key == SourceKpiKey.FINANCE_CASH_POSITION.value:
            return self._integration.get_cash_position(ctx, company_id)
        if key == SourceKpiKey.FINANCE_AR_AGING_TOTAL.value:
            return self._integration.get_ar_aging(ctx, company_id)
        if key == SourceKpiKey.FINANCE_AP_AGING_TOTAL.value:
            return self._integration.get_ap_aging(ctx, company_id)
        if key == SourceKpiKey.SALES_INVOICE_COUNT.value:
            return self._integration.sales_invoice_count(ctx, company_id)
        if key == SourceKpiKey.SALES_ORDER_COUNT.value:
            return self._integration.sales_order_count(ctx, company_id)
        if key == SourceKpiKey.SALES_INVOICED_TOTAL.value:
            return self._integration.sales_invoiced_total(ctx, company_id)
        if key == SourceKpiKey.INVENTORY_ON_HAND_QTY.value:
            return self._integration.inventory_on_hand_qty(ctx, company_id)
        if key == SourceKpiKey.INVENTORY_AVAILABLE_QTY.value:
            return self._integration.inventory_available_qty(ctx, company_id)
        if key == SourceKpiKey.INVENTORY_BALANCE_ROWS.value:
            return self._integration.inventory_balance_rows(ctx, company_id)
        if key == SourceKpiKey.MFG_PRODUCTION_ORDER_COUNT.value:
            return self._integration.mfg_production_order_count(ctx, company_id)
        if key == SourceKpiKey.MFG_PLANNED_QTY.value:
            return self._integration.mfg_planned_qty(ctx, company_id)
        if key == SourceKpiKey.MFG_SCRAP_COUNT.value:
            return self._integration.mfg_scrap_count(ctx, company_id)
        if key == SourceKpiKey.QUALITY_NCR_COUNT.value:
            return self._integration.quality_ncr_count(ctx, company_id)
        if key == SourceKpiKey.QUALITY_NCR_OPEN_COUNT.value:
            return self._integration.quality_ncr_open_count(ctx, company_id)
        if key == SourceKpiKey.QUALITY_INCOMING_INSPECTION_COUNT.value:
            return self._integration.quality_incoming_inspection_count(ctx, company_id)
        if key == SourceKpiKey.HELPDESK_TICKET_COUNT.value:
            return self._integration.helpdesk_ticket_count(ctx, company_id)
        if key == SourceKpiKey.HELPDESK_OPEN_TICKET_COUNT.value:
            return self._integration.helpdesk_open_ticket_count(ctx, company_id)
        if key == SourceKpiKey.HELPDESK_INCIDENT_COUNT.value:
            return self._integration.helpdesk_incident_count(ctx, company_id)
        raise UnknownKpiSource(f"Unsupported source_kpi_key: {key or '(empty)'}")

    def _validate_source_key(self, key: str) -> None:
        if key not in _SOURCE_KEYS:
            raise ValidationException(f"Unsupported source_kpi_key: {key}")

    def _unique_kpi_code(self, ctx: TenantContext, company_id: UUID, seed: str) -> str:
        slug = re.sub(r"[^A-Z0-9]+", "-", seed.upper()).strip("-") or "KPI"
        base = slug[:50]
        if not self._repo.code_exists(ctx, company_id, base):
            return base
        suffix = uuid4().hex[:6].upper()
        return f"{base[:43]}-{suffix}"[:50]
