"""Asset employee directory reads — slim employee + department projection."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from modules.asset.repository.base import AstScopedRepository
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.published import EmployeeRead
from modules.organization.models.hierarchy import OrgDepartment

# Statuses suitable for assignment / custody pickers.
DEFAULT_DIRECTORY_STATUSES: tuple[str, ...] = (
    "active",
    "probation",
    "on_leave",
)


@dataclass(frozen=True, slots=True)
class EmployeeDirectoryRow:
    id: UUID
    employee_code: str
    first_name: str
    last_name: str
    department_id: UUID
    department_code: str | None
    department_name: str | None
    status: str


class EmployeeDirectoryRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_employees(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        department_id: UUID | None = None,
        search: str | None = None,
        statuses: tuple[str, ...] | None = DEFAULT_DIRECTORY_STATUSES,
        limit: int = 500,
    ) -> list[EmployeeDirectoryRow]:
        full_name = func.trim(
            func.concat(EmployeeRead.first_name, " ", EmployeeRead.last_name)
        )
        stmt = (
            select(
                EmployeeRead.id,
                EmployeeRead.employee_code,
                EmployeeRead.first_name,
                EmployeeRead.last_name,
                EmployeeRead.department_id,
                OrgDepartment.department_code,
                OrgDepartment.department_name,
                EmployeeRead.status,
            )
            .outerjoin(
                OrgDepartment,
                (OrgDepartment.id == EmployeeRead.department_id)
                & (OrgDepartment.tenant_id == EmployeeRead.tenant_id)
                & (OrgDepartment.is_deleted.is_(False)),
            )
            .where(
                EmployeeRead.tenant_id == ctx.tenant_id,
                EmployeeRead.is_deleted.is_(False),
            )
            .order_by(EmployeeRead.employee_code.asc(), EmployeeRead.first_name.asc())
            .limit(max(1, min(limit, 2000)))
        )
        if company_id is not None:
            stmt = stmt.where(EmployeeRead.company_id == company_id)
        if branch_id is not None:
            stmt = stmt.where(EmployeeRead.branch_id == branch_id)
        if department_id is not None:
            stmt = stmt.where(EmployeeRead.department_id == department_id)
        if statuses:
            stmt = stmt.where(EmployeeRead.status.in_(statuses))
        term = (search or "").strip()
        if term:
            like = f"%{term}%"
            stmt = stmt.where(
                or_(
                    EmployeeRead.employee_code.ilike(like),
                    EmployeeRead.first_name.ilike(like),
                    EmployeeRead.last_name.ilike(like),
                    cast(full_name, String).ilike(like),
                    OrgDepartment.department_name.ilike(like),
                    OrgDepartment.department_code.ilike(like),
                )
            )
        rows = self.db.execute(stmt).all()
        return [
            EmployeeDirectoryRow(
                id=row.id,
                employee_code=row.employee_code,
                first_name=row.first_name,
                last_name=row.last_name,
                department_id=row.department_id,
                department_code=row.department_code,
                department_name=row.department_name,
                status=row.status,
            )
            for row in rows
        ]
