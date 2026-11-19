"""CRM team member lookup (module-assigned users with employee records)."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.crm.dependencies import get_db
from modules.crm.schemas import CrmMemberOption
from modules.crm.service.crm_member_service import CrmMemberService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

members_router = APIRouter(prefix="/members", tags=["CRM - Members"])


@members_router.get("", response_model=APIResponse[list[CrmMemberOption]])
def list_crm_members(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.company:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    rows = CrmMemberService(db).list_member_options(ctx)
    return APIResponse(
        message="OK",
        data=[CrmMemberOption(**row) for row in rows],
    )
