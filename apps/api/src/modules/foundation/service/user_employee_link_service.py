"""Link foundation users to master_employee rows (for CRM owners, HR, etc.)."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.service.org_context_service import OrgContextService
from modules.master_data.models.employee import MasterEmployee
from modules.master_data.repository.employee_repository import EmployeeRepository
from modules.master_data.service.employee_service import EmployeeService
from modules.organization.repository.hierarchy_repository import DepartmentRepository

EMPLOYEE_CODE_PREFIX = "EMP-"


def _split_name(display_name: str, email: str) -> tuple[str, str]:
    cleaned = (display_name or "").strip()
    if cleaned:
        parts = cleaned.split()
        if len(parts) >= 2:
            return parts[0], " ".join(parts[1:])
        return cleaned, "."
    local = (email.split("@")[0] or "user").replace(".", " ").strip()
    parts = local.split()
    if len(parts) >= 2:
        return parts[0].title(), " ".join(p.title() for p in parts[1:])
    return local.title() or "User", "."


class UserEmployeeLinkService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._employees = EmployeeRepository(db)
        self._employee_service = EmployeeService(db)
        self._departments = DepartmentRepository(db)
        self._org = OrgContextService(db)

    def find_employee_for_user(self, ctx: TenantContext, user: SecUser) -> MasterEmployee | None:
        tenant_id = ctx.tenant_id

        if user.employee_id:
            row = self._db.scalar(
                select(MasterEmployee).where(
                    MasterEmployee.id == user.employee_id,
                    MasterEmployee.tenant_id == tenant_id,
                    MasterEmployee.is_deleted.is_(False),
                )
            )
            if row is not None:
                return row

        by_user = self._db.scalar(
            select(MasterEmployee).where(
                MasterEmployee.tenant_id == tenant_id,
                MasterEmployee.is_deleted.is_(False),
                MasterEmployee.user_id == user.id,
            )
        )
        if by_user is not None:
            return by_user

        email = (user.email or "").strip().lower()
        if not email:
            return None

        return self._db.scalar(
            select(MasterEmployee).where(
                MasterEmployee.tenant_id == tenant_id,
                MasterEmployee.is_deleted.is_(False),
                func.lower(MasterEmployee.email) == email,
            )
        )

    def ensure_employee_for_user(
        self,
        ctx: TenantContext,
        user: SecUser,
        *,
        commit: bool = False,
    ) -> MasterEmployee | None:
        existing = self.find_employee_for_user(ctx, user)
        if existing is not None:
            self._link_user_and_employee(user, existing)
            if commit:
                self._db.commit()
            return existing

        email = (user.email or "").strip().lower()
        if not email or email.endswith("@example.com"):
            return None

        company_id, branch_id = self._org.resolve_company_and_branch(
            user_id=user.id,
            tenant_id=ctx.tenant_id,
            user_type=user.user_type,
        )
        if company_id is None or branch_id is None:
            primary_company, primary_branch = self._org.get_tenant_primary_org(ctx.tenant_id)
            company_id = primary_company.id if primary_company else None
            branch_id = primary_branch.id if primary_branch else None
        if company_id is None or branch_id is None:
            return None

        dept_ctx = TenantContext(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id or user.id,
            user_type=ctx.user_type or user.user_type,
            session_id=ctx.session_id,
            company_id=company_id,
            branch_id=branch_id,
        )
        departments = self._departments.list_departments(
            dept_ctx, company_id=company_id, branch_id=branch_id
        )
        if not departments:
            return None

        first_name, last_name = _split_name(user.display_name, email)
        employee_code = self._next_unique_employee_code(company_id)

        entity = self._employee_service.create_employee(
            dept_ctx,
            company_id=company_id,
            branch_id=branch_id,
            department_id=departments[0].id,
            employee_code=employee_code,
            first_name=first_name,
            last_name=last_name,
            email=email,
            mobile="N/A",
            designation="Employee",
            date_of_joining=date.today(),
            user_id=user.id,
        )
        row = self._db.get(MasterEmployee, entity.id)
        if row is not None:
            row.status = "active"
            self._link_user_and_employee(user, row)
            self._db.flush()
        if commit:
            self._db.commit()
        return row

    def _link_user_and_employee(self, user: SecUser, employee: MasterEmployee) -> None:
        if user.employee_id != employee.id:
            user.employee_id = employee.id
        if employee.user_id != user.id:
            employee.user_id = user.id
        self._db.flush()

    def _next_unique_employee_code(self, company_id: UUID) -> str:
        stmt = select(MasterEmployee.employee_code).where(
            MasterEmployee.company_id == company_id,
            MasterEmployee.is_deleted.is_(False),
            MasterEmployee.employee_code.like(f"{EMPLOYEE_CODE_PREFIX}%"),
        )
        max_num = 0
        for (code,) in self._db.execute(stmt).all():
            tail = str(code).replace(EMPLOYEE_CODE_PREFIX, "", 1)
            try:
                max_num = max(max_num, int(tail))
            except ValueError:
                continue
        return f"{EMPLOYEE_CODE_PREFIX}{str(max_num + 1).zfill(6)}"
