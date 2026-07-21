"""My Jobs — team-routed approval task service.

Raised by the sales blueprint whenever a record needs to be "sent for
approval to {Team}" (product rule #8). Deciding a task (approve/reject)
resumes the originating blueprint transition via a small dispatch table so
the approval workflow stays decoupled from the entity-specific services.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.crm.domain.enums import APPROVAL_TEAM_ROLES, CrmEntityType
from modules.crm.models import CrmApprovalTask
from modules.crm.repository.approval_task_repository import ApprovalTaskRepository
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import DocumentNumberService
from modules.foundation.domain.value_objects import TenantContext


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Maps the approve-action stored on a task to its corresponding reject action,
# so a single "action" field on CrmApprovalTask can resume either outcome.
_REJECT_ACTION_MAP = {
    "approve_boq": "reject_boq",
    "approve_po": "reject_po",
    "approve_internally": "reject_internally",
    "approve": "reject",
}


class ApprovalTaskService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ApprovalTaskRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)

    def list(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        team_role: str | None = None,
        status: str | None = None,
        my_tasks_only: bool = False,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        assigned_user_id = ctx.user_id if my_tasks_only else None
        return self._repo.list_tasks(
            ctx,
            cid,
            team_role=team_role,
            status=status,
            assigned_user_id=assigned_user_id,
            entity_type=entity_type,
            entity_id=entity_id,
        )

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmApprovalTask:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("My Jobs task not found")
        return row

    def create_task(
        self,
        ctx: TenantContext,
        *,
        title: str,
        entity_type: str,
        entity_id: UUID,
        team_role: str,
        action: str,
        company_id: UUID,
        branch_id: UUID,
        assigned_user_id: UUID | None = None,
        assigned_role: str | None = None,
        remarks: str | None = None,
        priority: str = "normal",
    ) -> CrmApprovalTask:
        if team_role not in APPROVAL_TEAM_ROLES:
            raise ConflictException(f"Unknown approval team role '{team_role}'")
        code = self._numbers.generate(CrmEntityType.APPROVAL_TASK, company_id, CrmApprovalTask, "task_code")
        task = self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            task_code=code,
            title=title,
            entity_type=entity_type,
            entity_id=entity_id,
            team_role=team_role,
            assigned_role=assigned_role,
            assigned_user_id=assigned_user_id,
            status="pending",
            requested_by=ctx.user_id,
            remarks=remarks,
            priority=priority,
            action=action,
        )
        self._send_notification_stub(task)
        return task

    def _send_notification_stub(self, task: CrmApprovalTask) -> None:
        """Notification-engine stub: mark as dispatched.

        A production build would enqueue a notification-service message
        here; the demo build simply records that notification "was sent".
        """
        task.notification_sent = True
        self._db.flush()

    def decide(
        self,
        ctx: TenantContext,
        task_id: UUID,
        *,
        decision: str,
        remark: str | None = None,
    ) -> CrmApprovalTask:
        if decision not in {"approved", "rejected"}:
            raise ConflictException("decision must be 'approved' or 'rejected'")
        task = self.get(ctx, task_id)
        if task.status != "pending":
            raise ConflictException(f"Task {task.task_code} has already been decided")

        task = self._repo.update(
            ctx,
            task_id,
            status=decision,
            decision_remark=remark,
            decided_at=utcnow(),
            decided_by=ctx.user_id,
        )
        self._resume(ctx, task, decision)
        return task

    def _resume(self, ctx: TenantContext, task: CrmApprovalTask, decision: str) -> None:
        action = task.action if decision == "approved" else _REJECT_ACTION_MAP.get(task.action or "", None)
        if not action:
            return

        if task.entity_type == "opportunity":
            from modules.crm.service.blueprint_service import OpportunityBlueprintService

            OpportunityBlueprintService(self._db).perform_action(ctx, task.entity_id, action, {})
        elif task.entity_type == "quote":
            from modules.crm.service.quote_service import QuoteService

            QuoteService(self._db).apply_blueprint_action(ctx, task.entity_id, action, {})
        elif task.entity_type == "ovf":
            from modules.crm.service.ovf_service import OvfService

            OvfService(self._db).apply_blueprint_action(ctx, task.entity_id, action, {})
