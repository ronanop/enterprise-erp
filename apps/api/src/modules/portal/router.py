"""Customer Portal module router aggregation."""

from fastapi import APIRouter

from modules.portal.routers import (
    customer_profiles_router,
    dashboard_widgets_router,
    dashboards_router,
    devices_router,
    document_accesses_router,
    download_histories_router,
    invoice_views_router,
    login_audits_router,
    message_threads_router,
    messages_router,
    notifications_router,
    order_views_router,
    portal_accounts_router,
    portal_sessions_router,
    preferences_router,
    reports_router,
    saved_reports_router,
    saved_searches_router,
    service_requests_router,
    support_tickets_router,
)

portal_router = APIRouter(prefix="/portal")
portal_router.include_router(portal_accounts_router)
portal_router.include_router(customer_profiles_router)
portal_router.include_router(portal_sessions_router)
portal_router.include_router(dashboards_router)
portal_router.include_router(dashboard_widgets_router)
portal_router.include_router(notifications_router)
portal_router.include_router(message_threads_router)
portal_router.include_router(messages_router)
portal_router.include_router(order_views_router)
portal_router.include_router(invoice_views_router)
portal_router.include_router(document_accesses_router)
portal_router.include_router(support_tickets_router)
portal_router.include_router(service_requests_router)
portal_router.include_router(download_histories_router)
portal_router.include_router(saved_reports_router)
portal_router.include_router(saved_searches_router)
portal_router.include_router(preferences_router)
portal_router.include_router(devices_router)
portal_router.include_router(login_audits_router)
portal_router.include_router(reports_router)
