"""Roster entry application service."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.repository.roster_entry_repository import RosterEntryRepository
from modules.hr.repository.shift_repository import ShiftRepository
from modules.hr.service.hr_scope_validator import HrScopeValidator

_ALLOWED_STATUSES = {"draft", "published", "cancelled"}


class RosterEntryService:
    def __init__(self, db: Session) -> None:
        self._repo = RosterEntryRepository(db)
        self._shifts = ShiftRepository(db)
        self._scope = HrScopeValidator(db)
        self._master = HrMasterDataAdapter(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Roster entry not found")
        return row

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        shift_id: UUID,
        roster_date: date,
        company_id: UUID | None = None,
        **fields,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        if self._shifts.get(ctx, shift_id) is None:
            raise NotFoundException("Shift not found")
        status = fields.pop("status", "draft")
        if status not in _ALLOWED_STATUSES:
            raise AppException(
                f"Invalid roster status '{status}'. Allowed: {sorted(_ALLOWED_STATUSES)}"
            )
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            shift_id=shift_id,
            roster_date=roster_date,
            status=status,
            **fields,
        )

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        if "shift_id" in fields and fields["shift_id"] is not None:
            if self._shifts.get(ctx, fields["shift_id"]) is None:
                raise NotFoundException("Shift not found")
        if "employee_id" in fields and fields["employee_id"] is not None:
            self._master.get_employee(ctx, fields["employee_id"])
        if "branch_id" in fields and fields["branch_id"] is not None:
            self._scope.validate_branch_access(ctx, fields["branch_id"])
        status = fields.get("status")
        if status is not None and status not in _ALLOWED_STATUSES:
            raise AppException(
                f"Invalid roster status '{status}'. Allowed: {sorted(_ALLOWED_STATUSES)}"
            )
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Roster entry not found")
        return row

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        if not self._repo.soft_delete(ctx, row_id):
            raise NotFoundException("Roster entry not found")
