"""Asset department directory — id, code, name from org_department."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.repository.department_directory_repository import (
    DEFAULT_DIRECTORY_STATUSES,
    DepartmentDirectoryRepository,
)
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.foundation.domain.value_objects import TenantContext


class DepartmentDirectoryService:
    def __init__(self, db: Session) -> None:
        self._repo = DepartmentDirectoryRepository(db)
        self._scope = AssetScopeValidator(db)

    def list_departments(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        search: str | None = None,
        include_inactive: bool = False,
        limit: int = 500,
    ) -> list[dict]:
        cid = self._scope.resolve_list_company_id(ctx, company_id)
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)
        statuses = None if include_inactive else DEFAULT_DIRECTORY_STATUSES
        rows = self._repo.list_departments(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            search=search,
            statuses=statuses,
            limit=limit,
        )
        return [
            {
                "id": row.id,
                "department_code": row.department_code,
                "department_name": row.department_name,
                "company_id": row.company_id,
                "branch_id": row.branch_id,
                "status": row.status,
            }
            for row in rows
        ]
