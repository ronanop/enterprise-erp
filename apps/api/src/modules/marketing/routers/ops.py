"""Marketing operations routers (tasks, M365, approvals, workload, AI ops)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from modules.marketing.dependencies import (
    PaginationParams,
    TenantContext,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
    require_permission,
)
from modules.marketing.schemas import (
    AiImproveBody,
    AiTopicBody,
    ApprovalActBody,
    ApprovalResponse,
    DelegateBody,
    M365FileCreate,
    M365FileResponse,
    M365WorkspaceResponse,
    MeetingCreate,
    MeetingResponse,
    OpsEventResponse,
    SearchQuery,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
    TimeEntryCreate,
    TimeEntryResponse,
)
from modules.marketing.service.ops_service import (
    AiOpsService,
    ApprovalService,
    M365Service,
    OpsEventService,
    TaskService,
    WorkloadService,
)
from shared.schemas import APIResponse

tasks_router = APIRouter(prefix="/tasks", tags=["Marketing - Tasks"])
approvals_router = APIRouter(prefix="/approvals", tags=["Marketing - Approvals"])
m365_router = APIRouter(prefix="/m365", tags=["Marketing - Microsoft 365"])
workload_router = APIRouter(prefix="/workload", tags=["Marketing - Workload"])
ops_router = APIRouter(prefix="/ops", tags=["Marketing - Operations"])
ai_ops_router = APIRouter(prefix="/ai", tags=["Marketing - AI Ops"])


@tasks_router.get("", response_model=APIResponse[list[TaskResponse]])
def list_tasks(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.task:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    mine: bool = False,
):
    return APIResponse(message="OK", data=paginate(TaskService(db).list(ctx, company_id, mine=mine), pagination))


@tasks_router.post("", response_model=APIResponse[TaskResponse])
def create_task(
    body: TaskCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.task:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TaskService(db).create(ctx, **body.model_dump()))


@tasks_router.patch("/{task_id}", response_model=APIResponse[TaskResponse])
def update_task(
    task_id: UUID,
    body: TaskUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.task:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TaskService(db).update(ctx, task_id, **extract_update_fields(body)))


@tasks_router.post("/{task_id}/execute", response_model=APIResponse[TaskResponse])
def execute_task(
    task_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.task:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TaskService(db).execute(ctx, task_id))


@tasks_router.post("/{task_id}/delegate", response_model=APIResponse[TaskResponse])
def delegate_task(
    task_id: UUID,
    body: DelegateBody,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.task:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TaskService(db).delegate(ctx, task_id, body.assignee_user_id))


@tasks_router.post("/{task_id}/hybrid", response_model=APIResponse[TaskResponse])
def hybrid_task(
    task_id: UUID,
    body: DelegateBody,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.task:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TaskService(db).hybrid(ctx, task_id, body.assignee_user_id))


@tasks_router.post("/{task_id}/time", response_model=APIResponse[TimeEntryResponse])
def log_task_time(
    task_id: UUID,
    body: TimeEntryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.task:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TaskService(db).log_time(ctx, task_id, **body.model_dump()))


@approvals_router.get("", response_model=APIResponse[list[ApprovalResponse]])
def list_approvals(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.approval:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(ApprovalService(db).list(ctx, company_id), pagination))


@approvals_router.post("", response_model=APIResponse[ApprovalResponse])
def act_approval(
    body: ApprovalActBody,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.approval:act"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ApprovalService(db).act(ctx, **body.model_dump()))


@m365_router.get("/workspaces", response_model=APIResponse[list[M365WorkspaceResponse]])
def list_workspaces(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.m365:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(M365Service(db).list_workspaces(ctx, company_id), pagination))


@m365_router.get("/files", response_model=APIResponse[list[M365FileResponse]])
def list_files(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.m365:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(M365Service(db).list_files(ctx, company_id), pagination))


@m365_router.post("/files", response_model=APIResponse[M365FileResponse])
def register_file(
    body: M365FileCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.m365:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=M365Service(db).register_file(ctx, **body.model_dump()))


@m365_router.post("/files/{file_id}/promote", response_model=APIResponse[M365FileResponse])
def promote_file(
    file_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.m365:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=M365Service(db).promote_to_sharepoint(ctx, file_id))


@m365_router.get("/meetings", response_model=APIResponse[list[MeetingResponse]])
def list_meetings(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.m365:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(M365Service(db).list_meetings(ctx, company_id), pagination))


@m365_router.post("/meetings", response_model=APIResponse[MeetingResponse])
def schedule_meeting(
    body: MeetingCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.m365:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=M365Service(db).schedule_meeting(ctx, **body.model_dump()))


@m365_router.post("/search")
def m365_search(
    body: SearchQuery,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.m365:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=M365Service(db).search(ctx, body.query))


@workload_router.get("/overview")
def workload_overview(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.workload:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=WorkloadService(db).overview(ctx, company_id))


@ops_router.get("/events", response_model=APIResponse[list[OpsEventResponse]])
def list_ops_events(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.ops:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(OpsEventService(db).list(ctx, company_id), pagination))


@ai_ops_router.post("/improve")
def ai_improve(
    body: AiImproveBody,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:generate"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AiOpsService(db).improve(body.text, body.mode))


@ai_ops_router.post("/review")
def ai_review(
    body: AiImproveBody,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:generate"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AiOpsService(db).review(body.text))


@ai_ops_router.post("/creative")
def ai_creative(
    body: AiTopicBody,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:generate"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AiOpsService(db).creative_brief(body.topic))


@ai_ops_router.post("/video")
def ai_video(
    body: AiTopicBody,
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:generate"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AiOpsService(db).video_assist(body.topic))


@ai_ops_router.get("/knowledge")
def ai_knowledge(
    ctx: Annotated[TenantContext, Depends(require_permission("marketing.content:read"))],
    db: Annotated[Session, Depends(get_db)],
    q: Annotated[str, Query(min_length=1)],
):
    return APIResponse(message="OK", data=AiOpsService(db).knowledge(ctx, q))
