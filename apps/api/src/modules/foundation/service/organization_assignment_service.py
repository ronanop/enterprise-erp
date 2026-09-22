"""Organization assignment for members: roles, hierarchy (companies), department."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException, ValidationException
from modules.foundation.domain.entities import UserEntity
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser, SecUserOrgScope, SecUserRole
from modules.foundation.schemas import UserResponse
from modules.foundation.service.user_employee_link_service import UserEmployeeLinkService
from modules.foundation.service.user_service import UserService
from modules.master_data.models.employee import MasterEmployee
from modules.master_data.repository.base import utcnow
from modules.organization.models.company import OrgCompany
from modules.organization.models.hierarchy import OrgDepartment
from modules.organization.repository.org_scope_repository import OrgScopeRepository


class OrganizationAssignmentService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._users = UserService(db)
        self._scopes = OrgScopeRepository(db)
        self._user_employee = UserEmployeeLinkService(db)

    def enrich_responses(self, tenant_id: UUID, users: list[UserEntity]) -> list[UserResponse]:
        if not users:
            return []
        user_ids = [u.id for u in users]
        employee_ids = [u.employee_id for u in users if u.employee_id]

        dept_by_employee: dict[UUID, UUID] = {}
        if employee_ids:
            rows = self._db.scalars(
                select(MasterEmployee).where(
                    MasterEmployee.tenant_id == tenant_id,
                    MasterEmployee.id.in_(employee_ids),
                    MasterEmployee.is_deleted.is_(False),
                )
            ).all()
            for row in rows:
                if row.department_id:
                    dept_by_employee[row.id] = row.department_id

        # Fallback: employee linked by user_id when employee_id is empty
        missing_user_ids = [u.id for u in users if not u.employee_id]
        emp_by_user: dict[UUID, MasterEmployee] = {}
        if missing_user_ids:
            for row in self._db.scalars(
                select(MasterEmployee).where(
                    MasterEmployee.tenant_id == tenant_id,
                    MasterEmployee.user_id.in_(missing_user_ids),
                    MasterEmployee.is_deleted.is_(False),
                )
            ).all():
                if row.user_id:
                    emp_by_user[row.user_id] = row

        company_ids_by_user: dict[UUID, list[UUID]] = {uid: [] for uid in user_ids}
        scope_rows = self._db.scalars(
            select(SecUserOrgScope).where(
                SecUserOrgScope.tenant_id == tenant_id,
                SecUserOrgScope.user_id.in_(user_ids),
            )
        ).all()
        for scope in scope_rows:
            ids = company_ids_by_user.setdefault(scope.user_id, [])
            if scope.company_id not in ids:
                ids.append(scope.company_id)

        out: list[UserResponse] = []
        for user in users:
            employee_id = user.employee_id
            department_id = dept_by_employee.get(employee_id) if employee_id else None
            if employee_id is None:
                linked = emp_by_user.get(user.id)
                if linked is not None:
                    employee_id = linked.id
                    department_id = linked.department_id
            base = UserService.to_response(user)
            out.append(
                base.model_copy(
                    update={
                        "employee_id": employee_id,
                        "department_id": department_id,
                        "company_ids": list(company_ids_by_user.get(user.id, [])),
                    }
                )
            )
        return out

    def list_organization_members(self, tenant_id: UUID) -> list[UserResponse]:
        users = self._users.list_users(tenant_id)
        return self.enrich_responses(tenant_id, users)

    def replace_roles(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        role_ids: list[UUID],
        updated_by: UUID | None,
    ) -> UserResponse:
        user = self._users.get_user(tenant_id, user_id)
        unique: list[UUID] = []
        seen: set[UUID] = set()
        for role_id in role_ids:
            if role_id in seen:
                continue
            seen.add(role_id)
            unique.append(role_id)

        existing = list(
            self._db.scalars(
                select(SecUserRole).where(
                    SecUserRole.tenant_id == tenant_id,
                    SecUserRole.user_id == user_id,
                )
            ).all()
        )
        existing_ids = {link.role_id for link in existing}
        desired = set(unique)

        for link in existing:
            if link.role_id not in desired:
                self._users.revoke_role(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    role_id=link.role_id,
                    revoked_by=updated_by,
                )
        for role_id in unique:
            if role_id not in existing_ids:
                self._users.assign_role(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    role_id=role_id,
                    assigned_by=updated_by,
                )

        refreshed = self._users.get_user(tenant_id, user.id)
        return self.enrich_responses(tenant_id, [refreshed])[0]

    def replace_company_scopes(
        self,
        *,
        ctx: TenantContext,
        user_id: UUID,
        company_ids: list[UUID],
    ) -> UserResponse:
        self._users.get_user(ctx.tenant_id, user_id)
        unique: list[UUID] = []
        seen: set[UUID] = set()
        for company_id in company_ids:
            if company_id in seen:
                continue
            seen.add(company_id)
            unique.append(company_id)

        if unique:
            found = {
                row.id
                for row in self._db.scalars(
                    select(OrgCompany).where(
                        OrgCompany.tenant_id == ctx.tenant_id,
                        OrgCompany.id.in_(unique),
                        OrgCompany.is_deleted.is_(False),
                    )
                ).all()
            }
            missing = [str(cid) for cid in unique if cid not in found]
            if missing:
                raise ValidationException(f"Unknown company ids: {', '.join(missing)}")

        self._scopes.replace_company_scopes(
            ctx,
            user_id=user_id,
            company_ids=unique,
        )
        refreshed = self._users.get_user(ctx.tenant_id, user_id)
        return self.enrich_responses(ctx.tenant_id, [refreshed])[0]

    def set_department(
        self,
        *,
        ctx: TenantContext,
        user_id: UUID,
        department_id: UUID | None,
    ) -> UserResponse:
        user_entity = self._users.get_user(ctx.tenant_id, user_id)
        user_row = self._db.scalar(
            select(SecUser).where(
                SecUser.id == user_id,
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.is_deleted.is_(False),
            )
        )
        if user_row is None:
            raise NotFoundException("User not found")

        employee = self._user_employee.ensure_employee_for_user(ctx, user_row)
        if employee is None:
            raise ValidationException(
                "Cannot assign department because no employee profile exists for this user."
            )

        emp_row = self._db.scalar(
            select(MasterEmployee).where(
                MasterEmployee.id == employee.id,
                MasterEmployee.tenant_id == ctx.tenant_id,
                MasterEmployee.is_deleted.is_(False),
            )
        )
        if emp_row is None:
            raise NotFoundException("Employee not found")

        if department_id is not None:
            dept = self._db.scalar(
                select(OrgDepartment).where(
                    OrgDepartment.id == department_id,
                    OrgDepartment.tenant_id == ctx.tenant_id,
                    OrgDepartment.is_deleted.is_(False),
                )
            )
            if dept is None:
                raise ValidationException("Department not found")
            emp_row.department_id = department_id
            # Keep employee org placement aligned with the selected department.
            if dept.branch_id is not None:
                emp_row.branch_id = dept.branch_id
            if dept.company_id is not None:
                emp_row.company_id = dept.company_id
        else:
            emp_row.department_id = None

        emp_row.updated_at = utcnow()
        emp_row.updated_by = ctx.user_id
        emp_row.version += 1
        self._db.flush()

        refreshed = self._users.get_user(ctx.tenant_id, user_entity.id)
        return self.enrich_responses(ctx.tenant_id, [refreshed])[0]
