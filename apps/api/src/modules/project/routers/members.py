"""Project team member lookup (module-assigned users with employee records)."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.schemas import ModuleMemberOption
from modules.foundation.service.module_member_service import ModuleMemberService
from modules.project.dependencies import get_db
from shared.schemas import APIResponse

PROJECT_MODULE_KEY = "projects"

members_router = APIRouter(prefix="/members", tags=["Project - Members"])


@members_router.get("", response_model=APIResponse[list[ModuleMemberOption]])
def list_project_members(
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    rows = ModuleMemberService(db).list_member_options(ctx, PROJECT_MODULE_KEY)
    return APIResponse(
        message="OK",
        data=[ModuleMemberOption(**row) for row in rows],
    )
