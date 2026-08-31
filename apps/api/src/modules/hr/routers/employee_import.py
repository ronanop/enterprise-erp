"""Workforce employee Excel/CSV bulk import API."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from shared.schemas import APIResponse
from modules.foundation.dependencies import require_any_permission, require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.dependencies import get_db
from modules.hr.permissions import HR_SUPERADMIN_PERMISSION
from modules.hr.schemas import EmployeeImportRequest, EmployeeImportResponse, EmployeeClearResponse
from modules.hr.service.employee_import_service import EmployeeImportService

employee_import_router = APIRouter(prefix="/employees", tags=["HR - Employee Import"])


@employee_import_router.post("/bulk-import", response_model=APIResponse[EmployeeImportResponse])
def bulk_import_employees(
    body: EmployeeImportRequest,
    ctx: Annotated[
        TenantContext,
        Depends(
            require_any_permission(
                "master.employee:create",
                "master.employee:update",
                "hr.employee_profile:create",
            )
        ),
    ],
    db: Annotated[Session, Depends(get_db)],
):
    rows = [r.model_dump() for r in body.rows]
    data = EmployeeImportService(db).import_rows(ctx, rows)
    return APIResponse(message="Import completed", data=EmployeeImportResponse.model_validate(data))


@employee_import_router.post("/clear-all", response_model=APIResponse[EmployeeClearResponse])
def clear_all_employees(
    ctx: Annotated[TenantContext, Depends(require_permission(HR_SUPERADMIN_PERMISSION))],
    db: Annotated[Session, Depends(get_db)],
):
    """Soft-delete all employees in scope. Superadmin only — HR Admin cannot clear the directory."""
    data = EmployeeImportService(db).clear_all_employees(ctx)
    db.commit()
    return APIResponse(
        message=data.get("message") or "Employees cleared",
        data=EmployeeClearResponse.model_validate(data),
    )
