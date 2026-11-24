"""My Jobs - team-routed approval task service.

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
    "provide_boq_attachment": "reject_boq_attachment",
    "provide_sow_attachment": "reject_sow_attachment",
    "approve_po_finance": "reject_po_finance",
    "approve_po_terms": "reject_po_terms",
    "approve_po": "reject_po",
    "approve_cloud_discount": "reject_cloud_discount",
    "approve_internally": "reject_internally",
    "approve": "reject",
}

_REJECT_DOC_LABEL = {
    "approve_boq": "BOQ",
    "approve_sow": "SOW",
    "provide_boq_attachment": "BOQ",
    "provide_sow_attachment": "SOW",
    "approve_po_finance": "customer PO",
    "approve_po_terms": "customer PO terms & conditions",
    "approve_po": "customer PO",
    "approve_internally": "quote",
    "approve": "OVF",
    "provide_freight": "freight charges",
    "provide_supporting_items": "supporting items",
    "price_supporting_items": "supporting item prices",
    "provide_service_visits": "service visits",
}


class ApprovalTaskService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ApprovalTaskRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)

    def _is_crm_admin(self, ctx: TenantContext) -> bool:
        from modules.crm.service.crm_module_admin import CrmModuleAdminService

        return CrmModuleAdminService(self._db).is_admin(ctx)

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
        # ERP / CRM admins always see the full tenant inbox (every assignee,
        # every company). Session company pin must not hide jobs owned by others.
        is_admin = self._is_crm_admin(ctx)
        if is_admin:
            my_tasks_only = False

        if is_admin:
            cid = company_id  # optional narrow; None = all companies in tenant
        else:
            cid = self._scope.resolve_list_company_id(ctx, company_id)

        assigned_user_id = ctx.user_id if my_tasks_only else None
        rows = self._repo.list_tasks(
            ctx,
            cid,
            team_role=team_role,
            status=status,
            assigned_user_id=assigned_user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            tenant_wide=is_admin,
        )
        # When viewing “Assigned to me”, also surface requests I sent so the
        # requester can track open approvals - but not every Admin fan-out copy.
        if my_tasks_only and ctx.user_id is not None:
            sent = self._repo.list_tasks(
                ctx,
                cid,
                team_role=team_role,
                status=status,
                requested_by=ctx.user_id,
                entity_type=entity_type,
                entity_id=entity_id,
                tenant_wide=False,
            )
            by_id = {row.id: row for row in rows}
            for row in sent:
                if row.assigned_user_id == ctx.user_id:
                    by_id.setdefault(row.id, row)
                    continue
                # Skip Admin copies created for other recipients; keep primary tasks.
                title = (row.title or "").strip()
                if title.endswith("(Admin)"):
                    continue
                by_id.setdefault(row.id, row)
            rows = sorted(
                by_id.values(),
                key=lambda row: row.created_at or utcnow(),
                reverse=True,
            )
        return self._unique_open_tasks(rows, preferred_user_id=ctx.user_id)

    @staticmethod
    def _unique_open_tasks(
        rows: list[CrmApprovalTask],
        *,
        preferred_user_id: UUID | None,
    ) -> list[CrmApprovalTask]:
        """One inbox row per logical approval (entity + action).

        Admin fan-out creates an ``admin_copy`` per CRM/ERP admin; without
        collapsing, My Jobs shows the same work many times ("25 shown").
        Prefer the caller's own assignment, then the primary (non-admin) task,
        then the newest row.
        """

        def rank(row: CrmApprovalTask) -> tuple[int, int, datetime]:
            is_mine = 0 if preferred_user_id and row.assigned_user_id == preferred_user_id else 1
            is_admin_copy = 1 if (row.assigned_role or "") == "admin_copy" else 0
            created = row.created_at or utcnow()
            return (is_mine, is_admin_copy, created)

        best: dict[tuple[str, UUID, str], CrmApprovalTask] = {}
        for row in rows:
            key = (row.entity_type, row.entity_id, row.action or "")
            current = best.get(key)
            if current is None or rank(row) < rank(current):
                best[key] = row
        return sorted(
            best.values(),
            key=lambda row: row.created_at or utcnow(),
            reverse=True,
        )

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmApprovalTask:
        is_admin = self._is_crm_admin(ctx)
        row = self._repo.get(ctx, row_id, tenant_wide=is_admin)
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
        email_attachments: list[dict] | None = None,
    ) -> CrmApprovalTask:
        if team_role not in APPROVAL_TEAM_ROLES:
            raise ConflictException(f"Unknown approval team role '{team_role}'")
        from modules.crm.service.boq_sow_sla_service import sla_deadlines

        code = self._numbers.generate(CrmEntityType.APPROVAL_TASK, company_id, CrmApprovalTask, "task_code")
        task = self._repo.create(
            ctx,
            **sla_deadlines(action),
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
        self._send_notification_stub(task, email_attachments=email_attachments)
        return task

    def route_approval(
        self,
        ctx: TenantContext,
        *,
        assigned_user_ids: list[UUID] | None = None,
        assigned_user_id: UUID | None = None,
        title: str,
        entity_type: str,
        entity_id: UUID,
        team_role: str,
        action: str,
        company_id: UUID,
        branch_id: UUID,
        remarks: str | None = None,
        priority: str = "normal",
        email_attachments: list[dict] | None = None,
    ) -> CrmApprovalTask:
        """Create My Jobs tasks for selected approvers, CRM module admins, and ERP admins."""
        recipient_ids: list[UUID] = []
        seen: set[UUID] = set()
        for uid in assigned_user_ids or []:
            if uid in seen:
                continue
            seen.add(uid)
            recipient_ids.append(uid)
        if assigned_user_id is not None and assigned_user_id not in seen:
            recipient_ids.insert(0, assigned_user_id)
            seen.add(assigned_user_id)
        if not recipient_ids:
            raise ConflictException("Select at least one approver before sending for approval")

        # Drop prior open rows for this action so re-sends do not stack duplicates.
        self._repo.cancel_pending_siblings(
            ctx,
            entity_type,
            entity_id,
            action,
            except_id=None,
            tenant_wide=self._is_crm_admin(ctx),
        )

        primary: CrmApprovalTask | None = None
        for uid in recipient_ids:
            task = self.create_task(
                ctx,
                title=title,
                entity_type=entity_type,
                entity_id=entity_id,
                team_role=team_role,
                action=action,
                company_id=company_id,
                branch_id=branch_id,
                assigned_user_id=uid,
                remarks=remarks,
                priority=priority,
                email_attachments=email_attachments,
            )
            if primary is None:
                primary = task

        for admin_id in self._admin_recipient_ids(ctx):
            if admin_id in seen:
                continue
            seen.add(admin_id)
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
                assigned_role="admin_copy",
                remarks=remarks,
                priority=priority,
            )
        assert primary is not None
        return primary

    def _admin_recipient_ids(self, ctx: TenantContext) -> list[UUID]:
        """CRM module admins + ERP admins (by user_type) only.

        Do not use TENANT_ADMIN / SUPER_ADMIN role codes here - those roles are
        widely assigned and would fan out one task per employee.
        """
        from sqlalchemy import select

        from modules.foundation.domain.erp_modules import ADMIN_USER_TYPES
        from modules.foundation.models.security import SecUser
        from modules.foundation.repository.user_module_repository import UserModuleRepository

        modules = UserModuleRepository(self._db)
        ids: set[UUID] = set(modules.list_admin_user_ids_for_module(ctx.tenant_id, "crm"))

        erp_admin_stmt = select(SecUser.id).where(
            SecUser.tenant_id == ctx.tenant_id,
            SecUser.is_deleted.is_(False),
            SecUser.status == "active",
            SecUser.user_type.in_(tuple(ADMIN_USER_TYPES)),
        )
        ids.update(self._db.scalars(erp_admin_stmt).all())
        return list(ids)

    def list_approval_user_options(self, ctx: TenantContext) -> list[dict]:
        from modules.crm.service.crm_member_service import CrmMemberService

        return CrmMemberService(self._db).list_approval_user_options(ctx)

    def _send_notification_stub(
        self,
        task: CrmApprovalTask,
        *,
        email_attachments: list[dict] | None = None,
    ) -> None:
        """Mark dispatched and email the assignee (task + approver CTA)."""
        task.notification_sent = True
        self._db.flush()
        try:
            from modules.crm.service.crm_email_notification_service import CrmEmailNotificationService

            title = (task.title or "").strip()
            is_admin_copy = title.endswith("(Admin)") or (task.assigned_role or "") == "admin_copy"
            CrmEmailNotificationService(self._db).notify_task_assigned_and_approver(
                tenant_id=task.tenant_id,
                assignee_user_id=task.assigned_user_id,
                task_title=title or "CRM approval task",
                entity_type=task.entity_type,
                entity_id=task.entity_id,
                action=task.action,
                assigner_user_id=task.requested_by,
                priority=task.priority or "normal",
                remarks=task.remarks,
                is_admin_copy=is_admin_copy,
                attachments=email_attachments,
            )
        except Exception:  # noqa: BLE001
            pass

    def decide(
        self,
        ctx: TenantContext,
        task_id: UUID,
        *,
        decision: str,
        remark: str | None = None,
        freight: object | None = None,
        freight_medium: str | None = None,
        freight_weight_kg: object | None = None,
        freight_insurance: bool | None = None,
        supporting_items: list | None = None,
        service_plan: object | None = None,
        file_name: str | None = None,
        content_base64: str | None = None,
        content_type: str | None = None,
        file_path: str | None = None,
    ) -> CrmApprovalTask:
        if decision not in {"approved", "rejected"}:
            raise ConflictException("decision must be 'approved' or 'rejected'")
        task = self.get(ctx, task_id)
        if task.status != "pending":
            raise ConflictException(f"Task {task.task_code} has already been decided")

        if decision == "approved" and task.action == "provide_freight":
            if freight is None:
                raise ConflictException("Freight amount is required to complete this task")
        if decision == "approved" and task.action == "provide_supporting_items":
            if not supporting_items:
                raise ConflictException("Add at least one supporting item to complete this task")
        if decision == "approved" and task.action == "price_supporting_items":
            if not supporting_items:
                raise ConflictException("Enter unit prices for supporting items to complete this task")
        if decision == "approved" and task.action == "provide_service_visits":
            if service_plan is None:
                raise ConflictException("A service plan is required to complete this task")
        if decision == "approved" and task.action in {
            "provide_boq_attachment",
            "provide_sow_attachment",
        }:
            if not file_name or not (content_base64 or file_path):
                raise ConflictException("A file upload is required to complete this attachment task")

        is_admin = self._is_crm_admin(ctx)
        # Apply blueprint / side effects while the task is still pending so a
        # failure (e.g. service PO spawn) does not leave My Jobs "approved"
        # while the opportunity stays locked.
        self._resume(
            ctx,
            task,
            decision,
            remark,
            freight=freight,
            freight_medium=freight_medium,
            freight_weight_kg=freight_weight_kg,
            freight_insurance=freight_insurance,
            supporting_items=supporting_items,
            service_plan=service_plan,
            file_name=file_name,
            content_base64=content_base64,
            content_type=content_type,
            file_path=file_path,
        )
        self._repo.cancel_pending_siblings(
            ctx,
            task.entity_type,
            task.entity_id,
            task.action,
            except_id=task.id,
            tenant_wide=is_admin,
        )

        task = self._repo.update(
            ctx,
            task_id,
            tenant_wide=is_admin,
            status=decision,
            decision_remark=remark,
            decided_at=utcnow(),
            decided_by=ctx.user_id,
        )
        if decision == "rejected":
            self._notify_rejection(ctx, task, remark)
        self._notify_decision_emails(ctx, task, decision, remark)
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
            title=f"Approval rejected - {task.title}",
            body=body,
            entity_type=task.entity_type,
            entity_id=task.entity_id,
            task_title=task.title,
            remark=reason or None,
            created_by=ctx.user_id,
        )

    def _notify_decision_emails(
        self,
        ctx: TenantContext,
        task: CrmApprovalTask,
        decision: str,
        remark: str | None,
    ) -> None:
        """Email requester (owner) and original assignee about approve/reject."""
        try:
            from modules.crm.service.crm_email_notification_service import (
                CrmEmailNotificationService,
                entity_record_url,
            )
            from modules.foundation.models.security import SecUser

            status = "approved" if decision == "approved" else "rejected"
            doc = _REJECT_DOC_LABEL.get(task.action or "", "submission")
            record_title = (task.title or "").strip() or doc
            record_url = entity_record_url(task.entity_type, task.entity_id)
            mail = CrmEmailNotificationService(self._db)

            approver = self._db.get(SecUser, ctx.user_id) if ctx.user_id else None
            approver_name = (
                (approver.display_name or approver.email) if approver is not None else "Approver"
            )
            requester = self._db.get(SecUser, task.requested_by) if task.requested_by else None
            owner_name = (
                (requester.display_name or requester.email) if requester is not None else "—"
            )

            if task.requested_by:
                mail.notify_owner_approval_result(
                    tenant_id=ctx.tenant_id,
                    recipient_user_id=task.requested_by,
                    owner_name=owner_name,
                    entity_label=task.entity_type.replace("_", " ").title(),
                    record_title=record_title,
                    approval_status=status,
                    approver_name=approver_name or "—",
                    comments=remark,
                    record_url=record_url,
                    created_by=ctx.user_id,
                )

            # Attachment / provide-* tasks: notify the assignee who submitted work.
            provide_actions = {
                "provide_boq_attachment",
                "provide_sow_attachment",
                "provide_freight",
                "provide_supporting_items",
                "price_supporting_items",
                "provide_service_visits",
            }
            if task.action in provide_actions and task.assigned_user_id:
                mail.notify_assignee_submission_result(
                    tenant_id=ctx.tenant_id,
                    recipient_user_id=task.assigned_user_id,
                    document_type=doc,
                    record_title=record_title,
                    approval_status=status,
                    comments=remark,
                    record_url=record_url,
                    created_by=ctx.user_id,
                )
        except Exception:  # noqa: BLE001
            pass

    def _resume(
        self,
        ctx: TenantContext,
        task: CrmApprovalTask,
        decision: str,
        remark: str | None = None,
        *,
        freight: object | None = None,
        freight_medium: str | None = None,
        freight_weight_kg: object | None = None,
        freight_insurance: bool | None = None,
        supporting_items: list | None = None,
        service_plan: object | None = None,
        file_name: str | None = None,
        content_base64: str | None = None,
        content_type: str | None = None,
        file_path: str | None = None,
    ) -> None:
        if task.action == "provide_freight":
            if decision != "approved":
                return
            from modules.crm.service.ovf_service import OvfService
            from modules.crm.service.crm_notification_service import notify_ovf_freight_provided

            ovf = OvfService(self._db).apply_freight_from_scm(
                ctx,
                task.entity_id,
                freight=freight,
                medium=freight_medium,
                weight_kg=freight_weight_kg,
                insurance=freight_insurance,
            )
            if task.requested_by:
                amount = float(ovf.freight or 0)
                freight_txt = f"{amount:,.2f}"
                notify_ovf_freight_provided(
                    self._db,
                    tenant_id=ctx.tenant_id,
                    recipient_user_id=task.requested_by,
                    ovf_id=ovf.id,
                    ovf_no=ovf.ovf_no,
                    freight=freight_txt,
                    created_by=ctx.user_id,
                )
            return

        if task.action == "provide_supporting_items":
            if decision != "approved":
                return
            from modules.crm.service.ovf_service import OvfService
            from modules.crm.service.crm_notification_service import notify_crm_user

            items_payload: list[dict] = []
            for raw in supporting_items or []:
                if hasattr(raw, "model_dump"):
                    items_payload.append(raw.model_dump())
                elif isinstance(raw, dict):
                    items_payload.append(raw)
            ovf_svc = OvfService(self._db)
            ovf = ovf_svc.apply_supporting_items_from_ops(
                ctx, task.entity_id, items_payload
            )
            # Ops list is complete — automatically raise SCM pricing My Jobs.
            try:
                ovf_svc.request_supporting_item_prices_from_scm(
                    ctx,
                    ovf.id,
                    remarks=(
                        f"Auto-requested after Operations submitted "
                        f"{len(items_payload)} supporting item(s)."
                    ),
                )
            except ConflictException:
                # Already pending / no owners / deal won — Sales still sees items at ₹0.
                pass
            if task.requested_by:
                notify_crm_user(
                    self._db,
                    tenant_id=ctx.tenant_id,
                    recipient_user_id=task.requested_by,
                    event_type="crm.ovf.supporting_items_provided",
                    title=f"Supporting items ready - OVF {ovf.ovf_no}",
                    body=(
                        f"Operations submitted {len(items_payload)} supporting item(s) "
                        f"for OVF {ovf.ovf_no}. SCM has been asked to price them."
                    ),
                    entity_type="ovf",
                    entity_id=ovf.id,
                    href=f"/crm/ovf/{ovf.id}/edit",
                    digest_key=f"ovf:{ovf.id}:supporting_items",
                    created_by=ctx.user_id,
                )
            return

        if task.action == "price_supporting_items":
            if decision != "approved":
                return
            from modules.crm.service.ovf_service import OvfService
            from modules.crm.service.crm_notification_service import notify_crm_user

            items_payload: list[dict] = []
            for raw in supporting_items or []:
                if hasattr(raw, "model_dump"):
                    items_payload.append(raw.model_dump(mode="json"))
                elif isinstance(raw, dict):
                    items_payload.append(raw)
            ovf = OvfService(self._db).apply_supporting_item_prices_from_scm(
                ctx, task.entity_id, items_payload
            )
            if task.requested_by:
                notify_crm_user(
                    self._db,
                    tenant_id=ctx.tenant_id,
                    recipient_user_id=task.requested_by,
                    event_type="crm.ovf.supporting_item_prices_provided",
                    title=f"Supporting item prices ready - OVF {ovf.ovf_no}",
                    body=(
                        f"SCM priced {len(items_payload)} supporting item(s) "
                        f"for OVF {ovf.ovf_no}."
                    ),
                    entity_type="ovf",
                    entity_id=ovf.id,
                    href=f"/crm/ovf/{ovf.id}/edit",
                    digest_key=f"ovf:{ovf.id}:supporting_item_prices",
                    created_by=ctx.user_id,
                )
            return

        if task.action == "provide_service_visits":
            if decision != "approved":
                return
            from modules.crm.service.ovf_service import OvfService
            from modules.crm.service.crm_notification_service import notify_crm_user

            plan_payload: dict = {}
            if hasattr(service_plan, "model_dump"):
                plan_payload = service_plan.model_dump()
            elif isinstance(service_plan, dict):
                plan_payload = service_plan
            ovf = OvfService(self._db).apply_service_plan_from_ops(
                ctx, task.entity_id, plan_payload
            )
            if task.requested_by:
                notify_crm_user(
                    self._db,
                    tenant_id=ctx.tenant_id,
                    recipient_user_id=task.requested_by,
                    event_type="crm.ovf.service_visits_provided",
                    title=f"Service visits planned - OVF {ovf.ovf_no}",
                    body=(
                        f"Operations set up a service visit plan for OVF {ovf.ovf_no}. "
                        "Planned cost is included in Additional Charges."
                    ),
                    entity_type="ovf",
                    entity_id=ovf.id,
                    href=f"/crm/ovf/{ovf.id}",
                    digest_key=f"ovf:{ovf.id}:service_visits",
                    created_by=ctx.user_id,
                )
            return

        action = task.action if decision == "approved" else _REJECT_ACTION_MAP.get(task.action or "", None)
        if not action:
            return

        payload: dict = {}
        if remark:
            payload["remark"] = remark
        if file_name:
            payload["file_name"] = file_name
        if content_base64:
            payload["content_base64"] = content_base64
        if content_type:
            payload["content_type"] = content_type
        if file_path:
            payload["file_path"] = file_path

        if task.entity_type == "opportunity":
            from modules.crm.service.blueprint_service import OpportunityBlueprintService

            OpportunityBlueprintService(self._db).perform_action(ctx, task.entity_id, action, payload)
        elif task.entity_type == "lead":
            from modules.crm.service.lead_service import LeadService

            LeadService(self._db).apply_attachment_action(ctx, task.entity_id, action, payload)
        elif task.entity_type == "quote":
            from modules.crm.service.quote_service import QuoteService

            QuoteService(self._db).apply_blueprint_action(ctx, task.entity_id, action, payload)
        elif task.entity_type == "ovf":
            from modules.crm.service.ovf_service import OvfService

            OvfService(self._db).apply_blueprint_action(ctx, task.entity_id, action, payload)

    def respond(
        self,
        ctx: TenantContext,
        task_id: UUID,
        *,
        can_submit: bool,
        reason: str | None = None,
    ) -> CrmApprovalTask:
        """BOQ/SOW assignee confirms within the SLA whether they can submit the document."""
        from modules.crm.service.boq_sow_sla_service import BoqSowSlaService

        task = self.get(ctx, task_id)
        return BoqSowSlaService(self._db).respond(ctx, task, can_submit=can_submit, reason=reason)

    def list_inbox_for_user(self, ctx: TenantContext, *, limit: int = 30) -> list[dict]:
        from modules.foundation.repository.notification_repository import NotificationRepository

        if ctx.user_id is None:
            return []
        return NotificationRepository(self._db).list_events_for_recipient(
            ctx.tenant_id,
            ctx.user_id,
            event_type_prefix="crm.",
            limit=limit,
        )
