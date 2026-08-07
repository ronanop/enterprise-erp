"""My Jobs — team-routed approval task service.

Raised by the sales blueprint whenever a record needs to be "sent for
approval to {Team}" (product rule #8). Deciding a task (approve/reject)
resumes the originating blueprint transition via a small dispatch table so
the approval workflow stays decoupled from the entity-specific services.
"""

from __future__ import annotations

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
    "approve_sow": "reject_sow",
    "approve_po": "reject_po",
    "approve_internally": "reject_internally",
    "approve": "reject",
}

_REJECT_DOC_LABEL = {
    "approve_boq": "BOQ",
    "approve_sow": "SOW",
    "approve_po": "customer PO",
    "approve_internally": "quote",
    "approve": "OVF",
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

    def route_approval(
        self,
        ctx: TenantContext,
        *,
        assigned_user_id: UUID,
        title: str,
        entity_type: str,
        entity_id: UUID,
        team_role: str,
        action: str,
        company_id: UUID,
        branch_id: UUID,
        remarks: str | None = None,
        priority: str = "normal",
    ) -> CrmApprovalTask:
        """Create a My Jobs task for the selected approver and copies for tenant admins."""
        primary = self.create_task(
            ctx,
            title=title,
            entity_type=entity_type,
            entity_id=entity_id,
            team_role=team_role,
            action=action,
            company_id=company_id,
            branch_id=branch_id,
            assigned_user_id=assigned_user_id,
            remarks=remarks,
            priority=priority,
        )
        for admin_id in self._admin_recipient_ids(ctx):
            if admin_id == assigned_user_id:
                continue
            self.create_task(
                ctx,
                title=f"{title} (Admin)",
                entity_type=entity_type,
                entity_id=entity_id,
                team_role=team_role,
                action=action,
                company_id=company_id,
                branch_id=branch_id,
                assigned_user_id=admin_id,
                remarks=remarks,
                priority=priority,
            )
        return primary

    def _admin_recipient_ids(self, ctx: TenantContext) -> list[UUID]:
        from sqlalchemy import select

        from modules.foundation.models.security import SecUser
        from security.rbac import RBACEngine

        engine = RBACEngine(self._db)
        ids: set[UUID] = set(engine.list_user_ids_with_permission(ctx.tenant_id, "crm.my_jobs:decide"))
        admin_types = ("super_admin", "tenant_admin", "company_admin")
        stmt = select(SecUser.id).where(
            SecUser.tenant_id == ctx.tenant_id,
            SecUser.is_deleted.is_(False),
            SecUser.status == "active",
            SecUser.user_type.in_(admin_types),
        )
        ids.update(self._db.scalars(stmt).all())
        return list(ids)

    def list_approval_user_options(self, ctx: TenantContext) -> list[dict]:
        from sqlalchemy import select

        from modules.foundation.models.security import SecUser
        from security.rbac import RBACEngine

        user_ids = set(RBACEngine(self._db).list_user_ids_with_crm_access(ctx.tenant_id))
        if not user_ids:
            return []
        stmt = (
            select(SecUser)
            .where(
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.id.in_(user_ids),
                SecUser.is_deleted.is_(False),
                SecUser.status == "active",
            )
            .order_by(SecUser.display_name.asc())
        )
        return [
            {"id": row.id, "display_name": row.display_name, "email": row.email}
            for row in self._db.scalars(stmt).all()
        ]

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

        self._repo.cancel_pending_siblings(
            ctx,
            task.entity_type,
            task.entity_id,
            task.action,
            except_id=task.id,
        )

        task = self._repo.update(
            ctx,
            task_id,
            status=decision,
            decision_remark=remark,
            decided_at=utcnow(),
            decided_by=ctx.user_id,
        )
        if decision == "rejected":
            self._notify_rejection(ctx, task, remark)
        self._resume(ctx, task, decision, remark)
        return task

    def _notify_rejection(
        self,
        ctx: TenantContext,
        task: CrmApprovalTask,
        remark: str | None,
    ) -> None:
        if not task.requested_by:
            return
        from modules.crm.service.crm_notification_service import notify_approval_rejected

        doc = _REJECT_DOC_LABEL.get(task.action or "", "item")
        reason = (remark or "").strip()
        body = (
            f"Your approval request was rejected"
            f"{f': {reason}' if reason else '.'} "
            f"Please re-attach the {doc} and send for approval again."
        )
        notify_approval_rejected(
            self._db,
            tenant_id=ctx.tenant_id,
            recipient_user_id=task.requested_by,
            title=f"Approval rejected — {task.title}",
            body=body,
            entity_type=task.entity_type,
            entity_id=task.entity_id,
            task_title=task.title,
            remark=reason or None,
            created_by=ctx.user_id,
        )

    def _resume(self, ctx: TenantContext, task: CrmApprovalTask, decision: str, remark: str | None = None) -> None:
        action = task.action if decision == "approved" else _REJECT_ACTION_MAP.get(task.action or "", None)
        if not action:
            return

        payload: dict = {}
        if remark:
            payload["remark"] = remark

        if task.entity_type == "opportunity":
            from modules.crm.service.blueprint_service import OpportunityBlueprintService

            OpportunityBlueprintService(self._db).perform_action(ctx, task.entity_id, action, payload)
        elif task.entity_type == "quote":
            from modules.crm.service.quote_service import QuoteService

            QuoteService(self._db).apply_blueprint_action(ctx, task.entity_id, action, payload)
        elif task.entity_type == "ovf":
            from modules.crm.service.ovf_service import OvfService

            OvfService(self._db).apply_blueprint_action(ctx, task.entity_id, action, payload)

    def list_inbox_for_user(self, ctx: TenantContext, *, limit: int = 30) -> list[dict]:
        from modules.foundation.repository.notification_repository import NotificationRepository

        if ctx.user_id is None:
            return []
        return NotificationRepository(self._db).list_events_for_recipient(
            ctx.tenant_id,
            ctx.user_id,
            event_type_prefix="crm.approval.",
            limit=limit,
        )
