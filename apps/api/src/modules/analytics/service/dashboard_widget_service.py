"""DashboardWidgetService application service."""

from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException, ValidationException
from modules.analytics.models import BiDashboardWidget
from modules.analytics.repository.dashboard_repository import DashboardRepository
from modules.analytics.repository.dashboard_widget_repository import DashboardWidgetRepository
from modules.analytics.repository.kpi_repository import KpiRepository
from modules.analytics.service.analytics_scope_validator import AnalyticsScopeValidator
from modules.analytics.service.engines import DashboardWidgetEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

_WIDGET_CREATE_FIELDS = {
    "dashboard_id",
    "widget_code",
    "widget_title",
    "widget_type",
    "kpi_id",
    "metric_id",
    "report_id",
    "dataset_id",
    "config_json",
    "sequence_no",
    "status",
    "branch_id",
}
_VALID_WIDGET_TYPES = {"kpi_tile", "chart", "table", "gauge", "map", "text", "iframe"}


class DashboardWidgetService:
    def __init__(self, db: Session) -> None:
        self._repo = DashboardWidgetRepository(db)
        self._dashboards = DashboardRepository(db)
        self._kpis = KpiRepository(db)
        self._scope = AnalyticsScopeValidator(db)
        self._engine = DashboardWidgetEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> BiDashboardWidget:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("DashboardWidgetService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id or fields.pop("company_id", None))
        payload = {k: v for k, v in fields.items() if k in _WIDGET_CREATE_FIELDS}
        dashboard_id = payload.get("dashboard_id")
        if dashboard_id is None:
            raise ValidationException("dashboard_id is required")
        dashboard = self._dashboards.get(ctx, dashboard_id)
        if dashboard is None:
            raise NotFoundException("Dashboard not found")
        title = str(payload.get("widget_title") or "").strip()
        if not title:
            raise ValidationException("Widget title is required")
        payload["widget_title"] = title
        widget_type = payload.get("widget_type") or "kpi_tile"
        if widget_type not in _VALID_WIDGET_TYPES:
            raise ValidationException("Invalid widget_type")
        payload["widget_type"] = widget_type
        kpi_id = payload.get("kpi_id")
        if kpi_id is not None and self._kpis.get(ctx, kpi_id) is None:
            raise NotFoundException("KPI not found")
        code = str(payload.get("widget_code") or "").strip().upper()
        if not code:
            code = f"WGT-{uuid4().hex[:8].upper()}"
        payload["widget_code"] = code[:50]
        siblings = self._repo.list_by_dashboard(ctx, dashboard_id)
        if payload.get("sequence_no") is None:
            payload["sequence_no"] = max((w.sequence_no for w in siblings), default=-1) + 1
        payload.setdefault("status", "active")
        row = self._repo.create(ctx, company_id=cid, **payload)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="bi_dashboard_widget",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("DashboardWidgetService not found")
        return row
