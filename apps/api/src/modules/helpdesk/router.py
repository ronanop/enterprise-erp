"""Helpdesk module router aggregation."""

from fastapi import APIRouter

from modules.helpdesk.routers import (
    customer_feedback_router,
    knowledge_articles_router,
    knowledge_bases_router,
    resolutions_router,
    support_schedules_router,
    support_shifts_router,
    support_teams_router,
    ticket_activities_router,
    ticket_assignments_router,
    ticket_attachments_router,
    ticket_categories_router,
    ticket_comments_router,
    ticket_dashboards_router,
    ticket_escalations_router,
    ticket_notifications_router,
    ticket_priorities_router,
    ticket_reports_router,
    ticket_slas_router,
    ticket_status_history_router,
    tickets_router,
)

helpdesk_router = APIRouter(prefix="/helpdesk")
helpdesk_router.include_router(ticket_categories_router)
helpdesk_router.include_router(ticket_priorities_router)
helpdesk_router.include_router(tickets_router)
helpdesk_router.include_router(ticket_assignments_router)
helpdesk_router.include_router(ticket_status_history_router)
helpdesk_router.include_router(ticket_comments_router)
helpdesk_router.include_router(ticket_attachments_router)
helpdesk_router.include_router(ticket_activities_router)
helpdesk_router.include_router(ticket_slas_router)
helpdesk_router.include_router(ticket_escalations_router)
helpdesk_router.include_router(knowledge_bases_router)
helpdesk_router.include_router(knowledge_articles_router)
helpdesk_router.include_router(resolutions_router)
helpdesk_router.include_router(customer_feedback_router)
helpdesk_router.include_router(support_teams_router)
helpdesk_router.include_router(support_shifts_router)
helpdesk_router.include_router(support_schedules_router)
helpdesk_router.include_router(ticket_notifications_router)
helpdesk_router.include_router(ticket_reports_router)
helpdesk_router.include_router(ticket_dashboards_router)
