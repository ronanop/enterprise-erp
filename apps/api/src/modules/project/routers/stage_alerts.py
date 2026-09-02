"""Project admin inbox — stage-save alerts from assignees."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.project.dependencies import get_db
from modules.project.schemas import ProjectStageSaveAlertItem
from modules.project.service.site_installation_service import SiteInstallationService
from shared.schemas import APIResponse

stage_alerts_router = APIRouter(
    prefix="/stage-alerts",
    tags=["Project - Stage alerts"],
)


@stage_alerts_router.get("", response_model=APIResponse[list[ProjectStageSaveAlertItem]])
def list_stage_save_alerts(
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
):
    rows = SiteInstallationService(db).list_stage_save_alerts(ctx, limit=limit)
    return APIResponse(
        message="OK",
        data=[ProjectStageSaveAlertItem(**row) for row in rows],
    )


@stage_alerts_router.post(
    "/{notification_id}/read",
    response_model=APIResponse[ProjectStageSaveAlertItem],
)
def mark_stage_save_alert_read(
    notification_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = SiteInstallationService(db).mark_stage_save_alert_read(ctx, notification_id)
    return APIResponse(
        message="Marked read",
        data=ProjectStageSaveAlertItem(**row),
    )
