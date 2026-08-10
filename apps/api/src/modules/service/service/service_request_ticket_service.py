"""Service Request Ticket Management — orchestration service per SOP."""

import base64
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.service.domain.enums import SvcEntityType
from modules.service.models import (
    SvcServiceFieldEngineerVisit,
    SvcServiceNotification,
    SvcServiceOemSupport,
    SvcServiceRequest,
    SvcServiceRequestAttachment,
    SvcServiceRequestCoOwner,
    SvcServiceRequestComment,
    SvcServiceRequestStakeholder,
    SvcServiceRequestStatusHistory,
)
from modules.service.models.service_sla import SvcServiceSla
from modules.master_data.models.employee import MasterEmployee
from modules.service.repository.service_request_repository import ServiceRequestRepository
from modules.service.service.document_number_service import DocumentNumberService
from modules.service.service.engines.service_request_ticket_engine import ServiceRequestTicketEngine
from modules.service.service.ticket_access_service import TicketAccessLevel, TicketAccessService
from modules.service.service.service_scope_validator import ServiceScopeValidator
from modules.service.service_request_ticket_schemas import (
    FieldEngineerVisitPayload,
    OemSupportPayload,
    ServiceRequestCoOwnerResponse,
    ServiceRequestStakeholderResponse,
    ServiceRequestStakeholderView,
    ServiceRequestTicketAccessInfo,
    ServiceRequestTicketDetail,
    ServiceAssignableEmployee,
    ServiceRequestSlaTrackerItem,
    ServiceRequestResolvedTicketItem,
)

UPLOAD_ROOT = Path(__file__).resolve().parents[3] / "var" / "service-attachments"
MAX_ATTACHMENT_BYTES = 40 * 1024 * 1024
ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".xls", ".xlsx",
    ".doc", ".docx", ".zip", ".txt", ".log",
}


