"""DashboardService."""

import re
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException, ValidationException
from modules.analytics.domain.enums import AnalyticsEntityType
from modules.analytics.models import BiDashboard
from modules.analytics.repository.base import utcnow
from modules.analytics.repository.dashboard_repository import DashboardRepository
from modules.analytics.service.analytics_number_service import AnalyticsNumberService
from modules.analytics.service.analytics_scope_validator import AnalyticsScopeValidator
from modules.analytics.service.engines import DashboardEngine
from modules.analytics.service.owner_resolver import resolve_owner_employee_id
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

_DASHBOARD_CREATE_FIELDS = {
    "dashboard_code",
    "dashboard_name",
    "dashboard_type",
    "audience_role",
    "owner_employee_id",
    "department_id",
    "layout_json",
    "is_default",
    "status",
    "branch_id",
}
_DASHBOARD_UPDATE_FIELDS = {
    "dashboard_name",
    "dashboard_type",
    "audience_role",
    "is_default",
}
_VALID_DASHBOARD_TYPES = {"executive", "operational", "self_service"}


class DashboardService:
    def __init__(self, db: Session) -> None:
        self._repo = DashboardRepository(db)
        self._scope = AnalyticsScopeValidator(db)
        self._numbers = AnalyticsNumberService(db)
        self._engine = DashboardEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> BiDashboard:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("DashboardService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id or fields.pop("company_id", None))
        payload = {k: v for k, v in fields.items() if k in _DASHBOARD_CREATE_FIELDS}
        name = str(payload.get("dashboard_name") or "").strip()
        if not name:
            raise ValidationException("Dashboard name is required")
        payload["dashboard_name"] = name
        dash_type = payload.get("dashboard_type") or "operational"
        if dash_type not in _VALID_DASHBOARD_TYPES:
            raise ValidationException("dashboard_type must be executive, operational, or self_service")
        payload["dashboard_type"] = dash_type
        code = str(payload.get("dashboard_code") or "").strip().upper()
        if not code:
            slug = re.sub(r"[^A-Z0-9]+", "-", name.upper()).strip("-") or "DASH"
            code = slug[:50]
            if self._repo.code_exists(ctx, cid, code):
                code = f"{slug[:43]}-{uuid4().hex[:6].upper()}"[:50]
        payload["dashboard_code"] = code
        if self._repo.code_exists(ctx, cid, payload["dashboard_code"]):
            raise ValidationException(f"Dashboard code already exists: {payload['dashboard_code']}")
        payload["owner_employee_id"] = resolve_owner_employee_id(
            self._repo.db, ctx, cid, payload.get("owner_employee_id")
        )
        payload.setdefault("status", "draft")
        payload.setdefault("is_default", False)
        doc = self._numbers.generate(AnalyticsEntityType.DASHBOARD, cid, BiDashboard, "dashboard_number")
        return self._repo.create(ctx, company_id=cid, dashboard_number=doc, **payload)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        payload = {k: v for k, v in fields.items() if k in _DASHBOARD_UPDATE_FIELDS}
        if "dashboard_name" in payload and payload["dashboard_name"] is not None:
            name = str(payload["dashboard_name"]).strip()
            if not name:
                raise ValidationException("Dashboard name is required")
            payload["dashboard_name"] = name
        if payload.get("dashboard_type") and payload["dashboard_type"] not in _VALID_DASHBOARD_TYPES:
            raise ValidationException("dashboard_type must be executive, operational, or self_service")
        row = self._repo.update(ctx, row_id, **payload)
        if row is None:
            raise NotFoundException("DashboardService not found")
        return row

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.approve(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def publish(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.publish(row)
        return self._repo.update(ctx, row_id, status=row.status, published_at=utcnow())

