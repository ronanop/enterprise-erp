"""Shift swap + rotation application services."""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.exceptions import InvalidLeaveRequestState
from modules.hr.repository.roster_entry_repository import RosterEntryRepository
from modules.hr.repository.shift_assignment_repository import ShiftAssignmentRepository
from modules.hr.repository.shift_swap_rotation_repository import (
    ShiftRotationRepository,
    ShiftSwapRepository,
)
from modules.hr.service.hr_scope_validator import HrScopeValidator


class ShiftRotationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ShiftRotationRepository(db)
        self._scope = HrScopeValidator(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        rotation_code: str,
        rotation_name: str,
        effective_from: date,
        sequence: list[str],
        employee_ids: list[str],
        company_id: UUID | None = None,
        cycle: str = "weekly",
        status: str = "active",
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        if cycle not in {"weekly", "biweekly", "monthly"}:
            raise AppException("Invalid rotation cycle")
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            rotation_code=rotation_code,
            rotation_name=rotation_name,
            cycle=cycle,
            sequence_json=json.dumps(sequence),
            employee_ids_json=json.dumps(employee_ids),
            effective_from=effective_from,
            status=status,
        )


class ShiftSwapService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ShiftSwapRepository(db)
        self._roster = RosterEntryRepository(db)
        self._assignments = ShiftAssignmentRepository(db)
        self._scope = HrScopeValidator(db)
        self._master = HrMasterDataAdapter(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Shift swap request not found")
        return row

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        swap_date: date,
        company_id: UUID | None = None,
        current_shift_id: UUID | None = None,
        requested_shift_id: UUID | None = None,
        swap_with_employee_id: UUID | None = None,
        reason: str | None = None,
        status: str = "draft",
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        if swap_with_employee_id:
            self._master.get_employee(ctx, swap_with_employee_id)
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            swap_date=swap_date,
            current_shift_id=current_shift_id,
            requested_shift_id=requested_shift_id,
            swap_with_employee_id=swap_with_employee_id,
            reason=reason,
            status=status,
        )

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.status != "draft":
            raise InvalidLeaveRequestState("Only draft swap requests can be submitted")
        return self._repo.update(ctx, row_id, status="submitted")

    def manager_approve(self, ctx: TenantContext, row_id: UUID, *, approver_employee_id: UUID | None = None):
        row = self.get(ctx, row_id)
        if row.status != "submitted":
            raise InvalidLeaveRequestState("Only submitted swaps can be manager-approved")
        return self._repo.update(
            ctx,
            row_id,
            status="manager_approved",
            manager_approver_id=approver_employee_id,
        )

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.status not in {"submitted", "manager_approved"}:
            raise InvalidLeaveRequestState("Swap must be submitted or manager-approved")
        self._apply_swap(ctx, row)
        updated = self._repo.update(
            ctx,
            row_id,
            status="approved",
            decided_at=datetime.now(timezone.utc),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_shift_swap_request",
            entity_id=row_id,
            operation="approve",
            performed_by=ctx.user_id,
        )
        return updated

    def reject(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.status not in {"submitted", "manager_approved"}:
            raise InvalidLeaveRequestState("Only submitted/manager-approved swaps can be rejected")
        return self._repo.update(
            ctx,
            row_id,
            status="rejected",
            decided_at=datetime.now(timezone.utc),
        )

    def _apply_swap(self, ctx: TenantContext, row) -> None:
        """Best-effort: swap roster entries for the date, else flip assignment shift_ids."""
        if not row.requested_shift_id:
            return
        roster_rows = self._roster.list_rows(ctx, row.company_id)
        emp_roster = next(
            (
                r
                for r in roster_rows
                if r.employee_id == row.employee_id and r.roster_date == row.swap_date
            ),
            None,
        )
        other_roster = None
        if row.swap_with_employee_id:
            other_roster = next(
                (
                    r
                    for r in roster_rows
                    if r.employee_id == row.swap_with_employee_id and r.roster_date == row.swap_date
                ),
                None,
            )
        if emp_roster is not None:
            old_shift = emp_roster.shift_id
            self._roster.update(ctx, emp_roster.id, shift_id=row.requested_shift_id)
            if other_roster is not None and row.current_shift_id:
                self._roster.update(ctx, other_roster.id, shift_id=old_shift or row.current_shift_id)
            return

        # Fallback: update active assignment for requester
        for asg in self._assignments.list_rows(ctx, row.company_id):
            if asg.employee_id == row.employee_id and getattr(asg, "status", None) in {
                None,
                "active",
                "approved",
                "assigned",
            }:
                self._assignments.update(ctx, asg.id, shift_id=row.requested_shift_id)
                break
