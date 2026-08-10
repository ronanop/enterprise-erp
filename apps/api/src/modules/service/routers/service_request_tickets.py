"""Dedicated router for Service Request Ticket Management (SOP)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
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
):
    items = ServiceRequestTicketService(db).list_sla_tracker(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))


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
):
    items = ServiceRequestTicketService(db).list_resolved_tickets(ctx, company_id=company_id, q=q)
    return APIResponse(message="OK", data=paginate(items, pagination))


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


@service_request_tickets_router.post("/{row_id}/close", response_model=APIResponse[ServiceRequestTicketDetail])
def close_ticket(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
    body: ServiceRequestReopenPayload | None = None,
):
    reason = body.reason if body else None
    data = ServiceRequestTicketService(db).close_ticket(ctx, row_id, reason=reason)
    db.commit()
    return APIResponse(message="Ticket closed", data=data)


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
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    att = ServiceRequestTicketService(db).upload_attachment(
        ctx, row_id, file_name=body.file_name, content_base64=body.content_base64, content_type=body.content_type
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
    path, file_name, content_type = ServiceRequestTicketService(db).resolve_attachment_path(ctx, row_id, attachment_id)
    return FileResponse(path, filename=file_name, media_type=content_type or "application/octet-stream")


@service_request_tickets_router.get("/{row_id}/timeline", response_model=APIResponse[list[ServiceRequestTimelineItem]])
def get_ticket_timeline(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    items = ServiceRequestTicketService(db).get_timeline(ctx, row_id)
    return APIResponse(message="OK", data=items)
