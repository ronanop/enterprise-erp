"""Dedicated router for Service Request Ticket Management (SOP)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from modules.service.dependencies import PaginationParams, TenantContext, get_db, get_pagination, get_tenant_context, paginate, require_permission
from modules.service.service.service_request_ticket_service import ServiceRequestTicketService
from modules.service.service_request_ticket_schemas import (
    ServiceRequestAssignOwner,
    ServiceRequestAttachmentCreate,
    ServiceRequestAttachmentResponse,
    ServiceAssignableEmployee,
    ServiceRequestCoOwnerCreate,
    ServiceRequestCoOwnerResponse,
    ServiceRequestCommentCreate,
    ServiceRequestCommentResponse,
    ServiceRequestFollowUpPayload,
    ServiceRequestReopenPayload,
    ServiceRequestResolvePayload,
    ServiceRequestStakeholderCreate,
    ServiceRequestStakeholderResponse,
    ServiceRequestStakeholderView,
    ServiceRequestStatusChange,
    ServiceRequestTicketCreate,
    ServiceRequestTicketDetail,
    ServiceRequestTicketListItem,
    ServiceRequestTicketUpdate,
    ServiceRequestTimelineItem,
    ServiceRequestSlaTrackerItem,
    ServiceRequestResolvedTicketItem,
    ServiceSlaComplianceSummary,
    TicketFieldEngineerCreate,
    TicketFieldEngineerResponse,
    TicketFieldEngineerSolve,
    TicketFieldEngineerUpdate,
    FieldEngineerTicketItem,
)
from shared.schemas import APIResponse

service_request_tickets_router = APIRouter(
    prefix="/service-request-tickets",
    tags=["Service — Request Tickets (SOP)"],
)


@service_request_tickets_router.get("", response_model=APIResponse[list[ServiceRequestTicketListItem]])
def list_service_request_tickets(
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    q: str | None = None,
    priority: str | None = None,
    status: str | None = None,
    owner_id: UUID | None = None,
    mode: str | None = None,
    category: str | None = None,
    customer_id: UUID | None = None,
    mine: bool = False,
):
    items = ServiceRequestTicketService(db).list_tickets(
        ctx,
        company_id=company_id,
        q=q,
        priority=priority,
        status=status,
        owner_id=owner_id,
        mode=mode,
        category=category,
        customer_id=customer_id,
        mine=mine,
    )
    return APIResponse(message="OK", data=paginate(items, pagination))


@service_request_tickets_router.get(
    "/assignable-employees",
    response_model=APIResponse[list[ServiceAssignableEmployee]],
)
def list_assignable_employees(
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    items = ServiceRequestTicketService(db).list_assignable_employees(ctx)
    return APIResponse(message="OK", data=items)


@service_request_tickets_router.get(
    "/sla-tracker",
    response_model=APIResponse[list[ServiceRequestSlaTrackerItem]],
)
def list_ticket_sla_tracker(
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    mine: bool = False,
):
    items = ServiceRequestTicketService(db).list_sla_tracker(ctx, company_id=company_id, mine=mine)
    return APIResponse(message="OK", data=paginate(items, pagination))


@service_request_tickets_router.get(
    "/sla-compliance-summary",
    response_model=APIResponse[ServiceSlaComplianceSummary],
)
def sla_compliance_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    mine: bool = False,
):
    summary = ServiceRequestTicketService(db).sla_compliance_summary(ctx, company_id=company_id, mine=mine)
    return APIResponse(message="OK", data=summary)


@service_request_tickets_router.get(
    "/resolved-tickets",
    response_model=APIResponse[list[ServiceRequestResolvedTicketItem]],
)
def list_resolved_tickets(
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    q: str | None = None,
    sla_outcome: str | None = Query(default=None, pattern="^(within|breach)$"),
    mine: bool = False,
):
    items = ServiceRequestTicketService(db).list_resolved_tickets(
        ctx, company_id=company_id, q=q, sla_outcome=sla_outcome, mine=mine
    )
    return APIResponse(message="OK", data=paginate(items, pagination))


@service_request_tickets_router.get("/export.xlsx")
def export_tickets_xlsx(
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    content = ServiceRequestTicketService(db).export_tickets_xlsx(ctx, company_id=company_id)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=service-request-tickets.xlsx"},
    )


@service_request_tickets_router.get(
    "/field-engineer/my-tickets",
    response_model=APIResponse[list[FieldEngineerTicketItem]],
)
def list_my_field_engineer_tickets(
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    items = ServiceRequestTicketService(db).list_my_field_engineer_tickets(ctx)
    return APIResponse(message="OK", data=items)


@service_request_tickets_router.get("/{row_id}", response_model=APIResponse[ServiceRequestTicketDetail])
def get_service_request_ticket(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceRequestTicketService(db).get_ticket(ctx, row_id))


@service_request_tickets_router.post("", response_model=APIResponse[ServiceRequestTicketDetail])
def create_service_request_ticket(
    body: ServiceRequestTicketCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump(exclude_none=True)
    branch_id = payload.pop("branch_id")
    company_id = payload.pop("company_id", None)
    fe = payload.pop("field_engineer", None)
    oem = payload.pop("oem_support", None)
    if fe:
        payload["field_engineer"] = fe
    if oem:
        payload["oem_support"] = oem
    data = ServiceRequestTicketService(db).create_ticket(
        ctx, branch_id=branch_id, company_id=company_id, **payload
    )
    db.commit()
    return APIResponse(message="Service request ticket created", data=data)


@service_request_tickets_router.patch("/{row_id}", response_model=APIResponse[ServiceRequestTicketDetail])
def update_service_request_ticket(
    row_id: UUID,
    body: ServiceRequestTicketUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump(exclude_none=True)
    fe = payload.pop("field_engineer", None)
    oem = payload.pop("oem_support", None)
    if fe is not None:
        payload["field_engineer"] = fe
    if oem is not None:
        payload["oem_support"] = oem
    data = ServiceRequestTicketService(db).update_ticket(ctx, row_id, **payload)
    db.commit()
    return APIResponse(message="Service request ticket updated", data=data)


@service_request_tickets_router.delete("/{row_id}", response_model=APIResponse[dict])
def delete_service_request_ticket(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    ServiceRequestTicketService(db).delete_ticket(ctx, row_id)
    db.commit()
    return APIResponse(message="Service request ticket deleted", data={"id": str(row_id)})


@service_request_tickets_router.post("/{row_id}/status", response_model=APIResponse[ServiceRequestTicketDetail])
def change_ticket_status(
    row_id: UUID,
    body: ServiceRequestStatusChange,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ServiceRequestTicketService(db).change_status(ctx, row_id, status=body.status, reason=body.reason)
    db.commit()
    return APIResponse(message="Status updated", data=data)


@service_request_tickets_router.get("/{row_id}/stakeholder-view", response_model=APIResponse[ServiceRequestStakeholderView])
def get_ticket_stakeholder_view(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=ServiceRequestTicketService(db).get_stakeholder_view(ctx, row_id),
    )


@service_request_tickets_router.post("/{row_id}/assign", response_model=APIResponse[ServiceRequestTicketDetail])
def assign_ticket_owner(
    row_id: UUID,
    body: ServiceRequestAssignOwner,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ServiceRequestTicketService(db).assign_owner(ctx, row_id, owner_employee_id=body.owner_employee_id)
    db.commit()
    return APIResponse(message="Owner assigned", data=data)


@service_request_tickets_router.post("/{row_id}/open", response_model=APIResponse[ServiceRequestTicketDetail])
def open_ticket(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ServiceRequestTicketService(db).open_ticket(ctx, row_id)
    db.commit()
    return APIResponse(message="Ticket opened — SLA started", data=data)


@service_request_tickets_router.post("/{row_id}/resolve", response_model=APIResponse[ServiceRequestTicketDetail])
def resolve_ticket(
    row_id: UUID,
    body: ServiceRequestResolvePayload,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ServiceRequestTicketService(db).resolve_ticket(
        ctx,
        row_id,
        solution_type=body.solution_type,
        solution_summary=body.solution_summary,
        reason=body.reason,
    )
    db.commit()
    return APIResponse(message="Ticket resolved", data=data)


@service_request_tickets_router.post("/{row_id}/resume", response_model=APIResponse[ServiceRequestTicketDetail])
def resume_ticket(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
    body: ServiceRequestReopenPayload | None = None,
):
    reason = body.reason if body else None
    data = ServiceRequestTicketService(db).resume_ticket(ctx, row_id, reason=reason)
    db.commit()
    return APIResponse(message="Ticket resumed", data=data)


@service_request_tickets_router.post("/{row_id}/awaiting-assignment", response_model=APIResponse[ServiceRequestTicketDetail])
def pause_awaiting_assignment(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
    body: ServiceRequestReopenPayload | None = None,
):
    reason = body.reason if body else None
    data = ServiceRequestTicketService(db).pause_awaiting_assignment(ctx, row_id, reason=reason)
    db.commit()
    return APIResponse(message="Moved to awaiting assignment", data=data)


@service_request_tickets_router.post("/{row_id}/follow-up", response_model=APIResponse[ServiceRequestTicketDetail])
def schedule_follow_up(
    row_id: UUID,
    body: ServiceRequestFollowUpPayload,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ServiceRequestTicketService(db).schedule_follow_up(
        ctx, row_id, follow_up_at=body.follow_up_at, follow_up_note=body.follow_up_note
    )
    db.commit()
    return APIResponse(message="Follow-up scheduled", data=data)


@service_request_tickets_router.post("/{row_id}/reopen", response_model=APIResponse[ServiceRequestTicketDetail])
def reopen_ticket(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
    body: ServiceRequestReopenPayload | None = None,
):
    reason = body.reason if body else None
    data = ServiceRequestTicketService(db).reopen_ticket(ctx, row_id, reason=reason)
    db.commit()
    return APIResponse(message="Ticket reopened", data=data)


@service_request_tickets_router.get("/{row_id}/co-owners", response_model=APIResponse[list[ServiceRequestCoOwnerResponse]])
def list_co_owners(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    ticket = ServiceRequestTicketService(db).get_ticket(ctx, row_id)
    return APIResponse(message="OK", data=ticket.co_owners)


@service_request_tickets_router.post("/{row_id}/co-owners", response_model=APIResponse[ServiceRequestCoOwnerResponse])
def add_co_owner(
    row_id: UUID,
    body: ServiceRequestCoOwnerCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    co = ServiceRequestTicketService(db).add_co_owner(ctx, row_id, employee_id=body.employee_id)
    db.commit()
    return APIResponse(message="Co-owner added", data=co)


@service_request_tickets_router.delete("/{row_id}/co-owners/{employee_id}", response_model=APIResponse[dict])
def remove_co_owner(
    row_id: UUID,
    employee_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    ServiceRequestTicketService(db).remove_co_owner(ctx, row_id, employee_id=employee_id)
    db.commit()
    return APIResponse(message="Co-owner removed", data={"employee_id": str(employee_id)})


@service_request_tickets_router.get("/{row_id}/stakeholders", response_model=APIResponse[list[ServiceRequestStakeholderResponse]])
def list_stakeholders(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    ticket = ServiceRequestTicketService(db).get_ticket(ctx, row_id)
    return APIResponse(message="OK", data=ticket.stakeholders)


@service_request_tickets_router.post("/{row_id}/stakeholders", response_model=APIResponse[ServiceRequestStakeholderResponse])
def add_stakeholder(
    row_id: UUID,
    body: ServiceRequestStakeholderCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    sh = ServiceRequestTicketService(db).add_stakeholder(ctx, row_id, name=body.name, email=body.email)
    db.commit()
    return APIResponse(message="Stakeholder added", data=sh)


@service_request_tickets_router.delete("/{row_id}/stakeholders/{stakeholder_id}", response_model=APIResponse[dict])
def remove_stakeholder(
    row_id: UUID,
    stakeholder_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    ServiceRequestTicketService(db).remove_stakeholder(ctx, row_id, stakeholder_id=stakeholder_id)
    db.commit()
    return APIResponse(message="Stakeholder removed", data={"id": str(stakeholder_id)})


@service_request_tickets_router.get("/{row_id}/comments", response_model=APIResponse[list[ServiceRequestCommentResponse]])
def list_ticket_comments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    items = ServiceRequestTicketService(db).list_comments(ctx, row_id)
    return APIResponse(message="OK", data=items)


@service_request_tickets_router.post("/{row_id}/comments", response_model=APIResponse[ServiceRequestCommentResponse])
def add_ticket_comment(
    row_id: UUID,
    body: ServiceRequestCommentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    comment = ServiceRequestTicketService(db).add_comment(ctx, row_id, body=body.body, is_internal=body.is_internal)
    db.commit()
    return APIResponse(message="Comment added", data=comment)


@service_request_tickets_router.get("/{row_id}/attachments", response_model=APIResponse[list[ServiceRequestAttachmentResponse]])
def list_ticket_attachments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    items = ServiceRequestTicketService(db).list_attachments(ctx, row_id)
    return APIResponse(message="OK", data=items)


@service_request_tickets_router.post("/{row_id}/attachments", response_model=APIResponse[ServiceRequestAttachmentResponse])
def upload_ticket_attachment(
    row_id: UUID,
    body: ServiceRequestAttachmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    # FE uploads use service.request:read; owner uploads still gated inside service by can_work / FE email.
    att = ServiceRequestTicketService(db).upload_attachment(
        ctx,
        row_id,
        file_name=body.file_name,
        content_base64=body.content_base64,
        content_type=body.content_type,
        field_engineer_id=body.field_engineer_id,
    )
    db.commit()
    return APIResponse(message="Attachment uploaded", data=att)


@service_request_tickets_router.delete("/{row_id}/attachments/{attachment_id}", response_model=APIResponse[dict])
def delete_ticket_attachment(
    row_id: UUID,
    attachment_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    ServiceRequestTicketService(db).delete_attachment(ctx, row_id, attachment_id)
    db.commit()
    return APIResponse(message="Attachment deleted", data={"id": str(attachment_id)})


@service_request_tickets_router.get("/{row_id}/attachments/{attachment_id}/content")
def download_ticket_attachment(
    row_id: UUID,
    attachment_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    data, file_name, content_type = ServiceRequestTicketService(db).resolve_attachment_content(
        ctx, row_id, attachment_id
    )
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=data, media_type=content_type or "application/octet-stream", headers=headers)


@service_request_tickets_router.get("/{row_id}/timeline", response_model=APIResponse[list[ServiceRequestTimelineItem]])
def get_ticket_timeline(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    items = ServiceRequestTicketService(db).get_timeline(ctx, row_id)
    return APIResponse(message="OK", data=items)


@service_request_tickets_router.get("/{row_id}/timeline.xlsx")
def export_ticket_timeline_xlsx(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    content = ServiceRequestTicketService(db).export_timeline_xlsx(ctx, row_id)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=ticket-{row_id}-timeline.xlsx"},
    )


@service_request_tickets_router.post(
    "/{row_id}/field-engineers",
    response_model=APIResponse[TicketFieldEngineerResponse],
)
def add_field_engineer(
    row_id: UUID,
    body: TicketFieldEngineerCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ServiceRequestTicketService(db).add_field_engineer(
        ctx,
        row_id,
        engineer_name=body.engineer_name,
        engineer_email=body.engineer_email,
        engineer_contact=body.engineer_contact,
        assigned_date=body.assigned_date,
        work_brief=body.work_brief,
        show_issue=body.show_issue,
        show_customer=body.show_customer,
        show_site=body.show_site,
        show_asset=body.show_asset,
        show_circuit=body.show_circuit,
    )
    db.commit()
    return APIResponse(message="Field engineer added", data=data)


@service_request_tickets_router.patch(
    "/{row_id}/field-engineers/{field_engineer_id}",
    response_model=APIResponse[TicketFieldEngineerResponse],
)
def update_field_engineer(
    row_id: UUID,
    field_engineer_id: UUID,
    body: TicketFieldEngineerUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump(exclude_unset=True)
    clear_assigned_date = "assigned_date" in payload and payload.get("assigned_date") is None
    data = ServiceRequestTicketService(db).update_field_engineer(
        ctx,
        row_id,
        field_engineer_id=field_engineer_id,
        clear_assigned_date=clear_assigned_date,
        engineer_name=payload.get("engineer_name"),
        engineer_contact=payload.get("engineer_contact"),
        engineer_email=payload.get("engineer_email"),
        assigned_date=payload.get("assigned_date"),
        work_brief=payload.get("work_brief"),
        show_issue=payload.get("show_issue"),
        show_customer=payload.get("show_customer"),
        show_site=payload.get("show_site"),
        show_asset=payload.get("show_asset"),
        show_circuit=payload.get("show_circuit"),
    )
    db.commit()
    return APIResponse(message="Field engineer updated", data=data)


@service_request_tickets_router.post(
    "/{row_id}/field-engineers/{field_engineer_id}/credentials",
    response_model=APIResponse[TicketFieldEngineerResponse],
)
def issue_field_engineer_credentials(
    row_id: UUID,
    field_engineer_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    """Create or reset FE login password and return credentials for on-screen share."""
    data = ServiceRequestTicketService(db).issue_field_engineer_credentials(
        ctx, row_id, field_engineer_id=field_engineer_id
    )
    db.commit()
    return APIResponse(message="Field engineer credentials ready", data=data)


@service_request_tickets_router.delete(
    "/{row_id}/field-engineers/{field_engineer_id}",
    response_model=APIResponse[dict],
)
def remove_field_engineer(
    row_id: UUID,
    field_engineer_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    ServiceRequestTicketService(db).remove_field_engineer(ctx, row_id, field_engineer_id=field_engineer_id)
    db.commit()
    return APIResponse(message="Field engineer removed", data={"id": str(field_engineer_id)})


@service_request_tickets_router.post(
    "/{row_id}/field-engineers/{field_engineer_id}/solve",
    response_model=APIResponse[TicketFieldEngineerResponse],
)
def field_engineer_mark_solved(
    row_id: UUID,
    field_engineer_id: UUID,
    body: TicketFieldEngineerSolve,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ServiceRequestTicketService(db).field_engineer_mark_solved(
        ctx,
        row_id,
        field_engineer_id=field_engineer_id,
        solution_summary=body.solution_summary,
        attachments=[a.model_dump() for a in body.attachments],
    )
    db.commit()
    return APIResponse(message="Marked solved by field engineer", data=data)
