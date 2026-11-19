"""CRUD + resolution for customer/priority SLA policies."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.models.party import MasterCustomer
from modules.service.domain.ticket_status import add_working_minutes
from modules.service.models import SvcCustomerPrioritySla
from modules.service.service.service_scope_validator import ServiceScopeValidator
from modules.service.service_itsm_schemas import CustomerPrioritySlaResponse

UNIT_MINUTES = {"minutes": 1, "hours": 60, "days": 1440}
ALLOWED_PRIORITIES = {"low", "medium", "high", "critical", "p1", "p2", "p3", "p4"}


def normalize_priority(value: str) -> str:
    return (value or "").strip().lower()


def duration_to_minutes(
    *, duration_minutes: int | None, duration: int | None, duration_unit: str | None
) -> int | None:
    if duration_minutes is not None:
        return int(duration_minutes)
    if duration is not None and duration_unit:
        return int(duration) * UNIT_MINUTES[duration_unit]
    return None


def compute_due_at(start: datetime, minutes: int, calendar_type: str) -> datetime:
    """Due time for a policy: wall-clock minutes, or Mon-Fri working-hour minutes."""
    if calendar_type == "working":
        return add_working_minutes(
            start,
            minutes,
            day_start_hour=settings.service_working_day_start_hour,
            day_end_hour=settings.service_working_day_end_hour,
            utc_offset_minutes=settings.service_business_utc_offset_minutes,
        )
    return start + timedelta(minutes=minutes)


def policy_snapshot(policy: SvcCustomerPrioritySla, *, captured_at: datetime) -> dict:
    """Immutable copy stored on the ticket — later policy edits never touch it."""
    return {
        "policy_id": str(policy.id),
        "customer_id": str(policy.customer_id),
        "priority": policy.priority,
        "duration_minutes": policy.duration_minutes,
        "calendar_type": policy.calendar_type,
        "effective_from": policy.effective_from.isoformat() if policy.effective_from else None,
        "effective_to": policy.effective_to.isoformat() if policy.effective_to else None,
        "escalation": policy.escalation_json,
        "sla_id": str(policy.sla_id) if policy.sla_id else None,
        "policy_version": policy.version,
        "captured_at": captured_at.isoformat(),
    }


class CustomerPrioritySlaService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._scope = ServiceScopeValidator(db)

    # ── queries ──────────────────────────────────────────────────────
    def _get_row(self, ctx: TenantContext, row_id: UUID) -> SvcCustomerPrioritySla:
        stmt = select(SvcCustomerPrioritySla).where(
            SvcCustomerPrioritySla.id == row_id,
            SvcCustomerPrioritySla.tenant_id == ctx.tenant_id,
            SvcCustomerPrioritySla.is_deleted.is_(False),
        )
        row = self._db.scalar(stmt)
        if row is None:
            raise NotFoundException("Customer priority SLA not found")
        self._scope.validate_company_access(ctx, row.company_id)
        return row

    def _customer_names(self, ids: list[UUID]) -> dict[UUID, str]:
        if not ids:
            return {}
        rows = self._db.execute(
            select(MasterCustomer.id, MasterCustomer.customer_name).where(MasterCustomer.id.in_(set(ids)))
        ).all()
        return {cid: name for cid, name in rows}

    def _to_response(self, rows: list[SvcCustomerPrioritySla]) -> list[CustomerPrioritySlaResponse]:
        names = self._customer_names([r.customer_id for r in rows])
        out = []
        for r in rows:
            item = CustomerPrioritySlaResponse.model_validate(r)
            item.customer_name = names.get(r.customer_id)
            out.append(item)
        return out

    def list(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        customer_id: UUID | None = None,
        priority: str | None = None,
        active_only: bool = False,
    ) -> list[CustomerPrioritySlaResponse]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        stmt = select(SvcCustomerPrioritySla).where(
            SvcCustomerPrioritySla.tenant_id == ctx.tenant_id,
            SvcCustomerPrioritySla.company_id == cid,
            SvcCustomerPrioritySla.is_deleted.is_(False),
        )
        if customer_id:
            stmt = stmt.where(SvcCustomerPrioritySla.customer_id == customer_id)
        if priority:
            stmt = stmt.where(func.lower(SvcCustomerPrioritySla.priority) == normalize_priority(priority))
        if active_only:
            stmt = stmt.where(SvcCustomerPrioritySla.is_active.is_(True))
        stmt = stmt.order_by(
            SvcCustomerPrioritySla.customer_id,
            SvcCustomerPrioritySla.priority,
            SvcCustomerPrioritySla.effective_from.desc().nullslast(),
        )
        return self._to_response(list(self._db.scalars(stmt).all()))

    def get(self, ctx: TenantContext, row_id: UUID) -> CustomerPrioritySlaResponse:
        return self._to_response([self._get_row(ctx, row_id)])[0]

    # ── mutations ────────────────────────────────────────────────────
    def _validate_priority(self, priority: str) -> str:
        p = normalize_priority(priority)
        if p not in ALLOWED_PRIORITIES:
            raise AppException(f"Priority must be one of: {', '.join(sorted(ALLOWED_PRIORITIES))}")
        return p

    def _validate_customer(self, ctx: TenantContext, customer_id: UUID) -> None:
        exists = self._db.scalar(
            select(MasterCustomer.id).where(
                MasterCustomer.id == customer_id,
                MasterCustomer.tenant_id == ctx.tenant_id,
                MasterCustomer.is_deleted.is_(False),
            )
        )
        if exists is None:
            raise NotFoundException("Customer not found")

    def create(self, ctx: TenantContext, **fields) -> CustomerPrioritySlaResponse:
        cid = self._scope.resolve_company_id(ctx, fields.pop("company_id", None))
        customer_id = fields["customer_id"]
        self._validate_customer(ctx, customer_id)
        minutes = duration_to_minutes(
            duration_minutes=fields.get("duration_minutes"),
            duration=fields.get("duration"),
            duration_unit=fields.get("duration_unit"),
        )
        if not minutes or minutes <= 0:
            raise AppException("Duration must be greater than zero")
        row = SvcCustomerPrioritySla(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=cid,
            customer_id=customer_id,
            priority=self._validate_priority(fields["priority"]),
            duration_minutes=minutes,
            calendar_type=fields.get("calendar_type") or "calendar",
            effective_from=fields.get("effective_from"),
            effective_to=fields.get("effective_to"),
            escalation_json=fields.get("escalation_json"),
            sla_id=fields.get("sla_id"),
            is_active=fields.get("is_active", True),
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._db.add(row)
        self._db.flush()
        return self._to_response([row])[0]

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> CustomerPrioritySlaResponse:
        row = self._get_row(ctx, row_id)
        fields.pop("version", None)
        minutes = duration_to_minutes(
            duration_minutes=fields.pop("duration_minutes", None),
            duration=fields.pop("duration", None),
            duration_unit=fields.pop("duration_unit", None),
        )
        if minutes is not None:
            row.duration_minutes = minutes
        if "priority" in fields and fields["priority"] is not None:
            row.priority = self._validate_priority(fields.pop("priority"))
        else:
            fields.pop("priority", None)
        for key in ("calendar_type", "effective_from", "effective_to", "escalation_json", "sla_id", "is_active"):
            if key in fields:
                setattr(row, key, fields[key])
        if row.effective_from and row.effective_to and row.effective_to < row.effective_from:
            raise AppException("effective_to cannot be before effective_from")
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self._db.flush()
        return self._to_response([row])[0]

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        row = self._get_row(ctx, row_id)
        row.is_deleted = True
        row.deleted_at = datetime.now(timezone.utc)
        row.deleted_by = ctx.user_id
        self._db.flush()

    # ── resolution used when a ticket's SLA starts ───────────────────
    def resolve_policy(
        self,
        *,
        tenant_id: UUID,
        company_id: UUID,
        customer_id: UUID,
        priority: str | None,
        on_date: date | None = None,
    ) -> SvcCustomerPrioritySla | None:
        if not priority:
            return None
        today = on_date or datetime.now(timezone.utc).date()
        stmt = (
            select(SvcCustomerPrioritySla)
            .where(
                SvcCustomerPrioritySla.tenant_id == tenant_id,
                SvcCustomerPrioritySla.company_id == company_id,
                SvcCustomerPrioritySla.customer_id == customer_id,
                func.lower(SvcCustomerPrioritySla.priority) == normalize_priority(priority),
                SvcCustomerPrioritySla.is_active.is_(True),
                SvcCustomerPrioritySla.is_deleted.is_(False),
                (SvcCustomerPrioritySla.effective_from.is_(None))
                | (SvcCustomerPrioritySla.effective_from <= today),
                (SvcCustomerPrioritySla.effective_to.is_(None))
                | (SvcCustomerPrioritySla.effective_to >= today),
            )
            .order_by(
                SvcCustomerPrioritySla.effective_from.desc().nullslast(),
                SvcCustomerPrioritySla.created_at.desc(),
            )
            .limit(1)
        )
        return self._db.scalar(stmt)
