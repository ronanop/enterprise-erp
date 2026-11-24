"""Asset department directory reads — slim org_department projection."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from modules.asset.repository.base import AstScopedRepository
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.models.hierarchy import OrgDepartment

DEFAULT_DIRECTORY_STATUSES: tuple[str, ...] = ("active",)


@dataclass(frozen=True, slots=True)
class DepartmentDirectoryRow:
    id: UUID
    department_code: str
    department_name: str
    company_id: UUID
    branch_id: UUID
    status: str


class DepartmentDirectoryRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_departments(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        search: str | None = None,
        statuses: tuple[str, ...] | None = DEFAULT_DIRECTORY_STATUSES,
        limit: int = 500,
    ) -> list[DepartmentDirectoryRow]:
        stmt = (
            select(
                OrgDepartment.id,
                OrgDepartment.department_code,
                OrgDepartment.department_name,
                OrgDepartment.company_id,
                OrgDepartment.branch_id,
                OrgDepartment.status,
            )
            .where(
                OrgDepartment.tenant_id == ctx.tenant_id,
                OrgDepartment.is_deleted.is_(False),
            )
            .order_by(OrgDepartment.department_name.asc())
            .limit(max(1, min(limit, 2000)))
        )
        if company_id is not None:
            stmt = stmt.where(OrgDepartment.company_id == company_id)
        if branch_id is not None:
            stmt = stmt.where(OrgDepartment.branch_id == branch_id)
        if statuses:
            stmt = stmt.where(OrgDepartment.status.in_(statuses))
        term = (search or "").strip()
        if term:
            like = f"%{term}%"
            stmt = stmt.where(
                or_(
                    OrgDepartment.department_name.ilike(like),
                    OrgDepartment.department_code.ilike(like),
                )
            )
        rows = self.db.execute(stmt).all()
        return [
            DepartmentDirectoryRow(
                id=row.id,
                department_code=row.department_code,
                department_name=row.department_name,
                company_id=row.company_id,
                branch_id=row.branch_id,
                status=row.status,
            )
            for row in rows
        ]
