"""Department, BU, location, cost/profit center services."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException, ValidationException
from modules.foundation.domain.erp_modules import ERP_MODULE_KEY_SET
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.organization.domain.entities import DepartmentEntity
from modules.organization.repository.department_module_repository import DepartmentModuleRepository
from modules.organization.repository.hierarchy_repository import (
    BusinessUnitRepository,
    CostCenterRepository,
    DepartmentRepository,
    LocationRepository,
    ProfitCenterRepository,
)
from modules.organization.schemas import DepartmentResponse
from modules.organization.service.org_scope_validator import OrgScopeValidator


class DepartmentService:
    def __init__(self, db: Session) -> None:
        self._repo = DepartmentRepository(db)
        self._modules = DepartmentModuleRepository(db)
        self._audit = AuditService(db)
        self._scope = OrgScopeValidator(db)

    @staticmethod
    def to_response(dept: DepartmentEntity) -> DepartmentResponse:
        return DepartmentResponse(
            id=dept.id,
            tenant_id=dept.tenant_id,
            company_id=dept.company_id,
            branch_id=dept.branch_id,
            department_code=dept.department_code,
            department_name=dept.department_name,
            status=dept.status,
            parent_department_id=dept.parent_department_id,
            head_employee_id=dept.head_employee_id,
            version=dept.version,
            created_at=dept.created_at,
            created_by=dept.created_by,
            updated_at=dept.updated_at,
            updated_by=dept.updated_by,
            module_keys=list(dept.module_keys),
        )

    @staticmethod
    def _normalize_module_keys(module_keys: list[str] | None) -> list[str]:
        if not module_keys:
            return []
        unique: list[str] = []
        seen: set[str] = set()
        invalid: list[str] = []
        for key in module_keys:
            normalized = (key or "").strip().lower()
            if not normalized:
                continue
            if normalized not in ERP_MODULE_KEY_SET:
                invalid.append(normalized)
                continue
            if normalized in seen:
                continue
            seen.add(normalized)
            unique.append(normalized)
        if invalid:
            raise ValidationException(f"Unknown module keys: {', '.join(sorted(set(invalid)))}")
        return unique

    def _attach_modules(
        self, ctx: TenantContext, departments: list[DepartmentEntity]
    ) -> list[DepartmentEntity]:
        if not departments:
            return []
        mapping = self._modules.list_module_keys_by_department(
            ctx.tenant_id, [d.id for d in departments]
        )
        for dept in departments:
            dept.module_keys = list(mapping.get(dept.id, []))
        return departments

    def list_departments(self, ctx: TenantContext, **filters) -> list[DepartmentEntity]:
        departments = self._repo.list_departments(ctx, **filters)
        return self._attach_modules(ctx, departments)

    def create_department(self, ctx: TenantContext, **fields) -> DepartmentEntity:
        module_keys = self._normalize_module_keys(fields.pop("module_keys", None))
        self._scope.validate_branch_access(ctx, fields["branch_id"])
        dept = self._repo.create(ctx, **fields)
        if module_keys:
            self._modules.replace_modules(ctx, department_id=dept.id, module_keys=module_keys)
            dept.module_keys = module_keys
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_department",
            entity_id=dept.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"module_keys": module_keys} if module_keys else None,
        )
        return dept

    def update_department(self, ctx: TenantContext, department_id: UUID, **fields) -> DepartmentEntity:
        dept = self._repo.update(ctx, department_id, **fields)
        if dept is None:
            raise NotFoundException("Department not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_department",
            entity_id=department_id,
            operation="update",
            performed_by=ctx.user_id,
            new_value=fields,
        )
        return self._attach_modules(ctx, [dept])[0]

    def replace_modules(
        self, ctx: TenantContext, department_id: UUID, module_keys: list[str]
    ) -> DepartmentEntity:
        existing = self._repo.get_by_id(ctx, department_id)
        if existing is None:
            raise NotFoundException("Department not found")
        normalized = self._normalize_module_keys(module_keys)
        saved = self._modules.replace_modules(
            ctx, department_id=department_id, module_keys=normalized
        )
        existing.module_keys = saved
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_department_module",
            entity_id=department_id,
            operation="update",
            performed_by=ctx.user_id,
            new_value={"module_keys": saved},
        )
        return existing

    def delete_department(self, ctx: TenantContext, department_id: UUID) -> None:
        if not self._repo.soft_delete(ctx, department_id):
            raise NotFoundException("Department not found")


class BusinessUnitService:
    def __init__(self, db: Session) -> None:
        self._repo = BusinessUnitRepository(db)
        self._audit = AuditService(db)
        self._scope = OrgScopeValidator(db)

    def list_units(self, ctx: TenantContext, *, branch_id: UUID | None = None):
        return self._repo.list_units(ctx, branch_id=branch_id)

    def create_unit(self, ctx: TenantContext, **fields):
        self._scope.validate_branch_access(ctx, fields["branch_id"])
        unit = self._repo.create(ctx, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_business_unit",
            entity_id=unit.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return unit


class LocationService:
    def __init__(self, db: Session) -> None:
        self._repo = LocationRepository(db)
        self._audit = AuditService(db)
        self._scope = OrgScopeValidator(db)

    def list_locations(
        self, ctx: TenantContext, *, branch_id: UUID | None = None, company_id: UUID | None = None
    ):
        return self._repo.list_locations(ctx, branch_id=branch_id, company_id=company_id)

    def create_location(self, ctx: TenantContext, **fields):
        self._scope.validate_branch_access(ctx, fields["branch_id"])
        loc = self._repo.create(ctx, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_location",
            entity_id=loc.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return loc

    def update_location(self, ctx: TenantContext, location_id: UUID, **fields):
        loc = self._repo.update(ctx, location_id, **fields)
        if loc is None:
            raise NotFoundException("Location not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_location",
            entity_id=loc.id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return loc

    def delete_location(self, ctx: TenantContext, location_id: UUID) -> None:
        if not self._repo.soft_delete(ctx, location_id):
            raise NotFoundException("Location not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_location",
            entity_id=location_id,
            operation="delete",
            performed_by=ctx.user_id,
        )


class CostCenterService:
    def __init__(self, db: Session) -> None:
        self._repo = CostCenterRepository(db)
        self._audit = AuditService(db)
        self._scope = OrgScopeValidator(db)

    def list_cost_centers(self, ctx: TenantContext, *, company_id: UUID | None = None):
        if company_id:
            self._scope.validate_company_access(ctx, company_id)
        return self._repo.list_cost_centers(ctx, company_id=company_id)

    def create_cost_center(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        cost_center_code: str,
        cost_center_name: str,
        valid_from: date,
        branch_id: UUID | None = None,
        department_id: UUID | None = None,
    ):
        self._scope.validate_company_access(ctx, company_id)
        cc = self._repo.create(
            ctx,
            company_id=company_id,
            cost_center_code=cost_center_code,
            cost_center_name=cost_center_name,
            valid_from=valid_from,
            branch_id=branch_id,
            department_id=department_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_cost_center",
            entity_id=cc.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return cc


class ProfitCenterService:
    def __init__(self, db: Session) -> None:
        self._repo = ProfitCenterRepository(db)
        self._audit = AuditService(db)
        self._scope = OrgScopeValidator(db)

    def list_profit_centers(self, ctx: TenantContext, *, company_id: UUID | None = None):
        if company_id:
            self._scope.validate_company_access(ctx, company_id)
        return self._repo.list_profit_centers(ctx, company_id=company_id)

    def create_profit_center(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        profit_center_code: str,
        profit_center_name: str,
        valid_from: date,
        branch_id: UUID | None = None,
        department_id: UUID | None = None,
    ):
        self._scope.validate_company_access(ctx, company_id)
        pc = self._repo.create(
            ctx,
            company_id=company_id,
            profit_center_code=profit_center_code,
            profit_center_name=profit_center_name,
            valid_from=valid_from,
            branch_id=branch_id,
            department_id=department_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_profit_center",
            entity_id=pc.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return pc
