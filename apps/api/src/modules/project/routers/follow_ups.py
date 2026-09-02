"""Portfolio follow-ups — sent (admin) or received (assignees)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.project.dependencies import get_db
from modules.project.schemas import (
    ProjectPortfolioFollowUpItem,
    SiteInstallationFollowUpReplyRequest,
)
from modules.project.service.site_installation_service import SiteInstallationService
from shared.schemas import APIResponse

follow_ups_router = APIRouter(prefix="/follow-ups", tags=["Project - Follow ups"])


@follow_ups_router.get("", response_model=APIResponse[list[ProjectPortfolioFollowUpItem]])
def list_portfolio_follow_ups(
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    rows = SiteInstallationService(db).list_portfolio_follow_ups(ctx)
    return APIResponse(
        message="OK",
        data=[ProjectPortfolioFollowUpItem(**row) for row in rows],
    )


@follow_ups_router.post(
    "/{notification_id}/reply",
    response_model=APIResponse[ProjectPortfolioFollowUpItem],
)
def reply_to_portfolio_follow_up(
    notification_id: UUID,
    body: SiteInstallationFollowUpReplyRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = SiteInstallationService(db).reply_to_follow_up(ctx, notification_id, body.body)
    return APIResponse(
        message="Reply sent",
        data=ProjectPortfolioFollowUpItem(**row),
    )
