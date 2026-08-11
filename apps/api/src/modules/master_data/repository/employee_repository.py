"""Employee repository."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.domain.entities import EmployeeEntity
from modules.master_data.models.employee import MasterEmployee
from modules.master_data.repository.base import MasterScopedRepository, utcnow


class EmployeeRepository(MasterScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_employees(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
    ) -> list[EmployeeEntity]:
        stmt = select(MasterEmployee)
        stmt = self.apply_master_filter(stmt, MasterEmployee, ctx, branch_scoped=True)
        if company_id:
            stmt = stmt.where(MasterEmployee.company_id == company_id)
        if branch_id:
            stmt = stmt.where(MasterEmployee.branch_id == branch_id)
        stmt = stmt.where(~MasterEmployee.email.ilike("%@example.com"))
        return [self._to_entity(r) for r in self.db.scalars(stmt).all()]

    def get_by_id(self, ctx: TenantContext, employee_id: UUID) -> EmployeeEntity | None:
        stmt = select(MasterEmployee).where(
            MasterEmployee.id == employee_id,
            MasterEmployee.tenant_id == ctx.tenant_id,
            MasterEmployee.is_deleted.is_(False),
        )
        row = self.db.scalar(stmt)
        return self._to_entity(row) if row else None

    def get_by_user_id(self, ctx: TenantContext, user_id: UUID) -> EmployeeEntity | None:
        stmt = select(MasterEmployee).where(
            MasterEmployee.user_id == user_id,
            MasterEmployee.tenant_id == ctx.tenant_id,
            MasterEmployee.is_deleted.is_(False),
        )
        row = self.db.scalar(stmt)
        return self._to_entity(row) if row else None

    def get_by_code(
        self, ctx: TenantContext, company_id: UUID, employee_code: str
    ) -> MasterEmployee | None:
        stmt = select(MasterEmployee).where(
            MasterEmployee.tenant_id == ctx.tenant_id,
            MasterEmployee.company_id == company_id,
            MasterEmployee.employee_code == employee_code,
            MasterEmployee.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def create(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        department_id: UUID,
        employee_code: str,
        first_name: str,
        last_name: str,
        email: str,
        mobile: str,
        designation: str,
        date_of_joining: date,
        reporting_manager_id: UUID | None = None,
        date_of_leaving: date | None = None,
        user_id: UUID | None = None,
    ) -> EmployeeEntity:
        row = MasterEmployee(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            department_id=department_id,
            employee_code=employee_code,
            first_name=first_name,
            last_name=last_name,
            email=email,
            mobile=mobile,
            designation=designation,
            date_of_joining=date_of_joining,
            reporting_manager_id=reporting_manager_id,
            date_of_leaving=date_of_leaving,
            user_id=user_id,
            status="draft",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self.db.add(row)
        self.db.flush()
        return self._to_entity(row)

    def update(
        self, ctx: TenantContext, employee_id: UUID, **fields: object
    ) -> EmployeeEntity | None:
        stmt = select(MasterEmployee).where(
            MasterEmployee.id == employee_id,
            MasterEmployee.tenant_id == ctx.tenant_id,
            MasterEmployee.is_deleted.is_(False),
        )
        row = self.db.scalar(stmt)
        if row is None:
            return None
        for key, value in fields.items():
            if hasattr(row, key) and value is not None:
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version += 1
        self.db.flush()
        return self._to_entity(row)

    def soft_delete(self, ctx: TenantContext, employee_id: UUID) -> bool:
        stmt = select(MasterEmployee).where(
            MasterEmployee.id == employee_id,
            MasterEmployee.tenant_id == ctx.tenant_id,
        )
        row = self.db.scalar(stmt)
        if row is None or row.is_deleted:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        self.db.flush()
        return True

    @staticmethod
    def _to_entity(row: MasterEmployee) -> EmployeeEntity:
        return EmployeeEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            company_id=row.company_id,
            branch_id=row.branch_id,
            department_id=row.department_id,
            employee_code=row.employee_code,
            first_name=row.first_name,
            last_name=row.last_name,
            email=row.email,
            mobile=row.mobile,
            designation=row.designation,
            date_of_joining=row.date_of_joining,
            reporting_manager_id=row.reporting_manager_id,
            date_of_leaving=row.date_of_leaving,
            user_id=row.user_id,
            status=row.status,
            version=row.version,
            is_deleted=row.is_deleted,
        )
