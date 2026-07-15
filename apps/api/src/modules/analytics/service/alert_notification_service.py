"""AlertNotificationService application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.analytics.models import BiAlertNotification
from modules.analytics.repository.alert_notification_repository import AlertNotificationRepository
from modules.analytics.service.analytics_scope_validator import AnalyticsScopeValidator
from modules.analytics.service.engines import AlertNotificationEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class AlertNotificationService:
    def __init__(self, db: Session) -> None:
        self._repo = AlertNotificationRepository(db)
        self._scope = AnalyticsScopeValidator(db)
        self._engine = AlertNotificationEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> BiAlertNotification:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("AlertNotificationService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        row = self._repo.create(ctx, company_id=cid, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="bi_alert_notification",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("AlertNotificationService not found")
        return row

    def acknowledge(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.acknowledge(row)
        return self._repo.update(ctx, row_id, status=row.status, delivery_status=row.delivery_status)
