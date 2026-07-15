"""Integration smoke: Helpdesk module imports and router mount."""

from modules.helpdesk.models import HdResolution, HdTicket, HdTicketCategory
from modules.helpdesk.router import helpdesk_router
from modules.helpdesk.service import (
    HelpdeskApplicationService,
    HelpdeskDashboardService,
    HelpdeskIntegrationService,
    HelpdeskReportService,
    TicketService,
)
from modules.helpdesk.service.engines import ResolutionEngine, TicketEngine


def test_helpdesk_models_importable():
    assert HdTicketCategory.__tablename__ == "hd_ticket_category"
    assert HdTicket.__tablename__ == "hd_ticket"
    assert HdResolution.__tablename__ == "hd_resolution"


def test_helpdesk_router_mounted():
    assert helpdesk_router.prefix == "/helpdesk"
    paths = [getattr(r, "path", "") for r in helpdesk_router.routes]
    assert any("/{row_id}" in p for p in paths)
    assert any("tickets" in p for p in paths)
    assert any("ticket-categories" in p for p in paths)


def test_helpdesk_services_and_engines_importable():
    assert HelpdeskApplicationService is not None
    assert TicketService is not None
    assert HelpdeskReportService is not None
    assert HelpdeskDashboardService is not None
    assert HelpdeskIntegrationService is not None
    assert TicketEngine is not None
    assert ResolutionEngine is not None
