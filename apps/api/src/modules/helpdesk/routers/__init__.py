"""Helpdesk API route handlers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.helpdesk.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
    require_permission,
)
from modules.helpdesk.schemas import (
    CustomerFeedbackCreate,
    CustomerFeedbackResponse,
    CustomerFeedbackUpdate,
    KnowledgeArticleCreate,
    KnowledgeArticleResponse,
    KnowledgeArticleUpdate,
    KnowledgeBaseCreate,
    KnowledgeBaseResponse,
    KnowledgeBaseUpdate,
    ResolutionCreate,
    ResolutionResponse,
    ResolutionUpdate,
    SupportScheduleCreate,
    SupportScheduleResponse,
    SupportScheduleUpdate,
    SupportShiftCreate,
    SupportShiftResponse,
    SupportShiftUpdate,
    SupportTeamCreate,
    SupportTeamResponse,
    SupportTeamUpdate,
    TicketActivityCreate,
    TicketActivityResponse,
    TicketActivityUpdate,
    TicketAssignmentCreate,
    TicketAssignmentResponse,
    TicketAssignmentUpdate,
    TicketAttachmentCreate,
    TicketAttachmentResponse,
    TicketAttachmentUpdate,
    TicketCategoryCreate,
    TicketCategoryResponse,
    TicketCategoryUpdate,
    TicketCommentCreate,
    TicketCommentResponse,
    TicketCommentUpdate,
    TicketCreate,
    TicketDashboardCreate,
    TicketDashboardResponse,
    TicketDashboardUpdate,
    TicketEscalationCreate,
    TicketEscalationResponse,
    TicketEscalationUpdate,
    TicketNotificationCreate,
    TicketNotificationResponse,
    TicketNotificationUpdate,
    TicketPriorityCreate,
    TicketPriorityResponse,
    TicketPriorityUpdate,
    TicketReportCreate,
    TicketReportResponse,
    TicketReportUpdate,
    TicketResponse,
    TicketSlaCreate,
    TicketSlaResponse,
    TicketSlaUpdate,
    TicketStatusHistoryCreate,
    TicketStatusHistoryResponse,
    TicketStatusHistoryUpdate,
    TicketUpdate,
)
from modules.helpdesk.service import (
    CustomerFeedbackService,
    HelpdeskDashboardService,
    HelpdeskReportService,
    KnowledgeArticleService,
    KnowledgeBaseService,
    ResolutionService,
    SupportScheduleService,
    SupportShiftService,
    SupportTeamService,
    TicketActivityService,
    TicketAssignmentService,
    TicketAttachmentService,
    TicketCategoryService,
    TicketCommentService,
    TicketEscalationService,
    TicketNotificationService,
    TicketPriorityService,
    TicketService,
    TicketSlaService,
    TicketStatusHistoryService,
)
from shared.schemas import APIResponse

ticket_categories_router = APIRouter(
    prefix="/ticket-categories", tags=["Helpdesk — TicketCategory"]
)


@ticket_categories_router.get("", response_model=APIResponse[list[TicketCategoryResponse]])
def list_ticket_categories(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.category:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TicketCategoryService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@ticket_categories_router.get("/{row_id}", response_model=APIResponse[TicketCategoryResponse])
def get_ticket_categories(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.category:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TicketCategoryService(db).get(ctx, row_id))


@ticket_categories_router.post("", response_model=APIResponse[TicketCategoryResponse])
def create_ticket_categories(
    body: TicketCategoryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.category:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=TicketCategoryService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )


@ticket_categories_router.patch("/{row_id}", response_model=APIResponse[TicketCategoryResponse])
def update_ticket_categories(
    row_id: UUID,
    body: TicketCategoryUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.category:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=TicketCategoryService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


ticket_priorities_router = APIRouter(
    prefix="/ticket-priorities", tags=["Helpdesk — TicketPriority"]
)


@ticket_priorities_router.get("", response_model=APIResponse[list[TicketPriorityResponse]])
def list_ticket_priorities(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.priority:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TicketPriorityService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@ticket_priorities_router.get("/{row_id}", response_model=APIResponse[TicketPriorityResponse])
def get_ticket_priorities(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.priority:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TicketPriorityService(db).get(ctx, row_id))


@ticket_priorities_router.post("", response_model=APIResponse[TicketPriorityResponse])
def create_ticket_priorities(
    body: TicketPriorityCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.priority:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=TicketPriorityService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )


@ticket_priorities_router.patch("/{row_id}", response_model=APIResponse[TicketPriorityResponse])
def update_ticket_priorities(
    row_id: UUID,
    body: TicketPriorityUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.priority:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=TicketPriorityService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


tickets_router = APIRouter(prefix="/tickets", tags=["Helpdesk — Ticket"])


@tickets_router.get("", response_model=APIResponse[list[TicketResponse]])
def list_tickets(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.ticket:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TicketService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@tickets_router.get("/{row_id}", response_model=APIResponse[TicketResponse])
def get_tickets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.ticket:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TicketService(db).get(ctx, row_id))


@tickets_router.post("", response_model=APIResponse[TicketResponse])
def create_tickets(
    body: TicketCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.ticket:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=TicketService(db).create(
            ctx,
            branch_id=body.branch_id,
            **body.model_dump(exclude={"branch_id"}, exclude_none=True),
        ),
    )


@tickets_router.patch("/{row_id}", response_model=APIResponse[TicketResponse])
def update_tickets(
    row_id: UUID,
    body: TicketUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.ticket:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated", data=TicketService(db).update(ctx, row_id, **extract_update_fields(body))
    )


@tickets_router.post("/{row_id}/submit", response_model=APIResponse[TicketResponse])
def submit_tickets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.ticket:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=TicketService(db).submit(ctx, row_id))


@tickets_router.post("/{row_id}/approve", response_model=APIResponse[TicketResponse])
def approve_tickets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.ticket:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=TicketService(db).approve(ctx, row_id))


ticket_assignments_router = APIRouter(
    prefix="/ticket-assignments", tags=["Helpdesk — TicketAssignment"]
)


@ticket_assignments_router.get("", response_model=APIResponse[list[TicketAssignmentResponse]])
def list_ticket_assignments(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.assignment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TicketAssignmentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@ticket_assignments_router.get("/{row_id}", response_model=APIResponse[TicketAssignmentResponse])
def get_ticket_assignments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.assignment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TicketAssignmentService(db).get(ctx, row_id))


@ticket_assignments_router.post("", response_model=APIResponse[TicketAssignmentResponse])
def create_ticket_assignments(
    body: TicketAssignmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.assignment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=TicketAssignmentService(db).create(
            ctx,
            branch_id=body.branch_id,
            **body.model_dump(exclude={"branch_id"}, exclude_none=True),
        ),
    )


@ticket_assignments_router.patch("/{row_id}", response_model=APIResponse[TicketAssignmentResponse])
def update_ticket_assignments(
    row_id: UUID,
    body: TicketAssignmentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.assignment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=TicketAssignmentService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


@ticket_assignments_router.post(
    "/{row_id}/submit", response_model=APIResponse[TicketAssignmentResponse]
)
def submit_ticket_assignments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.assignment:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=TicketAssignmentService(db).submit(ctx, row_id))


@ticket_assignments_router.post(
    "/{row_id}/approve", response_model=APIResponse[TicketAssignmentResponse]
)
def approve_ticket_assignments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.assignment:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=TicketAssignmentService(db).approve(ctx, row_id))


@ticket_assignments_router.post(
    "/{row_id}/complete", response_model=APIResponse[TicketAssignmentResponse]
)
def complete_ticket_assignments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.assignment:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="complete", data=TicketAssignmentService(db).complete(ctx, row_id))


ticket_status_history_router = APIRouter(
    prefix="/ticket-status-history", tags=["Helpdesk — TicketStatusHistory"]
)


@ticket_status_history_router.get("", response_model=APIResponse[list[TicketStatusHistoryResponse]])
def list_ticket_status_history(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.activity:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TicketStatusHistoryService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@ticket_status_history_router.get(
    "/{row_id}", response_model=APIResponse[TicketStatusHistoryResponse]
)
def get_ticket_status_history(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.activity:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TicketStatusHistoryService(db).get(ctx, row_id))


@ticket_status_history_router.post("", response_model=APIResponse[TicketStatusHistoryResponse])
def create_ticket_status_history(
    body: TicketStatusHistoryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.activity:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=TicketStatusHistoryService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )


@ticket_status_history_router.patch(
    "/{row_id}", response_model=APIResponse[TicketStatusHistoryResponse]
)
def update_ticket_status_history(
    row_id: UUID,
    body: TicketStatusHistoryUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.activity:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=TicketStatusHistoryService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


ticket_comments_router = APIRouter(prefix="/ticket-comments", tags=["Helpdesk — TicketComment"])


@ticket_comments_router.get("", response_model=APIResponse[list[TicketCommentResponse]])
def list_ticket_comments(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.comment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TicketCommentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@ticket_comments_router.get("/{row_id}", response_model=APIResponse[TicketCommentResponse])
def get_ticket_comments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.comment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TicketCommentService(db).get(ctx, row_id))


@ticket_comments_router.post("", response_model=APIResponse[TicketCommentResponse])
def create_ticket_comments(
    body: TicketCommentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.comment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=TicketCommentService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )


@ticket_comments_router.patch("/{row_id}", response_model=APIResponse[TicketCommentResponse])
def update_ticket_comments(
    row_id: UUID,
    body: TicketCommentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.comment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=TicketCommentService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


ticket_attachments_router = APIRouter(
    prefix="/ticket-attachments", tags=["Helpdesk — TicketAttachment"]
)


@ticket_attachments_router.get("", response_model=APIResponse[list[TicketAttachmentResponse]])
def list_ticket_attachments(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.attachment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TicketAttachmentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@ticket_attachments_router.get("/{row_id}", response_model=APIResponse[TicketAttachmentResponse])
def get_ticket_attachments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.attachment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TicketAttachmentService(db).get(ctx, row_id))


@ticket_attachments_router.post("", response_model=APIResponse[TicketAttachmentResponse])
def create_ticket_attachments(
    body: TicketAttachmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.attachment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=TicketAttachmentService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )


@ticket_attachments_router.patch("/{row_id}", response_model=APIResponse[TicketAttachmentResponse])
def update_ticket_attachments(
    row_id: UUID,
    body: TicketAttachmentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.attachment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=TicketAttachmentService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


ticket_activities_router = APIRouter(
    prefix="/ticket-activities", tags=["Helpdesk — TicketActivity"]
)


@ticket_activities_router.get("", response_model=APIResponse[list[TicketActivityResponse]])
def list_ticket_activities(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.activity:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TicketActivityService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@ticket_activities_router.get("/{row_id}", response_model=APIResponse[TicketActivityResponse])
def get_ticket_activities(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.activity:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TicketActivityService(db).get(ctx, row_id))


@ticket_activities_router.post("", response_model=APIResponse[TicketActivityResponse])
def create_ticket_activities(
    body: TicketActivityCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.activity:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=TicketActivityService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )


@ticket_activities_router.patch("/{row_id}", response_model=APIResponse[TicketActivityResponse])
def update_ticket_activities(
    row_id: UUID,
    body: TicketActivityUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.activity:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=TicketActivityService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


ticket_slas_router = APIRouter(prefix="/ticket-slas", tags=["Helpdesk — TicketSla"])


@ticket_slas_router.get("", response_model=APIResponse[list[TicketSlaResponse]])
def list_ticket_slas(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.sla:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TicketSlaService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@ticket_slas_router.get("/{row_id}", response_model=APIResponse[TicketSlaResponse])
def get_ticket_slas(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.sla:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TicketSlaService(db).get(ctx, row_id))


@ticket_slas_router.post("", response_model=APIResponse[TicketSlaResponse])
def create_ticket_slas(
    body: TicketSlaCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.sla:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=TicketSlaService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )


@ticket_slas_router.patch("/{row_id}", response_model=APIResponse[TicketSlaResponse])
def update_ticket_slas(
    row_id: UUID,
    body: TicketSlaUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.sla:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=TicketSlaService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


ticket_escalations_router = APIRouter(
    prefix="/ticket-escalations", tags=["Helpdesk — TicketEscalation"]
)


@ticket_escalations_router.get("", response_model=APIResponse[list[TicketEscalationResponse]])
def list_ticket_escalations(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.escalation:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TicketEscalationService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@ticket_escalations_router.get("/{row_id}", response_model=APIResponse[TicketEscalationResponse])
def get_ticket_escalations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.escalation:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TicketEscalationService(db).get(ctx, row_id))


@ticket_escalations_router.post("", response_model=APIResponse[TicketEscalationResponse])
def create_ticket_escalations(
    body: TicketEscalationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.escalation:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=TicketEscalationService(db).create(
            ctx,
            branch_id=body.branch_id,
            **body.model_dump(exclude={"branch_id"}, exclude_none=True),
        ),
    )


@ticket_escalations_router.patch("/{row_id}", response_model=APIResponse[TicketEscalationResponse])
def update_ticket_escalations(
    row_id: UUID,
    body: TicketEscalationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.escalation:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=TicketEscalationService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


@ticket_escalations_router.post(
    "/{row_id}/escalate", response_model=APIResponse[TicketEscalationResponse]
)
def escalate_ticket_escalations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.escalation:escalate"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="escalate", data=TicketEscalationService(db).escalate(ctx, row_id))


knowledge_bases_router = APIRouter(prefix="/knowledge-bases", tags=["Helpdesk — KnowledgeBase"])


@knowledge_bases_router.get("", response_model=APIResponse[list[KnowledgeBaseResponse]])
def list_knowledge_bases(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.knowledge:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = KnowledgeBaseService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@knowledge_bases_router.get("/{row_id}", response_model=APIResponse[KnowledgeBaseResponse])
def get_knowledge_bases(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.knowledge:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=KnowledgeBaseService(db).get(ctx, row_id))


@knowledge_bases_router.post("", response_model=APIResponse[KnowledgeBaseResponse])
def create_knowledge_bases(
    body: KnowledgeBaseCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.knowledge:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=KnowledgeBaseService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )


@knowledge_bases_router.patch("/{row_id}", response_model=APIResponse[KnowledgeBaseResponse])
def update_knowledge_bases(
    row_id: UUID,
    body: KnowledgeBaseUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.knowledge:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=KnowledgeBaseService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


knowledge_articles_router = APIRouter(
    prefix="/knowledge-articles", tags=["Helpdesk — KnowledgeArticle"]
)


@knowledge_articles_router.get("", response_model=APIResponse[list[KnowledgeArticleResponse]])
def list_knowledge_articles(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.knowledge:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = KnowledgeArticleService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@knowledge_articles_router.get("/{row_id}", response_model=APIResponse[KnowledgeArticleResponse])
def get_knowledge_articles(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.knowledge:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=KnowledgeArticleService(db).get(ctx, row_id))


@knowledge_articles_router.post("", response_model=APIResponse[KnowledgeArticleResponse])
def create_knowledge_articles(
    body: KnowledgeArticleCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.knowledge:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=KnowledgeArticleService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )


@knowledge_articles_router.patch("/{row_id}", response_model=APIResponse[KnowledgeArticleResponse])
def update_knowledge_articles(
    row_id: UUID,
    body: KnowledgeArticleUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.knowledge:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=KnowledgeArticleService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


@knowledge_articles_router.post(
    "/{row_id}/submit", response_model=APIResponse[KnowledgeArticleResponse]
)
def submit_knowledge_articles(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.knowledge:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=KnowledgeArticleService(db).submit(ctx, row_id))


@knowledge_articles_router.post(
    "/{row_id}/approve", response_model=APIResponse[KnowledgeArticleResponse]
)
def approve_knowledge_articles(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.knowledge:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=KnowledgeArticleService(db).approve(ctx, row_id))


@knowledge_articles_router.post(
    "/{row_id}/publish", response_model=APIResponse[KnowledgeArticleResponse]
)
def publish_knowledge_articles(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.knowledge:publish"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="publish", data=KnowledgeArticleService(db).publish(ctx, row_id))


resolutions_router = APIRouter(prefix="/resolutions", tags=["Helpdesk — Resolution"])


@resolutions_router.get("", response_model=APIResponse[list[ResolutionResponse]])
def list_resolutions(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.resolution:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ResolutionService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@resolutions_router.get("/{row_id}", response_model=APIResponse[ResolutionResponse])
def get_resolutions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.resolution:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ResolutionService(db).get(ctx, row_id))


@resolutions_router.post("", response_model=APIResponse[ResolutionResponse])
def create_resolutions(
    body: ResolutionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.resolution:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=ResolutionService(db).create(
            ctx,
            branch_id=body.branch_id,
            **body.model_dump(exclude={"branch_id"}, exclude_none=True),
        ),
    )


@resolutions_router.patch("/{row_id}", response_model=APIResponse[ResolutionResponse])
def update_resolutions(
    row_id: UUID,
    body: ResolutionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.resolution:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=ResolutionService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


@resolutions_router.post("/{row_id}/submit", response_model=APIResponse[ResolutionResponse])
def submit_resolutions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.resolution:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=ResolutionService(db).submit(ctx, row_id))


@resolutions_router.post("/{row_id}/complete", response_model=APIResponse[ResolutionResponse])
def complete_resolutions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.resolution:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="complete", data=ResolutionService(db).complete(ctx, row_id))


customer_feedback_router = APIRouter(
    prefix="/customer-feedback", tags=["Helpdesk — CustomerFeedback"]
)


@customer_feedback_router.get("", response_model=APIResponse[list[CustomerFeedbackResponse]])
def list_customer_feedback(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.feedback:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = CustomerFeedbackService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@customer_feedback_router.get("/{row_id}", response_model=APIResponse[CustomerFeedbackResponse])
def get_customer_feedback(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.feedback:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CustomerFeedbackService(db).get(ctx, row_id))


@customer_feedback_router.post("", response_model=APIResponse[CustomerFeedbackResponse])
def create_customer_feedback(
    body: CustomerFeedbackCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.feedback:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=CustomerFeedbackService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )


@customer_feedback_router.patch("/{row_id}", response_model=APIResponse[CustomerFeedbackResponse])
def update_customer_feedback(
    row_id: UUID,
    body: CustomerFeedbackUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.feedback:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=CustomerFeedbackService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


support_teams_router = APIRouter(prefix="/support-teams", tags=["Helpdesk — SupportTeam"])


@support_teams_router.get("", response_model=APIResponse[list[SupportTeamResponse]])
def list_support_teams(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.team:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = SupportTeamService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@support_teams_router.get("/{row_id}", response_model=APIResponse[SupportTeamResponse])
def get_support_teams(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.team:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SupportTeamService(db).get(ctx, row_id))


@support_teams_router.post("", response_model=APIResponse[SupportTeamResponse])
def create_support_teams(
    body: SupportTeamCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.team:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=SupportTeamService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )


@support_teams_router.patch("/{row_id}", response_model=APIResponse[SupportTeamResponse])
def update_support_teams(
    row_id: UUID,
    body: SupportTeamUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.team:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=SupportTeamService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


support_shifts_router = APIRouter(prefix="/support-shifts", tags=["Helpdesk — SupportShift"])


@support_shifts_router.get("", response_model=APIResponse[list[SupportShiftResponse]])
def list_support_shifts(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.shift:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = SupportShiftService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@support_shifts_router.get("/{row_id}", response_model=APIResponse[SupportShiftResponse])
def get_support_shifts(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.shift:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SupportShiftService(db).get(ctx, row_id))


@support_shifts_router.post("", response_model=APIResponse[SupportShiftResponse])
def create_support_shifts(
    body: SupportShiftCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.shift:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=SupportShiftService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )


@support_shifts_router.patch("/{row_id}", response_model=APIResponse[SupportShiftResponse])
def update_support_shifts(
    row_id: UUID,
    body: SupportShiftUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.shift:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=SupportShiftService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


support_schedules_router = APIRouter(
    prefix="/support-schedules", tags=["Helpdesk — SupportSchedule"]
)


@support_schedules_router.get("", response_model=APIResponse[list[SupportScheduleResponse]])
def list_support_schedules(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.schedule:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = SupportScheduleService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@support_schedules_router.get("/{row_id}", response_model=APIResponse[SupportScheduleResponse])
def get_support_schedules(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.schedule:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SupportScheduleService(db).get(ctx, row_id))


@support_schedules_router.post("", response_model=APIResponse[SupportScheduleResponse])
def create_support_schedules(
    body: SupportScheduleCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.schedule:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=SupportScheduleService(db).create(
            ctx,
            branch_id=body.branch_id,
            **body.model_dump(exclude={"branch_id"}, exclude_none=True),
        ),
    )


@support_schedules_router.patch("/{row_id}", response_model=APIResponse[SupportScheduleResponse])
def update_support_schedules(
    row_id: UUID,
    body: SupportScheduleUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.schedule:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=SupportScheduleService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


ticket_notifications_router = APIRouter(
    prefix="/ticket-notifications", tags=["Helpdesk — TicketNotification"]
)


@ticket_notifications_router.get("", response_model=APIResponse[list[TicketNotificationResponse]])
def list_ticket_notifications(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = TicketNotificationService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@ticket_notifications_router.get(
    "/{row_id}", response_model=APIResponse[TicketNotificationResponse]
)
def get_ticket_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TicketNotificationService(db).get(ctx, row_id))


@ticket_notifications_router.post("", response_model=APIResponse[TicketNotificationResponse])
def create_ticket_notifications(
    body: TicketNotificationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.notification:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=TicketNotificationService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )


@ticket_notifications_router.patch(
    "/{row_id}", response_model=APIResponse[TicketNotificationResponse]
)
def update_ticket_notifications(
    row_id: UUID,
    body: TicketNotificationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.notification:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=TicketNotificationService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


ticket_reports_router = APIRouter(prefix="/ticket-reports", tags=["Helpdesk — TicketReport"])


@ticket_reports_router.get("", response_model=APIResponse[list[TicketReportResponse]])
def list_ticket_reports(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = HelpdeskReportService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@ticket_reports_router.get("/{row_id}", response_model=APIResponse[TicketReportResponse])
def get_ticket_reports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=HelpdeskReportService(db).get(ctx, row_id))


@ticket_reports_router.post("", response_model=APIResponse[TicketReportResponse])
def create_ticket_reports(
    body: TicketReportCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=HelpdeskReportService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )


@ticket_reports_router.patch("/{row_id}", response_model=APIResponse[TicketReportResponse])
def update_ticket_reports(
    row_id: UUID,
    body: TicketReportUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=HelpdeskReportService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


ticket_dashboards_router = APIRouter(
    prefix="/ticket-dashboards", tags=["Helpdesk — TicketDashboard"]
)


@ticket_dashboards_router.get("", response_model=APIResponse[list[TicketDashboardResponse]])
def list_ticket_dashboards(
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.dashboard:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = HelpdeskDashboardService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


@ticket_dashboards_router.get("/{row_id}", response_model=APIResponse[TicketDashboardResponse])
def get_ticket_dashboards(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.dashboard:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=HelpdeskDashboardService(db).get(ctx, row_id))


@ticket_dashboards_router.post("", response_model=APIResponse[TicketDashboardResponse])
def create_ticket_dashboards(
    body: TicketDashboardCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.dashboard:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Created",
        data=HelpdeskDashboardService(db).create(ctx, **body.model_dump(exclude_none=True)),
    )


@ticket_dashboards_router.patch("/{row_id}", response_model=APIResponse[TicketDashboardResponse])
def update_ticket_dashboards(
    row_id: UUID,
    body: TicketDashboardUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("helpdesk.dashboard:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=HelpdeskDashboardService(db).update(ctx, row_id, **extract_update_fields(body)),
    )
