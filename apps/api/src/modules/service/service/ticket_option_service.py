"""CRUD for admin-managed Mode / Category ticket dropdown options."""

from __future__ import annotations

import uuid
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.service.models import SvcTicketOption
from modules.service.service.service_scope_validator import ServiceScopeValidator
from modules.service.service_request_ticket_schemas import TicketOptionResponse


class TicketOptionService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._scope = ServiceScopeValidator(db)

    def list(
        self,
        ctx: TenantContext,
        *,
        option_type: str | None = None,
        company_id: UUID | None = None,
        active_only: bool = True,
    ) -> list[TicketOptionResponse]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        stmt = select(SvcTicketOption).where(
            SvcTicketOption.company_id == cid,
            SvcTicketOption.is_deleted.is_(False),
        )
        if option_type:
            stmt = stmt.where(SvcTicketOption.option_type == option_type)
        if active_only:
            stmt = stmt.where(SvcTicketOption.status == "active")
        stmt = stmt.order_by(SvcTicketOption.sort_order.asc(), SvcTicketOption.option_label.asc())
        rows = list(self._db.scalars(stmt).all())
        # Always backfill missing master types (mode/category may exist while issue/resolution do not).
        if option_type in (None, "mode", "category", "issue_reported", "resolution_comment"):
            if self._ensure_defaults(ctx, cid) or not rows:
                rows = list(self._db.scalars(stmt).all())
        return [TicketOptionResponse.model_validate(r) for r in rows]

    def create(
        self,
        ctx: TenantContext,
        *,
        option_type: str,
        option_code: str,
        option_label: str,
        sort_order: int = 0,
        status: str = "active",
        company_id: UUID | None = None,
    ) -> TicketOptionResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        code = option_code.strip().lower().replace(" ", "_")
        existing = self._db.scalar(
            select(SvcTicketOption).where(
                SvcTicketOption.company_id == cid,
                SvcTicketOption.option_type == option_type,
                SvcTicketOption.option_code == code,
                SvcTicketOption.is_deleted.is_(False),
            )
        )
        if existing:
            raise AppException(f"Option '{code}' already exists for {option_type}", status_code=409)
        row = SvcTicketOption(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=cid,
            option_type=option_type,
            option_code=code,
            option_label=option_label.strip(),
            sort_order=sort_order,
            status=status,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._db.add(row)
        self._db.flush()
        return TicketOptionResponse.model_validate(row)

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> TicketOptionResponse:
        row = self._db.scalar(
            select(SvcTicketOption).where(
                SvcTicketOption.id == row_id,
                SvcTicketOption.tenant_id == ctx.tenant_id,
                SvcTicketOption.is_deleted.is_(False),
            )
        )
        if row is None:
            raise NotFoundException("Ticket option not found")
        for k, v in fields.items():
            if v is not None and hasattr(row, k):
                setattr(row, k, v)
        row.updated_by = ctx.user_id
        self._db.flush()
        return TicketOptionResponse.model_validate(row)

    def _ensure_defaults(self, ctx: TenantContext, company_id: UUID) -> bool:
        """Insert missing mode/category/issue/resolution masters. Returns True if any row was added."""
        defaults = [
            ("mode", "remote_support", "Remote Support", 1),
            ("mode", "onsite_support", "Onsite Support", 2),
            ("mode", "oem_support", "OEM Support", 3),
            ("category", "hardware", "Hardware", 1),
            ("category", "software", "Software", 2),
            ("category", "network", "Network", 3),
            ("issue_reported", "link_down", "Link Down", 1),
            ("issue_reported", "intermittent", "Intermittent Connectivity", 2),
            ("issue_reported", "hardware_fault", "Hardware Fault", 3),
            ("issue_reported", "configuration", "Configuration Issue", 4),
            ("issue_reported", "other", "Other", 99),
            ("resolution_comment", "replaced_hardware", "Replaced Hardware", 1),
            ("resolution_comment", "replaced_software", "Replaced Software", 2),
            ("resolution_comment", "replaced_device", "Replaced Device", 3),
            ("resolution_comment", "reconfigured", "Reconfigured / Settings Fixed", 4),
            ("resolution_comment", "provider_issue", "Provider / NOC Resolved", 5),
            ("resolution_comment", "customer_action", "Customer Action Required", 6),
            ("resolution_comment", "no_fault_found", "No Fault Found", 7),
            ("resolution_comment", "other", "Other", 99),
        ]
        added = False
        for otype, code, label, sort in defaults:
            # Unique key is (company_id, option_type, option_code) including soft-deleted rows.
            existing = self._db.scalar(
                select(SvcTicketOption).where(
                    SvcTicketOption.company_id == company_id,
                    SvcTicketOption.option_type == otype,
                    SvcTicketOption.option_code == code,
                )
            )
            if existing is not None:
                if existing.is_deleted:
                    existing.is_deleted = False
                    existing.deleted_at = None
                    existing.deleted_by = None
                    existing.status = "active"
                    existing.option_label = label
                    existing.sort_order = sort
                    existing.updated_by = ctx.user_id
                    added = True
                continue
            self._db.add(
                SvcTicketOption(
                    id=uuid.uuid4(),
                    tenant_id=ctx.tenant_id,
                    company_id=company_id,
                    option_type=otype,
                    option_code=code,
                    option_label=label,
                    sort_order=sort,
                    status="active",
                    created_by=ctx.user_id,
                    updated_by=ctx.user_id,
                )
            )
            added = True
        if added:
            self._db.flush()
        return added
