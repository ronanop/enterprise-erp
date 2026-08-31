"""Asset governance — workflow, audit, notifications (FP-ASSET-WF-GOV-001)."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.workflow_codes import NOTIFICATION_TEMPLATE_CODES, WORKFLOW_CODES
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.workflow_repository import WorkflowRepository
from modules.foundation.service.audit_service import AuditService
from modules.foundation.service.notification_service import NotificationService
from modules.foundation.service.workflow_service import WorkflowService


class AssetGovernanceService:
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
        recipient_user_id: UUID | None = None,
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
        self._notify(
            ctx,
            entity_name,
            entity_id,
            "submitted",
            recipient_user_id=recipient_user_id,
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
        comments: str | None = None,
        recipient_user_id: UUID | None = None,
    ):
        instance = self._workflow.approve(
            tenant_id=ctx.tenant_id,
            instance_id=instance_id,
            performed_by=ctx.user_id,
            comments=comments,
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
            self._notify(
                ctx,
                entity_name,
                entity_id,
                "approved",
                recipient_user_id=recipient_user_id,
            )
        elif instance.status == WorkflowStatus.IN_PROGRESS:
            self._notify(
                ctx,
                entity_name,
                entity_id,
                "step_approved",
                recipient_user_id=recipient_user_id,
            )
        return instance

    def reject(
        self,
        ctx: TenantContext,
        *,
        instance_id: UUID,
        entity_name: str,
        entity_id: UUID,
        on_rejected,
        comments: str | None = None,
        recipient_user_id: UUID | None = None,
    ):
        instance = self._workflow.reject(
            tenant_id=ctx.tenant_id,
            instance_id=instance_id,
            performed_by=ctx.user_id,
            comments=comments,
        )
        on_rejected()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=entity_name,
            entity_id=entity_id,
            operation="reject",
            performed_by=ctx.user_id,
        )
        self._notify(
            ctx,
            entity_name,
            entity_id,
            "rejected",
            recipient_user_id=recipient_user_id,
        )
        return instance

    def _notify(
        self,
        ctx: TenantContext,
        entity_name: str,
        entity_id: UUID,
        event: str,
        *,
        recipient_user_id: UUID | None = None,
    ) -> None:
        template_code = NOTIFICATION_TEMPLATE_CODES.get(event)
        if template_code is None:
            return
        templates = self._notifications.list_templates(ctx.tenant_id)
        template = next(
            (
                t
                for t in templates
                if t.template_code == template_code and t.is_active
            ),
            None,
        )
        if template is None:
            return
        self._notifications.send(
            tenant_id=ctx.tenant_id,
            template_id=template.id,
            event_type=f"{entity_name}.{event}",
            recipient_user_id=recipient_user_id,
            recipient_address=None,
            payload_json={"entity_name": entity_name, "entity_id": str(entity_id)},
            created_by=ctx.user_id,
        )
