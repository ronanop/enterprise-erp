"""Service API route handlers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.service.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
    require_permission,
)
from modules.service.schemas import (
    FinancePostRequest,
    ServiceAssignmentCreate,
    ServiceAssignmentResponse,
    ServiceAssignmentUpdate,
    ServiceCategoryCreate,
    ServiceCategoryResponse,
    ServiceCategoryUpdate,
    ServiceChecklistCreate,
    ServiceChecklistResponse,
    ServiceChecklistUpdate,
    ServiceContractCreate,
    ServiceContractResponse,
    ServiceContractUpdate,
    ServiceDocumentCreate,
    ServiceDocumentResponse,
    ServiceDocumentUpdate,
    ServiceEscalationCreate,
    ServiceEscalationResponse,
    ServiceEscalationUpdate,
    ServiceExpenseCreate,
    ServiceExpenseResponse,
    ServiceExpenseUpdate,
    ServiceFeedbackCreate,
    ServiceFeedbackResponse,
    ServiceFeedbackUpdate,
    ServiceMaterialCreate,
    ServiceMaterialResponse,
    ServiceMaterialUpdate,
    ServiceNotificationCreate,
    ServiceNotificationResponse,
    ServiceNotificationUpdate,
    ServiceReportCreate,
    ServiceReportResponse,
    ServiceReportUpdate,
    ServiceRequestCreate,
    ServiceRequestResponse,
    ServiceRequestUpdate,
    ServiceResolutionCreate,
    ServiceResolutionResponse,
    ServiceResolutionUpdate,
    ServiceScheduleCreate,
    ServiceScheduleResponse,
    ServiceScheduleUpdate,
    ServiceSlaCreate,
    ServiceSlaResponse,
    ServiceSlaUpdate,
    ServiceTaskCreate,
    ServiceTaskResponse,
    ServiceTaskUpdate,
    ServiceTicketCreate,
    ServiceTicketResponse,
    ServiceTicketUpdate,
    ServiceTimeEntryCreate,
    ServiceTimeEntryResponse,
    ServiceTimeEntryUpdate,
    ServiceVisitCreate,
    ServiceVisitResponse,
    ServiceVisitUpdate,
    WorkOrderCreate,
    WorkOrderResponse,
    WorkOrderUpdate,
)
from modules.service.service import (
    ServiceAssignmentService,
    ServiceCategoryService,
    ServiceChecklistService,
    ServiceContractService,
    ServiceDocumentService,
    ServiceEscalationService,
    ServiceExpenseService,
    ServiceFeedbackService,
    ServiceMaterialService,
    ServiceNotificationService,
    ServiceReportService,
    ServiceRequestService,
    ServiceResolutionService,
    ServiceScheduleService,
    ServiceSLAService,
    ServiceTaskService,
    ServiceTicketService,
    ServiceTimeEntryService,
    ServiceVisitService,
    WorkOrderService,
)
from shared.schemas import APIResponse

service_categories_router = APIRouter(prefix="/service-categories", tags=["Service — ServiceCategory"])

@service_categories_router.get("", response_model=APIResponse[list[ServiceCategoryResponse]])
def list_service_categories(
    ctx: Annotated[TenantContext, Depends(require_permission("service.category:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceCategoryService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_categories_router.get("/{row_id}", response_model=APIResponse[ServiceCategoryResponse])
def get_service_categories(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.category:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceCategoryService(db).get(ctx, row_id))

@service_categories_router.post("", response_model=APIResponse[ServiceCategoryResponse])
def create_service_categories(
    body: ServiceCategoryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.category:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceCategoryService(db).create(ctx, **body.model_dump(exclude_none=True)))

@service_categories_router.patch("/{row_id}", response_model=APIResponse[ServiceCategoryResponse])
def update_service_categories(
    row_id: UUID,
    body: ServiceCategoryUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.category:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceCategoryService(db).update(ctx, row_id, **extract_update_fields(body)))

service_requests_router = APIRouter(prefix="/service-requests", tags=["Service — ServiceRequest"])

@service_requests_router.get("", response_model=APIResponse[list[ServiceRequestResponse]])
def list_service_requests(
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceRequestService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_requests_router.get("/{row_id}", response_model=APIResponse[ServiceRequestResponse])
def get_service_requests(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceRequestService(db).get(ctx, row_id))

@service_requests_router.post("", response_model=APIResponse[ServiceRequestResponse])
def create_service_requests(
    body: ServiceRequestCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceRequestService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@service_requests_router.patch("/{row_id}", response_model=APIResponse[ServiceRequestResponse])
def update_service_requests(
    row_id: UUID,
    body: ServiceRequestUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceRequestService(db).update(ctx, row_id, **extract_update_fields(body)))

@service_requests_router.post("/{row_id}/submit", response_model=APIResponse[ServiceRequestResponse])
def submit_service_requests(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=ServiceRequestService(db).submit(ctx, row_id))

@service_requests_router.post("/{row_id}/approve", response_model=APIResponse[ServiceRequestResponse])
def approve_service_requests(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=ServiceRequestService(db).approve(ctx, row_id))

service_tickets_router = APIRouter(prefix="/service-tickets", tags=["Service — ServiceTicket"])

@service_tickets_router.get("", response_model=APIResponse[list[ServiceTicketResponse]])
def list_service_tickets(
    ctx: Annotated[TenantContext, Depends(require_permission("service.ticket:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceTicketService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_tickets_router.get("/{row_id}", response_model=APIResponse[ServiceTicketResponse])
def get_service_tickets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.ticket:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceTicketService(db).get(ctx, row_id))

@service_tickets_router.post("", response_model=APIResponse[ServiceTicketResponse])
def create_service_tickets(
    body: ServiceTicketCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.ticket:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceTicketService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@service_tickets_router.patch("/{row_id}", response_model=APIResponse[ServiceTicketResponse])
def update_service_tickets(
    row_id: UUID,
    body: ServiceTicketUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.ticket:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceTicketService(db).update(ctx, row_id, **extract_update_fields(body)))

service_assignments_router = APIRouter(prefix="/service-assignments", tags=["Service — ServiceAssignment"])

@service_assignments_router.get("", response_model=APIResponse[list[ServiceAssignmentResponse]])
def list_service_assignments(
    ctx: Annotated[TenantContext, Depends(require_permission("service.assignment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceAssignmentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_assignments_router.get("/{row_id}", response_model=APIResponse[ServiceAssignmentResponse])
def get_service_assignments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.assignment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceAssignmentService(db).get(ctx, row_id))

@service_assignments_router.post("", response_model=APIResponse[ServiceAssignmentResponse])
def create_service_assignments(
    body: ServiceAssignmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.assignment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceAssignmentService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@service_assignments_router.patch("/{row_id}", response_model=APIResponse[ServiceAssignmentResponse])
def update_service_assignments(
    row_id: UUID,
    body: ServiceAssignmentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.assignment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceAssignmentService(db).update(ctx, row_id, **extract_update_fields(body)))

@service_assignments_router.post("/{row_id}/complete", response_model=APIResponse[ServiceAssignmentResponse])
def complete_service_assignments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.assignment:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="complete", data=ServiceAssignmentService(db).complete(ctx, row_id))

service_schedules_router = APIRouter(prefix="/service-schedules", tags=["Service — ServiceSchedule"])

@service_schedules_router.get("", response_model=APIResponse[list[ServiceScheduleResponse]])
def list_service_schedules(
    ctx: Annotated[TenantContext, Depends(require_permission("service.schedule:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceScheduleService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_schedules_router.get("/{row_id}", response_model=APIResponse[ServiceScheduleResponse])
def get_service_schedules(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.schedule:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceScheduleService(db).get(ctx, row_id))

@service_schedules_router.post("", response_model=APIResponse[ServiceScheduleResponse])
def create_service_schedules(
    body: ServiceScheduleCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.schedule:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceScheduleService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@service_schedules_router.patch("/{row_id}", response_model=APIResponse[ServiceScheduleResponse])
def update_service_schedules(
    row_id: UUID,
    body: ServiceScheduleUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.schedule:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceScheduleService(db).update(ctx, row_id, **extract_update_fields(body)))

@service_schedules_router.post("/{row_id}/complete", response_model=APIResponse[ServiceScheduleResponse])
def complete_service_schedules(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.schedule:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="complete", data=ServiceScheduleService(db).complete(ctx, row_id))

work_orders_router = APIRouter(prefix="/work-orders", tags=["Service — WorkOrder"])

@work_orders_router.get("", response_model=APIResponse[list[WorkOrderResponse]])
def list_work_orders(
    ctx: Annotated[TenantContext, Depends(require_permission("service.work_order:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = WorkOrderService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@work_orders_router.get("/{row_id}", response_model=APIResponse[WorkOrderResponse])
def get_work_orders(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.work_order:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=WorkOrderService(db).get(ctx, row_id))

@work_orders_router.post("", response_model=APIResponse[WorkOrderResponse])
def create_work_orders(
    body: WorkOrderCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.work_order:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=WorkOrderService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@work_orders_router.patch("/{row_id}", response_model=APIResponse[WorkOrderResponse])
def update_work_orders(
    row_id: UUID,
    body: WorkOrderUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.work_order:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=WorkOrderService(db).update(ctx, row_id, **extract_update_fields(body)))

@work_orders_router.post("/{row_id}/submit", response_model=APIResponse[WorkOrderResponse])
def submit_work_orders(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.work_order:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=WorkOrderService(db).submit(ctx, row_id))

@work_orders_router.post("/{row_id}/approve", response_model=APIResponse[WorkOrderResponse])
def approve_work_orders(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.work_order:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=WorkOrderService(db).approve(ctx, row_id))

@work_orders_router.post("/{row_id}/complete", response_model=APIResponse[WorkOrderResponse])
def complete_work_orders(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.work_order:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="complete", data=WorkOrderService(db).complete(ctx, row_id))

service_tasks_router = APIRouter(prefix="/service-tasks", tags=["Service — ServiceTask"])

@service_tasks_router.get("", response_model=APIResponse[list[ServiceTaskResponse]])
def list_service_tasks(
    ctx: Annotated[TenantContext, Depends(require_permission("service.task:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceTaskService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_tasks_router.get("/{row_id}", response_model=APIResponse[ServiceTaskResponse])
def get_service_tasks(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.task:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceTaskService(db).get(ctx, row_id))

@service_tasks_router.post("", response_model=APIResponse[ServiceTaskResponse])
def create_service_tasks(
    body: ServiceTaskCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.task:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceTaskService(db).create(ctx, **body.model_dump(exclude_none=True)))

@service_tasks_router.patch("/{row_id}", response_model=APIResponse[ServiceTaskResponse])
def update_service_tasks(
    row_id: UUID,
    body: ServiceTaskUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.task:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceTaskService(db).update(ctx, row_id, **extract_update_fields(body)))

service_checklists_router = APIRouter(prefix="/service-checklists", tags=["Service — ServiceChecklist"])

@service_checklists_router.get("", response_model=APIResponse[list[ServiceChecklistResponse]])
def list_service_checklists(
    ctx: Annotated[TenantContext, Depends(require_permission("service.checklist:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceChecklistService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_checklists_router.get("/{row_id}", response_model=APIResponse[ServiceChecklistResponse])
def get_service_checklists(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.checklist:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceChecklistService(db).get(ctx, row_id))

@service_checklists_router.post("", response_model=APIResponse[ServiceChecklistResponse])
def create_service_checklists(
    body: ServiceChecklistCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.checklist:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceChecklistService(db).create(ctx, **body.model_dump(exclude_none=True)))

@service_checklists_router.patch("/{row_id}", response_model=APIResponse[ServiceChecklistResponse])
def update_service_checklists(
    row_id: UUID,
    body: ServiceChecklistUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.checklist:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceChecklistService(db).update(ctx, row_id, **extract_update_fields(body)))

service_visits_router = APIRouter(prefix="/service-visits", tags=["Service — ServiceVisit"])

@service_visits_router.get("", response_model=APIResponse[list[ServiceVisitResponse]])
def list_service_visits(
    ctx: Annotated[TenantContext, Depends(require_permission("service.visit:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceVisitService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_visits_router.get("/{row_id}", response_model=APIResponse[ServiceVisitResponse])
def get_service_visits(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.visit:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceVisitService(db).get(ctx, row_id))

@service_visits_router.post("", response_model=APIResponse[ServiceVisitResponse])
def create_service_visits(
    body: ServiceVisitCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.visit:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceVisitService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@service_visits_router.patch("/{row_id}", response_model=APIResponse[ServiceVisitResponse])
def update_service_visits(
    row_id: UUID,
    body: ServiceVisitUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.visit:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceVisitService(db).update(ctx, row_id, **extract_update_fields(body)))

@service_visits_router.post("/{row_id}/complete", response_model=APIResponse[ServiceVisitResponse])
def complete_service_visits(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.visit:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="complete", data=ServiceVisitService(db).complete(ctx, row_id))

service_materials_router = APIRouter(prefix="/service-materials", tags=["Service — ServiceMaterial"])

@service_materials_router.get("", response_model=APIResponse[list[ServiceMaterialResponse]])
def list_service_materials(
    ctx: Annotated[TenantContext, Depends(require_permission("service.material:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceMaterialService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_materials_router.get("/{row_id}", response_model=APIResponse[ServiceMaterialResponse])
def get_service_materials(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.material:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceMaterialService(db).get(ctx, row_id))

@service_materials_router.post("", response_model=APIResponse[ServiceMaterialResponse])
def create_service_materials(
    body: ServiceMaterialCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.material:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceMaterialService(db).create(ctx, **body.model_dump(exclude_none=True)))

@service_materials_router.patch("/{row_id}", response_model=APIResponse[ServiceMaterialResponse])
def update_service_materials(
    row_id: UUID,
    body: ServiceMaterialUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.material:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceMaterialService(db).update(ctx, row_id, **extract_update_fields(body)))

time_entries_router = APIRouter(prefix="/time-entries", tags=["Service — ServiceTimeEntry"])

@time_entries_router.get("", response_model=APIResponse[list[ServiceTimeEntryResponse]])
def list_time_entries(
    ctx: Annotated[TenantContext, Depends(require_permission("service.time_entry:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceTimeEntryService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@time_entries_router.get("/{row_id}", response_model=APIResponse[ServiceTimeEntryResponse])
def get_time_entries(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.time_entry:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceTimeEntryService(db).get(ctx, row_id))

@time_entries_router.post("", response_model=APIResponse[ServiceTimeEntryResponse])
def create_time_entries(
    body: ServiceTimeEntryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.time_entry:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceTimeEntryService(db).create(ctx, **body.model_dump(exclude_none=True)))

@time_entries_router.patch("/{row_id}", response_model=APIResponse[ServiceTimeEntryResponse])
def update_time_entries(
    row_id: UUID,
    body: ServiceTimeEntryUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.time_entry:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceTimeEntryService(db).update(ctx, row_id, **extract_update_fields(body)))

service_expenses_router = APIRouter(prefix="/service-expenses", tags=["Service — ServiceExpense"])

@service_expenses_router.get("", response_model=APIResponse[list[ServiceExpenseResponse]])
def list_service_expenses(
    ctx: Annotated[TenantContext, Depends(require_permission("service.expense:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceExpenseService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_expenses_router.get("/{row_id}", response_model=APIResponse[ServiceExpenseResponse])
def get_service_expenses(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.expense:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceExpenseService(db).get(ctx, row_id))

@service_expenses_router.post("", response_model=APIResponse[ServiceExpenseResponse])
def create_service_expenses(
    body: ServiceExpenseCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.expense:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceExpenseService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@service_expenses_router.patch("/{row_id}", response_model=APIResponse[ServiceExpenseResponse])
def update_service_expenses(
    row_id: UUID,
    body: ServiceExpenseUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.expense:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceExpenseService(db).update(ctx, row_id, **extract_update_fields(body)))

@service_expenses_router.post("/{row_id}/submit", response_model=APIResponse[ServiceExpenseResponse])
def submit_service_expenses(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.expense:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=ServiceExpenseService(db).submit(ctx, row_id))

@service_expenses_router.post("/{row_id}/approve", response_model=APIResponse[ServiceExpenseResponse])
def approve_service_expenses(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.expense:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=ServiceExpenseService(db).approve(ctx, row_id))

@service_expenses_router.post("/{row_id}/post", response_model=APIResponse[ServiceExpenseResponse])
def post_service_expenses(
    row_id: UUID,
    body: FinancePostRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("service.expense:post"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ServiceExpenseService(db).post(
        ctx,
        row_id,
        debit_account_id=body.debit_account_id,
        credit_account_id=body.credit_account_id,
        fiscal_year_id=body.fiscal_year_id,
    )
    return APIResponse(message="Posted", data=data)

service_slas_router = APIRouter(prefix="/service-slas", tags=["Service — ServiceSla"])

@service_slas_router.get("", response_model=APIResponse[list[ServiceSlaResponse]])
def list_service_slas(
    ctx: Annotated[TenantContext, Depends(require_permission("service.sla:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceSLAService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_slas_router.get("/{row_id}", response_model=APIResponse[ServiceSlaResponse])
def get_service_slas(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.sla:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceSLAService(db).get(ctx, row_id))

@service_slas_router.post("", response_model=APIResponse[ServiceSlaResponse])
def create_service_slas(
    body: ServiceSlaCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.sla:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceSLAService(db).create(ctx, **body.model_dump(exclude_none=True)))

@service_slas_router.patch("/{row_id}", response_model=APIResponse[ServiceSlaResponse])
def update_service_slas(
    row_id: UUID,
    body: ServiceSlaUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.sla:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceSLAService(db).update(ctx, row_id, **extract_update_fields(body)))

service_escalations_router = APIRouter(prefix="/service-escalations", tags=["Service — ServiceEscalation"])

@service_escalations_router.get("", response_model=APIResponse[list[ServiceEscalationResponse]])
def list_service_escalations(
    ctx: Annotated[TenantContext, Depends(require_permission("service.escalation:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceEscalationService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_escalations_router.get("/{row_id}", response_model=APIResponse[ServiceEscalationResponse])
def get_service_escalations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.escalation:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceEscalationService(db).get(ctx, row_id))

@service_escalations_router.post("", response_model=APIResponse[ServiceEscalationResponse])
def create_service_escalations(
    body: ServiceEscalationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.escalation:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceEscalationService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@service_escalations_router.patch("/{row_id}", response_model=APIResponse[ServiceEscalationResponse])
def update_service_escalations(
    row_id: UUID,
    body: ServiceEscalationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.escalation:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceEscalationService(db).update(ctx, row_id, **extract_update_fields(body)))

@service_escalations_router.post("/{row_id}/escalate", response_model=APIResponse[ServiceEscalationResponse])
def escalate_service_escalations(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.escalation:escalate"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="escalate", data=ServiceEscalationService(db).escalate(ctx, row_id))

service_feedback_router = APIRouter(prefix="/service-feedback", tags=["Service — ServiceFeedback"])

@service_feedback_router.get("", response_model=APIResponse[list[ServiceFeedbackResponse]])
def list_service_feedback(
    ctx: Annotated[TenantContext, Depends(require_permission("service.feedback:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceFeedbackService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_feedback_router.get("/{row_id}", response_model=APIResponse[ServiceFeedbackResponse])
def get_service_feedback(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.feedback:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceFeedbackService(db).get(ctx, row_id))

@service_feedback_router.post("", response_model=APIResponse[ServiceFeedbackResponse])
def create_service_feedback(
    body: ServiceFeedbackCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.feedback:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceFeedbackService(db).create(ctx, **body.model_dump(exclude_none=True)))

@service_feedback_router.patch("/{row_id}", response_model=APIResponse[ServiceFeedbackResponse])
def update_service_feedback(
    row_id: UUID,
    body: ServiceFeedbackUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.feedback:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceFeedbackService(db).update(ctx, row_id, **extract_update_fields(body)))

service_resolutions_router = APIRouter(prefix="/service-resolutions", tags=["Service — ServiceResolution"])

@service_resolutions_router.get("", response_model=APIResponse[list[ServiceResolutionResponse]])
def list_service_resolutions(
    ctx: Annotated[TenantContext, Depends(require_permission("service.resolution:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceResolutionService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_resolutions_router.get("/{row_id}", response_model=APIResponse[ServiceResolutionResponse])
def get_service_resolutions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.resolution:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceResolutionService(db).get(ctx, row_id))

@service_resolutions_router.post("", response_model=APIResponse[ServiceResolutionResponse])
def create_service_resolutions(
    body: ServiceResolutionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.resolution:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceResolutionService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@service_resolutions_router.patch("/{row_id}", response_model=APIResponse[ServiceResolutionResponse])
def update_service_resolutions(
    row_id: UUID,
    body: ServiceResolutionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.resolution:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceResolutionService(db).update(ctx, row_id, **extract_update_fields(body)))

@service_resolutions_router.post("/{row_id}/submit", response_model=APIResponse[ServiceResolutionResponse])
def submit_service_resolutions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.resolution:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=ServiceResolutionService(db).submit(ctx, row_id))

@service_resolutions_router.post("/{row_id}/complete", response_model=APIResponse[ServiceResolutionResponse])
def complete_service_resolutions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.resolution:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="complete", data=ServiceResolutionService(db).complete(ctx, row_id))

service_documents_router = APIRouter(prefix="/service-documents", tags=["Service — ServiceDocument"])

@service_documents_router.get("", response_model=APIResponse[list[ServiceDocumentResponse]])
def list_service_documents(
    ctx: Annotated[TenantContext, Depends(require_permission("service.document:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceDocumentService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_documents_router.get("/{row_id}", response_model=APIResponse[ServiceDocumentResponse])
def get_service_documents(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.document:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceDocumentService(db).get(ctx, row_id))

@service_documents_router.post("", response_model=APIResponse[ServiceDocumentResponse])
def create_service_documents(
    body: ServiceDocumentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.document:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceDocumentService(db).create(ctx, **body.model_dump(exclude_none=True)))

@service_documents_router.patch("/{row_id}", response_model=APIResponse[ServiceDocumentResponse])
def update_service_documents(
    row_id: UUID,
    body: ServiceDocumentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.document:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceDocumentService(db).update(ctx, row_id, **extract_update_fields(body)))

service_notifications_router = APIRouter(prefix="/service-notifications", tags=["Service — ServiceNotification"])

@service_notifications_router.get("", response_model=APIResponse[list[ServiceNotificationResponse]])
def list_service_notifications(
    ctx: Annotated[TenantContext, Depends(require_permission("service.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    mine: bool = False,
):
    items = ServiceNotificationService(db).list(ctx, company_id=company_id, mine=mine)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_notifications_router.get("/{row_id}", response_model=APIResponse[ServiceNotificationResponse])
def get_service_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceNotificationService(db).get(ctx, row_id))

@service_notifications_router.post("", response_model=APIResponse[ServiceNotificationResponse])
def create_service_notifications(
    body: ServiceNotificationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.notification:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceNotificationService(db).create(ctx, **body.model_dump(exclude_none=True)))

@service_notifications_router.patch("/{row_id}", response_model=APIResponse[ServiceNotificationResponse])
def update_service_notifications(
    row_id: UUID,
    body: ServiceNotificationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.notification:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceNotificationService(db).update(ctx, row_id, **extract_update_fields(body)))

service_contracts_router = APIRouter(prefix="/service-contracts", tags=["Service — ServiceContract"])

@service_contracts_router.get("", response_model=APIResponse[list[ServiceContractResponse]])
def list_service_contracts(
    ctx: Annotated[TenantContext, Depends(require_permission("service.contract:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceContractService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@service_contracts_router.get("/{row_id}", response_model=APIResponse[ServiceContractResponse])
def get_service_contracts(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.contract:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceContractService(db).get(ctx, row_id))

@service_contracts_router.post("", response_model=APIResponse[ServiceContractResponse])
def create_service_contracts(
    body: ServiceContractCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.contract:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceContractService(db).create(ctx, branch_id=body.branch_id, **body.model_dump(exclude={'branch_id'}, exclude_none=True)))

@service_contracts_router.patch("/{row_id}", response_model=APIResponse[ServiceContractResponse])
def update_service_contracts(
    row_id: UUID,
    body: ServiceContractUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.contract:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceContractService(db).update(ctx, row_id, **extract_update_fields(body)))

@service_contracts_router.post("/{row_id}/submit", response_model=APIResponse[ServiceContractResponse])
def submit_service_contracts(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.contract:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=ServiceContractService(db).submit(ctx, row_id))

@service_contracts_router.post("/{row_id}/approve", response_model=APIResponse[ServiceContractResponse])
def approve_service_contracts(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.contract:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=ServiceContractService(db).approve(ctx, row_id))

reports_router = APIRouter(prefix="/reports", tags=["Service — ServiceReport"])

@reports_router.get("", response_model=APIResponse[list[ServiceReportResponse]])
def list_reports(
    ctx: Annotated[TenantContext, Depends(require_permission("service.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ServiceReportService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@reports_router.get("/{row_id}", response_model=APIResponse[ServiceReportResponse])
def get_reports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ServiceReportService(db).get(ctx, row_id))

@reports_router.post("", response_model=APIResponse[ServiceReportResponse])
def create_reports(
    body: ServiceReportCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ServiceReportService(db).create(ctx, **body.model_dump(exclude_none=True)))

@reports_router.patch("/{row_id}", response_model=APIResponse[ServiceReportResponse])
def update_reports(
    row_id: UUID,
    body: ServiceReportUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.report:export"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ServiceReportService(db).update(ctx, row_id, **extract_update_fields(body)))

