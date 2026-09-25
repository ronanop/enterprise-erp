"""REST endpoints for configurable CRM My Jobs step owners."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from modules.crm.dependencies import get_db
from modules.crm.service.approval_step_owner_service import ApprovalStepOwnerService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

approval_step_owners_router = APIRouter(
    prefix="/approval-step-owners",
    tags=["CRM - Approval Step Owners"],
)


class StepOwnerUser(BaseModel):
    user_id: UUID
    display_name: str
    email: str


class ApprovalStepOwnersGroup(BaseModel):
    step_key: str
    label: str
    team_role: str
    owners: list[StepOwnerUser]


class ApprovalStepOwnersReplaceRequest(BaseModel):
    user_ids: list[UUID] = Field(default_factory=list)


@approval_step_owners_router.get("", response_model=APIResponse[list[ApprovalStepOwnersGroup]])
def list_approval_step_owners(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.my_jobs:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    rows = ApprovalStepOwnerService(db).list_grouped(ctx)
    return APIResponse(message="OK", data=[ApprovalStepOwnersGroup(**row) for row in rows])


@approval_step_owners_router.put(
    "/{step_key}",
    response_model=APIResponse[ApprovalStepOwnersGroup],
)
def replace_approval_step_owners(
    step_key: str,
    body: ApprovalStepOwnersReplaceRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.blueprint:act"))],
    db: Annotated[Session, Depends(get_db)],
):
    service = ApprovalStepOwnerService(db)
    service.replace(ctx, step_key, body.user_ids)
    grouped = service.list_grouped(ctx)
    row = next(item for item in grouped if item["step_key"] == step_key)
    return APIResponse(message="OK", data=ApprovalStepOwnersGroup(**row))
