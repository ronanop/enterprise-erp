"""Asset employee directory — id, code, name, department for pickers."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.repository.employee_directory_repository import (
    DEFAULT_DIRECTORY_STATUSES,
    EmployeeDirectoryRepository,
)
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.foundation.domain.value_objects import TenantContext


class EmployeeDirectoryService:
    def __init__(self, db: Session) -> None:
        self._repo = EmployeeDirectoryRepository(db)
        self._scope = AssetScopeValidator(db)

    def list_employees(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        department_id: UUID | None = None,
        search: str | None = None,
        include_inactive: bool = False,
        limit: int = 500,
    ) -> list[dict]:
        cid = self._scope.resolve_list_company_id(ctx, company_id)
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)
        statuses = None if include_inactive else DEFAULT_DIRECTORY_STATUSES
        rows = self._repo.list_employees(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            department_id=department_id,
            search=search,
            statuses=statuses,
            limit=limit,
        )
        return [
            {
                "id": row.id,
                "employee_code": row.employee_code,
                "first_name": row.first_name,
                "last_name": row.last_name,
                "display_name": f"{row.first_name} {row.last_name}".strip(),
                "department_id": row.department_id,
                "department_code": row.department_code,
                "department_name": row.department_name,
                "status": row.status,
            }
            for row in rows
        ]
