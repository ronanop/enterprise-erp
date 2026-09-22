"""Service module router aggregation."""

from fastapi import APIRouter

from modules.service.routers import (
    reports_router,
    service_assignments_router,
    service_categories_router,
    service_checklists_router,
    service_contracts_router,
    service_documents_router,
    service_escalations_router,
    service_expenses_router,
    service_feedback_router,
    service_materials_router,
    service_notifications_router,
    service_requests_router,
    service_resolutions_router,
    service_schedules_router,
    service_slas_router,
    service_tasks_router,
    service_tickets_router,
    service_visits_router,
    time_entries_router,
    work_orders_router,
)
from modules.service.routers.email_inbound import email_inbound_router
from modules.service.routers.service_request_tickets import service_request_tickets_router
from modules.service.routers.ticket_options import ticket_options_router

service_router = APIRouter(prefix="/service")
service_router.include_router(email_inbound_router)
service_router.include_router(service_request_tickets_router)
service_router.include_router(ticket_options_router)
service_router.include_router(service_categories_router)
service_router.include_router(service_requests_router)
service_router.include_router(service_tickets_router)
service_router.include_router(service_assignments_router)
service_router.include_router(service_schedules_router)
service_router.include_router(work_orders_router)
service_router.include_router(service_tasks_router)
service_router.include_router(service_checklists_router)
service_router.include_router(service_visits_router)
service_router.include_router(service_materials_router)
service_router.include_router(time_entries_router)
service_router.include_router(service_expenses_router)
service_router.include_router(service_slas_router)
service_router.include_router(service_escalations_router)
service_router.include_router(service_feedback_router)
service_router.include_router(service_resolutions_router)
service_router.include_router(service_documents_router)
service_router.include_router(service_notifications_router)
service_router.include_router(service_contracts_router)
service_router.include_router(reports_router)
