"""My Jobs — team-routed approval task REST endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.crm.dependencies import PaginationParams, get_db, get_pagination, paginate
from modules.crm.schemas import ApprovalTaskDecisionRequest, ApprovalTaskResponse
from modules.crm.service import ApprovalTaskService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

my_jobs_router = APIRouter(prefix="/my-jobs", tags=["CRM - My Jobs"])


@my_jobs_router.get("", response_model=APIResponse[list[ApprovalTaskResponse]])
def list_my_jobs(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.my_jobs:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    team_role: str | None = None,
    status: str | None = None,
    mine: bool = False,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
):
    rows = ApprovalTaskService(db).list(
        ctx,
        company_id=company_id,
        team_role=team_role,
        status=status,
        my_tasks_only=mine,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    return APIResponse(message="OK", data=paginate(rows, pagination))


@my_jobs_router.get("/{task_id}", response_model=APIResponse[ApprovalTaskResponse])
def get_my_job(
    task_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.my_jobs:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ApprovalTaskService(db).get(ctx, task_id))


@my_jobs_router.post("/{task_id}/decide", response_model=APIResponse[ApprovalTaskResponse])
def decide_my_job(
    task_id: UUID,
    body: ApprovalTaskDecisionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.my_jobs:decide"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = ApprovalTaskService(db).decide(ctx, task_id, decision=body.decision, remark=body.remark)
    return APIResponse(message="OK", data=row)
