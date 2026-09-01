"""Row-level access rules for service request tickets."""

from dataclasses import dataclass
from enum import Enum
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.service.rbac_service import RBACService
from modules.master_data.models.employee import MasterEmployee
from modules.service.models import (
    SvcServiceRequest,
    SvcServiceRequestCoOwner,
    SvcServiceRequestStakeholder,
)


class TicketAccessLevel(str, Enum):
    FULL = "full"
    VIEW_ONLY = "view_only"
    ASSIGN_PREVIEW = "assign_preview"
    STAKEHOLDER = "stakeholder"
    DENIED = "denied"


@dataclass(frozen=True)
class TicketAccess:
    level: TicketAccessLevel
    employee_id: UUID | None
    is_owner: bool
    is_co_owner: bool
    is_manager: bool
    is_stakeholder: bool
    can_assign: bool
    can_work: bool
    can_manage_collaborators: bool
    can_reopen: bool
    can_open: bool = False
    is_opened: bool = False
    can_end: bool = False
    can_resume: bool = False


class TicketAccessService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._rbac = RBACService(db)

    def resolve_employee_id(self, ctx: TenantContext) -> UUID | None:
        user = self._db.scalar(
            select(SecUser).where(
                SecUser.id == ctx.user_id,
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.is_deleted.is_(False),
            )
        )
        if user and user.employee_id:
            return user.employee_id
        emp = self._db.scalar(
            select(MasterEmployee.id).where(
                MasterEmployee.user_id == ctx.user_id,
                MasterEmployee.tenant_id == ctx.tenant_id,
                MasterEmployee.is_deleted.is_(False),
            )
        )
        return emp

    def is_manager(self, ctx: TenantContext) -> bool:
        return self._rbac.has_permission(ctx.user_id, ctx.tenant_id, "service.request:approve")

    def get_co_owner_ids(self, request_id: UUID) -> set[UUID]:
        rows = self._db.scalars(
            select(SvcServiceRequestCoOwner.employee_id).where(
                SvcServiceRequestCoOwner.request_id == request_id,
                SvcServiceRequestCoOwner.is_deleted.is_(False),
            )
        ).all()
        return set(rows)

    def is_stakeholder_email(self, request_id: UUID, email: str | None) -> bool:
        if not email:
            return False
        normalized = email.strip().lower()
        row = self._db.scalar(
            select(SvcServiceRequestStakeholder.id).where(
                SvcServiceRequestStakeholder.request_id == request_id,
                SvcServiceRequestStakeholder.is_deleted.is_(False),
                SvcServiceRequestStakeholder.email.ilike(normalized),
            )
        )
        return row is not None

    def is_field_engineer_email(self, request_id: UUID, email: str | None) -> bool:
        if not email:
            return False
        from modules.service.models import SvcTicketFieldEngineer

        normalized = email.strip().lower()
        row = self._db.scalar(
            select(SvcTicketFieldEngineer.id).where(
                SvcTicketFieldEngineer.request_id == request_id,
                SvcTicketFieldEngineer.is_deleted.is_(False),
                SvcTicketFieldEngineer.engineer_email == normalized,
            )
        )
        return row is not None

    def evaluate(self, ctx: TenantContext, row: SvcServiceRequest) -> TicketAccess:
        employee_id = self.resolve_employee_id(ctx)
        is_manager = self.is_manager(ctx)
        co_owner_ids = self.get_co_owner_ids(row.id)
        is_owner = bool(employee_id and row.owner_employee_id == employee_id)
        is_co_owner = bool(employee_id and employee_id in co_owner_ids)

        user = self._db.scalar(
            select(SecUser).where(SecUser.id == ctx.user_id, SecUser.is_deleted.is_(False))
        )
        is_stakeholder = self.is_stakeholder_email(row.id, user.email if user else None)
        is_field_engineer = self.is_field_engineer_email(row.id, user.email if user else None)

        unassigned = row.owner_employee_id is None
        closed = row.status == "closed"
        locked = row.ownership_locked or closed
        awaiting = row.status in ("ticket_registered", "awaiting_assignment")
        is_opened = row.opened_at is not None or row.status not in (
            "assigned",
            "ticket_registered",
            "awaiting_assignment",
        )

        if is_owner or is_co_owner:
            level = TicketAccessLevel.FULL
        elif is_manager and unassigned:
            level = TicketAccessLevel.ASSIGN_PREVIEW
        elif is_manager:
            level = TicketAccessLevel.VIEW_ONLY
        elif unassigned:
            level = TicketAccessLevel.ASSIGN_PREVIEW
        elif is_field_engineer:
            level = TicketAccessLevel.VIEW_ONLY
        elif is_stakeholder:
            level = TicketAccessLevel.STAKEHOLDER
        else:
            level = TicketAccessLevel.DENIED

        can_assign = is_manager and not locked and (unassigned or not row.owner_employee_id)
        can_open = (
            (is_owner or is_co_owner)
            and not closed
            and row.status == "assigned"
            and row.opened_at is None
        )
        can_work = (is_owner or is_co_owner) and not closed and is_opened
        can_manage_collaborators = is_owner and not locked and is_opened
        can_reopen = is_owner and closed
        # Helpdesk End only — engineer resolves (End SLA); helpdesk alone closes
        can_end = is_manager and row.status == "resolved"
        can_resume = (is_manager or is_owner or is_co_owner) and not closed and (
            awaiting or row.status in ("pending_customer", "pending_oem", "assigned")
        )

        return TicketAccess(
            level=level,
            employee_id=employee_id,
            is_owner=is_owner,
            is_co_owner=is_co_owner,
            is_manager=is_manager,
            is_stakeholder=is_stakeholder,
            can_assign=can_assign,
            can_work=can_work,
            can_manage_collaborators=can_manage_collaborators,
            can_reopen=can_reopen,
            can_open=can_open,
            is_opened=is_opened,
            can_end=can_end,
            can_resume=can_resume,
        )

    def require_level(
        self,
        ctx: TenantContext,
        row: SvcServiceRequest,
        *allowed: TicketAccessLevel,
    ) -> TicketAccess:
        access = self.evaluate(ctx, row)
        if access.level not in allowed:
            raise ForbiddenException("You do not have access to this ticket")
        return access

    def require_work(self, ctx: TenantContext, row: SvcServiceRequest) -> TicketAccess:
        access = self.evaluate(ctx, row)
        if not access.can_work:
            raise ForbiddenException("Only the ticket owner or co-owners can perform this action")
        return access

    def require_owner(self, ctx: TenantContext, row: SvcServiceRequest) -> TicketAccess:
        access = self.evaluate(ctx, row)
        if not access.is_owner:
            raise ForbiddenException("Only the ticket owner can perform this action")
        return access

    def require_assign(self, ctx: TenantContext, row: SvcServiceRequest) -> TicketAccess:
        access = self.evaluate(ctx, row)
        if not access.can_assign:
            raise ForbiddenException("Cannot assign owner for this ticket")
        return access
