"""HR employee asset custody endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.dependencies import get_db
from modules.hr.schemas import EmployeeAssetAssignRequest, EmployeeAssetItem, EmployeeAssetOption
from modules.hr.service.employee_asset_service import EmployeeAssetService
from shared.schemas import APIResponse

employee_assets_router = APIRouter(prefix="/employee-assets", tags=["HR - Employee Assets"])


@employee_assets_router.get("/{employee_id}", response_model=APIResponse[list[EmployeeAssetItem]])
def list_employee_assets(
    employee_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employee_asset:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=EmployeeAssetService(db).list_for_employee(ctx, employee_id),
    )


@employee_assets_router.get(
    "/{employee_id}/available",
    response_model=APIResponse[list[EmployeeAssetOption]],
)
def list_available_employee_assets(
    employee_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employee_asset:read"))],
    db: Annotated[Session, Depends(get_db)],
    branch_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=EmployeeAssetService(db).list_available_assets(
            ctx,
            employee_id,
            branch_id=branch_id,
        ),
    )


@employee_assets_router.post(
    "/{employee_id}/assign",
    response_model=APIResponse[EmployeeAssetItem],
)
def assign_employee_asset(
    employee_id: UUID,
    body: EmployeeAssetAssignRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employee_asset:assign"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Asset assigned",
        data=EmployeeAssetService(db).assign(
            ctx,
            employee_id=employee_id,
            asset_id=body.asset_id,
            branch_id=body.branch_id,
            expected_return_at=body.expected_return_at,
        ),
    )


@employee_assets_router.post(
    "/assignments/{assignment_id}/return",
    response_model=APIResponse[EmployeeAssetItem],
)
def return_employee_asset(
    assignment_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employee_asset:return"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Asset returned",
        data=EmployeeAssetService(db).return_asset(ctx, assignment_id),
    )
