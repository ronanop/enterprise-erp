"""My Jobs — delivery steps assigned to the signed-in project team member."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.project.dependencies import get_db
from modules.project.schemas import ProjectMyJobItem
from modules.project.service.site_installation_service import SiteInstallationService
from shared.schemas import APIResponse

my_jobs_router = APIRouter(prefix="/my-jobs", tags=["Project - My Jobs"])


@my_jobs_router.get("", response_model=APIResponse[list[ProjectMyJobItem]])
def list_project_my_jobs(
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    rows = SiteInstallationService(db).list_my_jobs(ctx, completed=False)
    return APIResponse(
        message="OK",
        data=[ProjectMyJobItem(**row) for row in rows],
    )


@my_jobs_router.get("/completed", response_model=APIResponse[list[ProjectMyJobItem]])
def list_project_completed_jobs(
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    rows = SiteInstallationService(db).list_my_jobs(ctx, completed=True)
    return APIResponse(
        message="OK",
        data=[ProjectMyJobItem(**row) for row in rows],
    )
