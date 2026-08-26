"""Project REST routers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.project.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
    require_permission,
)
from modules.project.schemas import (
    ChangeRequestCreate,
    ChangeRequestResponse,
    ChangeRequestUpdate,
    ProjectBudgetCreate,
    ProjectBudgetResponse,
    ProjectBudgetUpdate,
    ProjectCommentCreate,
    ProjectCommentResponse,
    ProjectCommentUpdate,
    ProjectCostCreate,
    ProjectCostPostRequest,
    ProjectCostResponse,
    ProjectCostUpdate,
    ProjectCreate,
    ProjectDocumentCreate,
    ProjectDocumentResponse,
    ProjectDocumentUpdate,
    ProjectIssueCreate,
    ProjectIssueResponse,
    ProjectIssueUpdate,
    ProjectMilestoneCreate,
    ProjectMilestoneResponse,
    ProjectMilestoneUpdate,
    ProjectNotificationCreate,
    ProjectNotificationResponse,
    ProjectNotificationUpdate,
    ProjectPhaseCreate,
    ProjectPhaseResponse,
    ProjectPhaseUpdate,
    ProjectReportCreate,
    ProjectReportResponse,
    ProjectReportUpdate,
    ProjectResponse,
    ProjectRiskCreate,
    ProjectRiskResponse,
    ProjectRiskUpdate,
    ProjectStatusHistoryCreate,
    ProjectStatusHistoryResponse,
    ProjectStatusHistoryUpdate,
    ProjectTaskCreate,
    ProjectTaskResponse,
    ProjectTaskUpdate,
    ProjectUpdate,
    ResourceAllocationCreate,
    ResourceAllocationResponse,
    ResourceAllocationUpdate,
    ResourcePlanCreate,
    ResourcePlanResponse,
    ResourcePlanUpdate,
    SiteInstallationAdvanceRequest,
    SiteInstallationBlueprintResponse,
    SiteInstallationCreate,
    SiteInstallationFollowUpRequest,
    SiteInstallationFollowUpResponse,
    SiteInstallationNoAnswerNotifyRequest,
    SiteStageFollowUpItem,
    SiteInstallationResponse,
    SiteInstallationUpdate,
    TaskAssignmentCreate,
    TaskAssignmentResponse,
    TaskAssignmentUpdate,
    TaskDependencyCreate,
    TaskDependencyResponse,
    TaskDependencyUpdate,
    TimesheetCreate,
    TimesheetEntryCreate,
    TimesheetEntryResponse,
    TimesheetEntryUpdate,
    TimesheetResponse,
    TimesheetUpdate,
)
from modules.project.service import (
    BudgetService,
    ChangeRequestService,
    CommentService,
    CostService,
    DocumentService,
    IssueService,
    MilestoneService,
    NotificationService,
    PhaseService,
    ProjectReportService,
    ProjectService,
    ResourceAllocationService,
    ResourcePlanningService,
    RiskService,
    SiteInstallationService,
    StatusHistoryService,
    TaskAssignmentService,
    TaskDependencyService,
    TaskService,
    TimesheetEntryService,
    TimesheetService,
)
from shared.schemas import APIResponse

projects_router = APIRouter(prefix="/projects", tags=["Project — Project"])

project_phases_router = APIRouter(prefix="/project-phases", tags=["Project — ProjectPhase"])

project_milestones_router = APIRouter(
    prefix="/project-milestones", tags=["Project — ProjectMilestone"]
)

project_tasks_router = APIRouter(prefix="/project-tasks", tags=["Project — ProjectTask"])

task_dependencies_router = APIRouter(
    prefix="/task-dependencies", tags=["Project — TaskDependency"]
)

task_assignments_router = APIRouter(
    prefix="/task-assignments", tags=["Project — TaskAssignment"]
)

timesheets_router = APIRouter(prefix="/timesheets", tags=["Project — Timesheet"])

timesheet_entries_router = APIRouter(
    prefix="/timesheet-entries", tags=["Project — TimesheetEntry"]
)

resource_plans_router = APIRouter(prefix="/resource-plans", tags=["Project — ResourcePlan"])

resource_allocations_router = APIRouter(
    prefix="/resource-allocations", tags=["Project — ResourceAllocation"]
)

project_budgets_router = APIRouter(prefix="/project-budgets", tags=["Project — ProjectBudget"])

project_costs_router = APIRouter(prefix="/project-costs", tags=["Project — ProjectCost"])

project_issues_router = APIRouter(prefix="/project-issues", tags=["Project — ProjectIssue"])

project_risks_router = APIRouter(prefix="/project-risks", tags=["Project — ProjectRisk"])

change_requests_router = APIRouter(prefix="/change-requests", tags=["Project — ChangeRequest"])

project_documents_router = APIRouter(
    prefix="/project-documents", tags=["Project — ProjectDocument"]
)

project_comments_router = APIRouter(
    prefix="/project-comments", tags=["Project — ProjectComment"]
)

project_status_history_router = APIRouter(
    prefix="/project-status-history", tags=["Project — ProjectStatusHistory"]
)

project_notifications_router = APIRouter(
    prefix="/project-notifications", tags=["Project — ProjectNotification"]
)

reports_router = APIRouter(prefix="/reports", tags=["Project — ProjectReport"])

site_installations_router = APIRouter(
    prefix="/site-installations", tags=["Project — SiteInstallation"]
)
@projects_router.get("", response_model=APIResponse[list[ProjectResponse]])
def list_projects(
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ProjectService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@projects_router.get("/{row_id}", response_model=APIResponse[ProjectResponse])
def get_projects(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ProjectService(db).get(ctx, row_id))

@projects_router.post("", response_model=APIResponse[ProjectResponse])
def create_projects(
    body: ProjectCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump(exclude={"branch_id"}, exclude_none=True)
    site = payload.pop("site_installation", None)
    if site is not None:
        payload["site_installation"] = site
    # Keep False explicitly so OVF POs cannot bypass via omit-then-default.
    payload["installation_handoff"] = bool(body.installation_handoff)
    return APIResponse(
        message="Created",
        data=ProjectService(db).create(ctx, branch_id=body.branch_id, **payload),
    )

@projects_router.patch("/{row_id}", response_model=APIResponse[ProjectResponse])
def update_projects(
    row_id: UUID,
    body: ProjectUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ProjectService(db).update(ctx, row_id, **extract_update_fields(body)))

@projects_router.post("/{row_id}/submit", response_model=APIResponse[ProjectResponse])
def submit_projects(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Submit", data=ProjectService(db).submit(ctx, row_id))

@projects_router.post("/{row_id}/approve", response_model=APIResponse[ProjectResponse])
def approve_projects(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Approve", data=ProjectService(db).approve(ctx, row_id))

@projects_router.post("/{row_id}/close", response_model=APIResponse[ProjectResponse])
def close_projects(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:close"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Close", data=ProjectService(db).close(ctx, row_id))

@project_phases_router.get("", response_model=APIResponse[list[ProjectPhaseResponse]])
def list_project_phases(
    ctx: Annotated[TenantContext, Depends(require_permission("project.phase:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = PhaseService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@project_phases_router.get("/{row_id}", response_model=APIResponse[ProjectPhaseResponse])
def get_project_phases(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.phase:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PhaseService(db).get(ctx, row_id))

@project_phases_router.post("", response_model=APIResponse[ProjectPhaseResponse])
def create_project_phases(
    body: ProjectPhaseCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.phase:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PhaseService(db).create(ctx, **body.model_dump(exclude_none=True)))

@project_phases_router.patch("/{row_id}", response_model=APIResponse[ProjectPhaseResponse])
def update_project_phases(
    row_id: UUID,
    body: ProjectPhaseUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.phase:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PhaseService(db).update(ctx, row_id, **extract_update_fields(body)))

@project_milestones_router.get("", response_model=APIResponse[list[ProjectMilestoneResponse]])
def list_project_milestones(
    ctx: Annotated[TenantContext, Depends(require_permission("project.milestone:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = MilestoneService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@project_milestones_router.get("/{row_id}", response_model=APIResponse[ProjectMilestoneResponse])
def get_project_milestones(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.milestone:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=MilestoneService(db).get(ctx, row_id))

@project_milestones_router.post("", response_model=APIResponse[ProjectMilestoneResponse])
def create_project_milestones(
    body: ProjectMilestoneCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.milestone:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=MilestoneService(db).create(ctx, **body.model_dump(exclude_none=True)))

@project_milestones_router.patch("/{row_id}", response_model=APIResponse[ProjectMilestoneResponse])
def update_project_milestones(
    row_id: UUID,
    body: ProjectMilestoneUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.milestone:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=MilestoneService(db).update(ctx, row_id, **extract_update_fields(body)))

@project_tasks_router.get("", response_model=APIResponse[list[ProjectTaskResponse]])
def list_project_tasks(
    ctx: Annotated[TenantContext, Depends(require_permission("project.task:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TaskService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@project_tasks_router.get("/{row_id}", response_model=APIResponse[ProjectTaskResponse])
def get_project_tasks(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.task:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TaskService(db).get(ctx, row_id))

@project_tasks_router.post("", response_model=APIResponse[ProjectTaskResponse])
def create_project_tasks(
    body: ProjectTaskCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.task:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=TaskService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@project_tasks_router.patch("/{row_id}", response_model=APIResponse[ProjectTaskResponse])
def update_project_tasks(
    row_id: UUID,
    body: ProjectTaskUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.task:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=TaskService(db).update(ctx, row_id, **extract_update_fields(body)))

@project_tasks_router.post("/{row_id}/submit", response_model=APIResponse[ProjectTaskResponse])
def submit_project_tasks(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.task:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Submit", data=TaskService(db).submit(ctx, row_id))

@project_tasks_router.post("/{row_id}/approve", response_model=APIResponse[ProjectTaskResponse])
def approve_project_tasks(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.task:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Approve", data=TaskService(db).approve(ctx, row_id))

@task_dependencies_router.get("", response_model=APIResponse[list[TaskDependencyResponse]])
def list_task_dependencies(
    ctx: Annotated[TenantContext, Depends(require_permission("project.task:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TaskDependencyService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@task_dependencies_router.get("/{row_id}", response_model=APIResponse[TaskDependencyResponse])
def get_task_dependencies(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.task:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TaskDependencyService(db).get(ctx, row_id))

@task_dependencies_router.post("", response_model=APIResponse[TaskDependencyResponse])
def create_task_dependencies(
    body: TaskDependencyCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.task:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=TaskDependencyService(db).create(ctx, **body.model_dump(exclude_none=True)))

@task_dependencies_router.patch("/{row_id}", response_model=APIResponse[TaskDependencyResponse])
def update_task_dependencies(
    row_id: UUID,
    body: TaskDependencyUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.task:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=TaskDependencyService(db).update(ctx, row_id, **extract_update_fields(body)))

@task_assignments_router.get("", response_model=APIResponse[list[TaskAssignmentResponse]])
def list_task_assignments(
    ctx: Annotated[TenantContext, Depends(require_permission("project.task:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TaskAssignmentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@task_assignments_router.get("/{row_id}", response_model=APIResponse[TaskAssignmentResponse])
def get_task_assignments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.task:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TaskAssignmentService(db).get(ctx, row_id))

@task_assignments_router.post("", response_model=APIResponse[TaskAssignmentResponse])
def create_task_assignments(
    body: TaskAssignmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.task:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=TaskAssignmentService(db).create(ctx, **body.model_dump(exclude_none=True)))

@task_assignments_router.patch("/{row_id}", response_model=APIResponse[TaskAssignmentResponse])
def update_task_assignments(
    row_id: UUID,
    body: TaskAssignmentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.task:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=TaskAssignmentService(db).update(ctx, row_id, **extract_update_fields(body)))

@timesheets_router.get("", response_model=APIResponse[list[TimesheetResponse]])
def list_timesheets(
    ctx: Annotated[TenantContext, Depends(require_permission("project.timesheet:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TimesheetService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@timesheets_router.get("/{row_id}", response_model=APIResponse[TimesheetResponse])
def get_timesheets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.timesheet:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TimesheetService(db).get(ctx, row_id))

@timesheets_router.post("", response_model=APIResponse[TimesheetResponse])
def create_timesheets(
    body: TimesheetCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.timesheet:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=TimesheetService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@timesheets_router.patch("/{row_id}", response_model=APIResponse[TimesheetResponse])
def update_timesheets(
    row_id: UUID,
    body: TimesheetUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.timesheet:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=TimesheetService(db).update(ctx, row_id, **extract_update_fields(body)))

@timesheets_router.post("/{row_id}/submit", response_model=APIResponse[TimesheetResponse])
def submit_timesheets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.timesheet:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Submit", data=TimesheetService(db).submit(ctx, row_id))

@timesheets_router.post("/{row_id}/approve", response_model=APIResponse[TimesheetResponse])
def approve_timesheets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.timesheet:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Approve", data=TimesheetService(db).approve(ctx, row_id))

@timesheet_entries_router.get("", response_model=APIResponse[list[TimesheetEntryResponse]])
def list_timesheet_entries(
    ctx: Annotated[TenantContext, Depends(require_permission("project.timesheet:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TimesheetEntryService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@timesheet_entries_router.get("/{row_id}", response_model=APIResponse[TimesheetEntryResponse])
def get_timesheet_entries(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.timesheet:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TimesheetEntryService(db).get(ctx, row_id))

@timesheet_entries_router.post("", response_model=APIResponse[TimesheetEntryResponse])
def create_timesheet_entries(
    body: TimesheetEntryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.timesheet:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=TimesheetEntryService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@timesheet_entries_router.patch("/{row_id}", response_model=APIResponse[TimesheetEntryResponse])
def update_timesheet_entries(
    row_id: UUID,
    body: TimesheetEntryUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.timesheet:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=TimesheetEntryService(db).update(ctx, row_id, **extract_update_fields(body)))

@resource_plans_router.get("", response_model=APIResponse[list[ResourcePlanResponse]])
def list_resource_plans(
    ctx: Annotated[TenantContext, Depends(require_permission("project.resource:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ResourcePlanningService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@resource_plans_router.get("/{row_id}", response_model=APIResponse[ResourcePlanResponse])
def get_resource_plans(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.resource:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ResourcePlanningService(db).get(ctx, row_id))

@resource_plans_router.post("", response_model=APIResponse[ResourcePlanResponse])
def create_resource_plans(
    body: ResourcePlanCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.resource:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ResourcePlanningService(db).create(ctx, **body.model_dump(exclude_none=True)))

@resource_plans_router.patch("/{row_id}", response_model=APIResponse[ResourcePlanResponse])
def update_resource_plans(
    row_id: UUID,
    body: ResourcePlanUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.resource:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ResourcePlanningService(db).update(ctx, row_id, **extract_update_fields(body)))

@resource_allocations_router.get("", response_model=APIResponse[list[ResourceAllocationResponse]])
def list_resource_allocations(
    ctx: Annotated[TenantContext, Depends(require_permission("project.resource:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ResourceAllocationService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@resource_allocations_router.get("/{row_id}", response_model=APIResponse[ResourceAllocationResponse])
def get_resource_allocations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.resource:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ResourceAllocationService(db).get(ctx, row_id))

@resource_allocations_router.post("", response_model=APIResponse[ResourceAllocationResponse])
def create_resource_allocations(
    body: ResourceAllocationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.resource:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ResourceAllocationService(db).create(ctx, **body.model_dump(exclude_none=True)))

@resource_allocations_router.patch("/{row_id}", response_model=APIResponse[ResourceAllocationResponse])
def update_resource_allocations(
    row_id: UUID,
    body: ResourceAllocationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.resource:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ResourceAllocationService(db).update(ctx, row_id, **extract_update_fields(body)))

@project_budgets_router.get("", response_model=APIResponse[list[ProjectBudgetResponse]])
def list_project_budgets(
    ctx: Annotated[TenantContext, Depends(require_permission("project.budget:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = BudgetService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@project_budgets_router.get("/{row_id}", response_model=APIResponse[ProjectBudgetResponse])
def get_project_budgets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.budget:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=BudgetService(db).get(ctx, row_id))

@project_budgets_router.post("", response_model=APIResponse[ProjectBudgetResponse])
def create_project_budgets(
    body: ProjectBudgetCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.budget:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=BudgetService(db).create(ctx, **body.model_dump(exclude_none=True)))

@project_budgets_router.patch("/{row_id}", response_model=APIResponse[ProjectBudgetResponse])
def update_project_budgets(
    row_id: UUID,
    body: ProjectBudgetUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.budget:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=BudgetService(db).update(ctx, row_id, **extract_update_fields(body)))

@project_budgets_router.post("/{row_id}/submit", response_model=APIResponse[ProjectBudgetResponse])
def submit_project_budgets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.budget:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Submit", data=BudgetService(db).submit(ctx, row_id))

@project_budgets_router.post("/{row_id}/approve", response_model=APIResponse[ProjectBudgetResponse])
def approve_project_budgets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.budget:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Approve", data=BudgetService(db).approve(ctx, row_id))

@project_costs_router.get("", response_model=APIResponse[list[ProjectCostResponse]])
def list_project_costs(
    ctx: Annotated[TenantContext, Depends(require_permission("project.cost:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = CostService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@project_costs_router.get("/{row_id}", response_model=APIResponse[ProjectCostResponse])
def get_project_costs(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.cost:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CostService(db).get(ctx, row_id))

@project_costs_router.post("", response_model=APIResponse[ProjectCostResponse])
def create_project_costs(
    body: ProjectCostCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.cost:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=CostService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@project_costs_router.patch("/{row_id}", response_model=APIResponse[ProjectCostResponse])
def update_project_costs(
    row_id: UUID,
    body: ProjectCostUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.cost:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=CostService(db).update(ctx, row_id, **extract_update_fields(body)))

@project_costs_router.post("/{row_id}/post", response_model=APIResponse[ProjectCostResponse])
def post_project_costs(
    row_id: UUID,
    body: ProjectCostPostRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("project.cost:post"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Posted", data=CostService(db).post(
        ctx, row_id, body.debit_account_id, body.credit_account_id, body.fiscal_year_id
    ))

@project_issues_router.get("", response_model=APIResponse[list[ProjectIssueResponse]])
def list_project_issues(
    ctx: Annotated[TenantContext, Depends(require_permission("project.issue:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = IssueService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@project_issues_router.get("/{row_id}", response_model=APIResponse[ProjectIssueResponse])
def get_project_issues(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.issue:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=IssueService(db).get(ctx, row_id))

@project_issues_router.post("", response_model=APIResponse[ProjectIssueResponse])
def create_project_issues(
    body: ProjectIssueCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.issue:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=IssueService(db).create(ctx, **body.model_dump(exclude_none=True)))

@project_issues_router.patch("/{row_id}", response_model=APIResponse[ProjectIssueResponse])
def update_project_issues(
    row_id: UUID,
    body: ProjectIssueUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.issue:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=IssueService(db).update(ctx, row_id, **extract_update_fields(body)))

@project_risks_router.get("", response_model=APIResponse[list[ProjectRiskResponse]])
def list_project_risks(
    ctx: Annotated[TenantContext, Depends(require_permission("project.risk:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = RiskService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@project_risks_router.get("/{row_id}", response_model=APIResponse[ProjectRiskResponse])
def get_project_risks(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.risk:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=RiskService(db).get(ctx, row_id))

@project_risks_router.post("", response_model=APIResponse[ProjectRiskResponse])
def create_project_risks(
    body: ProjectRiskCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.risk:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=RiskService(db).create(ctx, **body.model_dump(exclude_none=True)))

@project_risks_router.patch("/{row_id}", response_model=APIResponse[ProjectRiskResponse])
def update_project_risks(
    row_id: UUID,
    body: ProjectRiskUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.risk:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=RiskService(db).update(ctx, row_id, **extract_update_fields(body)))

@change_requests_router.get("", response_model=APIResponse[list[ChangeRequestResponse]])
def list_change_requests(
    ctx: Annotated[TenantContext, Depends(require_permission("project.change_request:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ChangeRequestService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@change_requests_router.get("/{row_id}", response_model=APIResponse[ChangeRequestResponse])
def get_change_requests(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.change_request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ChangeRequestService(db).get(ctx, row_id))

@change_requests_router.post("", response_model=APIResponse[ChangeRequestResponse])
def create_change_requests(
    body: ChangeRequestCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.change_request:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ChangeRequestService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@change_requests_router.patch("/{row_id}", response_model=APIResponse[ChangeRequestResponse])
def update_change_requests(
    row_id: UUID,
    body: ChangeRequestUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.change_request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ChangeRequestService(db).update(ctx, row_id, **extract_update_fields(body)))

@change_requests_router.post("/{row_id}/submit", response_model=APIResponse[ChangeRequestResponse])
def submit_change_requests(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.change_request:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Submit", data=ChangeRequestService(db).submit(ctx, row_id))

@change_requests_router.post("/{row_id}/approve", response_model=APIResponse[ChangeRequestResponse])
def approve_change_requests(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.change_request:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Approve", data=ChangeRequestService(db).approve(ctx, row_id))

@project_documents_router.get("", response_model=APIResponse[list[ProjectDocumentResponse]])
def list_project_documents(
    ctx: Annotated[TenantContext, Depends(require_permission("project.document:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DocumentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@project_documents_router.get("/{row_id}", response_model=APIResponse[ProjectDocumentResponse])
def get_project_documents(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.document:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DocumentService(db).get(ctx, row_id))

@project_documents_router.post("", response_model=APIResponse[ProjectDocumentResponse])
def create_project_documents(
    body: ProjectDocumentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.document:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DocumentService(db).create(ctx, **body.model_dump(exclude_none=True)))

@project_documents_router.patch("/{row_id}", response_model=APIResponse[ProjectDocumentResponse])
def update_project_documents(
    row_id: UUID,
    body: ProjectDocumentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.document:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DocumentService(db).update(ctx, row_id, **extract_update_fields(body)))

@project_comments_router.get("", response_model=APIResponse[list[ProjectCommentResponse]])
def list_project_comments(
    ctx: Annotated[TenantContext, Depends(require_permission("project.comment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = CommentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@project_comments_router.get("/{row_id}", response_model=APIResponse[ProjectCommentResponse])
def get_project_comments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.comment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CommentService(db).get(ctx, row_id))

@project_comments_router.post("", response_model=APIResponse[ProjectCommentResponse])
def create_project_comments(
    body: ProjectCommentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.comment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=CommentService(db).create(ctx, **body.model_dump(exclude_none=True)))

@project_comments_router.patch("/{row_id}", response_model=APIResponse[ProjectCommentResponse])
def update_project_comments(
    row_id: UUID,
    body: ProjectCommentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.comment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=CommentService(db).update(ctx, row_id, **extract_update_fields(body)))

@project_status_history_router.get("", response_model=APIResponse[list[ProjectStatusHistoryResponse]])
def list_project_status_history(
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = StatusHistoryService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@project_status_history_router.get("/{row_id}", response_model=APIResponse[ProjectStatusHistoryResponse])
def get_project_status_history(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=StatusHistoryService(db).get(ctx, row_id))

@project_status_history_router.post("", response_model=APIResponse[ProjectStatusHistoryResponse])
def create_project_status_history(
    body: ProjectStatusHistoryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=StatusHistoryService(db).create(ctx, **body.model_dump(exclude_none=True)))

@project_status_history_router.patch("/{row_id}", response_model=APIResponse[ProjectStatusHistoryResponse])
def update_project_status_history(
    row_id: UUID,
    body: ProjectStatusHistoryUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=StatusHistoryService(db).update(ctx, row_id, **extract_update_fields(body)))

@project_notifications_router.get("", response_model=APIResponse[list[ProjectNotificationResponse]])
def list_project_notifications(
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = NotificationService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@project_notifications_router.get("/{row_id}", response_model=APIResponse[ProjectNotificationResponse])
def get_project_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=NotificationService(db).get(ctx, row_id))

@project_notifications_router.post("", response_model=APIResponse[ProjectNotificationResponse])
def create_project_notifications(
    body: ProjectNotificationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=NotificationService(db).create(ctx, **body.model_dump(exclude_none=True)))

@project_notifications_router.patch("/{row_id}", response_model=APIResponse[ProjectNotificationResponse])
def update_project_notifications(
    row_id: UUID,
    body: ProjectNotificationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=NotificationService(db).update(ctx, row_id, **extract_update_fields(body)))

@reports_router.get("", response_model=APIResponse[list[ProjectReportResponse]])
def list_reports(
    ctx: Annotated[TenantContext, Depends(require_permission("project.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ProjectReportService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@reports_router.get("/{row_id}", response_model=APIResponse[ProjectReportResponse])
def get_reports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ProjectReportService(db).get(ctx, row_id))

@reports_router.post("", response_model=APIResponse[ProjectReportResponse])
def create_reports(
    body: ProjectReportCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ProjectReportService(db).create(ctx, **body.model_dump(exclude_none=True)))

@reports_router.patch("/{row_id}", response_model=APIResponse[ProjectReportResponse])
def update_reports(
    row_id: UUID,
    body: ProjectReportUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ProjectReportService(db).update(ctx, row_id, **extract_update_fields(body)))


# ---------------------------------------------------------------------------
# Site Installation workflow
# ---------------------------------------------------------------------------


@site_installations_router.get("", response_model=APIResponse[list[SiteInstallationResponse]])
def list_site_installations(
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = SiteInstallationService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@site_installations_router.get(
    "/by-project/{project_id}", response_model=APIResponse[SiteInstallationResponse]
)
def get_site_installation_by_project(
    project_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=SiteInstallationService(db).get_or_bootstrap(ctx, project_id),
    )


@site_installations_router.get(
    "/by-project/{project_id}/blueprint",
    response_model=APIResponse[SiteInstallationBlueprintResponse],
)
def get_site_installation_blueprint(
    project_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SiteInstallationService(db).blueprint(ctx, project_id))


@site_installations_router.post(
    "/by-project/{project_id}/advance",
    response_model=APIResponse[SiteInstallationResponse],
)
def advance_site_installation(
    project_id: UUID,
    body: SiteInstallationAdvanceRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Advanced",
        data=SiteInstallationService(db).advance(ctx, project_id, body.action),
    )


@site_installations_router.post(
    "/by-project/{project_id}/follow-up",
    response_model=APIResponse[SiteInstallationFollowUpResponse],
)
def follow_up_site_installation_stage(
    project_id: UUID,
    body: SiteInstallationFollowUpRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Follow-up sent",
        data=SiteInstallationService(db).follow_up_stage(
            ctx, project_id, body.stage, body.note
        ),
    )


@site_installations_router.post(
    "/by-project/{project_id}/notify-no-answers",
    response_model=APIResponse[SiteInstallationFollowUpResponse],
)
def notify_site_installation_no_answers(
    project_id: UUID,
    body: SiteInstallationNoAnswerNotifyRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Admin notified",
        data=SiteInstallationService(db).notify_no_answers(
            ctx,
            project_id,
            body.stage,
            [item.model_dump() for item in body.items],
        ),
    )


@site_installations_router.get(
    "/by-project/{project_id}/follow-ups",
    response_model=APIResponse[list[SiteStageFollowUpItem]],
)
def list_site_installation_follow_ups(
    project_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=SiteInstallationService(db).list_follow_ups(ctx, project_id),
    )


@site_installations_router.patch(
    "/by-project/{project_id}",
    response_model=APIResponse[SiteInstallationResponse],
)
def update_site_installation_by_project(
    project_id: UUID,
    body: SiteInstallationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=SiteInstallationService(db).update_by_project(
            ctx, project_id, **extract_update_fields(body)
        ),
    )


@site_installations_router.post("", response_model=APIResponse[SiteInstallationResponse])
def create_site_installation(
    body: SiteInstallationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump(exclude={"project_id"}, exclude_none=True)
    return APIResponse(
        message="Created",
        data=SiteInstallationService(db).create_for_project(
            ctx, body.project_id, **payload
        ),
    )


@site_installations_router.get("/{row_id}", response_model=APIResponse[SiteInstallationResponse])
def get_site_installation(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SiteInstallationService(db).get(ctx, row_id))


@site_installations_router.patch(
    "/{row_id}", response_model=APIResponse[SiteInstallationResponse]
)
def update_site_installation(
    row_id: UUID,
    body: SiteInstallationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=SiteInstallationService(db).update(ctx, row_id, **extract_update_fields(body)),
    )
