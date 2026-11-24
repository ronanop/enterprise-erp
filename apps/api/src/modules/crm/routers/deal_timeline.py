"""Unified deal timeline endpoints for the CRM Timeline tab.

Spans lead → opportunity → quote → OVF → SCM handoff → PO → delivery →
project handoff → project completion.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.crm.dependencies import get_db
from modules.crm.schemas import DealTimelineListItem, DealTimelineResponse
from modules.crm.service.deal_timeline_service import DealTimelineService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

deal_timeline_router = APIRouter(prefix="/deal-timeline", tags=["CRM - Deal Timeline"])


@deal_timeline_router.get("", response_model=APIResponse[list[DealTimelineListItem]])
def list_deal_timelines(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.opportunity:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    rows = DealTimelineService(db).list_deals(ctx, company_id)
    return APIResponse(message="OK", data=rows)


@deal_timeline_router.get(
    "/{opportunity_id}", response_model=APIResponse[DealTimelineResponse]
)
def get_deal_timeline(
    opportunity_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.opportunity:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=DealTimelineService(db).timeline(ctx, opportunity_id),
    )
