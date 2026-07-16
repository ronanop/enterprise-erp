"""Unit tests for Customer Portal Celery task names."""

from modules.portal import tasks


def test_portal_task_names_registered():
    assert tasks.session_expiry_sweeper.name == "portal.session_expiry_sweeper"
    assert tasks.order_view_sync.name == "portal.order_view_sync"
    assert tasks.invoice_view_sync.name == "portal.invoice_view_sync"
    assert tasks.notification_dispatcher.name == "portal.notification_dispatcher"
    assert tasks.login_audit_retention.name == "portal.login_audit_retention"
    assert tasks.ticket_status_poller.name == "portal.ticket_status_poller"
