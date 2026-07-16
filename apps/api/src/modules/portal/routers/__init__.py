"""Customer Portal API route handlers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.portal.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
    require_permission,
)
from modules.portal.schemas import (
    CustomerProfileCreate,
    CustomerProfileResponse,
    CustomerProfileUpdate,
    DashboardCreate,
    DashboardResponse,
    DashboardUpdate,
    DashboardWidgetCreate,
    DashboardWidgetResponse,
    DashboardWidgetUpdate,
    DeviceCreate,
    DeviceResponse,
    DeviceUpdate,
    DocumentAccessCreate,
    DocumentAccessResponse,
    DocumentAccessUpdate,
    DownloadHistoryCreate,
    DownloadHistoryResponse,
    DownloadHistoryUpdate,
    InvoiceViewCreate,
    InvoiceViewResponse,
    InvoiceViewUpdate,
    LoginAuditCreate,
    LoginAuditResponse,
    LoginAuditUpdate,
    MessageCreate,
    MessageResponse,
    MessageThreadCreate,
    MessageThreadResponse,
    MessageThreadUpdate,
    MessageUpdate,
    NotificationCreate,
    NotificationResponse,
    NotificationUpdate,
    OrderViewCreate,
    OrderViewResponse,
    OrderViewUpdate,
    PortalAccountCreate,
    PortalAccountResponse,
    PortalAccountUpdate,
    PortalReportCreate,
    PortalReportResponse,
    PortalReportUpdate,
    PortalSessionCreate,
    PortalSessionResponse,
    PortalSessionUpdate,
    PreferenceCreate,
    PreferenceResponse,
    PreferenceUpdate,
    SavedReportCreate,
    SavedReportResponse,
    SavedReportUpdate,
    SavedSearchCreate,
    SavedSearchResponse,
    SavedSearchUpdate,
    ServiceRequestCreate,
    ServiceRequestResponse,
    ServiceRequestUpdate,
    SupportTicketCreate,
    SupportTicketResponse,
    SupportTicketUpdate,
)
from modules.portal.service import (
    CustomerProfileService,
    DashboardService,
    DashboardWidgetService,
    DeviceService,
    DocumentAccessService,
    DownloadHistoryService,
    InvoiceViewService,
    LoginAuditService,
    MessageService,
    MessageThreadService,
    NotificationService,
    OrderViewService,
    PortalAccountService,
    PortalReportService,
    PortalSessionService,
    PreferenceService,
    SavedReportService,
    SavedSearchService,
    ServiceRequestService,
    SupportTicketService,
)
from shared.schemas import APIResponse

portal_accounts_router = APIRouter(prefix="/portal-accounts", tags=["Portal — PortalAccount"])

@portal_accounts_router.get("", response_model=APIResponse[list[PortalAccountResponse]])
def list_portal_accounts(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.account:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = PortalAccountService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@portal_accounts_router.get("/{row_id}", response_model=APIResponse[PortalAccountResponse])
def get_portal_accounts(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.account:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PortalAccountService(db).get(ctx, row_id))

@portal_accounts_router.post("", response_model=APIResponse[PortalAccountResponse])
def create_portal_accounts(
    body: PortalAccountCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.account:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PortalAccountService(db).create(ctx, **body.model_dump(exclude_none=True)))

@portal_accounts_router.patch("/{row_id}", response_model=APIResponse[PortalAccountResponse])
def update_portal_accounts(
    row_id: UUID,
    body: PortalAccountUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.account:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PortalAccountService(db).update(ctx, row_id, **extract_update_fields(body)))

@portal_accounts_router.post("/{row_id}/submit", response_model=APIResponse[PortalAccountResponse])
def submit_portal_accounts(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.account:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=PortalAccountService(db).submit(ctx, row_id))

@portal_accounts_router.post("/{row_id}/approve", response_model=APIResponse[PortalAccountResponse])
def approve_portal_accounts(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.account:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=PortalAccountService(db).approve(ctx, row_id))

customer_profiles_router = APIRouter(prefix="/customer-profiles", tags=["Portal — CustomerProfile"])

@customer_profiles_router.get("", response_model=APIResponse[list[CustomerProfileResponse]])
def list_customer_profiles(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.profile:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = CustomerProfileService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@customer_profiles_router.get("/{row_id}", response_model=APIResponse[CustomerProfileResponse])
def get_customer_profiles(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.profile:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CustomerProfileService(db).get(ctx, row_id))

@customer_profiles_router.post("", response_model=APIResponse[CustomerProfileResponse])
def create_customer_profiles(
    body: CustomerProfileCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.profile:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=CustomerProfileService(db).create(ctx, **body.model_dump(exclude_none=True)))

@customer_profiles_router.patch("/{row_id}", response_model=APIResponse[CustomerProfileResponse])
def update_customer_profiles(
    row_id: UUID,
    body: CustomerProfileUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.profile:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=CustomerProfileService(db).update(ctx, row_id, **extract_update_fields(body)))

@customer_profiles_router.post("/{row_id}/submit", response_model=APIResponse[CustomerProfileResponse])
def submit_customer_profiles(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.profile:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=CustomerProfileService(db).submit(ctx, row_id))

@customer_profiles_router.post("/{row_id}/approve", response_model=APIResponse[CustomerProfileResponse])
def approve_customer_profiles(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.profile:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=CustomerProfileService(db).approve(ctx, row_id))

portal_sessions_router = APIRouter(prefix="/portal-sessions", tags=["Portal — PortalSession"])

@portal_sessions_router.get("", response_model=APIResponse[list[PortalSessionResponse]])
def list_portal_sessions(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.session:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = PortalSessionService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@portal_sessions_router.get("/{row_id}", response_model=APIResponse[PortalSessionResponse])
def get_portal_sessions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.session:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PortalSessionService(db).get(ctx, row_id))

@portal_sessions_router.post("", response_model=APIResponse[PortalSessionResponse])
def create_portal_sessions(
    body: PortalSessionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.session:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PortalSessionService(db).create(ctx, **body.model_dump(exclude_none=True)))

@portal_sessions_router.patch("/{row_id}", response_model=APIResponse[PortalSessionResponse])
def update_portal_sessions(
    row_id: UUID,
    body: PortalSessionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.session:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PortalSessionService(db).update(ctx, row_id, **extract_update_fields(body)))

dashboards_router = APIRouter(prefix="/dashboards", tags=["Portal — Dashboard"])

@dashboards_router.get("", response_model=APIResponse[list[DashboardResponse]])
def list_dashboards(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.dashboard:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DashboardService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@dashboards_router.get("/{row_id}", response_model=APIResponse[DashboardResponse])
def get_dashboards(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.dashboard:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DashboardService(db).get(ctx, row_id))

@dashboards_router.post("", response_model=APIResponse[DashboardResponse])
def create_dashboards(
    body: DashboardCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.dashboard:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DashboardService(db).create(ctx, **body.model_dump(exclude_none=True)))

@dashboards_router.patch("/{row_id}", response_model=APIResponse[DashboardResponse])
def update_dashboards(
    row_id: UUID,
    body: DashboardUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.dashboard:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DashboardService(db).update(ctx, row_id, **extract_update_fields(body)))

dashboard_widgets_router = APIRouter(prefix="/dashboard-widgets", tags=["Portal — DashboardWidget"])

@dashboard_widgets_router.get("", response_model=APIResponse[list[DashboardWidgetResponse]])
def list_dashboard_widgets(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.widget:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DashboardWidgetService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@dashboard_widgets_router.get("/{row_id}", response_model=APIResponse[DashboardWidgetResponse])
def get_dashboard_widgets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.widget:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DashboardWidgetService(db).get(ctx, row_id))

@dashboard_widgets_router.post("", response_model=APIResponse[DashboardWidgetResponse])
def create_dashboard_widgets(
    body: DashboardWidgetCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.widget:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DashboardWidgetService(db).create(ctx, **body.model_dump(exclude_none=True)))

@dashboard_widgets_router.patch("/{row_id}", response_model=APIResponse[DashboardWidgetResponse])
def update_dashboard_widgets(
    row_id: UUID,
    body: DashboardWidgetUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.widget:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DashboardWidgetService(db).update(ctx, row_id, **extract_update_fields(body)))

notifications_router = APIRouter(prefix="/notifications", tags=["Portal — Notification"])

@notifications_router.get("", response_model=APIResponse[list[NotificationResponse]])
def list_notifications(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = NotificationService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@notifications_router.get("/{row_id}", response_model=APIResponse[NotificationResponse])
def get_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=NotificationService(db).get(ctx, row_id))

@notifications_router.post("", response_model=APIResponse[NotificationResponse])
def create_notifications(
    body: NotificationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=NotificationService(db).create(ctx, **body.model_dump(exclude_none=True)))

@notifications_router.patch("/{row_id}", response_model=APIResponse[NotificationResponse])
def update_notifications(
    row_id: UUID,
    body: NotificationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=NotificationService(db).update(ctx, row_id, **extract_update_fields(body)))

@notifications_router.post("/{row_id}/acknowledge", response_model=APIResponse[NotificationResponse])
def acknowledge_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.notification:acknowledge"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="acknowledge", data=NotificationService(db).acknowledge(ctx, row_id))

message_threads_router = APIRouter(prefix="/message-threads", tags=["Portal — MessageThread"])

@message_threads_router.get("", response_model=APIResponse[list[MessageThreadResponse]])
def list_message_threads(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.thread:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = MessageThreadService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@message_threads_router.get("/{row_id}", response_model=APIResponse[MessageThreadResponse])
def get_message_threads(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.thread:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=MessageThreadService(db).get(ctx, row_id))

@message_threads_router.post("", response_model=APIResponse[MessageThreadResponse])
def create_message_threads(
    body: MessageThreadCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.thread:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=MessageThreadService(db).create(ctx, **body.model_dump(exclude_none=True)))

@message_threads_router.patch("/{row_id}", response_model=APIResponse[MessageThreadResponse])
def update_message_threads(
    row_id: UUID,
    body: MessageThreadUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.thread:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=MessageThreadService(db).update(ctx, row_id, **extract_update_fields(body)))

messages_router = APIRouter(prefix="/messages", tags=["Portal — Message"])

@messages_router.get("", response_model=APIResponse[list[MessageResponse]])
def list_messages(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.message:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = MessageService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@messages_router.get("/{row_id}", response_model=APIResponse[MessageResponse])
def get_messages(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.message:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=MessageService(db).get(ctx, row_id))

@messages_router.post("", response_model=APIResponse[MessageResponse])
def create_messages(
    body: MessageCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.message:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=MessageService(db).create(ctx, **body.model_dump(exclude_none=True)))

@messages_router.patch("/{row_id}", response_model=APIResponse[MessageResponse])
def update_messages(
    row_id: UUID,
    body: MessageUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.message:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=MessageService(db).update(ctx, row_id, **extract_update_fields(body)))

order_views_router = APIRouter(prefix="/order-views", tags=["Portal — OrderView"])

@order_views_router.get("", response_model=APIResponse[list[OrderViewResponse]])
def list_order_views(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.order_view:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = OrderViewService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@order_views_router.get("/{row_id}", response_model=APIResponse[OrderViewResponse])
def get_order_views(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.order_view:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OrderViewService(db).get(ctx, row_id))

@order_views_router.post("", response_model=APIResponse[OrderViewResponse])
def create_order_views(
    body: OrderViewCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.order_view:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=OrderViewService(db).create(ctx, **body.model_dump(exclude_none=True)))

@order_views_router.patch("/{row_id}", response_model=APIResponse[OrderViewResponse])
def update_order_views(
    row_id: UUID,
    body: OrderViewUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.order_view:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=OrderViewService(db).update(ctx, row_id, **extract_update_fields(body)))

invoice_views_router = APIRouter(prefix="/invoice-views", tags=["Portal — InvoiceView"])

@invoice_views_router.get("", response_model=APIResponse[list[InvoiceViewResponse]])
def list_invoice_views(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.invoice_view:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = InvoiceViewService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@invoice_views_router.get("/{row_id}", response_model=APIResponse[InvoiceViewResponse])
def get_invoice_views(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.invoice_view:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=InvoiceViewService(db).get(ctx, row_id))

@invoice_views_router.post("", response_model=APIResponse[InvoiceViewResponse])
def create_invoice_views(
    body: InvoiceViewCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.invoice_view:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=InvoiceViewService(db).create(ctx, **body.model_dump(exclude_none=True)))

@invoice_views_router.patch("/{row_id}", response_model=APIResponse[InvoiceViewResponse])
def update_invoice_views(
    row_id: UUID,
    body: InvoiceViewUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.invoice_view:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=InvoiceViewService(db).update(ctx, row_id, **extract_update_fields(body)))

document_accesses_router = APIRouter(prefix="/document-accesses", tags=["Portal — DocumentAccess"])

@document_accesses_router.get("", response_model=APIResponse[list[DocumentAccessResponse]])
def list_document_accesses(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.document_access:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DocumentAccessService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@document_accesses_router.get("/{row_id}", response_model=APIResponse[DocumentAccessResponse])
def get_document_accesses(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.document_access:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DocumentAccessService(db).get(ctx, row_id))

@document_accesses_router.post("", response_model=APIResponse[DocumentAccessResponse])
def create_document_accesses(
    body: DocumentAccessCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.document_access:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DocumentAccessService(db).create(ctx, **body.model_dump(exclude_none=True)))

@document_accesses_router.patch("/{row_id}", response_model=APIResponse[DocumentAccessResponse])
def update_document_accesses(
    row_id: UUID,
    body: DocumentAccessUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.document_access:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DocumentAccessService(db).update(ctx, row_id, **extract_update_fields(body)))

@document_accesses_router.post("/{row_id}/submit", response_model=APIResponse[DocumentAccessResponse])
def submit_document_accesses(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.document_access:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=DocumentAccessService(db).submit(ctx, row_id))

@document_accesses_router.post("/{row_id}/approve", response_model=APIResponse[DocumentAccessResponse])
def approve_document_accesses(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.document_access:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=DocumentAccessService(db).approve(ctx, row_id))

support_tickets_router = APIRouter(prefix="/support-tickets", tags=["Portal — SupportTicket"])

@support_tickets_router.get("", response_model=APIResponse[list[SupportTicketResponse]])
def list_support_tickets(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.support_ticket:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = SupportTicketService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@support_tickets_router.get("/{row_id}", response_model=APIResponse[SupportTicketResponse])
def get_support_tickets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.support_ticket:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SupportTicketService(db).get(ctx, row_id))

@support_tickets_router.post("", response_model=APIResponse[SupportTicketResponse])
def create_support_tickets(
    body: SupportTicketCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.support_ticket:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=SupportTicketService(db).create(ctx, **body.model_dump(exclude_none=True)))

@support_tickets_router.patch("/{row_id}", response_model=APIResponse[SupportTicketResponse])
def update_support_tickets(
    row_id: UUID,
    body: SupportTicketUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.support_ticket:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=SupportTicketService(db).update(ctx, row_id, **extract_update_fields(body)))

@support_tickets_router.post("/{row_id}/submit", response_model=APIResponse[SupportTicketResponse])
def submit_support_tickets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.support_ticket:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=SupportTicketService(db).submit(ctx, row_id))

service_requests_router = APIRouter(prefix="/service-requests", tags=["Portal — ServiceRequest"])

@service_requests_router.get("", response_model=APIResponse[list[ServiceRequestResponse]])
def list_service_requests(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.service_request:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceRequestService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_requests_router.get("/{row_id}", response_model=APIResponse[ServiceRequestResponse])
def get_service_requests(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.service_request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceRequestService(db).get(ctx, row_id))

@service_requests_router.post("", response_model=APIResponse[ServiceRequestResponse])
def create_service_requests(
    body: ServiceRequestCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.service_request:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceRequestService(db).create(ctx, **body.model_dump(exclude_none=True)))

@service_requests_router.patch("/{row_id}", response_model=APIResponse[ServiceRequestResponse])
def update_service_requests(
    row_id: UUID,
    body: ServiceRequestUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.service_request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceRequestService(db).update(ctx, row_id, **extract_update_fields(body)))

@service_requests_router.post("/{row_id}/submit", response_model=APIResponse[ServiceRequestResponse])
def submit_service_requests(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.service_request:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=ServiceRequestService(db).submit(ctx, row_id))

download_histories_router = APIRouter(prefix="/download-histories", tags=["Portal — DownloadHistory"])

@download_histories_router.get("", response_model=APIResponse[list[DownloadHistoryResponse]])
def list_download_histories(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.download:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DownloadHistoryService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@download_histories_router.get("/{row_id}", response_model=APIResponse[DownloadHistoryResponse])
def get_download_histories(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.download:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DownloadHistoryService(db).get(ctx, row_id))

@download_histories_router.post("", response_model=APIResponse[DownloadHistoryResponse])
def create_download_histories(
    body: DownloadHistoryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.download:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DownloadHistoryService(db).create(ctx, **body.model_dump(exclude_none=True)))

@download_histories_router.patch("/{row_id}", response_model=APIResponse[DownloadHistoryResponse])
def update_download_histories(
    row_id: UUID,
    body: DownloadHistoryUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.download:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DownloadHistoryService(db).update(ctx, row_id, **extract_update_fields(body)))

saved_reports_router = APIRouter(prefix="/saved-reports", tags=["Portal — SavedReport"])

@saved_reports_router.get("", response_model=APIResponse[list[SavedReportResponse]])
def list_saved_reports(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.saved_report:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = SavedReportService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@saved_reports_router.get("/{row_id}", response_model=APIResponse[SavedReportResponse])
def get_saved_reports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.saved_report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SavedReportService(db).get(ctx, row_id))

@saved_reports_router.post("", response_model=APIResponse[SavedReportResponse])
def create_saved_reports(
    body: SavedReportCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.saved_report:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=SavedReportService(db).create(ctx, **body.model_dump(exclude_none=True)))

@saved_reports_router.patch("/{row_id}", response_model=APIResponse[SavedReportResponse])
def update_saved_reports(
    row_id: UUID,
    body: SavedReportUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.saved_report:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=SavedReportService(db).update(ctx, row_id, **extract_update_fields(body)))

saved_searches_router = APIRouter(prefix="/saved-searches", tags=["Portal — SavedSearch"])

@saved_searches_router.get("", response_model=APIResponse[list[SavedSearchResponse]])
def list_saved_searches(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.saved_search:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = SavedSearchService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@saved_searches_router.get("/{row_id}", response_model=APIResponse[SavedSearchResponse])
def get_saved_searches(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.saved_search:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SavedSearchService(db).get(ctx, row_id))

@saved_searches_router.post("", response_model=APIResponse[SavedSearchResponse])
def create_saved_searches(
    body: SavedSearchCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.saved_search:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=SavedSearchService(db).create(ctx, **body.model_dump(exclude_none=True)))

@saved_searches_router.patch("/{row_id}", response_model=APIResponse[SavedSearchResponse])
def update_saved_searches(
    row_id: UUID,
    body: SavedSearchUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.saved_search:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=SavedSearchService(db).update(ctx, row_id, **extract_update_fields(body)))

preferences_router = APIRouter(prefix="/preferences", tags=["Portal — Preference"])

@preferences_router.get("", response_model=APIResponse[list[PreferenceResponse]])
def list_preferences(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.preference:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = PreferenceService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@preferences_router.get("/{row_id}", response_model=APIResponse[PreferenceResponse])
def get_preferences(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.preference:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PreferenceService(db).get(ctx, row_id))

@preferences_router.post("", response_model=APIResponse[PreferenceResponse])
def create_preferences(
    body: PreferenceCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.preference:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PreferenceService(db).create(ctx, **body.model_dump(exclude_none=True)))

@preferences_router.patch("/{row_id}", response_model=APIResponse[PreferenceResponse])
def update_preferences(
    row_id: UUID,
    body: PreferenceUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.preference:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PreferenceService(db).update(ctx, row_id, **extract_update_fields(body)))

devices_router = APIRouter(prefix="/devices", tags=["Portal — Device"])

@devices_router.get("", response_model=APIResponse[list[DeviceResponse]])
def list_devices(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.device:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DeviceService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@devices_router.get("/{row_id}", response_model=APIResponse[DeviceResponse])
def get_devices(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.device:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DeviceService(db).get(ctx, row_id))

@devices_router.post("", response_model=APIResponse[DeviceResponse])
def create_devices(
    body: DeviceCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.device:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DeviceService(db).create(ctx, **body.model_dump(exclude_none=True)))

@devices_router.patch("/{row_id}", response_model=APIResponse[DeviceResponse])
def update_devices(
    row_id: UUID,
    body: DeviceUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.device:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DeviceService(db).update(ctx, row_id, **extract_update_fields(body)))

login_audits_router = APIRouter(prefix="/login-audits", tags=["Portal — LoginAudit"])

@login_audits_router.get("", response_model=APIResponse[list[LoginAuditResponse]])
def list_login_audits(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.login_audit:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = LoginAuditService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@login_audits_router.get("/{row_id}", response_model=APIResponse[LoginAuditResponse])
def get_login_audits(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.login_audit:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LoginAuditService(db).get(ctx, row_id))

@login_audits_router.post("", response_model=APIResponse[LoginAuditResponse])
def create_login_audits(
    body: LoginAuditCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.login_audit:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=LoginAuditService(db).create(ctx, **body.model_dump(exclude_none=True)))

@login_audits_router.patch("/{row_id}", response_model=APIResponse[LoginAuditResponse])
def update_login_audits(
    row_id: UUID,
    body: LoginAuditUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.login_audit:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=LoginAuditService(db).update(ctx, row_id, **extract_update_fields(body)))

reports_router = APIRouter(prefix="/reports", tags=["Portal — PortalReport"])

@reports_router.get("", response_model=APIResponse[list[PortalReportResponse]])
def list_reports(
    ctx: Annotated[TenantContext, Depends(require_permission("portal.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = PortalReportService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@reports_router.get("/{row_id}", response_model=APIResponse[PortalReportResponse])
def get_reports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PortalReportService(db).get(ctx, row_id))

@reports_router.post("", response_model=APIResponse[PortalReportResponse])
def create_reports(
    body: PortalReportCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PortalReportService(db).create(ctx, **body.model_dump(exclude_none=True)))

@reports_router.patch("/{row_id}", response_model=APIResponse[PortalReportResponse])
def update_reports(
    row_id: UUID,
    body: PortalReportUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("portal.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PortalReportService(db).update(ctx, row_id, **extract_update_fields(body)))

