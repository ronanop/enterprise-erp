"""Shift / shift assignment services."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.enums import HrEntityType, ShiftAssignmentStatus
from modules.hr.models import HrShiftAssignment
from modules.hr.repository.shift_assignment_repository import ShiftAssignmentRepository
from modules.hr.repository.shift_repository import ShiftRepository
from modules.hr.service.document_number_service import DocumentNumberService
from modules.hr.service.engines import ShiftAssignmentEngine, ShiftEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator


class ShiftService:
    def __init__(self, db: Session) -> None:
        self._repo = ShiftRepository(db)
        self._scope = HrScopeValidator(db)
        self._engine = ShiftEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Shift not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.create(ctx, company_id=cid, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Shift not found")
        return row


class ShiftAssignmentService:
    def __init__(self, db: Session) -> None:
        self._repo = ShiftAssignmentRepository(db)
        self._shifts = ShiftRepository(db)
        self._scope = HrScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = ShiftAssignmentEngine()
        self._master = HrMasterDataAdapter(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Shift assignment not found")
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        if "shift_id" in fields and fields["shift_id"] is not None:
            if self._shifts.get(ctx, fields["shift_id"]) is None:
                raise NotFoundException("Shift not found")
        if "employee_id" in fields and fields["employee_id"] is not None:
            self._master.get_employee(ctx, fields["employee_id"])
        if "branch_id" in fields and fields["branch_id"] is not None:
            self._scope.validate_branch_access(ctx, fields["branch_id"])
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Shift assignment not found")
        return row

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        shift_id: UUID,
        effective_from: date,
        company_id: UUID | None = None,
        **fields,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        if self._shifts.get(ctx, shift_id) is None:
            raise NotFoundException("Shift not found")
        doc = self._numbers.generate(
            HrEntityType.SHIFT_ASSIGNMENT, cid, HrShiftAssignment, "document_number"
        )
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            shift_id=shift_id,
            effective_from=effective_from,
            document_number=doc,
            status=fields.pop("status", ShiftAssignmentStatus.DRAFT.value),
            **fields,
        )

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.approve(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        if not self._repo.soft_delete(ctx, row_id):
            raise NotFoundException("Shift assignment not found")
