"""Management group configuration service."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, ConflictException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.hr.domain.enums import ShiftAssignmentStatus
from modules.hr.domain.management_group_features import (
    DEFAULT_GROUP_SPECS,
    catalog_for_api,
    normalize_toggles,
    preset_for_group_code,
    validate_toggles,
)
from modules.hr.models.employment import HrEmployment
from modules.hr.repository.employment_repository import EmploymentRepository
from modules.hr.repository.management_group_repository import ManagementGroupRepository
from modules.hr.repository.shift_assignment_repository import ShiftAssignmentRepository
from modules.hr.repository.shift_repository import ShiftRepository
from modules.hr.service.hr_scope_validator import HrScopeValidator
from modules.hr.service.shift_service import ShiftAssignmentService


class ManagementGroupService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ManagementGroupRepository(db)
        self._shifts = ShiftRepository(db)
        self._shift_assignments = ShiftAssignmentRepository(db)
        self._employment = EmploymentRepository(db)
        self._scope = HrScopeValidator(db)
        self._audit = AuditService(db)

    def feature_catalog(self) -> list[dict]:
        return catalog_for_api()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self.ensure_default_groups(ctx, cid)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Management group not found")
        return row

    def ensure_default_groups(self, ctx: TenantContext, company_id: UUID) -> None:
        if self._repo.count_for_company(ctx, company_id) > 0:
            return
        shift = self._first_active_shift(ctx, company_id)
        if shift is None:
            return
        for spec in DEFAULT_GROUP_SPECS:
            toggles = preset_for_group_code(spec["group_code"])
            self._repo.create(
                ctx,
                company_id=company_id,
                group_code=spec["group_code"],
                group_name=spec["group_name"],
                description=spec.get("description"),
                employment_type=spec.get("employment_type", "permanent"),
                status="active",
                default_shift_id=shift.id,
                feature_toggles_json=toggles,
            )
        self._db.flush()

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        shift_id = fields.get("default_shift_id")
        if shift_id is None or self._shifts.get(ctx, shift_id) is None:
            raise AppException("Default attendance shift group (shift) is required")
        try:
            toggles = validate_toggles(fields.pop("feature_toggles_json", None))
        except ValueError as exc:
            raise AppException(str(exc)) from exc
        row = self._repo.create(
            ctx,
            company_id=cid,
            feature_toggles_json=toggles,
            **fields,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_management_group",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        prev = self.get(ctx, row_id)
        prev_toggles = dict(prev.feature_toggles_json or {})
        if "default_shift_id" in fields and fields["default_shift_id"] is not None:
            if self._shifts.get(ctx, fields["default_shift_id"]) is None:
                raise NotFoundException("Shift not found")
        if "feature_toggles_json" in fields:
            try:
                fields["feature_toggles_json"] = validate_toggles(fields["feature_toggles_json"])
            except ValueError as exc:
                raise AppException(str(exc)) from exc
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Management group not found")
        new_toggles = dict(row.feature_toggles_json or {})
        for key in set(prev_toggles) | set(new_toggles):
            if prev_toggles.get(key) != new_toggles.get(key):
                self._audit.log_entity_change(
                    tenant_id=ctx.tenant_id,
                    entity_name="hr_management_group",
                    entity_id=row.id,
                    operation="update",
                    performed_by=ctx.user_id,
                    old_value={"feature_toggle": key, "value": prev_toggles.get(key), "group_code": row.group_code},
                    new_value={"feature_toggle": key, "value": new_toggles.get(key), "group_code": row.group_code},
                )
        return row

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        row = self.get(ctx, row_id)
        count = self._repo.count_employees(ctx, row.company_id, row_id)
        if count > 0:
            raise ConflictException(
                f"Cannot delete management group assigned to {count} employee(s)"
            )
        if not self._repo.soft_delete(ctx, row_id):
            raise NotFoundException("Management group not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_management_group",
            entity_id=row_id,
            operation="delete",
            performed_by=ctx.user_id,
        )

    def effective_toggles_for_employee(self, ctx: TenantContext, employee_id: UUID) -> dict[str, bool]:
        cid = self._scope.resolve_company_id(ctx, None)
        rows = [
            r
            for r in self._employment.list_rows(ctx, cid)
            if r.employee_id == employee_id and not r.is_deleted
        ]
        employment = rows[0] if rows else None
        if employment is None or employment.management_group_id is None:
            return normalize_toggles(None)
        group = self._repo.get(ctx, employment.management_group_id)
        if group is None:
            return normalize_toggles(None)
        return normalize_toggles(group.feature_toggles_json)

    def apply_to_employment(
        self,
        ctx: TenantContext,
        employment: HrEmployment,
        *,
        auto_shift: bool = True,
    ) -> None:
        if employment.management_group_id is None:
            return
        group = self.get(ctx, employment.management_group_id)
        if not auto_shift:
            return
        self._assign_shift_from_group(ctx, employment, group.default_shift_id)

    def _assign_shift_from_group(
        self,
        ctx: TenantContext,
        employment: HrEmployment,
        shift_id: UUID,
    ) -> None:
        active = [
            a
            for a in self._shift_assignments.list_for_employee(ctx, employment.employee_id)
            if a.status in {ShiftAssignmentStatus.ACTIVE.value, ShiftAssignmentStatus.APPROVED.value}
        ]
        for row in active:
            if row.shift_id == shift_id:
                return
            self._shift_assignments.update(
                ctx,
                row.id,
                status=ShiftAssignmentStatus.ENDED.value,
                effective_to=date.today(),
            )
        ShiftAssignmentService(self._db).create(
            ctx,
            branch_id=employment.branch_id,
            employee_id=employment.employee_id,
            shift_id=shift_id,
            effective_from=employment.date_of_joining or date.today(),
            company_id=employment.company_id,
            status=ShiftAssignmentStatus.ACTIVE.value,
        )

    def employee_feature_access(self, ctx: TenantContext, employee_id: UUID):
        from modules.hr.schemas import EmployeeFeatureAccessResponse

        cid = self._scope.resolve_company_id(ctx, None)
        rows = [r for r in self._employment.list_rows(ctx, cid) if r.employee_id == employee_id]
        mgmt_id = rows[0].management_group_id if rows else None
        return EmployeeFeatureAccessResponse(
            employee_id=employee_id,
            management_group_id=mgmt_id,
            feature_toggles=self.effective_toggles_for_employee(ctx, employee_id),
        )

    def serialize(self, ctx: TenantContext, row) -> dict:
        from modules.hr.schemas import ManagementGroupResponse

        count = self._repo.count_employees(ctx, row.company_id, row.id)
        toggles = normalize_toggles(row.feature_toggles_json)
        base = ManagementGroupResponse.model_validate(row)
        return base.model_copy(
            update={"employee_count": count, "feature_toggles_json": toggles}
        ).model_dump()

    def _first_active_shift(self, ctx: TenantContext, company_id: UUID):
        for row in self._shifts.list_rows(ctx, company_id):
            if row.status == "active":
                return row
        return None
