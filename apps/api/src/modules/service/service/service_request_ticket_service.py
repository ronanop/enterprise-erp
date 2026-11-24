"""Service Request Ticket Management — orchestration service per SOP."""

import base64
import logging
import secrets
import string
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from uuid import UUID

from sqlalchemy import false, func, or_, select
from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import (
    SecPermission,
    SecRole,
    SecRolePermission,
    SecUser,
    SecUserOrgScope,
    SecUserRole,
)
from modules.foundation.service.audit_service import AuditService
from modules.foundation.service.rbac_service import RBACService
from modules.foundation.service.user_service import UserService
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
    SvcTicketAssignmentHistory,
    SvcTicketFieldEngineer,
    SvcTicketOption,
    SvcTicketReopenRequest,
    SvcTicketSlaPause,
)
from modules.service.models.service_sla import SvcServiceSla
from modules.master_data.models.employee import MasterEmployee
from modules.service.permissions import SERVICE_FIELD_ENGINEER_PERMISSIONS
from modules.service.repository.service_request_repository import ServiceRequestRepository
from modules.service.domain.ticket_status import status_label
from modules.service.service.customer_priority_sla_service import (
    CustomerPrioritySlaService,
    compute_due_at,
    policy_snapshot,
)
from modules.service.service.document_number_service import DocumentNumberService
from modules.service.service.engines.service_request_ticket_engine import ServiceRequestTicketEngine
from modules.service.service.service_channel_notifier import ServiceChannelNotifier
from modules.service.adapters.hr_port import ServiceHrAdapter
from modules.service.service.ticket_access_service import TicketAccessLevel, TicketAccessService
from modules.service.service.service_scope_validator import ServiceScopeValidator
from modules.service.service_request_ticket_schemas import (
    AssignmentHistoryItem,
    CircuitHistoryItem,
    CircuitHistoryResponse,
    FieldEngineerVisitPayload,
    OemSupportPayload,
    ServiceRequestCoOwnerResponse,
    ServiceRequestReopenRequestResponse,
    ServiceRequestSlaPauseItem,
    ServiceRequestStakeholderResponse,
    ServiceRequestStakeholderView,
    ServiceRequestTicketAccessInfo,
    ServiceRequestTicketDetail,
    ServiceAssignableEmployee,
    ServiceRequestSlaTrackerItem,
    ServiceRequestResolvedTicketItem,
    ServiceSlaComplianceSummary,
    StakeholderFieldEngineerWork,
    TicketFieldEngineerResponse,
    FieldEngineerTicketItem,
)
from security.password import PasswordHasher
from shared.email_utils import send_smtp_email

logger = logging.getLogger(__name__)

UPLOAD_ROOT = Path(__file__).resolve().parents[3] / "var" / "service-attachments"
MAX_ATTACHMENT_BYTES = 40 * 1024 * 1024
ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".xls", ".xlsx",
    ".doc", ".docx", ".zip", ".txt", ".log",
}

ASSET_CONFIRM_FIELDS = (
    "asset_name",
    "serial_number",
    "warranty_start_date",
    "warranty_end_date",
    "amc_end_date",
    "asset_status",
)
MAIL_OVERRIDE_FIELDS = (
    "ckt_id",
    "lsi",
    "present_type",
    "reference_sr_number",
    "serial_number",
    "asset_name",
    "end_customer_name",
    "site_availability",
    "link_type",
    "bandwidth",
)


