"""Asset employee directory API — slim employee + department list."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.session import get_db
from modules.asset.schemas import AssetEmployeeDirectoryItem, AssetEmployeeDirectoryListResult
from modules.asset.service.employee_directory_service import EmployeeDirectoryService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

employee_directory_router = APIRouter(
    prefix="/asset-employees",
    tags=["Asset — Employee Directory"],
)


@employee_directory_router.get(
    "",
    response_model=APIResponse[AssetEmployeeDirectoryListResult],
)
def list_asset_employees(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    branch_id: UUID | None = None,
    department_id: UUID | None = None,
    search: Annotated[
        str | None,
        Query(description="Match employee code, name, or department"),
    ] = None,
    include_inactive: Annotated[
        bool,
        Query(
            description=(
                "Include all statuses (draft/onboarding/notice/resigned/etc). "
                "Default list is active, probation, on_leave only."
            ),
        ),
    ] = False,
    limit: Annotated[int, Query(ge=1, le=2000)] = 500,
):
    """Return employee id, code, name, and related department for Asset pickers."""
    items = EmployeeDirectoryService(db).list_employees(
        ctx,
        company_id=company_id,
        branch_id=branch_id,
        department_id=department_id,
        search=search,
        include_inactive=include_inactive,
        limit=limit,
    )
    payload = AssetEmployeeDirectoryListResult(
        items=[AssetEmployeeDirectoryItem(**row) for row in items],
        total=len(items),
    )
    return APIResponse(message="OK", data=payload)
