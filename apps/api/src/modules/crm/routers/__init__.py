"""CRM REST routers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.crm.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
)
from modules.crm.schemas import (
    CallLogCreate,
    CampaignCreate,
    CampaignMemberCreate,
    CampaignMemberResponse,
    CampaignResponse,
    EmailLogCreate,
    FeedbackCreate,
    FeedbackResponse,
    FollowupCreate,
    FollowupResponse,
    InteractionCreate,
    InteractionResponse,
    LeadActivityCreate,
    LeadActivityResponse,
    LeadAssignmentResponse,
    LeadAssignRequest,
    LeadConvertRequest,
    LeadCreate,
    LeadResponse,
    LeadSourceCreate,
    LeadSourceResponse,
    LeadSourceUpdate,
    LeadUpdate,
    LogResponse,
    MeetingCreate,
    MeetingResponse,
    OpportunityCloseLostRequest,
    OpportunityCloseWonRequest,
    OpportunityCreate,
    OpportunityResponse,
    OpportunityStageResponse,
    OpportunityTimelineResponse,
    OpportunityUpdate,
    PipelineCreate,
    PipelineResponse,
    PipelineUpdate,
    ReportSummaryResponse,
    SatisfactionCreate,
    SatisfactionResponse,
    TaskCreate,
    TaskResponse,
    VisitLogCreate,
)
from modules.crm.service import (
    CallLogService,
    CampaignService,
    CRMReportService,
    CustomerSatisfactionService,
    EmailLogService,
    FeedbackService,
    FollowupService,
    InteractionService,
    LeadActivityService,
    LeadAssignmentService,
    LeadService,
    LeadSourceService,
    MeetingService,
    OpportunityService,
    OpportunityStageService,
    OpportunityTimelineService,
    PipelineService,
    TaskService,
    VisitLogService,
)
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

lead_sources_router = APIRouter(prefix="/lead-sources", tags=["CRM - Lead Sources"])
leads_router = APIRouter(prefix="/leads", tags=["CRM - Leads"])
lead_assignments_router = APIRouter(prefix="/lead-assignments", tags=["CRM - Lead Assignments"])
lead_activities_router = APIRouter(prefix="/lead-activities", tags=["CRM - Lead Activities"])
pipelines_router = APIRouter(prefix="/pipelines", tags=["CRM - Pipelines"])
opportunities_router = APIRouter(prefix="/opportunities", tags=["CRM - Opportunities"])
opportunity_stages_router = APIRouter(prefix="/opportunity-stages", tags=["CRM - Opportunity Stages"])
campaigns_router = APIRouter(prefix="/campaigns", tags=["CRM - Campaigns"])
campaign_members_router = APIRouter(prefix="/campaign-members", tags=["CRM - Campaign Members"])
interactions_router = APIRouter(prefix="/interactions", tags=["CRM - Interactions"])
tasks_router = APIRouter(prefix="/tasks", tags=["CRM - Tasks"])
followups_router = APIRouter(prefix="/followups", tags=["CRM - Followups"])
meetings_router = APIRouter(prefix="/meetings", tags=["CRM - Meetings"])
call_logs_router = APIRouter(prefix="/call-logs", tags=["CRM - Call Logs"])
email_logs_router = APIRouter(prefix="/email-logs", tags=["CRM - Email Logs"])
visit_logs_router = APIRouter(prefix="/visit-logs", tags=["CRM - Visit Logs"])
feedback_router = APIRouter(prefix="/customer-feedback", tags=["CRM - Feedback"])
satisfaction_router = APIRouter(prefix="/customer-satisfaction", tags=["CRM - Satisfaction"])
reports_router = APIRouter(prefix="/reports", tags=["CRM - Reports"])


@lead_sources_router.get("", response_model=APIResponse[list[LeadSourceResponse]])
def list_lead_sources(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead_source:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = LeadSourceService(db).list(ctx, company_id)
    return APIResponse(message="OK", data=paginate(rows, pagination))


@lead_sources_router.post("", response_model=APIResponse[LeadSourceResponse])
def create_lead_source(
    body: LeadSourceCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead_source:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = LeadSourceService(db).create(ctx, **body.model_dump())
    return APIResponse(message="OK", data=row)


@lead_sources_router.get("/{source_id}", response_model=APIResponse[LeadSourceResponse])
def get_lead_source(
    source_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead_source:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeadSourceService(db).get(ctx, source_id))


@lead_sources_router.patch("/{source_id}", response_model=APIResponse[LeadSourceResponse])
def update_lead_source(
    source_id: UUID,
    body: LeadSourceUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead_source:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeadSourceService(db).update(ctx, source_id, **extract_update_fields(body)))


@leads_router.get("", response_model=APIResponse[list[LeadResponse]])
def list_leads(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    company_account_id: UUID | None = None,
):
    rows = LeadService(db).list(ctx, company_id, company_account_id)
    return APIResponse(message="OK", data=paginate(rows, pagination))


@leads_router.post("", response_model=APIResponse[LeadResponse])
def create_lead(
    body: LeadCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeadService(db).create(ctx, **body.model_dump()))


@leads_router.get("/{lead_id}", response_model=APIResponse[LeadResponse])
def get_lead(
    lead_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeadService(db).get(ctx, lead_id))


@leads_router.patch("/{lead_id}", response_model=APIResponse[LeadResponse])
def update_lead(
    lead_id: UUID,
    body: LeadUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeadService(db).update(ctx, lead_id, **extract_update_fields(body)))


@leads_router.post("/{lead_id}/assign", response_model=APIResponse[LeadAssignmentResponse])
def assign_lead(
    lead_id: UUID,
    body: LeadAssignRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:assign"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeadService(db).assign(ctx, lead_id, **body.model_dump()))


@leads_router.post("/{lead_id}/convert", response_model=APIResponse[OpportunityResponse])
def convert_lead(
    lead_id: UUID,
    body: LeadConvertRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:convert"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeadService(db).convert(ctx, lead_id, **body.model_dump()))


@lead_assignments_router.get("", response_model=APIResponse[list[LeadAssignmentResponse]])
def list_assignments(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(LeadAssignmentService(db).list(ctx, company_id), pagination))


@lead_activities_router.get("", response_model=APIResponse[list[LeadActivityResponse]])
def list_activities(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(LeadActivityService(db).list(ctx, company_id), pagination))


@lead_activities_router.post("", response_model=APIResponse[LeadActivityResponse])
def create_activity(
    body: LeadActivityCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeadActivityService(db).create(ctx, **body.model_dump()))


@pipelines_router.get("", response_model=APIResponse[list[PipelineResponse]])
def list_pipelines(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.pipeline:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(PipelineService(db).list(ctx, company_id), pagination))


@pipelines_router.post("", response_model=APIResponse[PipelineResponse])
def create_pipeline(
    body: PipelineCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.pipeline:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PipelineService(db).create(ctx, **body.model_dump(exclude_none=True)))


@pipelines_router.patch("/{pipeline_id}", response_model=APIResponse[PipelineResponse])
def update_pipeline(
    pipeline_id: UUID,
    body: PipelineUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.pipeline:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PipelineService(db).update(ctx, pipeline_id, **extract_update_fields(body)))


@opportunities_router.get("", response_model=APIResponse[list[OpportunityResponse]])
def list_opportunities(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.opportunity:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(OpportunityService(db).list(ctx, company_id), pagination))


@opportunities_router.post("", response_model=APIResponse[OpportunityResponse])
def create_opportunity(
    body: OpportunityCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.opportunity:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OpportunityService(db).create(ctx, **body.model_dump()))


@opportunities_router.get("/{opportunity_id}", response_model=APIResponse[OpportunityResponse])
def get_opportunity(
    opportunity_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.opportunity:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OpportunityService(db).get(ctx, opportunity_id))


@opportunities_router.get(
    "/{opportunity_id}/timeline",
    response_model=APIResponse[OpportunityTimelineResponse],
)
def get_opportunity_timeline(
    opportunity_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.opportunity:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=OpportunityTimelineService(db).timeline(ctx, opportunity_id),
    )


@opportunities_router.patch("/{opportunity_id}", response_model=APIResponse[OpportunityResponse])
def update_opportunity(
    opportunity_id: UUID,
    body: OpportunityUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.opportunity:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OpportunityService(db).update(ctx, opportunity_id, **extract_update_fields(body)),
    )


@opportunities_router.post("/{opportunity_id}/close-won", response_model=APIResponse[OpportunityResponse])
def close_won(
    opportunity_id: UUID,
    body: OpportunityCloseWonRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.opportunity:close"))],
    db: Annotated[Session, Depends(get_db)],
):
    opp, _ = OpportunityService(db).close_won(ctx, opportunity_id, **body.model_dump())
    return APIResponse(message="OK", data=opp)


@opportunities_router.post("/{opportunity_id}/close-lost", response_model=APIResponse[OpportunityResponse])
def close_lost(
    opportunity_id: UUID,
    body: OpportunityCloseLostRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.opportunity:close"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OpportunityService(db).close_lost(ctx, opportunity_id, **body.model_dump()))


@opportunity_stages_router.get("", response_model=APIResponse[list[OpportunityStageResponse]])
def list_stages(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.opportunity:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(OpportunityStageService(db).list(ctx, company_id), pagination))


@campaigns_router.get("", response_model=APIResponse[list[CampaignResponse]])
def list_campaigns(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.campaign:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(CampaignService(db).list(ctx, company_id), pagination))


@campaigns_router.post("", response_model=APIResponse[CampaignResponse])
def create_campaign(
    body: CampaignCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.campaign:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CampaignService(db).create(ctx, **body.model_dump()))


@campaigns_router.post("/{campaign_id}/activate", response_model=APIResponse[CampaignResponse])
def activate_campaign(
    campaign_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.campaign:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CampaignService(db).activate(ctx, campaign_id))


@campaigns_router.post("/{campaign_id}/members", response_model=APIResponse[CampaignMemberResponse])
def add_campaign_member(
    campaign_id: UUID,
    body: CampaignMemberCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.campaign:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CampaignService(db).add_member(ctx, campaign_id, **body.model_dump()))


@campaign_members_router.get("", response_model=APIResponse[list[CampaignMemberResponse]])
def list_campaign_members(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.campaign:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(CampaignService(db).list_members(ctx, company_id), pagination))


@interactions_router.get("", response_model=APIResponse[list[InteractionResponse]])
def list_interactions(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.interaction:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(InteractionService(db).list(ctx, company_id), pagination))


@interactions_router.post("", response_model=APIResponse[InteractionResponse])
def create_interaction(
    body: InteractionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.interaction:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=InteractionService(db).create(ctx, **body.model_dump()))


@tasks_router.get("", response_model=APIResponse[list[TaskResponse]])
def list_tasks(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.task:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    opportunity_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=paginate(
            TaskService(db).list(ctx, company_id, opportunity_id=opportunity_id),
            pagination,
        ),
    )


@tasks_router.post("", response_model=APIResponse[TaskResponse])
def create_task(
    body: TaskCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.task:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TaskService(db).create(ctx, **body.model_dump()))


@tasks_router.post("/{task_id}/complete", response_model=APIResponse[TaskResponse])
def complete_task(
    task_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.task:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TaskService(db).complete(ctx, task_id))


@followups_router.get("", response_model=APIResponse[list[FollowupResponse]])
def list_followups(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.followup:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    company_account_id: UUID | None = None,
):
    rows = FollowupService(db).list(ctx, company_id, company_account_id=company_account_id)
    return APIResponse(message="OK", data=paginate(rows, pagination))


@followups_router.post("", response_model=APIResponse[FollowupResponse])
def create_followup(
    body: FollowupCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.followup:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=FollowupService(db).create(ctx, **body.model_dump()))


@followups_router.post("/{followup_id}/complete", response_model=APIResponse[FollowupResponse])
def complete_followup(
    followup_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.followup:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=FollowupService(db).complete(ctx, followup_id))


@meetings_router.get("", response_model=APIResponse[list[MeetingResponse]])
def list_meetings(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.meeting:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    company_account_id: UUID | None = None,
):
    rows = MeetingService(db).list(ctx, company_id, company_account_id=company_account_id)
    return APIResponse(message="OK", data=paginate(rows, pagination))


@meetings_router.post("", response_model=APIResponse[MeetingResponse])
def create_meeting(
    body: MeetingCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.meeting:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=MeetingService(db).create(ctx, **body.model_dump()))


@meetings_router.post("/{meeting_id}/complete", response_model=APIResponse[MeetingResponse])
def complete_meeting(
    meeting_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.meeting:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=MeetingService(db).complete(ctx, meeting_id))


@call_logs_router.post("", response_model=APIResponse[LogResponse])
def create_call_log(
    body: CallLogCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.call_log:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CallLogService(db).create(ctx, **body.model_dump()))


@call_logs_router.get("", response_model=APIResponse[list[LogResponse]])
def list_call_logs(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.call_log:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(CallLogService(db).list(ctx, company_id), pagination))


@email_logs_router.post("", response_model=APIResponse[LogResponse])
def create_email_log(
    body: EmailLogCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.email_log:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EmailLogService(db).create(ctx, **body.model_dump()))


@email_logs_router.get("", response_model=APIResponse[list[LogResponse]])
def list_email_logs(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.email_log:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(EmailLogService(db).list(ctx, company_id), pagination))


@visit_logs_router.post("", response_model=APIResponse[LogResponse])
def create_visit_log(
    body: VisitLogCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.visit_log:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=VisitLogService(db).create(ctx, **body.model_dump()))


@visit_logs_router.get("", response_model=APIResponse[list[LogResponse]])
def list_visit_logs(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.visit_log:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(VisitLogService(db).list(ctx, company_id), pagination))


@feedback_router.get("", response_model=APIResponse[list[FeedbackResponse]])
def list_feedback(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.feedback:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(FeedbackService(db).list(ctx, company_id), pagination))


@feedback_router.post("", response_model=APIResponse[FeedbackResponse])
def create_feedback(
    body: FeedbackCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.feedback:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=FeedbackService(db).create(ctx, **body.model_dump()))


@feedback_router.post("/{feedback_id}/close", response_model=APIResponse[FeedbackResponse])
def close_feedback(
    feedback_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.feedback:close"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=FeedbackService(db).close(ctx, feedback_id))


@satisfaction_router.get("", response_model=APIResponse[list[SatisfactionResponse]])
def list_satisfaction(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.satisfaction:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(CustomerSatisfactionService(db).list(ctx, company_id), pagination)
    )


@satisfaction_router.post("", response_model=APIResponse[SatisfactionResponse])
def create_satisfaction(
    body: SatisfactionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.satisfaction:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CustomerSatisfactionService(db).create(ctx, **body.model_dump()))


@satisfaction_router.post("/{score_id}/publish", response_model=APIResponse[SatisfactionResponse])
def publish_satisfaction(
    score_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.satisfaction:publish"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CustomerSatisfactionService(db).publish(ctx, score_id))


@reports_router.get("/summary", response_model=APIResponse[ReportSummaryResponse])
def report_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=CRMReportService(db).summary(ctx, company_id))


# ---------------------------------------------------------------------------
# Sales CRM (Zoho-replacement) routers — defined in their own modules and
# re-exported here so `modules.crm.router` can import everything from this
# package the same way it does for the legacy CRM routers above.
# ---------------------------------------------------------------------------
from modules.crm.routers.attachments import attachments_router  # noqa: E402,F401
from modules.crm.routers.blueprint import blueprint_router  # noqa: E402,F401
from modules.crm.routers.companies import companies_router  # noqa: E402,F401
from modules.crm.routers.contacts import contacts_router  # noqa: E402,F401
from modules.crm.routers.my_jobs import my_jobs_router  # noqa: E402,F401
from modules.crm.routers.ovf import ovf_router  # noqa: E402,F401
from modules.crm.routers.products import products_router  # noqa: E402,F401
from modules.crm.routers.sales_quotes import quotes_router  # noqa: E402,F401