class ServiceRequestTicketService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ServiceRequestRepository(db)
        self._scope = ServiceScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = ServiceRequestTicketEngine()
        self._audit = AuditService(db)
        self._access = TicketAccessService(db)

    def list_tickets(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        q: str | None = None,
        priority: str | None = None,
        status: str | None = None,
        owner_id: UUID | None = None,
        mode: str | None = None,
        category: str | None = None,
        customer_id: UUID | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        mine: bool = False,
    ) -> list[SvcServiceRequest]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        stmt = select(SvcServiceRequest).where(
            SvcServiceRequest.company_id == cid,
            SvcServiceRequest.is_deleted.is_(False),
        )
        stmt = self._scope.apply_svc_filter(stmt, SvcServiceRequest, ctx, branch_scoped=True)

        if priority:
            stmt = stmt.where(SvcServiceRequest.priority == priority)
        if status:
            stmt = stmt.where(SvcServiceRequest.status == status)
        if owner_id:
            stmt = stmt.where(SvcServiceRequest.owner_employee_id == owner_id)
        if mine:
            emp_id = self._access.resolve_employee_id(ctx)
            if emp_id is None:
                return []
            co_owner_ids = select(SvcServiceRequestCoOwner.request_id).where(
                SvcServiceRequestCoOwner.employee_id == emp_id,
                SvcServiceRequestCoOwner.is_deleted.is_(False),
            )
            stmt = stmt.where(
                or_(
                    SvcServiceRequest.owner_employee_id == emp_id,
                    SvcServiceRequest.id.in_(co_owner_ids),
                )
            )
        if mode:
            stmt = stmt.where(SvcServiceRequest.mode_of_action == mode)
        if category:
            stmt = stmt.where(SvcServiceRequest.ticket_category == category)
        if customer_id:
            stmt = stmt.where(SvcServiceRequest.customer_id == customer_id)
        if date_from:
            stmt = stmt.where(SvcServiceRequest.created_at >= date_from)
        if date_to:
            stmt = stmt.where(SvcServiceRequest.created_at <= date_to)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(
                or_(
                    SvcServiceRequest.document_number.ilike(like),
                    SvcServiceRequest.subject.ilike(like),
                    SvcServiceRequest.contact_name.ilike(like),
                    SvcServiceRequest.serial_number.ilike(like),
                    SvcServiceRequest.asset_name.ilike(like),
                    SvcServiceRequest.reference_sr_number.ilike(like),
                )
            )

        stmt = stmt.order_by(SvcServiceRequest.created_at.desc())
        return list(self._db.scalars(stmt).all())

    def list_sla_tracker(self, ctx: TenantContext, *, company_id: UUID | None = None) -> list[ServiceRequestSlaTrackerItem]:
        """Active ticket SLAs — tickets with SLA clock running and not yet resolved/closed."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        stmt = select(SvcServiceRequest).where(
            SvcServiceRequest.company_id == cid,
            SvcServiceRequest.is_deleted.is_(False),
            SvcServiceRequest.sla_started_at.isnot(None),
            SvcServiceRequest.status.notin_(("resolved", "closed", "cancelled")),
        )
        stmt = self._scope.apply_svc_filter(stmt, SvcServiceRequest, ctx, branch_scoped=True)
        stmt = stmt.order_by(SvcServiceRequest.due_at.asc().nullslast(), SvcServiceRequest.sla_started_at.desc())
        rows = list(self._db.scalars(stmt).all())
        now = datetime.now(timezone.utc)
        owner_names = self._owner_display_names([r.owner_employee_id for r in rows if r.owner_employee_id])
        items: list[ServiceRequestSlaTrackerItem] = []
        for row in rows:
            started = row.sla_started_at
            if started is None:
                continue
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            elapsed = int((now - started).total_seconds() // 60)
            remaining: int | None = None
            is_breached = row.sla_status == "breached"
            if row.due_at:
                due = row.due_at if row.due_at.tzinfo else row.due_at.replace(tzinfo=timezone.utc)
                remaining = int((due - now).total_seconds() // 60)
                if remaining < 0:
                    is_breached = True
            items.append(
                ServiceRequestSlaTrackerItem(
                    id=row.id,
                    document_number=row.document_number,
                    subject=row.subject,
                    priority=row.priority,
                    status=row.status,
                    sla_status=row.sla_status,
                    sla_started_at=started,
                    due_at=row.due_at,
                    owner_employee_id=row.owner_employee_id,
                    owner_name=owner_names.get(row.owner_employee_id) if row.owner_employee_id else None,
                    elapsed_minutes=elapsed,
                    remaining_minutes=remaining,
                    is_breached=is_breached,
                )
            )
        return items

    def list_resolved_tickets(
        self, ctx: TenantContext, *, company_id: UUID | None = None, q: str | None = None
    ) -> list[ServiceRequestResolvedTicketItem]:
        """Resolved and closed tickets with solution details."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        stmt = select(SvcServiceRequest).where(
            SvcServiceRequest.company_id == cid,
            SvcServiceRequest.is_deleted.is_(False),
            or_(
                SvcServiceRequest.status.in_(("resolved", "closed")),
                SvcServiceRequest.resolved_at.isnot(None),
            ),
        )
        stmt = self._scope.apply_svc_filter(stmt, SvcServiceRequest, ctx, branch_scoped=True)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(
                or_(
                    SvcServiceRequest.document_number.ilike(like),
                    SvcServiceRequest.subject.ilike(like),
                    SvcServiceRequest.solution_summary.ilike(like),
                )
            )
        stmt = stmt.order_by(SvcServiceRequest.resolved_at.desc().nullslast(), SvcServiceRequest.closed_at.desc().nullslast())
        rows = list(self._db.scalars(stmt).all())
        owner_names = self._owner_display_names([r.owner_employee_id for r in rows if r.owner_employee_id])
        return [
            ServiceRequestResolvedTicketItem(
                id=row.id,
                document_number=row.document_number,
                subject=row.subject,
                priority=row.priority,
                status=row.status,
                solution_type=row.solution_type,
                solution_summary=row.solution_summary,
                resolved_at=row.resolved_at,
                closed_at=row.closed_at,
                owner_employee_id=row.owner_employee_id,
                owner_name=owner_names.get(row.owner_employee_id) if row.owner_employee_id else None,
            )
            for row in rows
        ]

    def _owner_display_names(self, employee_ids: list[UUID]) -> dict[UUID, str]:
        if not employee_ids:
            return {}
        from modules.foundation.models.security import SecUser

        unique_ids = list({eid for eid in employee_ids})
        stmt = (
            select(MasterEmployee.id, SecUser.display_name, MasterEmployee.first_name, MasterEmployee.last_name, MasterEmployee.employee_code)
            .outerjoin(SecUser, SecUser.id == MasterEmployee.user_id)
            .where(MasterEmployee.id.in_(unique_ids), MasterEmployee.is_deleted.is_(False))
        )
        result: dict[UUID, str] = {}
        for emp_id, display_name, first, last, code in self._db.execute(stmt).all():
            label = display_name or f"{first or ''} {last or ''}".strip() or code
            result[emp_id] = label
        return result

    def list_assignable_employees(self, ctx: TenantContext) -> list[ServiceAssignableEmployee]:
        """Return only service engineers who can be assigned as ticket owners."""
        from modules.foundation.models.security import SecRole, SecUser, SecUserRole

        cid = self._scope.resolve_company_id(ctx, None)
        stmt = (
            select(MasterEmployee, SecUser.display_name)
            .join(SecUser, SecUser.id == MasterEmployee.user_id)
            .join(SecUserRole, SecUserRole.user_id == SecUser.id)
            .join(SecRole, SecRole.id == SecUserRole.role_id)
            .where(
                MasterEmployee.tenant_id == ctx.tenant_id,
                MasterEmployee.company_id == cid,
                MasterEmployee.is_deleted.is_(False),
                MasterEmployee.status == "active",
                SecUser.is_deleted.is_(False),
                SecRole.role_code == "SERVICE_ENGINEER",
            )
            .order_by(SecUser.display_name, MasterEmployee.employee_code)
        )
        options: list[ServiceAssignableEmployee] = []
        seen: set[UUID] = set()
        for emp, user_display_name in self._db.execute(stmt).all():
            if emp.id in seen:
                continue
            seen.add(emp.id)
            label = (user_display_name or f"{emp.first_name} {emp.last_name}".strip() or emp.employee_code)
            options.append(
                ServiceAssignableEmployee(
                    id=emp.id,
                    employee_code=emp.employee_code,
                    display_name=label,
                    designation=emp.designation,
                )
            )
        return options

    def get_ticket(self, ctx: TenantContext, row_id: UUID) -> ServiceRequestTicketDetail:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if access.level == TicketAccessLevel.DENIED:
            from core.exceptions import ForbiddenException
            raise ForbiddenException("You do not have access to this ticket")
        if access.level == TicketAccessLevel.STAKEHOLDER:
            from core.exceptions import ForbiddenException
            raise ForbiddenException("Use the stakeholder status view for this ticket")
        return self._build_detail(ctx, row, access)

    def get_stakeholder_view(self, ctx: TenantContext, row_id: UUID) -> ServiceRequestStakeholderView:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if access.level not in (TicketAccessLevel.STAKEHOLDER, TicketAccessLevel.FULL):
            from core.exceptions import ForbiddenException
            raise ForbiddenException("You do not have stakeholder access to this ticket")
        return ServiceRequestStakeholderView(
            id=row.id,
            document_number=row.document_number,
            subject=row.subject,
            status=row.status,
            is_resolved=row.status in ("resolved", "closed"),
            is_closed=row.status == "closed",
            resolved_at=row.resolved_at,
            closed_at=row.closed_at,
            owner_employee_id=row.owner_employee_id,
        )

    def _build_detail(self, ctx: TenantContext, row: SvcServiceRequest, access) -> ServiceRequestTicketDetail:
        fe = self._get_field_engineer(row.id)
        oem = self._get_oem_support(row.id)
        detail = ServiceRequestTicketDetail.model_validate(row)
        detail.field_engineer = self._fe_to_payload(fe) if fe else None
        detail.oem_support = self._oem_to_payload(oem) if oem else None
        detail.co_owners = [
            ServiceRequestCoOwnerResponse.model_validate(c) for c in self._list_co_owners(row.id)
        ]
        detail.stakeholders = [
            ServiceRequestStakeholderResponse.model_validate(s) for s in self._list_stakeholders(row.id)
        ]
        detail.access = ServiceRequestTicketAccessInfo(
            level=access.level.value,
            is_owner=access.is_owner,
            is_co_owner=access.is_co_owner,
            is_manager=access.is_manager,
            is_stakeholder=access.is_stakeholder,
            can_assign=access.can_assign,
            can_work=access.can_work,
            can_manage_collaborators=access.can_manage_collaborators,
            can_reopen=access.can_reopen,
            can_open=access.can_open,
            is_opened=access.is_opened,
            employee_id=access.employee_id,
        )
        return detail

    def open_ticket(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if not access.can_open:
            raise AppException("Only the assigned engineer can open this ticket")
        old = row.status
        now = datetime.now(timezone.utc)
        due = now + timedelta(minutes=self._resolution_minutes_for(row))
        self._engine.transition(row, "engineer_working")
        self._repo.update(
            ctx,
            row_id,
            status=row.status,
            opened_at=now,
            opened_by=ctx.user_id,
            sla_started_at=now,
            due_at=due,
            sla_status="within_sla",
        )
        self._record_status(ctx, row, old, row.status, "Ticket opened — SLA clock started")
        self._notify(ctx, row, "ticket_opened", "Ticket opened by owner")
        self._notify_service_heads(ctx, row, "ticket_opened", f"Ticket {row.document_number} opened — SLA started")
        return self.get_ticket(ctx, row_id)

    def _resolution_minutes_for(self, row: SvcServiceRequest) -> int:
        if row.sla_id:
            sla = self._db.get(SvcServiceSla, row.sla_id)
            if sla and sla.status == "active":
                return sla.resolution_minutes
        priority_map = {
            "critical": 240,
            "p1": 240,
            "high": 480,
            "p2": 480,
            "medium": 1440,
            "p3": 1440,
            "low": 2880,
            "p4": 2880,
        }
        return priority_map.get((row.priority or "medium").lower(), 1440)

    def create_ticket(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)

        fe_data = fields.pop("field_engineer", None)
        oem_data = fields.pop("oem_support", None)

        if not fields.get("status"):
            fields["status"] = "ticket_registered"

        doc = self._numbers.generate(SvcEntityType.REQUEST, cid, SvcServiceRequest, "document_number")
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            document_number=doc,
            requested_at=datetime.now(timezone.utc),
            **fields,
        )

        if fe_data and fields.get("mode_of_action") == "onsite_support":
            self._upsert_field_engineer(ctx, row, fe_data)
        if oem_data and fields.get("oem_support_enabled"):
            self._upsert_oem_support(ctx, row, oem_data)

        self._record_status(ctx, row, None, row.status, "Ticket created")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="svc_service_request",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"status": row.status},
        )
        self._notify(ctx, row, "ticket_created", "Service request ticket created")
        return self.get_ticket(ctx, row.id)

    def update_ticket(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if access.level == TicketAccessLevel.ASSIGN_PREVIEW:
            raise AppException("Assign an owner before editing this ticket")
        self._access.require_work(ctx, row)

        if row.ownership_locked and "owner_employee_id" in fields:
            raise AppException("Ownership cannot be changed after the ticket is closed")
        if "owner_employee_id" in fields and fields.get("owner_employee_id") != row.owner_employee_id:
            raise AppException("Use the assign endpoint to change ticket owner")

        fe_data = fields.pop("field_engineer", None)
        oem_data = fields.pop("oem_support", None)
        old_status = row.status

        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Service request ticket not found")

        mode = fields.get("mode_of_action", row.mode_of_action)
        if fe_data is not None and mode == "onsite_support":
            self._upsert_field_engineer(ctx, row, fe_data)
        if oem_data is not None and row.oem_support_enabled:
            self._upsert_oem_support(ctx, row, oem_data)

        if fields.get("status") and fields["status"] != old_status:
            self._record_status(ctx, row, old_status, fields["status"], "Status updated")
            self._notify(ctx, row, "status_change", f"Status changed to {fields['status']}")

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="svc_service_request",
            entity_id=row.id,
            operation="update",
            performed_by=ctx.user_id,
            new_value=fields,
        )
        return self.get_ticket(ctx, row_id)

    def delete_ticket(self, ctx: TenantContext, row_id: UUID) -> None:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._repo.update(ctx, row_id, is_deleted=True, deleted_at=datetime.now(timezone.utc), deleted_by=ctx.user_id)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="svc_service_request",
            entity_id=row_id,
            operation="delete",
            performed_by=ctx.user_id,
        )

    def change_status(self, ctx: TenantContext, row_id: UUID, *, status: str, reason: str | None = None):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if status == "closed":
            if not access.can_work:
                raise AppException("Only the owner or co-owners can close this ticket")
        elif status == "engineer_working" and row.status == "assigned":
            raise AppException("Open the ticket first to start working and begin SLA")
        elif status in ("engineer_working", "assigned") and row.status == "closed":
            self._access.require_owner(ctx, row)
        else:
            self._access.require_work(ctx, row)

        old = row.status
        self._engine.transition(row, status)
        updates: dict = {"status": row.status}
        now = datetime.now(timezone.utc)
        if row.status == "resolved":
            updates["resolved_at"] = now
        if row.status == "closed":
            updates["closed_at"] = now
            updates["ownership_locked"] = True
        if row.status == "engineer_working" and old == "closed":
            updates["reopened_at"] = now

        self._repo.update(ctx, row_id, **updates)
        self._record_status(ctx, row, old, row.status, reason)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="svc_service_request",
            entity_id=row_id,
            operation="status_change",
            performed_by=ctx.user_id,
            new_value={"from": old, "to": status},
        )
        self._notify(ctx, row, "status_change", f"Status changed to {status}")
        return self.get_ticket(ctx, row_id)

    def assign_owner(self, ctx: TenantContext, row_id: UUID, *, owner_employee_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_assign(ctx, row)
        if row.ownership_locked:
            raise AppException("Ownership is locked for closed tickets")

        old = row.status
        new_status = row.status
        if row.status in ("ticket_registered", "new", "submitted", "approved"):
            new_status = "assigned"
        self._repo.update(ctx, row_id, owner_employee_id=owner_employee_id, status=new_status)
        if old != new_status:
            self._record_status(ctx, row, old, new_status, "Owner assigned")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="svc_service_request",
            entity_id=row_id,
            operation="assignment",
            performed_by=ctx.user_id,
            new_value={"owner_employee_id": str(owner_employee_id)},
        )
        self._notify(ctx, row, "assignment", "Ticket assigned to owner")
        self._notify_service_heads(ctx, row, "ticket_assigned", f"Ticket {row.document_number} assigned to engineer")
        return self.get_ticket(ctx, row_id)

    def add_comment(self, ctx: TenantContext, row_id: UUID, *, body: str, is_internal: bool = True):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_work(ctx, row)
        comment = SvcServiceRequestComment(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=row.company_id,
            branch_id=row.branch_id,
            request_id=row_id,
            author_user_id=ctx.user_id,
            body=body,
            is_internal=is_internal,
            commented_at=datetime.now(timezone.utc),
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._db.add(comment)
        self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="svc_service_request_comment",
            entity_id=comment.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return comment

    def list_comments(self, ctx: TenantContext, row_id: UUID) -> list[SvcServiceRequestComment]:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if access.level in (TicketAccessLevel.DENIED, TicketAccessLevel.STAKEHOLDER, TicketAccessLevel.VIEW_ONLY):
            from core.exceptions import ForbiddenException
            raise ForbiddenException("You do not have access to ticket comments")
        stmt = select(SvcServiceRequestComment).where(
            SvcServiceRequestComment.request_id == row_id,
            SvcServiceRequestComment.is_deleted.is_(False),
        ).order_by(SvcServiceRequestComment.commented_at.desc())
        return list(self._db.scalars(stmt).all())

    def upload_attachment(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        file_name: str,
        content_base64: str,
        content_type: str | None = None,
    ) -> SvcServiceRequestAttachment:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_work(ctx, row)

        ext = Path(file_name).suffix.lower()
        if ext and ext not in ALLOWED_EXTENSIONS:
            raise AppException(f"File type {ext} is not allowed")

        safe_name = Path(file_name).name
        raw = base64.b64decode(content_base64)
        if len(raw) > MAX_ATTACHMENT_BYTES:
            raise AppException("Attachment exceeds maximum size of 40MB")

        UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
        dest = UPLOAD_ROOT / f"{uuid.uuid4()}_{safe_name}"
        dest.write_bytes(raw)

        att = SvcServiceRequestAttachment(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=row.company_id,
            branch_id=row.branch_id,
            request_id=row_id,
            file_name=safe_name,
            content_type=content_type,
            file_path=str(dest),
            file_size=len(raw),
            uploaded_by=ctx.user_id,
            uploaded_at=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc),
            created_by=ctx.user_id,
        )
        self._db.add(att)
        self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="svc_service_request_attachment",
            entity_id=att.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"file_name": safe_name},
        )
        self._notify(ctx, row, "attachment_upload", f"Attachment uploaded: {safe_name}")
        return att

    def list_attachments(self, ctx: TenantContext, row_id: UUID) -> list[SvcServiceRequestAttachment]:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if access.level in (TicketAccessLevel.DENIED, TicketAccessLevel.STAKEHOLDER, TicketAccessLevel.VIEW_ONLY):
            from core.exceptions import ForbiddenException
            raise ForbiddenException("You do not have access to ticket attachments")
        stmt = select(SvcServiceRequestAttachment).where(
            SvcServiceRequestAttachment.request_id == row_id,
            SvcServiceRequestAttachment.is_deleted.is_(False),
        ).order_by(SvcServiceRequestAttachment.uploaded_at.desc())
        return list(self._db.scalars(stmt).all())

    def delete_attachment(self, ctx: TenantContext, row_id: UUID, attachment_id: UUID) -> None:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_work(ctx, row)
        att = self._db.scalar(
            select(SvcServiceRequestAttachment).where(
                SvcServiceRequestAttachment.id == attachment_id,
                SvcServiceRequestAttachment.request_id == row_id,
                SvcServiceRequestAttachment.is_deleted.is_(False),
            )
        )
        if att is None:
            raise NotFoundException("Attachment not found")
        att.is_deleted = True
        self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="svc_service_request_attachment",
            entity_id=attachment_id,
            operation="delete",
            performed_by=ctx.user_id,
        )

    def resolve_attachment_path(self, ctx: TenantContext, row_id: UUID, attachment_id: UUID) -> tuple[Path, str, str | None]:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if access.level in (TicketAccessLevel.DENIED, TicketAccessLevel.STAKEHOLDER, TicketAccessLevel.VIEW_ONLY):
            from core.exceptions import ForbiddenException
            raise ForbiddenException("You do not have access to ticket attachments")
        att = self._db.scalar(
            select(SvcServiceRequestAttachment).where(
                SvcServiceRequestAttachment.id == attachment_id,
                SvcServiceRequestAttachment.request_id == row_id,
                SvcServiceRequestAttachment.is_deleted.is_(False),
            )
        )
        if att is None:
            raise NotFoundException("Attachment not found")
        path = Path(att.file_path)
        if not path.is_file():
            candidate = UPLOAD_ROOT / path.name
            path = candidate if candidate.is_file() else path
        if not path.is_file():
            raise NotFoundException("Attachment file missing on disk")
        return path, att.file_name, att.content_type

    def get_timeline(self, ctx: TenantContext, row_id: UUID) -> list[dict]:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if access.level in (TicketAccessLevel.DENIED, TicketAccessLevel.STAKEHOLDER, TicketAccessLevel.VIEW_ONLY):
            from core.exceptions import ForbiddenException
            raise ForbiddenException("You do not have access to ticket timeline")
        items: list[dict] = []
        history = self._db.scalars(
            select(SvcServiceRequestStatusHistory)
            .where(SvcServiceRequestStatusHistory.request_id == row_id)
            .order_by(SvcServiceRequestStatusHistory.changed_at.desc())
        ).all()
        for h in history:
            items.append({
                "event_type": "status_change",
                "title": f"Status: {h.from_status or '—'} → {h.to_status}",
                "description": h.reason,
                "actor_id": h.changed_by,
                "occurred_at": h.changed_at,
            })
        comments = self.list_comments(ctx, row_id)
        for c in comments:
            items.append({
                "event_type": "comment",
                "title": "Comment added",
                "description": c.body,
                "actor_id": c.author_user_id,
                "occurred_at": c.commented_at,
            })
        items.sort(key=lambda x: x["occurred_at"], reverse=True)
        return items

    def add_co_owner(self, ctx: TenantContext, row_id: UUID, *, employee_id: UUID) -> ServiceRequestCoOwnerResponse:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_owner(ctx, row)
        if row.owner_employee_id == employee_id:
            raise AppException("Owner cannot be added as a co-owner")
        existing = self._db.scalar(
            select(SvcServiceRequestCoOwner).where(
                SvcServiceRequestCoOwner.request_id == row_id,
                SvcServiceRequestCoOwner.employee_id == employee_id,
                SvcServiceRequestCoOwner.is_deleted.is_(False),
            )
        )
        if existing:
            return ServiceRequestCoOwnerResponse.model_validate(existing)
        co = SvcServiceRequestCoOwner(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=row.company_id,
            branch_id=row.branch_id,
            request_id=row_id,
            employee_id=employee_id,
            added_by=ctx.user_id,
            added_at=datetime.now(timezone.utc),
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._db.add(co)
        self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="svc_service_request_co_owner",
            entity_id=co.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"employee_id": str(employee_id)},
        )
        return ServiceRequestCoOwnerResponse.model_validate(co)

    def remove_co_owner(self, ctx: TenantContext, row_id: UUID, *, employee_id: UUID) -> None:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_owner(ctx, row)
        co = self._db.scalar(
            select(SvcServiceRequestCoOwner).where(
                SvcServiceRequestCoOwner.request_id == row_id,
                SvcServiceRequestCoOwner.employee_id == employee_id,
                SvcServiceRequestCoOwner.is_deleted.is_(False),
            )
        )
        if co is None:
            raise NotFoundException("Co-owner not found")
        co.is_deleted = True
        co.deleted_at = datetime.now(timezone.utc)
        co.deleted_by = ctx.user_id
        self._db.flush()

    def add_stakeholder(
        self, ctx: TenantContext, row_id: UUID, *, name: str, email: str
    ) -> ServiceRequestStakeholderResponse:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_owner(ctx, row)
        normalized_email = email.strip().lower()
        existing = self._db.scalar(
            select(SvcServiceRequestStakeholder).where(
                SvcServiceRequestStakeholder.request_id == row_id,
                SvcServiceRequestStakeholder.email.ilike(normalized_email),
                SvcServiceRequestStakeholder.is_deleted.is_(False),
            )
        )
        if existing:
            return ServiceRequestStakeholderResponse.model_validate(existing)
        sh = SvcServiceRequestStakeholder(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=row.company_id,
            branch_id=row.branch_id,
            request_id=row_id,
            name=name.strip(),
            email=normalized_email,
            added_by=ctx.user_id,
            added_at=datetime.now(timezone.utc),
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._db.add(sh)
        self._db.flush()
        return ServiceRequestStakeholderResponse.model_validate(sh)

    def remove_stakeholder(self, ctx: TenantContext, row_id: UUID, *, stakeholder_id: UUID) -> None:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_owner(ctx, row)
        sh = self._db.scalar(
            select(SvcServiceRequestStakeholder).where(
                SvcServiceRequestStakeholder.id == stakeholder_id,
                SvcServiceRequestStakeholder.request_id == row_id,
                SvcServiceRequestStakeholder.is_deleted.is_(False),
            )
        )
        if sh is None:
            raise NotFoundException("Stakeholder not found")
        sh.is_deleted = True
        sh.deleted_at = datetime.now(timezone.utc)
        sh.deleted_by = ctx.user_id
        self._db.flush()

    def resolve_ticket(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        solution_type: str,
        solution_summary: str,
        reason: str | None = None,
    ):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_work(ctx, row)
        old = row.status
        self._engine.transition(row, "resolved")
        now = datetime.now(timezone.utc)
        self._repo.update(
            ctx,
            row_id,
            status=row.status,
            solution_type=solution_type,
            solution_summary=solution_summary,
            resolved_at=now,
        )
        self._record_status(ctx, row, old, row.status, reason or "Ticket resolved")
        self._notify(ctx, row, "ticket_resolved", f"Ticket resolved: {solution_type}")
        self._notify_service_heads(
            ctx, row, "ticket_resolved", f"Ticket {row.document_number} resolved ({solution_type})"
        )
        return self.get_ticket(ctx, row_id)

    def close_ticket(self, ctx: TenantContext, row_id: UUID, *, reason: str | None = None):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if not access.can_work:
            raise AppException("Only the owner or co-owners can close this ticket")
        if row.status != "resolved":
            raise AppException("Ticket must be resolved before closing")
        old = row.status
        self._engine.transition(row, "closed")
        now = datetime.now(timezone.utc)
        self._repo.update(ctx, row_id, status=row.status, closed_at=now, ownership_locked=True)
        self._record_status(ctx, row, old, row.status, reason or "Ticket closed")
        return self.get_ticket(ctx, row_id)

    def reopen_ticket(self, ctx: TenantContext, row_id: UUID, *, reason: str | None = None):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_owner(ctx, row)
        if row.status != "closed":
            raise AppException("Only closed tickets can be reopened")
        old = row.status
        self._engine.transition(row, "engineer_working")
        now = datetime.now(timezone.utc)
        due = now + timedelta(minutes=self._resolution_minutes_for(row))
        self._repo.update(
            ctx,
            row_id,
            status=row.status,
            reopened_at=now,
            sla_started_at=now,
            due_at=due,
            sla_status="within_sla",
        )
        self._record_status(ctx, row, old, row.status, reason or "Ticket reopened by owner")
        return self.get_ticket(ctx, row_id)

    def _list_co_owners(self, request_id: UUID) -> list[SvcServiceRequestCoOwner]:
        return list(
            self._db.scalars(
                select(SvcServiceRequestCoOwner).where(
                    SvcServiceRequestCoOwner.request_id == request_id,
                    SvcServiceRequestCoOwner.is_deleted.is_(False),
                ).order_by(SvcServiceRequestCoOwner.added_at)
            ).all()
        )

    def _list_stakeholders(self, request_id: UUID) -> list[SvcServiceRequestStakeholder]:
        return list(
            self._db.scalars(
                select(SvcServiceRequestStakeholder).where(
                    SvcServiceRequestStakeholder.request_id == request_id,
                    SvcServiceRequestStakeholder.is_deleted.is_(False),
                ).order_by(SvcServiceRequestStakeholder.added_at)
            ).all()
        )

    def _get_field_engineer(self, request_id: UUID) -> SvcServiceFieldEngineerVisit | None:
        return self._db.scalar(
            select(SvcServiceFieldEngineerVisit).where(
                SvcServiceFieldEngineerVisit.request_id == request_id,
                SvcServiceFieldEngineerVisit.is_deleted.is_(False),
            )
        )

    def _get_oem_support(self, request_id: UUID) -> SvcServiceOemSupport | None:
        return self._db.scalar(
            select(SvcServiceOemSupport).where(
                SvcServiceOemSupport.request_id == request_id,
                SvcServiceOemSupport.is_deleted.is_(False),
            )
        )

    def _upsert_field_engineer(self, ctx: TenantContext, row: SvcServiceRequest, data: dict | FieldEngineerVisitPayload) -> None:
        payload = data if isinstance(data, dict) else data.model_dump(exclude_none=True)
        existing = self._get_field_engineer(row.id)
        if existing:
            for k, v in payload.items():
                setattr(existing, k, v)
            existing.updated_by = ctx.user_id
        else:
            fe = SvcServiceFieldEngineerVisit(
                id=uuid.uuid4(),
                tenant_id=ctx.tenant_id,
                company_id=row.company_id,
                branch_id=row.branch_id,
                request_id=row.id,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
                **payload,
            )
            self._db.add(fe)
        self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="svc_service_field_engineer_visit",
            entity_id=row.id,
            operation="update",
            performed_by=ctx.user_id,
            new_value=payload,
        )

    def _upsert_oem_support(self, ctx: TenantContext, row: SvcServiceRequest, data: dict | OemSupportPayload) -> None:
        payload = data if isinstance(data, dict) else data.model_dump(exclude_none=True)
        existing = self._get_oem_support(row.id)
        if existing:
            for k, v in payload.items():
                setattr(existing, k, v)
            existing.updated_by = ctx.user_id
        else:
            oem = SvcServiceOemSupport(
                id=uuid.uuid4(),
                tenant_id=ctx.tenant_id,
                company_id=row.company_id,
                branch_id=row.branch_id,
                request_id=row.id,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
                **payload,
            )
            self._db.add(oem)
        self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="svc_service_oem_support",
            entity_id=row.id,
            operation="update",
            performed_by=ctx.user_id,
            new_value=payload,
        )
        self._notify(ctx, row, "oem_update", "OEM support details updated")

    def _record_status(self, ctx: TenantContext, row: SvcServiceRequest, from_status: str | None, to_status: str, reason: str | None) -> None:
        hist = SvcServiceRequestStatusHistory(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=row.company_id,
            request_id=row.id,
            from_status=from_status,
            to_status=to_status,
            changed_by=ctx.user_id,
            changed_at=datetime.now(timezone.utc),
            reason=reason,
            created_at=datetime.now(timezone.utc),
        )
        self._db.add(hist)
        self._db.flush()

    def _notify(self, ctx: TenantContext, row: SvcServiceRequest, notification_type: str, message: str) -> None:
        recipient_user_id = ctx.user_id
        if row.owner_employee_id:
            owner_user = self._db.scalar(
                select(MasterEmployee.user_id).where(
                    MasterEmployee.id == row.owner_employee_id,
                    MasterEmployee.is_deleted.is_(False),
                )
            )
            if owner_user:
                recipient_user_id = owner_user
        notif = SvcServiceNotification(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=row.company_id,
            branch_id=row.branch_id,
            request_id=row.id,
            notification_type=notification_type,
            recipient_user_id=recipient_user_id,
            payload_json={"message": message, "ticket_id": str(row.id), "document_number": row.document_number},
            sent_at=datetime.now(timezone.utc),
            delivery_status="pending",
            status="active",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._db.add(notif)

    def _service_head_user_ids(self, ctx: TenantContext) -> list[UUID]:
        from modules.foundation.models.security import SecRole, SecUser, SecUserRole

        stmt = (
            select(SecUser.id)
            .join(SecUserRole, SecUserRole.user_id == SecUser.id)
            .join(SecRole, SecRole.id == SecUserRole.role_id)
            .where(
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.is_deleted.is_(False),
                SecRole.role_code == "SERVICE_COORDINATOR",
            )
        )
        return list(self._db.scalars(stmt).unique().all())

    def _notify_service_heads(
        self, ctx: TenantContext, row: SvcServiceRequest, notification_type: str, message: str
    ) -> None:
        now = datetime.now(timezone.utc)
        for user_id in self._service_head_user_ids(ctx):
            notif = SvcServiceNotification(
                id=uuid.uuid4(),
                tenant_id=ctx.tenant_id,
                company_id=row.company_id,
                branch_id=row.branch_id,
                request_id=row.id,
                notification_type=notification_type,
                recipient_user_id=user_id,
                payload_json={
                    "message": message,
                    "ticket_id": str(row.id),
                    "document_number": row.document_number,
                    "for_service_head": True,
                },
                sent_at=now,
                delivery_status="pending",
                status="active",
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
            )
            self._db.add(notif)

    @staticmethod
    def _fe_to_payload(fe: SvcServiceFieldEngineerVisit) -> FieldEngineerVisitPayload:
        return FieldEngineerVisitPayload(
            engineer_name=fe.engineer_name,
            engineer_contact=fe.engineer_contact,
            distance=fe.distance,
            visits_count=fe.visits_count,
            carrying_spares=fe.carrying_spares,
            visit_date=fe.visit_date,
            hw_replacement=fe.hw_replacement,
            transport_mode=fe.transport_mode,
            movement_charges=fe.movement_charges,
            visit_charges=fe.visit_charges,
            total_charges=fe.total_charges,
            remarks=fe.remarks,
            payment_approval=fe.payment_approval,
        )

    @staticmethod
    def _oem_to_payload(oem: SvcServiceOemSupport) -> OemSupportPayload:
        return OemSupportPayload(
            oem_name=oem.oem_name,
            oem_ticket_number=oem.oem_ticket_number,
            customer_reference=oem.customer_reference,
            ticket_type=oem.ticket_type,
            oem_engineer_contact=oem.oem_engineer_contact,
            tac_response_summary=oem.tac_response_summary,
            tac_resolution=oem.tac_resolution,
            oem_status=oem.oem_status,
            last_checked_at=oem.last_checked_at,
        )