class ServiceRequestTicketService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ServiceRequestRepository(db)
        self._scope = ServiceScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = ServiceRequestTicketEngine()
        self._audit = AuditService(db)
        self._access = TicketAccessService(db)
        self._channels = ServiceChannelNotifier(db)
        self._hr = ServiceHrAdapter(db)

    def _apply_mine_filter(self, stmt, ctx: TenantContext):
        """Limit to own/co-owned tickets plus the unassigned intake queue.

        Unassigned email tickets (owner IS NULL) must stay visible to engineers
        and heads so they can open/assign them from Request Tickets.
        """
        emp_id = self._access.resolve_employee_id(ctx)
        if emp_id is None:
            # Still show unassigned intake if the user has no employee link.
            return stmt.where(SvcServiceRequest.owner_employee_id.is_(None))
        co_owner_ids = select(SvcServiceRequestCoOwner.request_id).where(
            SvcServiceRequestCoOwner.employee_id == emp_id,
            SvcServiceRequestCoOwner.is_deleted.is_(False),
        )
        return stmt.where(
            or_(
                SvcServiceRequest.owner_employee_id == emp_id,
                SvcServiceRequest.id.in_(co_owner_ids),
                SvcServiceRequest.owner_employee_id.is_(None),
            )
        )

    def _apply_roster_visibility_filter(self, stmt, ctx: TenantContext, *, company_id: UUID):
        """When HRMS roster gate is on, non-managers only see own tickets + on-duty queue.

        - Managers bypass.
        - Off-shift engineers: only tickets they own / co-own.
        - On-duty engineers: own/co-own tickets OR unassigned queue tickets.
        """
        if not self._hr.roster_visibility_enabled:
            return stmt
        if self._access.is_manager(ctx):
            return stmt
        emp_id = self._access.resolve_employee_id(ctx)
        if emp_id is None:
            return stmt.where(false())
        co_owner_ids = select(SvcServiceRequestCoOwner.request_id).where(
            SvcServiceRequestCoOwner.employee_id == emp_id,
            SvcServiceRequestCoOwner.is_deleted.is_(False),
        )
        own = or_(
            SvcServiceRequest.owner_employee_id == emp_id,
            SvcServiceRequest.id.in_(co_owner_ids),
        )
        if self._hr.is_employee_on_duty(ctx, emp_id, company_id=company_id):
            # On duty: own tickets + unassigned tickets waiting for the shift team.
            return stmt.where(or_(own, SvcServiceRequest.owner_employee_id.is_(None)))
        # Off duty: only tickets already owned / co-owned.
        return stmt.where(own)

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
        stmt = self._apply_roster_visibility_filter(stmt, ctx, company_id=cid)

        if priority:
            stmt = stmt.where(SvcServiceRequest.priority == priority)
        if status:
            stmt = stmt.where(SvcServiceRequest.status == status)
        if owner_id:
            stmt = stmt.where(SvcServiceRequest.owner_employee_id == owner_id)
        if mine:
            stmt = self._apply_mine_filter(stmt, ctx)
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

    def list_sla_tracker(
        self, ctx: TenantContext, *, company_id: UUID | None = None, mine: bool = False
    ) -> list[ServiceRequestSlaTrackerItem]:
        """Active ticket SLAs — tickets with SLA clock running and not yet resolved/closed."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        stmt = select(SvcServiceRequest).where(
            SvcServiceRequest.company_id == cid,
            SvcServiceRequest.is_deleted.is_(False),
            SvcServiceRequest.sla_started_at.isnot(None),
            SvcServiceRequest.status.notin_(("resolved", "closed", "cancelled")),
        )
        stmt = self._scope.apply_svc_filter(stmt, SvcServiceRequest, ctx, branch_scoped=True)
        stmt = self._apply_roster_visibility_filter(stmt, ctx, company_id=cid)
        if mine:
            stmt = self._apply_mine_filter(stmt, ctx)
        # Newest tickets first (created_at), then document number for stable serial order.
        stmt = stmt.order_by(
            SvcServiceRequest.created_at.desc(),
            SvcServiceRequest.document_number.desc(),
        )
        rows = list(self._db.scalars(stmt).all())
        now = datetime.now(timezone.utc)
        owner_names = self._owner_display_names([r.owner_employee_id for r in rows if r.owner_employee_id])
        items: list[ServiceRequestSlaTrackerItem] = []
        for row in rows:
            started = row.sla_started_at
            if started is None:
                continue
            started = self._as_utc(started)
            clock = self._sla_clock(row, now=now)
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
                    elapsed_minutes=clock["elapsed_minutes"],
                    remaining_minutes=clock["remaining_minutes"],
                    is_breached=clock["is_breached"],
                    is_paused=clock["is_paused"],
                    sla_target_minutes=row.sla_target_minutes,
                    created_at=row.created_at,
                )
            )
        return items

    @staticmethod
    def _as_utc(value: datetime) -> datetime:
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    @classmethod
    def _paused_total_minutes(cls, row: SvcServiceRequest, *, now: datetime) -> int:
        total = int(getattr(row, "sla_paused_total_minutes", 0) or 0)
        paused_at = getattr(row, "sla_paused_at", None)
        if paused_at is not None:
            total += max(0, int((now - cls._as_utc(paused_at)).total_seconds() // 60))
        return total

    @classmethod
    def _sla_effective_now(cls, row: SvcServiceRequest, *, now: datetime) -> datetime:
        """While paused, freeze the clock at the pause moment for remaining/breach math."""
        paused_at = getattr(row, "sla_paused_at", None)
        return cls._as_utc(paused_at) if paused_at is not None else now

    @classmethod
    def _sla_clock(cls, row: SvcServiceRequest, *, now: datetime) -> dict:
        started = row.sla_started_at
        if started is None:
            return {
                "elapsed_minutes": 0,
                "remaining_minutes": None,
                "is_breached": False,
                "is_paused": False,
                "paused_total_minutes": int(getattr(row, "sla_paused_total_minutes", 0) or 0),
            }
        started = cls._as_utc(started)
        effective_now = cls._sla_effective_now(row, now=now)
        paused_total = cls._paused_total_minutes(row, now=now)
        # Completed pauses are already pushed into due_at on resume; active pause is
        # excluded via effective_now. Elapsed excludes only completed pause minutes.
        completed = int(getattr(row, "sla_paused_total_minutes", 0) or 0)
        wall = max(0, int((effective_now - started).total_seconds() // 60))
        elapsed = max(0, wall - completed)
        remaining: int | None = None
        is_breached = False
        if row.due_at is not None:
            due = cls._as_utc(row.due_at)
            remaining = int((due - effective_now).total_seconds() // 60)
            is_breached = remaining < 0 or row.sla_status == "breached"
        elif row.sla_status == "breached":
            is_breached = True
        return {
            "elapsed_minutes": elapsed,
            "remaining_minutes": remaining,
            "is_breached": is_breached,
            "is_paused": getattr(row, "sla_paused_at", None) is not None,
            "paused_total_minutes": paused_total,
        }

    @classmethod
    def _closed_within_sla(cls, due_at: datetime | None, ended_at: datetime | None) -> bool | None:
        if due_at is None or ended_at is None:
            return None
        return cls._as_utc(ended_at) <= cls._as_utc(due_at)

    @classmethod
    def _is_active_breached(cls, row: SvcServiceRequest, *, now: datetime) -> bool:
        return bool(cls._sla_clock(row, now=now)["is_breached"])

    def sla_compliance_summary(
        self, ctx: TenantContext, *, company_id: UUID | None = None, mine: bool = False
    ) -> ServiceSlaComplianceSummary:
        """SLA dashboard counts: active breaches plus closed-ticket compliance."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        now = datetime.now(timezone.utc)

        active_stmt = select(SvcServiceRequest).where(
            SvcServiceRequest.company_id == cid,
            SvcServiceRequest.is_deleted.is_(False),
            SvcServiceRequest.sla_started_at.isnot(None),
            SvcServiceRequest.status.notin_(("resolved", "closed", "cancelled")),
        )
        active_stmt = self._scope.apply_svc_filter(active_stmt, SvcServiceRequest, ctx, branch_scoped=True)
        active_stmt = self._apply_roster_visibility_filter(active_stmt, ctx, company_id=cid)
        if mine:
            active_stmt = self._apply_mine_filter(active_stmt, ctx)
        active_rows = list(self._db.scalars(active_stmt).all())
        active_breached = sum(1 for row in active_rows if self._is_active_breached(row, now=now))
        active_paused = sum(1 for row in active_rows if getattr(row, "sla_paused_at", None) is not None)

        closed_stmt = select(SvcServiceRequest).where(
            SvcServiceRequest.company_id == cid,
            SvcServiceRequest.is_deleted.is_(False),
            SvcServiceRequest.sla_started_at.isnot(None),
            SvcServiceRequest.due_at.isnot(None),
            or_(
                SvcServiceRequest.status.in_(("resolved", "closed")),
                SvcServiceRequest.resolved_at.isnot(None),
            ),
        )
        closed_stmt = self._scope.apply_svc_filter(closed_stmt, SvcServiceRequest, ctx, branch_scoped=True)
        closed_stmt = self._apply_roster_visibility_filter(closed_stmt, ctx, company_id=cid)
        if mine:
            closed_stmt = self._apply_mine_filter(closed_stmt, ctx)
        within = 0
        after_breach = 0
        for row in self._db.scalars(closed_stmt).all():
            ended_at = row.resolved_at or row.closed_at
            outcome = self._closed_within_sla(row.due_at, ended_at)
            if outcome is None:
                continue
            if outcome:
                within += 1
            else:
                after_breach += 1
        return ServiceSlaComplianceSummary(
            active_breached=active_breached,
            active_paused=active_paused,
            closed_within_sla=within,
            closed_after_breach=after_breach,
        )

    def list_resolved_tickets(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        q: str | None = None,
        sla_outcome: str | None = None,
        mine: bool = False,
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
        stmt = self._apply_roster_visibility_filter(stmt, ctx, company_id=cid)
        if mine:
            stmt = self._apply_mine_filter(stmt, ctx)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(
                or_(
                    SvcServiceRequest.document_number.ilike(like),
                    SvcServiceRequest.subject.ilike(like),
                    SvcServiceRequest.solution_summary.ilike(like),
                )
            )
        ended_at = func.coalesce(SvcServiceRequest.resolved_at, SvcServiceRequest.closed_at)
        if sla_outcome == "within":
            stmt = stmt.where(
                SvcServiceRequest.due_at.isnot(None),
                ended_at.isnot(None),
                ended_at <= SvcServiceRequest.due_at,
            )
        elif sla_outcome == "breach":
            stmt = stmt.where(
                SvcServiceRequest.due_at.isnot(None),
                ended_at.isnot(None),
                ended_at > SvcServiceRequest.due_at,
            )
        # Newest tickets first (created_at / document number), then most recently resolved.
        stmt = stmt.order_by(
            SvcServiceRequest.created_at.desc(),
            SvcServiceRequest.document_number.desc(),
            SvcServiceRequest.resolved_at.desc().nullslast(),
            SvcServiceRequest.closed_at.desc().nullslast(),
        )
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
                due_at=row.due_at,
                closed_within_sla=self._closed_within_sla(row.due_at, row.resolved_at or row.closed_at),
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
        on_duty: set[UUID] | None = None
        if self._hr.roster_visibility_enabled:
            company_id = self._scope.resolve_company_id(ctx, None)
            on_duty = self._hr.list_on_duty_employee_ids(ctx, company_id=company_id)
        for emp, user_display_name in self._db.execute(stmt).all():
            if emp.id in seen:
                continue
            seen.add(emp.id)
            if on_duty is not None and emp.id not in on_duty:
                continue
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
        fe_work = [
            StakeholderFieldEngineerWork(
                engineer_name=fe.engineer_name,
                engineer_email=fe.engineer_email,
                status=fe.status,
                solution_summary=fe.solution_summary,
                solved_at=fe.solved_at,
                work_brief=fe.work_brief,
            )
            for fe in self._list_field_engineers(row.id)
        ]
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
            solution_type=row.solution_type,
            solution_summary=row.solution_summary,
            field_engineer_work=fe_work,
        )

    def _build_detail(self, ctx: TenantContext, row: SvcServiceRequest, access) -> ServiceRequestTicketDetail:
        fe = self._get_field_engineer(row.id)
        oem = self._get_oem_support(row.id)
        detail = ServiceRequestTicketDetail.model_validate(row)
        detail.field_engineer = self._fe_to_payload(fe) if fe else None
        detail.oem_support = self._oem_to_payload(oem) if oem else None
        detail.ticket_start_at = row.sla_started_at or row.requested_at or row.created_at
        detail.ticket_end_at = row.closed_at or row.resolved_at
        detail.co_owners = [
            ServiceRequestCoOwnerResponse.model_validate(c) for c in self._list_co_owners(row.id)
        ]
        detail.stakeholders = [
            ServiceRequestStakeholderResponse.model_validate(s) for s in self._list_stakeholders(row.id)
        ]
        detail.field_engineers = [
            self._fe_response_with_attachments(fe) for fe in self._list_field_engineers(row.id)
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
            can_resume=access.can_resume,
            can_pause_sla=access.can_pause_sla,
            can_resume_sla=access.can_resume_sla,
            is_on_duty=access.is_on_duty,
            roster_visibility_enabled=access.roster_visibility_enabled,
            employee_id=access.employee_id,
        )
        now = datetime.now(timezone.utc)
        clock = self._sla_clock(row, now=now)
        detail.sla_paused_at = getattr(row, "sla_paused_at", None)
        detail.sla_paused_total_minutes = int(getattr(row, "sla_paused_total_minutes", 0) or 0)
        detail.sla_is_paused = bool(clock["is_paused"])
        detail.sla_elapsed_minutes = clock["elapsed_minutes"] if row.sla_started_at else None
        detail.sla_remaining_minutes = clock["remaining_minutes"]
        detail.sla_breached = clock["is_breached"] if row.sla_started_at else None
        detail.sla_pauses = self._list_sla_pause_items(row.id)
        pending = self._pending_reopen_request(row.id)
        detail.pending_reopen_request = (
            self._reopen_request_response(pending, row) if pending else None
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
        self._engine.transition(row, "engineer_working")
        updates: dict = {
            "status": row.status,
            "opened_at": now,
            "opened_by": ctx.user_id,
        }
        # SLA already started on create/email — do not reset calendar clock
        if not row.sla_started_at:
            updates["sla_started_at"] = now
            updates["sla_status"] = "within_sla"
            updates.update(self._sla_start_updates(row, now))
            sla_msg = "Ticket opened — SLA clock started"
        else:
            sla_msg = "Ticket opened by engineer (SLA already running)"
        self._repo.update(ctx, row_id, **updates)
        self._record_status(ctx, row, old, row.status, sla_msg)
        self._notify(ctx, row, "ticket_opened", "Ticket opened by owner")
        self._notify_service_heads(ctx, row, "ticket_opened", f"Ticket {row.document_number} opened")
        return self.get_ticket(ctx, row_id)

    def _resolution_minutes_for(self, row: SvcServiceRequest) -> int:
        policy = CustomerPrioritySlaService(self._db).resolve_policy(
            tenant_id=row.tenant_id,
            company_id=row.company_id,
            customer_id=row.customer_id,
            priority=row.priority,
        )
        if policy:
            return policy.duration_minutes
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

    def _sla_start_updates(self, row: SvcServiceRequest, start: datetime) -> dict:
        """Snapshot customer priority SLA on the ticket (immutable after set)."""
        policy = CustomerPrioritySlaService(self._db).resolve_policy(
            tenant_id=row.tenant_id,
            company_id=row.company_id,
            customer_id=row.customer_id,
            priority=row.priority,
        )
        minutes = self._resolution_minutes_for(row)
        updates: dict = {"sla_target_minutes": minutes}
        if policy:
            updates["sla_policy_snapshot"] = policy_snapshot(policy, captured_at=start)
            updates["due_at"] = compute_due_at(start, policy.duration_minutes, policy.calendar_type)
            if policy.sla_id:
                updates["sla_id"] = policy.sla_id
        else:
            updates["due_at"] = start + timedelta(minutes=minutes)
        return updates

    @staticmethod
    def _normalize_circuit(value: str | None) -> str | None:
        if not value or not str(value).strip():
            return None
        normalized = str(value).strip().upper()
        if normalized in {"NA", "N/A", "N.A.", "NONE", "-", "--", "NULL", "UNDEFINED"}:
            return None
        return normalized

    def _validate_option_code(self, ctx: TenantContext, company_id: UUID, option_type: str, code: str) -> None:
        normalized = (code or "").strip().lower()
        exists = self._db.scalar(
            select(SvcTicketOption.id).where(
                SvcTicketOption.company_id == company_id,
                SvcTicketOption.option_type == option_type,
                SvcTicketOption.option_code == normalized,
                SvcTicketOption.status == "active",
                SvcTicketOption.is_deleted.is_(False),
            )
        )
        if exists is None:
            raise AppException(f"Invalid or inactive {option_type.replace('_', ' ')} code: {code}")

    def _record_assignment_history(
        self,
        ctx: TenantContext,
        row: SvcServiceRequest,
        *,
        change_type: str,
        old_owner_employee_id: UUID | None = None,
        new_owner_employee_id: UUID | None = None,
        reason: str | None = None,
    ) -> None:
        self._db.add(
            SvcTicketAssignmentHistory(
                id=uuid.uuid4(),
                tenant_id=ctx.tenant_id,
                company_id=row.company_id,
                request_id=row.id,
                old_owner_employee_id=old_owner_employee_id,
                new_owner_employee_id=new_owner_employee_id,
                reason=reason,
                changed_by=ctx.user_id,
                changed_at=datetime.now(timezone.utc),
                change_type=change_type,
            )
        )
        self._db.flush()

    def _pending_reopen_request(self, request_id: UUID) -> SvcTicketReopenRequest | None:
        return self._db.scalar(
            select(SvcTicketReopenRequest).where(
                SvcTicketReopenRequest.request_id == request_id,
                SvcTicketReopenRequest.status == "pending",
            ).order_by(SvcTicketReopenRequest.requested_at.desc()).limit(1)
        )

    def _reopen_request_response(
        self, req: SvcTicketReopenRequest, row: SvcServiceRequest | None = None
    ) -> ServiceRequestReopenRequestResponse:
        out = ServiceRequestReopenRequestResponse.model_validate(req)
        if row:
            out.document_number = row.document_number
            out.subject = row.subject
        return out

    @staticmethod
    def _json_safe(value):
        """Make audit payloads JSON-serializable (datetimes, UUIDs, Decimals, etc.)."""
        if isinstance(value, dict):
            return {k: ServiceRequestTicketService._json_safe(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [ServiceRequestTicketService._json_safe(v) for v in value]
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, date) and not isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, UUID):
            return str(value)
        if isinstance(value, Decimal):
            return float(value)
        return value

    def _ticket_is_opened(self, row: SvcServiceRequest) -> bool:
        if row.opened_at:
            return True
        return row.status in (
            "engineer_working",
            "pending_customer",
            "pending_oem",
            "resolved",
            "closed",
        )

    def _enforce_support_selection_rules(self, row: SvcServiceRequest, fields: dict) -> None:
        """Mode may change after open (child FE/OEM/remote data is preserved). Category stays locked."""
        if "mode_of_action" in fields:
            new_mode = fields.get("mode_of_action") or None
            current = row.mode_of_action or None
            if current is None and new_mode and not self._ticket_is_opened(row):
                raise AppException("Open the ticket before choosing mode of support")
            if current and new_mode is None:
                raise AppException("Mode of support cannot be cleared after selection")

        if "ticket_category" in fields:
            new_cat = fields.get("ticket_category") or None
            current = row.ticket_category or None
            if current and new_cat != current:
                raise AppException("Ticket category is fixed after selection and cannot be changed")
            if current and new_cat is None:
                raise AppException("Ticket category cannot be cleared after selection")
            if not current and new_cat and not self._ticket_is_opened(row):
                raise AppException("Open the ticket before choosing category")

    def create_ticket(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)

        fe_data = fields.pop("field_engineer", None)
        oem_data = fields.pop("oem_support", None)

        if not fields.get("status"):
            fields["status"] = "ticket_registered"

        # Assigned engineer chooses mode/category after opening the ticket
        fields["mode_of_action"] = None
        fields["ticket_category"] = None

        doc = self._numbers.generate(SvcEntityType.REQUEST, cid, SvcServiceRequest, "document_number")
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            document_number=doc,
            requested_at=datetime.now(timezone.utc),
            **fields,
        )

        if fe_data and fields.get("mode_of_action") in ("onsite_support", "oem_support"):
            self._upsert_field_engineer(ctx, row, fe_data)
        if oem_data and fields.get("oem_support_enabled"):
            self._upsert_oem_support(ctx, row, oem_data)

        # Start SLA when ticket is created / email received (calendar time — weekends included)
        if row.status != "draft" and not row.sla_started_at:
            now = datetime.now(timezone.utc)
            sla_updates = self._sla_start_updates(row, now)
            self._repo.update(
                ctx,
                row.id,
                sla_started_at=now,
                sla_status=row.sla_status or "within_sla",
                follow_up_at=now + timedelta(hours=settings.service_followup_hours),
                **sla_updates,
            )
            row = self._repo.get(ctx, row.id) or row

        self._record_status(ctx, row, None, row.status, "Ticket created — SLA started")
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

        self._enforce_support_selection_rules(row, fields)

        fe_data = fields.pop("field_engineer", None)
        oem_data = fields.pop("oem_support", None)
        old_status = row.status
        old_mode = row.mode_of_action

        if any(k in fields and fields.get(k) != getattr(row, k, None) for k in ASSET_CONFIRM_FIELDS):
            fields["asset_confirmed_at"] = None
            fields["asset_confirmed_by"] = None

        overrides = dict(row.field_manual_overrides or {})
        override_touched = False
        for key in MAIL_OVERRIDE_FIELDS:
            if key in fields and fields.get(key) != getattr(row, key, None):
                overrides[key] = True
                override_touched = True
        if override_touched:
            fields["field_manual_overrides"] = overrides

        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Service request ticket not found")

        mode = fields.get("mode_of_action", row.mode_of_action)
        if fe_data is not None and mode in ("onsite_support", "oem_support"):
            self._upsert_field_engineer(ctx, row, fe_data)
        if oem_data is not None and row.oem_support_enabled:
            self._upsert_oem_support(ctx, row, oem_data)

        if fields.get("status") and fields["status"] != old_status:
            self._record_status(ctx, row, old_status, fields["status"], "Status updated")
            self._notify(ctx, row, "status_change", f"Status changed to {fields['status']}")

        new_mode = fields.get("mode_of_action", row.mode_of_action)
        if old_mode and new_mode and new_mode != old_mode:
            self._record_status(
                ctx,
                row,
                row.status,
                row.status,
                f"Mode of support changed: {old_mode} → {new_mode}",
            )

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="svc_service_request",
            entity_id=row.id,
            operation="update",
            performed_by=ctx.user_id,
            new_value=self._json_safe(fields),
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

    def assign_owner(
        self, ctx: TenantContext, row_id: UUID, *, owner_employee_id: UUID, reason: str | None = None
    ):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_assign(ctx, row)
        if row.ownership_locked:
            raise AppException("Ownership is locked for closed tickets")

        prior_owner = row.owner_employee_id
        change_type = "reassign" if prior_owner else "assign"
        old = row.status
        new_status = row.status
        if row.status in ("ticket_registered", "awaiting_assignment", "new", "submitted", "approved"):
            new_status = "assigned"
        self._repo.update(ctx, row_id, owner_employee_id=owner_employee_id, status=new_status)
        self._record_assignment_history(
            ctx,
            row,
            change_type=change_type,
            old_owner_employee_id=prior_owner,
            new_owner_employee_id=owner_employee_id,
            reason=reason,
        )
        if old != new_status:
            self._record_status(ctx, row, old, new_status, reason or "Owner assigned")
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
        # Stakeholders cannot read comments; Service Head (view_only manager) can.
        if access.level in (TicketAccessLevel.DENIED, TicketAccessLevel.STAKEHOLDER):
            from core.exceptions import ForbiddenException
            raise ForbiddenException("You do not have access to ticket comments")
        if access.level == TicketAccessLevel.VIEW_ONLY and not access.is_manager:
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
        field_engineer_id: UUID | None = None,
    ) -> SvcServiceRequestAttachment:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        fe_row: SvcTicketFieldEngineer | None = None
        if field_engineer_id:
            fe_row = self._db.scalar(
                select(SvcTicketFieldEngineer).where(
                    SvcTicketFieldEngineer.id == field_engineer_id,
                    SvcTicketFieldEngineer.request_id == row_id,
                    SvcTicketFieldEngineer.is_deleted.is_(False),
                )
            )
            if fe_row is None:
                raise NotFoundException("Field engineer assignment not found")
            # FE portal removed — ticket owner/co-owner uploads visit docs on the ticket.
            if not access.can_work:
                from core.exceptions import ForbiddenException
                raise ForbiddenException("Only the ticket owner or co-owners can upload visit attachments")
            if fe_row.status == "solved":
                raise AppException("Cannot upload after the visit is marked complete")
        elif not access.can_work:
            from core.exceptions import ForbiddenException
            raise ForbiddenException("You do not have permission to upload attachments")

        ext = Path(file_name).suffix.lower()
        if ext and ext not in ALLOWED_EXTENSIONS:
            raise AppException(f"File type {ext} is not allowed")

        safe_name = Path(file_name).name
        raw = base64.b64decode(content_base64)
        if len(raw) > MAX_ATTACHMENT_BYTES:
            raise AppException("Attachment exceeds maximum size of 40MB")

        att = SvcServiceRequestAttachment(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=row.company_id,
            branch_id=row.branch_id,
            request_id=row_id,
            file_name=safe_name,
            content_type=content_type,
            file_path=f"db://service.svc_service_request_attachment/{uuid.uuid4()}",
            file_content=raw,
            file_size=len(raw),
            uploaded_by=ctx.user_id,
            field_engineer_id=field_engineer_id,
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
            new_value={
                "file_name": safe_name,
                "storage": "postgresql",
                "field_engineer_id": str(field_engineer_id) if field_engineer_id else None,
            },
        )
        who = fe_row.engineer_name if fe_row else "engineer"
        self._notify(
            ctx,
            row,
            "attachment_upload",
            f"Attachment uploaded by {who}: {safe_name}",
        )
        return att

    def list_attachments(self, ctx: TenantContext, row_id: UUID) -> list[SvcServiceRequestAttachment]:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if access.level == TicketAccessLevel.DENIED:
            from core.exceptions import ForbiddenException
            raise ForbiddenException("You do not have access to ticket attachments")
        # Stakeholders: no attachments. FE (view_only) and workers: yes.
        if access.level == TicketAccessLevel.STAKEHOLDER:
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

    def resolve_attachment_content(
        self, ctx: TenantContext, row_id: UUID, attachment_id: UUID
    ) -> tuple[bytes, str, str | None]:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if access.level in (TicketAccessLevel.DENIED, TicketAccessLevel.STAKEHOLDER):
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
        if att.file_content:
            return bytes(att.file_content), att.file_name, att.content_type
        # Legacy disk fallback for older rows not yet backfilled
        if att.file_path and not str(att.file_path).startswith("db://"):
            path = Path(att.file_path)
            if not path.is_file():
                candidate = UPLOAD_ROOT / path.name
                path = candidate if candidate.is_file() else path
            if path.is_file():
                data = path.read_bytes()
                att.file_content = data
                self._db.flush()
                return data, att.file_name, att.content_type
        raise NotFoundException("Attachment content missing in database")

    def resolve_attachment_path(self, ctx: TenantContext, row_id: UUID, attachment_id: UUID) -> tuple[Path, str, str | None]:
        """Deprecated disk helper — prefer resolve_attachment_content."""
        data, file_name, content_type = self.resolve_attachment_content(ctx, row_id, attachment_id)
        UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
        tmp = UPLOAD_ROOT / f"_dl_{uuid.uuid4()}_{Path(file_name).name}"
        tmp.write_bytes(data)
        return tmp, file_name, content_type

    def get_timeline(self, ctx: TenantContext, row_id: UUID) -> list[dict]:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if access.level in (TicketAccessLevel.DENIED, TicketAccessLevel.STAKEHOLDER):
            from core.exceptions import ForbiddenException
            raise ForbiddenException("You do not have access to ticket timeline")
        # Service Head / manager view_only and assign_preview may read timeline.
        if access.level == TicketAccessLevel.VIEW_ONLY and not access.is_manager:
            from core.exceptions import ForbiddenException
            raise ForbiddenException("You do not have access to ticket timeline")
        items: list[dict] = []
        start_at = row.sla_started_at or row.requested_at or row.created_at
        if start_at:
            items.append({
                "event_type": "ticket_start",
                "title": "Ticket Start",
                "description": "SLA / ticket timeline started",
                "actor_id": None,
                "occurred_at": start_at,
            })
        if row.owner_employee_id and row.opened_at:
            items.append({
                "event_type": "ticket_opened",
                "title": "Engineer Opened Ticket",
                "description": "Service engineer started working",
                "actor_id": None,
                "occurred_at": row.opened_at,
            })
        if row.resolved_at:
            items.append({
                "event_type": "ticket_resolved",
                "title": "Engineer Resolved",
                "description": row.solution_summary,
                "actor_id": None,
                "occurred_at": row.resolved_at,
            })
        if row.closed_at:
            items.append({
                "event_type": "ticket_end",
                "title": "Helpdesk End",
                "description": "Ticket closed / ended",
                "actor_id": None,
                "occurred_at": row.closed_at,
            })
        for fe in self._list_field_engineers(row_id):
            if fe.solved_at:
                items.append({
                    "event_type": "field_engineer_solved",
                    "title": f"Field Engineer Solved — {fe.engineer_name}",
                    "description": fe.solution_summary,
                    "actor_id": None,
                    "occurred_at": fe.solved_at,
                })
        for pause in self._list_sla_pauses(row_id):
            items.append({
                "event_type": "sla_pause",
                "title": "SLA Paused",
                "description": pause.reason,
                "actor_id": pause.paused_by,
                "occurred_at": pause.paused_at,
            })
            if pause.resumed_at:
                resume_desc = pause.resume_reason or (
                    f"Resumed after {pause.duration_minutes} min"
                    if pause.duration_minutes is not None
                    else "SLA resumed"
                )
                items.append({
                    "event_type": "sla_resume",
                    "title": "SLA Resumed",
                    "description": resume_desc,
                    "actor_id": pause.resumed_by,
                    "occurred_at": pause.resumed_at,
                })
        history = self._db.scalars(
            select(SvcServiceRequestStatusHistory)
            .where(SvcServiceRequestStatusHistory.request_id == row_id)
            .order_by(SvcServiceRequestStatusHistory.changed_at.desc())
        ).all()
        for h in history:
            items.append({
                "event_type": "status_change",
                "title": "Status updated",
                "description": h.reason,
                "actor_id": h.changed_by,
                "occurred_at": h.changed_at,
                "from_status": h.from_status,
                "to_status": h.to_status,
            })
        try:
            comments = self.list_comments(ctx, row_id)
        except Exception:
            comments = []
        for c in comments:
            items.append({
                "event_type": "comment",
                "title": "Comment added",
                "description": c.body,
                "actor_id": c.author_user_id,
                "occurred_at": c.commented_at,
            })
        items.sort(key=lambda x: x["occurred_at"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
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
        self._record_assignment_history(
            ctx,
            row,
            change_type="co_owner_add",
            new_owner_employee_id=employee_id,
        )
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
        self._record_assignment_history(
            ctx,
            row,
            change_type="co_owner_remove",
            old_owner_employee_id=employee_id,
        )
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
        issue_reported_code: str | None = None,
        resolution_comment_code: str | None = None,
        other_remarks: str | None = None,
    ):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_work(ctx, row)
        if not (row.mode_of_action and row.ticket_category):
            raise AppException("Choose mode of support and category before resolving this ticket")
        if not row.asset_confirmed_at:
            raise AppException("Confirm asset details before resolving this ticket")
        issue_code = (issue_reported_code or row.issue_reported_code or "").strip().lower()
        resolution_code = (resolution_comment_code or row.resolution_comment_code or "").strip().lower()
        if not issue_code or not resolution_code:
            raise AppException(
                "Select Issue Reported and Resolution Comment in the Resolve dialog before resolving"
            )
        # Ensure Issue/Resolution masters exist (and are committed) before validating codes.
        from modules.service.service.ticket_option_service import TicketOptionService

        TicketOptionService(self._db)._ensure_defaults(ctx, row.company_id)
        self._db.flush()
        self._validate_option_code(ctx, row.company_id, "issue_reported", issue_code)
        self._validate_option_code(ctx, row.company_id, "resolution_comment", resolution_code)

        # FE portal removed — completing the visit is done by the ticket owner on Resolve.
        now = datetime.now(timezone.utc)
        pending_fe = [fe for fe in self._list_field_engineers(row_id) if fe.status != "solved"]
        for fe in pending_fe:
            fe.status = "solved"
            fe.solved_at = now
            fe.solution_summary = (solution_summary or "").strip()[:2000] or "Visit completed on resolve"
            fe.updated_by = ctx.user_id
        if pending_fe:
            self._db.flush()
            names = ", ".join(fe.engineer_name for fe in pending_fe)
            self._record_status(
                ctx,
                row,
                row.status,
                row.status,
                f"Field engineer visit(s) auto-completed on resolve: {names}",
            )

        self._finalize_open_sla_pause(
            ctx, row, reason="SLA auto-resumed because the ticket was resolved"
        )
        old = row.status
        self._engine.transition(row, "resolved")
        sla_status = "breached" if self._closed_within_sla(row.due_at, now) is False else "within_sla"
        self._repo.update(
            ctx,
            row_id,
            status=row.status,
            solution_type=solution_type,
            solution_summary=solution_summary,
            resolved_at=now,
            sla_status=sla_status,
            issue_reported_code=issue_code,
            resolution_comment_code=resolution_code,
            other_remarks=other_remarks if other_remarks is not None else row.other_remarks,
        )
        self._record_status(ctx, row, old, "resolved", reason or "Ticket resolved")
        self._notify(ctx, row, "ticket_resolved", f"Ticket resolved: {solution_type}")
        self._notify_service_heads(
            ctx, row, "ticket_resolved", f"Ticket {row.document_number} resolved ({solution_type})"
        )
        return self.get_ticket(ctx, row_id)

    def close_ticket(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        reason: str | None = None,
        other_remarks: str | None = None,
        field_engineer: dict | FieldEngineerVisitPayload | None = None,
    ):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if not access.can_work:
            raise AppException("Only the owner or co-owners can close this ticket")
        if row.status != "resolved":
            raise AppException("Ticket must be resolved before it can be closed")
        if not row.issue_reported_code or not row.resolution_comment_code:
            raise AppException("Issue reported and resolution comment codes are required to close")
        if not row.asset_confirmed_at:
            raise AppException("Confirm asset details before closing this ticket")
        if row.mode_of_action == "onsite_support":
            fe_visit = self._get_field_engineer(row.id)
            if fe_visit is None:
                raise AppException("Record field engineer visit details before closing onsite tickets")
            if fe_visit.visit_charges is None and fe_visit.total_charges is None:
                raise AppException("Enter visit or total charges before closing onsite support tickets")
        if field_engineer is not None:
            self._upsert_field_engineer(ctx, row, field_engineer)
        if other_remarks is not None:
            self._repo.update(ctx, row_id, other_remarks=other_remarks)
        self._finalize_open_sla_pause(
            ctx, row, reason="SLA auto-resumed because the ticket was closed"
        )
        old = row.status
        self._engine.transition(row, "closed")
        now = datetime.now(timezone.utc)
        self._repo.update(
            ctx,
            row_id,
            status=row.status,
            closed_at=now,
            ownership_locked=True,
        )
        self._record_status(ctx, row, old, "closed", reason or "Ticket closed")
        self._notify(ctx, row, "ticket_closed", f"Ticket {row.document_number} closed")
        self._notify_service_heads(ctx, row, "ticket_closed", f"Ticket {row.document_number} closed")
        return self.get_ticket(ctx, row_id)

    def pause_sla(self, ctx: TenantContext, row_id: UUID, *, reason: str) -> ServiceRequestTicketDetail:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if not access.can_pause_sla:
            raise AppException("Only the owner or co-owners can pause SLA on an active ticket")
        pause_reason = (reason or "").strip()
        if not pause_reason:
            raise AppException("A reason is required before pausing the SLA")
        if not row.sla_started_at:
            raise AppException("SLA has not started on this ticket yet")
        if row.sla_paused_at is not None:
            raise AppException("SLA is already paused on this ticket")
        if self._open_sla_pause(row.id) is not None:
            raise AppException("SLA is already paused on this ticket")

        now = datetime.now(timezone.utc)
        pause = SvcTicketSlaPause(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=row.company_id,
            request_id=row.id,
            paused_at=now,
            reason=pause_reason[:2000],
            paused_by=ctx.user_id,
        )
        self._db.add(pause)
        self._repo.update(ctx, row_id, sla_paused_at=now)
        self._record_status(ctx, row, row.status, row.status, f"SLA paused: {pause_reason[:500]}")
        self._notify(ctx, row, "sla_paused", f"SLA paused on {row.document_number}: {pause_reason[:200]}")
        return self.get_ticket(ctx, row_id)

    def resume_sla(
        self, ctx: TenantContext, row_id: UUID, *, reason: str | None = None
    ) -> ServiceRequestTicketDetail:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if not access.can_resume_sla:
            raise AppException("Only the owner or co-owners can resume a paused SLA")
        self._finalize_open_sla_pause(ctx, row, reason=reason, actor_id=ctx.user_id, require_open=True)
        return self.get_ticket(ctx, row_id)

    def list_sla_pauses(self, ctx: TenantContext, row_id: UUID) -> list[ServiceRequestSlaPauseItem]:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if access.level == TicketAccessLevel.DENIED:
            from core.exceptions import ForbiddenException

            raise ForbiddenException("You do not have access to this ticket")
        return self._list_sla_pause_items(row_id)

    def _list_sla_pauses(self, request_id: UUID) -> list[SvcTicketSlaPause]:
        return list(
            self._db.scalars(
                select(SvcTicketSlaPause)
                .where(SvcTicketSlaPause.request_id == request_id)
                .order_by(SvcTicketSlaPause.paused_at.desc())
            ).all()
        )

    def _list_sla_pause_items(self, request_id: UUID) -> list[ServiceRequestSlaPauseItem]:
        return [
            ServiceRequestSlaPauseItem(
                id=p.id,
                request_id=p.request_id,
                paused_at=p.paused_at,
                resumed_at=p.resumed_at,
                reason=p.reason,
                resume_reason=p.resume_reason,
                paused_by=p.paused_by,
                resumed_by=p.resumed_by,
                duration_minutes=p.duration_minutes,
                is_active=p.resumed_at is None,
            )
            for p in self._list_sla_pauses(request_id)
        ]

    def _open_sla_pause(self, request_id: UUID) -> SvcTicketSlaPause | None:
        return self._db.scalar(
            select(SvcTicketSlaPause).where(
                SvcTicketSlaPause.request_id == request_id,
                SvcTicketSlaPause.resumed_at.is_(None),
            )
        )

    def _finalize_open_sla_pause(
        self,
        ctx: TenantContext,
        row: SvcServiceRequest,
        *,
        reason: str | None = None,
        actor_id: UUID | None = None,
        require_open: bool = False,
    ) -> None:
        pause = self._open_sla_pause(row.id)
        if pause is None and row.sla_paused_at is None:
            if require_open:
                raise AppException("SLA is not paused on this ticket")
            return
        now = datetime.now(timezone.utc)
        paused_at = self._as_utc(pause.paused_at if pause is not None else row.sla_paused_at)
        duration = max(0, int((now - paused_at).total_seconds() // 60))
        resume_note = (reason or "").strip() or None
        if pause is not None:
            pause.resumed_at = now
            pause.resumed_by = actor_id or ctx.user_id
            pause.duration_minutes = duration
            pause.resume_reason = resume_note[:2000] if resume_note else None
        total = int(getattr(row, "sla_paused_total_minutes", 0) or 0) + duration
        updates: dict = {
            "sla_paused_at": None,
            "sla_paused_total_minutes": total,
        }
        if row.due_at is not None and duration > 0:
            updates["due_at"] = self._as_utc(row.due_at) + timedelta(minutes=duration)
        self._repo.update(ctx, row.id, **updates)
        self._db.flush()
        # Keep in-memory row in sync for subsequent detail/clock reads in this request.
        row.sla_paused_at = None
        row.sla_paused_total_minutes = total
        if "due_at" in updates:
            row.due_at = updates["due_at"]
        msg = f"SLA resumed after {duration} min"
        if resume_note:
            msg = f"{msg}: {resume_note[:500]}"
        self._record_status(ctx, row, row.status, row.status, msg)
        self._notify(ctx, row, "sla_resumed", f"SLA resumed on {row.document_number}")

    def confirm_asset(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_work(ctx, row)
        if not (row.asset_name or row.serial_number or row.master_asset_id):
            raise AppException("Enter asset details before confirming")
        now = datetime.now(timezone.utc)
        self._repo.update(
            ctx,
            row_id,
            asset_confirmed_at=now,
            asset_confirmed_by=ctx.user_id,
        )
        self._record_status(ctx, row, row.status, row.status, "Asset details confirmed")
        return self.get_ticket(ctx, row_id)

    def get_circuit_history(self, ctx: TenantContext, row_id: UUID) -> CircuitHistoryResponse:
        """Previous tickets that share the same normalized CKT ID / LSI."""
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        circuit = self._normalize_circuit(row.ckt_id) or self._normalize_circuit(row.lsi)
        if not circuit:
            return CircuitHistoryResponse(count=0, last_ticket_at=None, items=[], ckt_id=None)
        stmt = (
            select(SvcServiceRequest)
            .where(
                SvcServiceRequest.tenant_id == ctx.tenant_id,
                SvcServiceRequest.company_id == row.company_id,
                SvcServiceRequest.is_deleted.is_(False),
                SvcServiceRequest.id != row_id,
            )
            .order_by(SvcServiceRequest.created_at.desc())
            .limit(400)
        )
        stmt = self._scope.apply_svc_filter(stmt, SvcServiceRequest, ctx, branch_scoped=False)
        candidates = list(self._db.scalars(stmt).all())
        items: list[CircuitHistoryItem] = []
        for other in candidates:
            other_ckt = self._normalize_circuit(other.ckt_id) or self._normalize_circuit(other.lsi)
            if other_ckt != circuit:
                continue
            items.append(
                CircuitHistoryItem(
                    id=other.id,
                    document_number=other.document_number,
                    created_at=other.created_at,
                    issue_reported_code=other.issue_reported_code,
                    resolution_comment_code=other.resolution_comment_code,
                    status=other.status,
                    status_label=status_label(other.status, other.reopened_at),
                    subject=other.subject,
                )
            )
            if len(items) >= 50:
                break
        last_at = items[0].created_at if items else None
        return CircuitHistoryResponse(
            count=len(items),
            last_ticket_at=last_at,
            items=items,
            ckt_id=circuit,
        )

    def list_assignment_history(self, ctx: TenantContext, row_id: UUID) -> list[AssignmentHistoryItem]:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if access.level == TicketAccessLevel.DENIED:
            from core.exceptions import ForbiddenException
            raise ForbiddenException("You do not have access to this ticket")
        rows = list(
            self._db.scalars(
                select(SvcTicketAssignmentHistory)
                .where(
                    SvcTicketAssignmentHistory.request_id == row_id,
                    SvcTicketAssignmentHistory.tenant_id == ctx.tenant_id,
                )
                .order_by(SvcTicketAssignmentHistory.changed_at.desc())
            ).all()
        )
        emp_ids = {
            eid
            for h in rows
            for eid in (h.old_owner_employee_id, h.new_owner_employee_id)
            if eid is not None
        }
        names = self._owner_display_names(list(emp_ids))
        out: list[AssignmentHistoryItem] = []
        for h in rows:
            item = AssignmentHistoryItem.model_validate(h)
            item.old_owner_name = names.get(h.old_owner_employee_id) if h.old_owner_employee_id else None
            item.new_owner_name = names.get(h.new_owner_employee_id) if h.new_owner_employee_id else None
            out.append(item)
        return out

    def resume_ticket(self, ctx: TenantContext, row_id: UUID, *, reason: str | None = None):
        """Resume from Awaiting Assignment / pending — continue work without resetting SLA."""
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if not access.can_resume:
            raise AppException("Cannot resume this ticket from its current state")
        old = row.status
        now = datetime.now(timezone.utc)
        if old in ("ticket_registered", "awaiting_assignment"):
            if row.owner_employee_id:
                target = "assigned" if not row.opened_at else "engineer_working"
            else:
                raise AppException("Assign an owner before resuming an awaiting-assignment ticket")
        elif old == "assigned":
            target = "engineer_working"
        else:
            target = "engineer_working"
        self._engine.transition(row, target)
        updates: dict = {"status": row.status}
        if target == "engineer_working" and not row.opened_at:
            updates["opened_at"] = now
            updates["opened_by"] = ctx.user_id
        if not row.sla_started_at:
            updates["sla_started_at"] = now
            updates["due_at"] = now + timedelta(minutes=self._resolution_minutes_for(row))
            updates["sla_status"] = "within_sla"
        self._repo.update(ctx, row_id, **updates)
        self._record_status(ctx, row, old, row.status, reason or "Ticket resumed from awaiting assignment")
        self._notify(ctx, row, "ticket_resumed", f"Ticket {row.document_number} resumed")
        return self.get_ticket(ctx, row_id)

    def pause_awaiting_assignment(self, ctx: TenantContext, row_id: UUID, *, reason: str | None = None):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if not (access.is_manager or access.can_work):
            raise AppException("Not allowed to mark awaiting assignment")
        old = row.status
        self._engine.transition(row, "awaiting_assignment")
        self._repo.update(ctx, row_id, status=row.status)
        self._record_status(ctx, row, old, row.status, reason or "Moved to awaiting assignment")
        self._notify(ctx, row, "awaiting_assignment", f"Ticket {row.document_number} awaiting assignment")
        return self.get_ticket(ctx, row_id)

    def schedule_follow_up(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        follow_up_at: datetime,
        follow_up_note: str | None = None,
    ):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_work(ctx, row)
        self._repo.update(ctx, row_id, follow_up_at=follow_up_at, follow_up_note=follow_up_note)
        self._notify(
            ctx,
            row,
            "follow_up_scheduled",
            follow_up_note or f"Follow-up scheduled for {follow_up_at.isoformat()}",
        )
        return self.get_ticket(ctx, row_id)

    def reopen_ticket(self, ctx: TenantContext, row_id: UUID, *, reason: str | None = None):
        """Backward-compatible alias — creates a pending reopen approval request."""
        if not reason or not reason.strip():
            raise AppException("A reason is required; use reopen-request for the approval workflow")
        self.request_reopen(ctx, row_id, reason=reason.strip())
        return self.get_ticket(ctx, row_id)

    def request_reopen(self, ctx: TenantContext, row_id: UUID, *, reason: str) -> ServiceRequestReopenRequestResponse:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if not (access.is_owner or access.is_co_owner):
            raise AppException("Only the owner or co-owners can request a reopen")
        if row.status != "closed":
            raise AppException("Only closed tickets can be submitted for reopen")
        if self._pending_reopen_request(row_id):
            raise AppException("A reopen request is already pending for this ticket")
        now = datetime.now(timezone.utc)
        req = SvcTicketReopenRequest(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=row.company_id,
            request_id=row_id,
            reason=reason.strip(),
            requested_by=ctx.user_id,
            requested_at=now,
            status="pending",
        )
        self._db.add(req)
        self._db.flush()
        self._notify_service_heads(
            ctx,
            row,
            "reopen_requested",
            f"Reopen requested for ticket {row.document_number}: {reason[:200]}",
        )
        return self._reopen_request_response(req, row)

    def list_pending_reopen_requests(
        self, ctx: TenantContext, *, company_id: UUID | None = None
    ) -> list[ServiceRequestReopenRequestResponse]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        stmt = (
            select(SvcTicketReopenRequest, SvcServiceRequest)
            .join(SvcServiceRequest, SvcServiceRequest.id == SvcTicketReopenRequest.request_id)
            .where(
                SvcTicketReopenRequest.tenant_id == ctx.tenant_id,
                SvcTicketReopenRequest.company_id == cid,
                SvcTicketReopenRequest.status == "pending",
                SvcServiceRequest.is_deleted.is_(False),
            )
            .order_by(SvcTicketReopenRequest.requested_at.asc())
        )
        out: list[ServiceRequestReopenRequestResponse] = []
        for req, row in self._db.execute(stmt).all():
            out.append(self._reopen_request_response(req, row))
        return out

    def approve_reopen(
        self, ctx: TenantContext, reopen_request_id: UUID, *, note: str | None = None
    ) -> ServiceRequestTicketDetail:
        req = self._db.get(SvcTicketReopenRequest, reopen_request_id)
        if req is None or req.tenant_id != ctx.tenant_id:
            raise NotFoundException("Reopen request not found")
        if req.status != "pending":
            raise AppException("Reopen request is not pending")
        row = self._repo.get(ctx, req.request_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._scope.validate_company_access(ctx, row.company_id)
        access = self._access.evaluate(ctx, row)
        if not access.is_manager:
            raise AppException("Only service managers can approve reopen requests")

        now = datetime.now(timezone.utc)
        req.status = "approved"
        req.approved_by = ctx.user_id
        req.approved_at = now
        old = row.status
        self._engine.transition(row, "engineer_working")
        updates: dict = {
            "status": row.status,
            "reopened_at": now,
            "ownership_locked": False,
            "closed_at": None,
        }
        if settings.service_reopen_restart_sla:
            updates["sla_started_at"] = now
            updates["sla_status"] = "within_sla"
            updates.update(self._sla_start_updates(row, now))
        self._repo.update(ctx, row.id, **updates)
        self._record_status(ctx, row, old, row.status, note or f"Reopen approved: {req.reason[:200]}")
        self._notify(ctx, row, "ticket_reopened", f"Ticket {row.document_number} reopened")
        return self.get_ticket(ctx, row.id)

    def reject_reopen(
        self, ctx: TenantContext, reopen_request_id: UUID, *, rejection_reason: str
    ) -> ServiceRequestReopenRequestResponse:
        req = self._db.get(SvcTicketReopenRequest, reopen_request_id)
        if req is None or req.tenant_id != ctx.tenant_id:
            raise NotFoundException("Reopen request not found")
        if req.status != "pending":
            raise AppException("Reopen request is not pending")
        row = self._repo.get(ctx, req.request_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        access = self._access.evaluate(ctx, row)
        if not access.is_manager:
            raise AppException("Only service managers can reject reopen requests")
        req.status = "rejected"
        req.approved_by = ctx.user_id
        req.approved_at = datetime.now(timezone.utc)
        req.rejection_reason = rejection_reason.strip()
        self._db.flush()
        return self._reopen_request_response(req, row)

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
        payload.pop("visit_notes_history", None)
        visit = payload.get("visit_charges") or 0
        movement = payload.get("movement_charges") or 0
        other = payload.get("other_charges") or 0
        if any(k in payload for k in ("visit_charges", "movement_charges", "other_charges")):
            try:
                payload["total_charges"] = Decimal(visit) + Decimal(movement) + Decimal(other)
            except Exception:
                pass
        existing = self._get_field_engineer(row.id)
        if existing:
            remark = payload.get("remarks")
            if remark and remark.strip() and remark.strip() != (existing.remarks or "").strip():
                stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
                line = f"[{stamp}] {remark.strip()}"
                history = existing.visit_notes_history or ""
                existing.visit_notes_history = f"{history}\n{line}".strip() if history else line
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
            new_value=ServiceRequestTicketService._json_safe(payload),
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
        self._channels.dispatch(
            tenant_id=ctx.tenant_id,
            company_id=row.company_id,
            branch_id=row.branch_id,
            request=row,
            notification_type=notification_type,
            message=message,
            recipient_user_id=recipient_user_id,
            created_by=ctx.user_id,
        )

    def _service_head_user_ids(self, ctx: TenantContext) -> list[UUID]:
        """Users who triage / assign tickets (Service Head + Service Manager)."""
        from modules.foundation.models.security import SecPermission, SecRole, SecRolePermission, SecUser, SecUserRole

        # Prefer assigners: anyone with service.request:approve
        stmt = (
            select(SecUser.id)
            .join(SecUserRole, SecUserRole.user_id == SecUser.id)
            .join(SecRole, SecRole.id == SecUserRole.role_id)
            .join(SecRolePermission, SecRolePermission.role_id == SecRole.id)
            .join(SecPermission, SecPermission.id == SecRolePermission.permission_id)
            .where(
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.is_deleted.is_(False),
                SecRole.is_deleted.is_(False),
                SecPermission.permission_code == "service.request:approve",
                SecPermission.is_active.is_(True),
            )
        )
        ids = list(self._db.scalars(stmt).unique().all())
        if ids:
            return ids
        # Fallback: coordinator role code used in older seeds
        stmt = (
            select(SecUser.id)
            .join(SecUserRole, SecUserRole.user_id == SecUser.id)
            .join(SecRole, SecRole.id == SecUserRole.role_id)
            .where(
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.is_deleted.is_(False),
                SecRole.role_code.in_(("SERVICE_COORDINATOR", "SERVICE_MANAGER", "SERVICE_ADMIN")),
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
            hardware_repair=fe.hardware_repair,
            hardware_replacement_yn=fe.hardware_replacement_yn,
            new_device_serial=fe.new_device_serial,
            transport_mode=fe.transport_mode,
            movement_charges=fe.movement_charges,
            visit_charges=fe.visit_charges,
            other_charges=fe.other_charges,
            total_charges=fe.total_charges,
            remarks=fe.remarks,
            payment_approval=fe.payment_approval,
            visit_notes_history=fe.visit_notes_history,
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

    def export_tickets_xlsx(self, ctx: TenantContext, *, company_id: UUID | None = None) -> bytes:
        from io import BytesIO

        from openpyxl import Workbook

        tickets = self.list_tickets(ctx, company_id=company_id)
        wb = Workbook()
        ws = wb.active
        ws.title = "Service Tickets"
        headers = [
            "Ticket Number", "Subject", "Contact", "Email", "Mobile", "Priority", "Status",
            "Mode", "Category", "Serial Number", "Asset Status",
            "Remote Engineer", "Remote Contact", "Remote Date",
            "SLA Started", "Due", "Resolved", "Closed", "Created",
        ]
        ws.append(headers)
        for t in tickets:
            ws.append([
                t.document_number,
                t.subject,
                t.contact_name or "",
                getattr(t, "email", None) or "",
                getattr(t, "mobile", None) or "",
                t.priority,
                t.status,
                t.mode_of_action or "",
                t.ticket_category or "",
                getattr(t, "serial_number", None) or "",
                getattr(t, "asset_status", None) or "",
                getattr(t, "remote_engineer_name", None) or "",
                getattr(t, "remote_engineer_contact", None) or "",
                str(getattr(t, "remote_engineer_date", None) or ""),
                str(getattr(t, "sla_started_at", None) or ""),
                str(t.due_at or ""),
                str(getattr(t, "resolved_at", None) or ""),
                str(getattr(t, "closed_at", None) or ""),
                str(t.created_at),
            ])
        buf = BytesIO()
        wb.save(buf)
        return buf.getvalue()

    def export_timeline_xlsx(self, ctx: TenantContext, row_id: UUID) -> bytes:
        from io import BytesIO

        from openpyxl import Workbook

        items = self.get_timeline(ctx, row_id)
        row = self._repo.get(ctx, row_id)
        wb = Workbook()
        ws = wb.active
        ws.title = "Ticket Timeline"
        ws.append(["Ticket", row.document_number if row else str(row_id)])
        ws.append(["Subject", row.subject if row else ""])
        ws.append([])
        ws.append(["Occurred At", "Event Type", "Title", "From Status", "To Status", "Description", "Actor ID"])
        for item in reversed(items):
            ws.append([
                str(item.get("occurred_at") or ""),
                item.get("event_type") or "",
                item.get("title") or "",
                item.get("from_status") or "",
                item.get("to_status") or "",
                item.get("description") or "",
                str(item.get("actor_id") or ""),
            ])
        buf = BytesIO()
        wb.save(buf)
        return buf.getvalue()

    def _list_field_engineers(self, request_id: UUID) -> list[SvcTicketFieldEngineer]:
        return list(
            self._db.scalars(
                select(SvcTicketFieldEngineer)
                .where(
                    SvcTicketFieldEngineer.request_id == request_id,
                    SvcTicketFieldEngineer.is_deleted.is_(False),
                )
                .order_by(SvcTicketFieldEngineer.created_at.asc())
            ).all()
        )

    def add_field_engineer(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        engineer_name: str,
        engineer_email: str | None = None,
        engineer_contact: str | None = None,
        assigned_date=None,
        work_brief: str | None = None,
        show_issue: bool = True,
        show_customer: bool = True,
        show_site: bool = True,
        show_asset: bool = True,
        show_circuit: bool = True,
    ) -> TicketFieldEngineerResponse:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_work(ctx, row)
        if row.mode_of_action not in ("onsite_support", "oem_support"):
            raise AppException("Field engineers can only be added for Onsite Support or OEM Support mode")
        if not row.ticket_category:
            raise AppException("Choose ticket category before adding a field engineer")
        email = (engineer_email or "").strip().lower()
        fe = SvcTicketFieldEngineer(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=row.company_id,
            branch_id=row.branch_id,
            request_id=row_id,
            engineer_name=engineer_name.strip(),
            engineer_contact=(engineer_contact or "").strip() or None,
            engineer_email=email,
            assigned_date=assigned_date,
            status="assigned",
            work_brief=(work_brief or "").strip() or None,
            show_issue=show_issue,
            show_customer=show_customer,
            show_site=show_site,
            show_asset=show_asset,
            show_circuit=show_circuit,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._db.add(fe)
        self._db.flush()
        # FE portal login removed — assignment stays on the ticket only.
        label = f"{fe.engineer_name}" + (f" ({email})" if email else "")
        self._record_status(
            ctx, row, row.status, row.status, f"Field engineer added: {label}"
        )
        self._notify(ctx, row, "field_engineer_added", f"Field engineer {fe.engineer_name} assigned")
        return TicketFieldEngineerResponse.model_validate(fe)

    def update_field_engineer(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        field_engineer_id: UUID,
        engineer_name: str | None = None,
        engineer_contact: str | None = None,
        engineer_email: str | None = None,
        assigned_date=None,
        work_brief: str | None = None,
        show_issue: bool | None = None,
        show_customer: bool | None = None,
        show_site: bool | None = None,
        show_asset: bool | None = None,
        show_circuit: bool | None = None,
        clear_assigned_date: bool = False,
    ) -> TicketFieldEngineerResponse:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_work(ctx, row)
        fe = self._db.scalar(
            select(SvcTicketFieldEngineer).where(
                SvcTicketFieldEngineer.id == field_engineer_id,
                SvcTicketFieldEngineer.request_id == row_id,
                SvcTicketFieldEngineer.is_deleted.is_(False),
            )
        )
        if fe is None:
            raise NotFoundException("Field engineer not found")

        if engineer_name is not None:
            fe.engineer_name = engineer_name.strip()
        if engineer_contact is not None:
            fe.engineer_contact = engineer_contact.strip() or None
        if engineer_email is not None:
            fe.engineer_email = engineer_email.strip().lower()
        if clear_assigned_date:
            fe.assigned_date = None
        elif assigned_date is not None:
            fe.assigned_date = assigned_date
        if work_brief is not None:
            fe.work_brief = work_brief.strip() or None
        if show_issue is not None:
            fe.show_issue = show_issue
        if show_customer is not None:
            fe.show_customer = show_customer
        if show_site is not None:
            fe.show_site = show_site
        if show_asset is not None:
            fe.show_asset = show_asset
        if show_circuit is not None:
            fe.show_circuit = show_circuit
        fe.updated_by = ctx.user_id
        self._db.flush()

        self._record_status(
            ctx,
            row,
            row.status,
            row.status,
            f"Field engineer updated: {fe.engineer_name}"
            + (f" ({fe.engineer_email})" if fe.engineer_email else ""),
        )
        return TicketFieldEngineerResponse.model_validate(fe)

    @staticmethod
    def _generate_fe_password() -> str:
        alphabet = string.ascii_letters + string.digits
        body = "".join(secrets.choice(alphabet) for _ in range(10))
        return f"Fe{body}1!"

    def _ensure_field_engineer_role(self, tenant_id: UUID) -> SecRole:
        role = self._db.scalar(
            select(SecRole).where(
                SecRole.tenant_id == tenant_id,
                SecRole.role_code == "SERVICE_FIELD_ENGINEER",
                SecRole.is_deleted.is_(False),
            )
        )
        if role is None:
            role = SecRole(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                role_code="SERVICE_FIELD_ENGINEER",
                role_name="Service Field Engineer",
                description="Login for field engineers assigned on service tickets",
                is_system_role=True,
                status="active",
            )
            self._db.add(role)
            self._db.flush()

        perm_map: dict[str, UUID] = {}
        for code in SERVICE_FIELD_ENGINEER_PERMISSIONS:
            pid = self._db.scalar(
                select(SecPermission.id).where(
                    SecPermission.permission_code == code,
                    SecPermission.is_active.is_(True),
                )
            )
            if pid:
                perm_map[code] = pid

        for code in SERVICE_FIELD_ENGINEER_PERMISSIONS:
            perm_id = perm_map.get(code)
            if not perm_id:
                continue
            exists = self._db.scalar(
                select(SecRolePermission).where(
                    SecRolePermission.role_id == role.id,
                    SecRolePermission.permission_id == perm_id,
                )
            )
            if exists:
                continue
            self._db.add(
                SecRolePermission(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    role_id=role.id,
                    permission_id=perm_id,
                    granted_at=datetime.now(timezone.utc),
                )
            )
        self._db.flush()
        return role

    def _provision_field_engineer_login(
        self,
        ctx: TenantContext,
        row: SvcServiceRequest,
        *,
        engineer_name: str,
        engineer_email: str,
        engineer_contact: str | None,
    ) -> dict:
        users = UserService(self._db)
        existing = self._db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.email == engineer_email,
                SecUser.is_deleted.is_(False),
            )
        )
        account_created = False
        temporary_password: str | None = None

        if existing is None:
            temporary_password = self._generate_fe_password()
            created = users.create_user(
                tenant_id=ctx.tenant_id,
                email=engineer_email,
                password=temporary_password,
                display_name=engineer_name[:255],
                user_type="employee",
                created_by=ctx.user_id,
            )
            user = self._db.scalar(select(SecUser).where(SecUser.id == created.id))
            if user is None:
                raise AppException("Failed to create field engineer login")
            account_created = True
        else:
            user = existing
            if user.status == "locked":
                user.status = "active"
                user.locked_until = None
                user.failed_login_count = 0

        role = self._ensure_field_engineer_role(ctx.tenant_id)
        already = self._db.scalar(
            select(SecUserRole).where(
                SecUserRole.user_id == user.id,
                SecUserRole.role_id == role.id,
            )
        )
        if not already:
            users.assign_role(
                tenant_id=ctx.tenant_id,
                user_id=user.id,
                role_id=role.id,
                assigned_by=ctx.user_id,
            )
        else:
            RBACService(self._db).invalidate_user(user.id)

        scope = self._db.scalar(
            select(SecUserOrgScope).where(
                SecUserOrgScope.user_id == user.id,
                SecUserOrgScope.company_id == row.company_id,
            )
        )
        if scope is None:
            self._db.add(
                SecUserOrgScope(
                    id=uuid.uuid4(),
                    tenant_id=ctx.tenant_id,
                    user_id=user.id,
                    company_id=row.company_id,
                    branch_id=row.branch_id,
                    is_default=True,
                    assigned_at=datetime.now(timezone.utc),
                    assigned_by=ctx.user_id,
                )
            )
            self._db.flush()

        login_url = "http://localhost:3000/login"
        if account_created and temporary_password:
            body = (
                f"Hello {engineer_name},\n\n"
                f"You have been assigned as a Field Engineer on service ticket "
                f"{row.document_number}.\n\n"
                f"Login ID (email): {engineer_email}\n"
                f"Password: {temporary_password}\n\n"
                f"Sign in at: {login_url}\n"
                f"Then open Service → Field Engineer to view your tickets and mark work solved.\n\n"
                f"Please change your password after first login if possible.\n\n"
                f"— Service Team"
            )
            note = (
                "New login created. Credentials were emailed to the field engineer "
                "(also shown here if email is not configured)."
            )
        else:
            body = (
                f"Hello {engineer_name},\n\n"
                f"You have been assigned as a Field Engineer on service ticket "
                f"{row.document_number}.\n\n"
                f"Login ID (email): {engineer_email}\n"
                f"Use your existing ERP password to sign in at: {login_url}\n"
                f"Then open Service → Field Engineer.\n\n"
                f"— Service Team"
            )
            note = "Existing ERP login found — password was not changed. Assignment notice emailed if SMTP is configured."

        email_sent = False
        try:
            if settings.smtp_configured:
                send_smtp_email(
                    to_address=engineer_email,
                    subject=f"[{row.document_number}] Field Engineer login details",
                    body_text=body,
                )
                email_sent = True
        except Exception as exc:
            logger.warning("FE credentials email failed: %s", exc)
            email_sent = False

        # Best-effort SMS with login id (password only for new accounts)
        if engineer_contact and settings.sms_gateway_enabled and settings.sms_gateway_url:
            try:
                import httpx

                sms_msg = (
                    f"[{row.document_number}] FE login: {engineer_email}"
                    + (f" / {temporary_password}" if temporary_password else " (use existing password)")
                    + f" → {login_url}"
                )[:480]
                httpx.post(
                    settings.sms_gateway_url,
                    json={"to": engineer_contact, "message": sms_msg},
                    headers={"Authorization": f"Bearer {settings.sms_gateway_api_key}"}
                    if settings.sms_gateway_api_key
                    else None,
                    timeout=8.0,
                )
            except Exception as exc:
                logger.warning("FE credentials SMS failed: %s", exc)

        if not email_sent and account_created:
            note = (
                "New login created. SMTP is not configured — share the temporary password "
                "with the field engineer manually (shown below)."
            )

        return {
            "login_email": engineer_email,
            "temporary_password": temporary_password,
            "account_created": account_created,
            "credentials_email_sent": email_sent,
            "credentials_note": note,
        }

    def issue_field_engineer_credentials(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        field_engineer_id: UUID,
    ) -> TicketFieldEngineerResponse:
        """FE portal login is disabled — manage visit completion on the ticket."""
        raise AppException(
            "Field engineer login portal is disabled. Record the visit on the ticket and mark it complete there."
        )
        # Unreachable — kept for signature compatibility with older callers.
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_work(ctx, row)
        fe = self._db.scalar(
            select(SvcTicketFieldEngineer).where(
                SvcTicketFieldEngineer.id == field_engineer_id,
                SvcTicketFieldEngineer.request_id == row_id,
                SvcTicketFieldEngineer.is_deleted.is_(False),
            )
        )
        if fe is None:
            raise NotFoundException("Field engineer not found")

        email = fe.engineer_email.strip().lower()
        users = UserService(self._db)
        existing = self._db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.email == email,
                SecUser.is_deleted.is_(False),
            )
        )
        temporary_password = self._generate_fe_password()
        account_created = False
        if existing is None:
            created = users.create_user(
                tenant_id=ctx.tenant_id,
                email=email,
                password=temporary_password,
                display_name=fe.engineer_name[:255],
                user_type="employee",
                created_by=ctx.user_id,
            )
            user = self._db.scalar(select(SecUser).where(SecUser.id == created.id))
            if user is None:
                raise AppException("Failed to create field engineer login")
            account_created = True
        else:
            user = existing
            user.password_hash = PasswordHasher.hash_password(temporary_password)
            user.failed_login_count = 0
            user.locked_until = None
            if user.status == "locked":
                user.status = "active"
            self._db.flush()

        role = self._ensure_field_engineer_role(ctx.tenant_id)
        already = self._db.scalar(
            select(SecUserRole).where(
                SecUserRole.user_id == user.id,
                SecUserRole.role_id == role.id,
            )
        )
        if not already:
            users.assign_role(
                tenant_id=ctx.tenant_id,
                user_id=user.id,
                role_id=role.id,
                assigned_by=ctx.user_id,
            )
        else:
            RBACService(self._db).invalidate_user(user.id)

        scope = self._db.scalar(
            select(SecUserOrgScope).where(
                SecUserOrgScope.user_id == user.id,
                SecUserOrgScope.company_id == row.company_id,
            )
        )
        if scope is None:
            self._db.add(
                SecUserOrgScope(
                    id=uuid.uuid4(),
                    tenant_id=ctx.tenant_id,
                    user_id=user.id,
                    company_id=row.company_id,
                    branch_id=row.branch_id,
                    is_default=True,
                    assigned_at=datetime.now(timezone.utc),
                    assigned_by=ctx.user_id,
                )
            )
            self._db.flush()

        login_url = "http://localhost:3000/login"
        body = (
            f"Hello {fe.engineer_name},\n\n"
            f"Your Field Engineer login for ticket {row.document_number}:\n\n"
            f"Login ID (email): {email}\n"
            f"Password: {temporary_password}\n\n"
            f"Sign in at: {login_url}\n"
            f"Then open Service → Field Engineer.\n\n"
            f"— Service Team"
        )
        email_sent = False
        try:
            if settings.smtp_configured:
                send_smtp_email(
                    to_address=email,
                    subject=f"[{row.document_number}] Field Engineer login credentials",
                    body_text=body,
                )
                email_sent = True
        except Exception as exc:
            logger.warning("FE credentials email failed: %s", exc)

        note = (
            "Login ready. Share these credentials with the field engineer "
            + ("(also emailed)." if email_sent else "(SMTP off — copy from screen).")
        )
        data = TicketFieldEngineerResponse.model_validate(fe)
        data.login_email = email
        data.temporary_password = temporary_password
        data.account_created = account_created
        data.credentials_email_sent = email_sent
        data.credentials_note = note
        return data

    def remove_field_engineer(self, ctx: TenantContext, row_id: UUID, *, field_engineer_id: UUID) -> None:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_work(ctx, row)
        fe = self._db.scalar(
            select(SvcTicketFieldEngineer).where(
                SvcTicketFieldEngineer.id == field_engineer_id,
                SvcTicketFieldEngineer.request_id == row_id,
                SvcTicketFieldEngineer.is_deleted.is_(False),
            )
        )
        if fe is None:
            raise NotFoundException("Field engineer not found")
        fe.is_deleted = True
        fe.deleted_at = datetime.now(timezone.utc)
        fe.deleted_by = ctx.user_id
        self._db.flush()

    def list_my_field_engineer_tickets(self, ctx: TenantContext) -> list[FieldEngineerTicketItem]:
        user = self._db.scalar(
            select(SecUser).where(
                SecUser.id == ctx.user_id,
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.is_deleted.is_(False),
            )
        )
        if user is None or not user.email:
            return []
        email = user.email.strip().lower()
        stmt = (
            select(SvcTicketFieldEngineer, SvcServiceRequest)
            .join(SvcServiceRequest, SvcServiceRequest.id == SvcTicketFieldEngineer.request_id)
            .where(
                SvcTicketFieldEngineer.engineer_email == email,
                SvcTicketFieldEngineer.is_deleted.is_(False),
                SvcTicketFieldEngineer.tenant_id == ctx.tenant_id,
                SvcServiceRequest.is_deleted.is_(False),
                SvcServiceRequest.status.notin_(("cancelled",)),
            )
            .order_by(SvcTicketFieldEngineer.created_at.desc())
        )
        items: list[FieldEngineerTicketItem] = []
        for fe, req in self._db.execute(stmt).all():
            items.append(self._fe_ticket_item(fe, req))
        return items

    def _fe_ticket_item(self, fe: SvcTicketFieldEngineer, req: SvcServiceRequest) -> FieldEngineerTicketItem:
        show_issue = bool(getattr(fe, "show_issue", True))
        show_customer = bool(getattr(fe, "show_customer", True))
        show_site = bool(getattr(fe, "show_site", True))
        show_asset = bool(getattr(fe, "show_asset", True))
        show_circuit = bool(getattr(fe, "show_circuit", True))
        return FieldEngineerTicketItem(
            id=req.id,
            document_number=req.document_number,
            subject=req.subject,
            status=req.status,
            priority=req.priority,
            asset_status=req.asset_status if show_asset else None,
            serial_number=req.serial_number if show_asset else None,
            field_engineer_id=fe.id,
            field_engineer_status=fe.status,
            assigned_date=fe.assigned_date,
            solution_summary=fe.solution_summary,
            created_at=req.created_at,
            work_brief=getattr(fe, "work_brief", None),
            show_issue=show_issue,
            show_customer=show_customer,
            show_site=show_site,
            show_asset=show_asset,
            show_circuit=show_circuit,
            issue_description=(req.issue_description or req.description) if show_issue else None,
            end_customer_name=req.end_customer_name if show_customer else None,
            coordinator_name=req.coordinator_name if show_customer else None,
            coordinator_phone=req.coordinator_phone if show_customer else None,
            end_customer_street=req.end_customer_street if show_site else None,
            end_customer_city=req.end_customer_city if show_site else None,
            end_customer_state=req.end_customer_state if show_site else None,
            end_customer_postal_code=req.end_customer_postal_code if show_site else None,
            site_availability=getattr(req, "site_availability", None) if show_site else None,
            site_instructions=getattr(req, "site_instructions", None) if show_site else None,
            asset_name=req.asset_name if show_asset else None,
            reference_sr_number=req.reference_sr_number if show_circuit else None,
            ckt_id=(getattr(req, "ckt_id", None) or req.lsi) if show_circuit else None,
            link_type=getattr(req, "link_type", None) if show_circuit else None,
            bandwidth=getattr(req, "bandwidth", None) if show_circuit else None,
            ports_in_use=getattr(req, "ports_in_use", None) if show_circuit else None,
            ip_details=getattr(req, "ip_details", None) if show_circuit else None,
            previous_fe_notes=getattr(req, "previous_fe_notes", None) if show_circuit else None,
        )

    def _attachments_for_field_engineer(self, field_engineer_id: UUID) -> list:
        from modules.service.service_request_ticket_schemas import ServiceRequestAttachmentResponse

        rows = list(
            self._db.scalars(
                select(SvcServiceRequestAttachment)
                .where(
                    SvcServiceRequestAttachment.field_engineer_id == field_engineer_id,
                    SvcServiceRequestAttachment.is_deleted.is_(False),
                )
                .order_by(SvcServiceRequestAttachment.uploaded_at.asc())
            ).all()
        )
        return [ServiceRequestAttachmentResponse.model_validate(a) for a in rows]

    def _fe_response_with_attachments(self, fe: SvcTicketFieldEngineer) -> TicketFieldEngineerResponse:
        data = TicketFieldEngineerResponse.model_validate(fe)
        data.attachments = self._attachments_for_field_engineer(fe.id)
        return data

    def field_engineer_mark_solved(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        field_engineer_id: UUID,
        solution_summary: str,
        attachments: list | None = None,
    ) -> TicketFieldEngineerResponse:
        """Mark FE visit complete from the ticket (owner/co-owner). No FE portal login."""
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Service request ticket not found")
        self._access.require_work(ctx, row)
        fe = self._db.scalar(
            select(SvcTicketFieldEngineer).where(
                SvcTicketFieldEngineer.id == field_engineer_id,
                SvcTicketFieldEngineer.request_id == row_id,
                SvcTicketFieldEngineer.is_deleted.is_(False),
            )
        )
        if fe is None:
            raise NotFoundException("Field engineer assignment not found")
        if fe.status == "solved":
            raise AppException("Already marked as completed")

        uploaded_names: list[str] = []
        for item in attachments or []:
            payload = item if isinstance(item, dict) else item.model_dump()
            att = self.upload_attachment(
                ctx,
                row_id,
                file_name=payload["file_name"],
                content_base64=payload["content_base64"],
                content_type=payload.get("content_type"),
                field_engineer_id=field_engineer_id,
            )
            uploaded_names.append(att.file_name)

        now = datetime.now(timezone.utc)
        fe.solution_summary = solution_summary.strip()
        fe.status = "solved"
        fe.solved_at = now
        fe.updated_by = ctx.user_id
        self._db.flush()

        files_note = f" Files: {', '.join(uploaded_names)}." if uploaded_names else ""
        reason = (
            f"Field engineer visit completed for {fe.engineer_name} — "
            f"{solution_summary.strip()[:300]}{files_note}"
        )
        self._record_status(ctx, row, row.status, row.status, reason)
        self._notify(
            ctx,
            row,
            "field_engineer_solved",
            f"Field engineer {fe.engineer_name} completed their work on {row.document_number}: "
            f"{solution_summary.strip()[:200]}{files_note}",
        )
        self._notify_service_heads(
            ctx,
            row,
            "field_engineer_solved",
            f"FE {fe.engineer_name} solved work on {row.document_number}",
        )
        return self._fe_response_with_attachments(fe)
