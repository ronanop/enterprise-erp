"""Customer Portal application service facade."""

from sqlalchemy.orm import Session

from modules.portal.service.customer_profile_service import CustomerProfileService
from modules.portal.service.dashboard_service import DashboardService
from modules.portal.service.dashboard_widget_service import DashboardWidgetService
from modules.portal.service.device_service import DeviceService
from modules.portal.service.document_access_service import DocumentAccessService
from modules.portal.service.download_history_service import DownloadHistoryService
from modules.portal.service.invoice_view_service import InvoiceViewService
from modules.portal.service.login_audit_service import LoginAuditService
from modules.portal.service.message_service import MessageService
from modules.portal.service.message_thread_service import MessageThreadService
from modules.portal.service.notification_service import NotificationService
from modules.portal.service.order_view_service import OrderViewService
from modules.portal.service.portal_account_service import PortalAccountService
from modules.portal.service.portal_integration_service import PortalIntegrationService
from modules.portal.service.portal_report_service import PortalReportService
from modules.portal.service.portal_session_service import PortalSessionService
from modules.portal.service.preference_service import PreferenceService
from modules.portal.service.saved_report_service import SavedReportService
from modules.portal.service.saved_search_service import SavedSearchService
from modules.portal.service.service_request_service import ServiceRequestService
from modules.portal.service.support_ticket_service import SupportTicketService


class PortalApplicationService:
    def __init__(self, db: Session) -> None:
        self.portal_accounts = PortalAccountService(db)
        self.customer_profiles = CustomerProfileService(db)
        self.portal_sessions = PortalSessionService(db)
        self.dashboards = DashboardService(db)
        self.dashboard_widgets = DashboardWidgetService(db)
        self.notifications = NotificationService(db)
        self.message_threads = MessageThreadService(db)
        self.messages = MessageService(db)
        self.order_views = OrderViewService(db)
        self.invoice_views = InvoiceViewService(db)
        self.document_accesses = DocumentAccessService(db)
        self.support_tickets = SupportTicketService(db)
        self.service_requests = ServiceRequestService(db)
        self.download_histories = DownloadHistoryService(db)
        self.saved_reports = SavedReportService(db)
        self.saved_searches = SavedSearchService(db)
        self.preferences = PreferenceService(db)
        self.devices = DeviceService(db)
        self.login_audits = LoginAuditService(db)
        self.reports = PortalReportService(db)
        self.integration = PortalIntegrationService(db)
