"""Asset department directory API — slim org_department list."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.session import get_db
from modules.asset.schemas import (
    AssetDepartmentDirectoryItem,
    AssetDepartmentDirectoryListResult,
)
from modules.asset.service.department_directory_service import DepartmentDirectoryService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

department_directory_router = APIRouter(
    prefix="/asset-departments",
    tags=["Asset — Department Directory"],
)


@department_directory_router.get(
    "",
    response_model=APIResponse[AssetDepartmentDirectoryListResult],
)
def list_asset_departments(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    branch_id: UUID | None = None,
    search: Annotated[
        str | None,
        Query(description="Match department name or code"),
    ] = None,
    include_inactive: Annotated[
        bool,
        Query(description="Include draft/inactive departments. Default is active only."),
    ] = False,
    limit: Annotated[int, Query(ge=1, le=2000)] = 500,
):
    """Return department id, code, and name from organization.org_department."""
    items = DepartmentDirectoryService(db).list_departments(
        ctx,
        company_id=company_id,
        branch_id=branch_id,
        search=search,
        include_inactive=include_inactive,
        limit=limit,
    )
    payload = AssetDepartmentDirectoryListResult(
        items=[AssetDepartmentDirectoryItem(**row) for row in items],
        total=len(items),
    )
    return APIResponse(message="OK", data=payload)
