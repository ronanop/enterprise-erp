"""Sales governance - workflow, audit, notifications."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.workflow_repository import WorkflowRepository
from modules.foundation.service.audit_service import AuditService
from modules.foundation.service.notification_service import NotificationService
from modules.foundation.service.workflow_service import WorkflowService
from modules.sales.domain.enums import WORKFLOW_CODES


class SalesGovernanceService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._workflow = WorkflowService(db)
        self._workflow_repo = WorkflowRepository(db)
        self._audit = AuditService(db)
        self._notifications = NotificationService(db)

    def submit_for_approval(
        self,
        ctx: TenantContext,
        *,
        entity_name: str,
        entity_id: UUID,
    ):
        workflow_code = WORKFLOW_CODES.get(entity_name)
        if workflow_code is None:
            raise NotFoundException("No workflow configured for this entity")
        definition = self._workflow_repo.get_definition_by_code(ctx.tenant_id, workflow_code)
        if definition is None:
            raise NotFoundException("Workflow definition not found")
        instance = self._workflow.create_instance(
            tenant_id=ctx.tenant_id,
            workflow_id=definition.id,
            entity_name=entity_name,
            entity_id=entity_id,
            started_by=ctx.user_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=entity_name,
            entity_id=entity_id,
            operation="submit",
            performed_by=ctx.user_id,
        )
        return instance

    def approve(
        self,
        ctx: TenantContext,
        *,
        instance_id: UUID,
        entity_name: str,
        entity_id: UUID,
        on_approved,
    ):
        instance = self._workflow.approve(
            tenant_id=ctx.tenant_id,
            instance_id=instance_id,
            performed_by=ctx.user_id,
        )
        if instance.status == WorkflowStatus.APPROVED:
            on_approved()
            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name=entity_name,
                entity_id=entity_id,
                operation="approve",
                performed_by=ctx.user_id,
            )
            self._notify(ctx, entity_name, entity_id, "approved")
        return instance

    def reject(
        self,
        ctx: TenantContext,
        *,
        instance_id: UUID,
        entity_name: str,
        entity_id: UUID,
        on_rejected,
    ):
        instance = self._workflow.reject(
            tenant_id=ctx.tenant_id,
            instance_id=instance_id,
            performed_by=ctx.user_id,
        )
        on_rejected()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=entity_name,
            entity_id=entity_id,
            operation="reject",
            performed_by=ctx.user_id,
        )
        return instance

    def _notify(
        self, ctx: TenantContext, entity_name: str, entity_id: UUID, event: str
    ) -> None:
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=entity_name,
            entity_id=entity_id,
            operation=f"notify_{event}",
            performed_by=ctx.user_id,
        )
