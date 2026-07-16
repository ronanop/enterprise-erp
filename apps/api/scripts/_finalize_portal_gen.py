"""Finalize portal generator: services, permissions, seeds, wiring, adapters, tasks, domain."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT / "scripts" / "_gen_portal_module.py"

DOMAIN_ENUMS = '''"""Customer Portal domain enums per ERD_23 section 8."""

from enum import Enum


class PortalAccountStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    LOCKED = "locked"
    SUSPENDED = "suspended"
    RETIRED = "retired"


class CustomerProfileStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    INACTIVE = "inactive"


class PortalSessionStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"


class DashboardStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class DashboardWidgetStatus(str, Enum):
    ACTIVE = "active"
    HIDDEN = "hidden"


class NotificationStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class MessageThreadStatus(str, Enum):
    OPEN = "open"
    WAITING = "waiting"
    CLOSED = "closed"


class MessageStatus(str, Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    DELETED = "deleted"


class OrderViewStatus(str, Enum):
    VISIBLE = "visible"
    HIDDEN = "hidden"
    STALE = "stale"


class InvoiceViewStatus(str, Enum):
    VISIBLE = "visible"
    HIDDEN = "hidden"
    STALE = "stale"
    PAID_SNAPSHOT = "paid_snapshot"


class DocumentAccessStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"


class SupportTicketStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING = "waiting"
    RESOLVED = "resolved"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class ServiceRequestStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DownloadHistoryStatus(str, Enum):
    RECORDED = "recorded"
    FAILED = "failed"


class SavedReportStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class SavedSearchStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class PreferenceStatus(str, Enum):
    ACTIVE = "active"


class DeviceStatus(str, Enum):
    ACTIVE = "active"
    REVOKED = "revoked"


class LoginAuditStatus(str, Enum):
    RECORDED = "recorded"


class PortalReportStatus(str, Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"


class PortalEntityType(str, Enum):
    PORTAL_ACCOUNT = "portal_account"
    CUSTOMER_PROFILE = "customer_profile"
    PORTAL_SESSION = "portal_session"
    DASHBOARD = "dashboard"
    MESSAGE = "message"
    MESSAGE_THREAD = "message_thread"
    ORDER_VIEW = "order_view"
    INVOICE_VIEW = "invoice_view"
    DOCUMENT_ACCESS = "document_access"
    SUPPORT_TICKET = "support_ticket"
    SERVICE_REQUEST = "service_request"
    DOWNLOAD_HISTORY = "download_history"
    SAVED_REPORT = "saved_report"
    SAVED_SEARCH = "saved_search"
    DEVICE = "device"
    LOGIN_AUDIT = "login_audit"


CODE_PREFIXES: dict[PortalEntityType, tuple[str, int, bool]] = {
    PortalEntityType.PORTAL_ACCOUNT: ("ACC-", 6, True),
    PortalEntityType.CUSTOMER_PROFILE: ("PRF-", 6, True),
    PortalEntityType.PORTAL_SESSION: ("SES-", 6, True),
    PortalEntityType.DASHBOARD: ("DSH-", 6, True),
    PortalEntityType.MESSAGE: ("MSG-", 6, True),
    PortalEntityType.MESSAGE_THREAD: ("THR-", 6, True),
    PortalEntityType.ORDER_VIEW: ("ORD-", 6, True),
    PortalEntityType.INVOICE_VIEW: ("INV-", 6, True),
    PortalEntityType.DOCUMENT_ACCESS: ("DOC-", 6, True),
    PortalEntityType.SUPPORT_TICKET: ("TKT-", 6, True),
    PortalEntityType.SERVICE_REQUEST: ("SRQ-", 6, True),
    PortalEntityType.DOWNLOAD_HISTORY: ("DL-", 6, True),
    PortalEntityType.SAVED_REPORT: ("SVR-", 6, True),
    PortalEntityType.SAVED_SEARCH: ("SVS-", 6, True),
    PortalEntityType.DEVICE: ("DEV-", 6, True),
    PortalEntityType.LOGIN_AUDIT: ("AUD-", 6, True),
}
'''

DOMAIN_EXCEPTIONS = '''"""Customer Portal domain exceptions."""


class InvalidPortalAccountState(Exception):
    pass


class InvalidCustomerProfileState(Exception):
    pass


class InvalidDocumentAccessState(Exception):
    pass


class InvalidSupportTicketState(Exception):
    pass


class InvalidServiceRequestState(Exception):
    pass
'''

PERMISSIONS_PY = '''"""Customer Portal permission constants per ERD_23 section 10."""

PORTAL_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("portal.account:read", "portal.account", "read", "portal"),
    ("portal.account:create", "portal.account", "create", "portal"),
    ("portal.account:update", "portal.account", "update", "portal"),
    ("portal.account:submit", "portal.account", "submit", "portal"),
    ("portal.account:approve", "portal.account", "approve", "portal"),
    ("portal.account:lock", "portal.account", "lock", "portal"),
    ("portal.profile:read", "portal.profile", "read", "portal"),
    ("portal.profile:create", "portal.profile", "create", "portal"),
    ("portal.profile:update", "portal.profile", "update", "portal"),
    ("portal.profile:submit", "portal.profile", "submit", "portal"),
    ("portal.profile:approve", "portal.profile", "approve", "portal"),
    ("portal.profile:lock", "portal.profile", "lock", "portal"),
    ("portal.session:read", "portal.session", "read", "portal"),
    ("portal.session:revoke", "portal.session", "revoke", "portal"),
    ("portal.device:read", "portal.device", "read", "portal"),
    ("portal.device:revoke", "portal.device", "revoke", "portal"),
    ("portal.login_audit:read", "portal.login_audit", "read", "portal"),
    ("portal.dashboard:read", "portal.dashboard", "read", "portal"),
    ("portal.dashboard:create", "portal.dashboard", "create", "portal"),
    ("portal.dashboard:update", "portal.dashboard", "update", "portal"),
    ("portal.widget:read", "portal.widget", "read", "portal"),
    ("portal.widget:create", "portal.widget", "create", "portal"),
    ("portal.widget:update", "portal.widget", "update", "portal"),
    ("portal.notification:read", "portal.notification", "read", "portal"),
    ("portal.notification:create", "portal.notification", "create", "portal"),
    ("portal.notification:update", "portal.notification", "update", "portal"),
    ("portal.notification:acknowledge", "portal.notification", "acknowledge", "portal"),
    ("portal.message:read", "portal.message", "read", "portal"),
    ("portal.message:create", "portal.message", "create", "portal"),
    ("portal.message:update", "portal.message", "update", "portal"),
    ("portal.message:acknowledge", "portal.message", "acknowledge", "portal"),
    ("portal.thread:read", "portal.thread", "read", "portal"),
    ("portal.thread:create", "portal.thread", "create", "portal"),
    ("portal.thread:update", "portal.thread", "update", "portal"),
    ("portal.thread:acknowledge", "portal.thread", "acknowledge", "portal"),
    ("portal.order_view:read", "portal.order_view", "read", "portal"),
    ("portal.order_view:sync", "portal.order_view", "sync", "portal"),
    ("portal.invoice_view:read", "portal.invoice_view", "read", "portal"),
    ("portal.invoice_view:sync", "portal.invoice_view", "sync", "portal"),
    ("portal.document_access:read", "portal.document_access", "read", "portal"),
    ("portal.document_access:create", "portal.document_access", "create", "portal"),
    ("portal.document_access:submit", "portal.document_access", "submit", "portal"),
    ("portal.document_access:approve", "portal.document_access", "approve", "portal"),
    ("portal.document_access:revoke", "portal.document_access", "revoke", "portal"),
    ("portal.download:read", "portal.download", "read", "portal"),
    ("portal.support_ticket:read", "portal.support_ticket", "read", "portal"),
    ("portal.support_ticket:create", "portal.support_ticket", "create", "portal"),
    ("portal.support_ticket:submit", "portal.support_ticket", "submit", "portal"),
    ("portal.support_ticket:update", "portal.support_ticket", "update", "portal"),
    ("portal.service_request:read", "portal.service_request", "read", "portal"),
    ("portal.service_request:create", "portal.service_request", "create", "portal"),
    ("portal.service_request:submit", "portal.service_request", "submit", "portal"),
    ("portal.service_request:update", "portal.service_request", "update", "portal"),
    ("portal.saved_report:read", "portal.saved_report", "read", "portal"),
    ("portal.saved_report:create", "portal.saved_report", "create", "portal"),
    ("portal.saved_report:update", "portal.saved_report", "update", "portal"),
    ("portal.saved_search:read", "portal.saved_search", "read", "portal"),
    ("portal.saved_search:create", "portal.saved_search", "create", "portal"),
    ("portal.saved_search:update", "portal.saved_search", "update", "portal"),
    ("portal.preference:read", "portal.preference", "read", "portal"),
    ("portal.preference:create", "portal.preference", "create", "portal"),
    ("portal.preference:update", "portal.preference", "update", "portal"),
    ("portal.report:read", "portal.report", "read", "portal"),
    ("portal.report:export", "portal.report", "export", "portal"),
]

_ALL = [p[0] for p in PORTAL_PERMISSIONS]

PORTAL_ADMIN_PERMISSIONS = list(_ALL)
PORTAL_MANAGER_PERMISSIONS = [
    p for p in _ALL if ":approve" not in p and ":lock" not in p
]
CUSTOMER_USER_PERMISSIONS = [
    p for p in _ALL
    if any(
        x in p
        for x in (
            "portal.profile",
            "portal.dashboard",
            "portal.widget",
            "portal.notification",
            "portal.message",
            "portal.thread",
            "portal.order_view",
            "portal.invoice_view",
            "portal.document_access:read",
            "portal.download",
            "portal.support_ticket",
            "portal.service_request",
            "portal.saved_report",
            "portal.saved_search",
            "portal.preference",
        )
    )
    and ":approve" not in p
    and ":lock" not in p
]
SUPPORT_USER_PERMISSIONS = [
    p for p in _ALL
    if any(
        x in p
        for x in (
            "portal.account",
            "portal.session",
            "portal.device",
            "portal.login_audit",
            "portal.notification",
            "portal.message",
            "portal.thread",
            "portal.document_access",
            "portal.support_ticket",
            "portal.service_request",
            "portal.report:read",
        )
    )
    and ":approve" not in p
    and ":lock" not in p
]
'''


def patch_between(text: str, start: str, end: str, replacement: str) -> str:
    i = text.index(start)
    j = text.index(end, i)
    return text[:i] + replacement + text[j:]


def main() -> None:
    text = GEN.read_text(encoding="utf-8")

    # gen_domain enums content
    text = re.sub(
        r"(PORTAL / \"domain\" / \"enums.py\",\n        '''\"\"\"Customer Portal domain enums per ERD_23 section 8\.\"\"\"\n\n).*?(\n''',\n    \)\n    exc_lines)",
        r"\1" + DOMAIN_ENUMS + r"\2",
        text,
        count=1,
        flags=re.DOTALL,
    )

    # entities marker
    text = text.replace(
        '''@dataclass
class StoreIdentity:
    store_id: UUID
    store_number: str''',
        '''@dataclass
class PortalAccountIdentity:
    account_id: UUID
    account_number: str''',
    )

    # Skip broken patch_between for domain/exceptions - exceptions are generated from TABLES

    # gen_engines exc_imports
    text = re.sub(
        r"exc_imports = \{.*?\}",
        '''exc_imports = {
        "PortalAccount": "InvalidPortalAccountState",
        "CustomerProfile": "InvalidCustomerProfileState",
        "DocumentAccess": "InvalidDocumentAccessState",
        "SupportTicket": "InvalidSupportTicketState",
        "ServiceRequest": "InvalidServiceRequestState",
    }''',
        text,
        count=1,
        flags=re.DOTALL,
    )

    # Replace simple_specs and numbered in gen_services
    simple_specs = '''    simple_specs = [
        ("DashboardWidgetService", "PtDashboardWidget", "DashboardWidget", "dashboard_widget", "DashboardWidget", "dashboard_widget_service.py"),
        ("MessageService", "PtMessage", "Message", "message", "Message", "message_service.py"),
        ("MessageThreadService", "PtMessageThread", "MessageThread", "message_thread", "MessageThread", "message_thread_service.py"),
        ("OrderViewService", "PtOrderView", "OrderView", "order_view", "OrderView", "order_view_service.py"),
        ("InvoiceViewService", "PtInvoiceView", "InvoiceView", "invoice_view", "InvoiceView", "invoice_view_service.py"),
        ("DownloadHistoryService", "PtDownloadHistory", "DownloadHistory", "download_history", "DownloadHistory", "download_history_service.py"),
        ("SavedReportService", "PtSavedReport", "SavedReport", "saved_report", "SavedReport", "saved_report_service.py"),
        ("SavedSearchService", "PtSavedSearch", "SavedSearch", "saved_search", "SavedSearch", "saved_search_service.py"),
        ("PreferenceService", "PtPreference", "Preference", "preference", "Preference", "preference_service.py"),
        ("LoginAuditService", "PtLoginAudit", "LoginAudit", "login_audit", "LoginAudit", "login_audit_service.py"),
        ("PortalReportService", "PtReport", "PortalReport", "report", "PortalReport", "portal_report_service.py"),
        ("NotificationService", "PtNotification", "Notification", "notification", "Notification", "notification_service.py"),
    ]'''

    numbered = '''    numbered = [
        ("PortalAccountService", "PtPortalAccount", "PortalAccount", "portal_account", "PORTAL_ACCOUNT", "account_number", "PortalAccount", ["submit", "approve"], "portal_account_service.py"),
        ("CustomerProfileService", "PtCustomerProfile", "CustomerProfile", "customer_profile", "CUSTOMER_PROFILE", "profile_number", "CustomerProfile", ["submit", "approve"], "customer_profile_service.py"),
        ("PortalSessionService", "PtPortalSession", "PortalSession", "portal_session", "PORTAL_SESSION", "session_number", "PortalSession", [], "portal_session_service.py"),
        ("DashboardService", "PtDashboard", "Dashboard", "dashboard", "DASHBOARD", "dashboard_number", "Dashboard", [], "dashboard_service.py"),
        ("DocumentAccessService", "PtDocumentAccess", "DocumentAccess", "document_access", "DOCUMENT_ACCESS", "access_number", "DocumentAccess", ["submit", "approve"], "document_access_service.py"),
        ("SupportTicketService", "PtSupportTicket", "SupportTicket", "support_ticket", "SUPPORT_TICKET", "ticket_number", "SupportTicket", ["submit"], "support_ticket_service.py"),
        ("ServiceRequestService", "PtServiceRequest", "ServiceRequest", "service_request", "SERVICE_REQUEST", "request_number", "ServiceRequest", ["submit"], "service_request_service.py"),
        ("DeviceService", "PtDevice", "Device", "device", "DEVICE", "device_number", "Device", [], "device_service.py"),
    ]'''

    text = re.sub(
        r"    simple_specs = \[.*?\]\n\n    for svc, cls, repo, entity, eng, fname in simple_specs:",
        simple_specs + "\n\n    for svc, cls, repo, entity, eng, fname in simple_specs:",
        text,
        count=1,
        flags=re.DOTALL,
    )
    text = re.sub(
        r"    numbered = \[.*?\]\n\n    for svc, cls, repo, entity, etype, col, eng, acts, fname in numbered:",
        numbered + "\n\n    for svc, cls, repo, entity, etype, col, eng, acts, fname in numbered:",
        text,
        count=1,
        flags=re.DOTALL,
    )

    # Fix notification acknowledge update fields
    text = text.replace(
        "return self._repo.update(ctx, row_id, delivery_status=row.delivery_status)",
        "return self._repo.update(ctx, row_id, delivery_status=row.delivery_status, status=row.status)",
    )

    # Integration service
    integration_svc = '''"""Customer Portal integration service using peer adapters (C-01 + UUID refs)."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.portal.adapters.analytics_port import PortalAnalyticsAdapter
from modules.portal.adapters.crm_port import PortalCrmAdapter
from modules.portal.adapters.document_port import PortalDocumentAdapter
from modules.portal.adapters.ecommerce_port import PortalEcommerceAdapter
from modules.portal.adapters.finance_port import PortalFinanceAdapter
from modules.portal.adapters.helpdesk_port import PortalHelpdeskAdapter
from modules.portal.adapters.integration_port import PortalIntegrationAdapter
from modules.portal.adapters.master_data_port import PortalMasterDataAdapter
from modules.portal.adapters.organization_port import PortalOrganizationAdapter
from modules.portal.adapters.sales_port import PortalSalesAdapter
from modules.portal.adapters.service_port import PortalServiceAdapter
from modules.portal.models import PtInvoiceView


class PortalIntegrationService:
    def __init__(self, db: Session) -> None:
        self._master = PortalMasterDataAdapter(db)
        self._org = PortalOrganizationAdapter(db)
        self._crm = PortalCrmAdapter(db)
        self._sales = PortalSalesAdapter(db)
        self._finance = PortalFinanceAdapter(db)
        self._document = PortalDocumentAdapter(db)
        self._helpdesk = PortalHelpdeskAdapter(db)
        self._service = PortalServiceAdapter(db)
        self._analytics = PortalAnalyticsAdapter(db)
        self._integration = PortalIntegrationAdapter(db)
        self._ecommerce = PortalEcommerceAdapter(db)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._master.get_employee(ctx, employee_id)

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._master.get_customer(ctx, customer_id)

    def get_product(self, ctx: TenantContext, product_id: UUID):
        return self._master.get_product(ctx, product_id)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        return self._org.get_department(ctx, department_id)

    def crm_party_ref(self, ctx: TenantContext, crm_party_ref_id: UUID | None) -> UUID | None:
        return self._crm.resolve_party_ref(ctx, crm_party_ref_id)

    def sales_order_ref(self, ctx: TenantContext, sales_order_id: UUID | None) -> UUID | None:
        return self._sales.resolve_sales_order_ref(ctx, sales_order_id)

    def finance_invoice_ref(self, ctx: TenantContext, finance_invoice_id: UUID | None) -> UUID | None:
        return self._finance.resolve_invoice_ref(ctx, finance_invoice_id)

    def document_ref(self, ctx: TenantContext, document_id: UUID | None) -> UUID | None:
        return self._document.resolve_document_uuid(document_id)

    def helpdesk_ticket_ref(self, ctx: TenantContext, helpdesk_ticket_id: UUID | None) -> UUID | None:
        return self._helpdesk.resolve_ticket_ref(ctx, helpdesk_ticket_id)

    def service_request_ref(self, ctx: TenantContext, service_request_id: UUID | None) -> UUID | None:
        return self._service.resolve_request_ref(ctx, service_request_id)

    def analytics_report_ref(self, ctx: TenantContext, bi_report_ref_id: UUID | None) -> UUID | None:
        return self._analytics.resolve_report_ref(ctx, bi_report_ref_id)

    def integration_connector_ref(self, ctx: TenantContext, int_connector_id: UUID | None) -> UUID | None:
        return self._integration.resolve_connector_ref(ctx, int_connector_id)

    def ecommerce_order_ref(self, ctx: TenantContext, ec_order_id: UUID | None) -> UUID | None:
        return self._ecommerce.resolve_order_ref(ctx, ec_order_id)

    def post_portal_fee(
        self,
        ctx: TenantContext,
        row: PtInvoiceView,
        *,
        amount: Decimal,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        return self._finance.post_portal_fee(
            ctx,
            row,
            amount=amount,
            debit_account_id=debit_account_id,
            credit_account_id=credit_account_id,
            fiscal_year_id=fiscal_year_id,
        )
'''

    text = patch_between(
        text,
        '        \'\'\'"""Customer Portal integration service using peer adapters (C-01 + UUID refs)."""',
        "''',\n    )\n\n    svc_imports = ",
        f"        '''{integration_svc}''',\n    )\n\n    svc_imports = ",
    )

    svc_imports = '''svc_imports = """from modules.portal.service.customer_profile_service import CustomerProfileService
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
from modules.portal.service.support_ticket_service import SupportTicketService"""'''

    text = re.sub(r'svc_imports = """.*?"""', svc_imports, text, count=1, flags=re.DOTALL)

    app_svc = '''class PortalApplicationService:
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
        self.integration = PortalIntegrationService(db)'''

    text = re.sub(r"class PortalApplicationService:.*?(?=\n''',)", app_svc, text, count=1, flags=re.DOTALL)

    svc_init = '''__all__ = [
    "CustomerProfileService",
    "DashboardService",
    "DashboardWidgetService",
    "DeviceService",
    "DocumentAccessService",
    "DownloadHistoryService",
    "InvoiceViewService",
    "LoginAuditService",
    "MessageService",
    "MessageThreadService",
    "NotificationService",
    "OrderViewService",
    "PortalAccountService",
    "PortalApplicationService",
    "PortalIntegrationService",
    "PortalReportService",
    "PortalSessionService",
    "PreferenceService",
    "SavedReportService",
    "SavedSearchService",
    "ServiceRequestService",
    "SupportTicketService",
]'''

    text = re.sub(r"__all__ = \[.*?\]", svc_init, text, count=1, flags=re.DOTALL)

    # gen_permissions
    text = re.sub(
        r"(PORTAL / \"permissions.py\",\n        '''\"\"\"Customer Portal permission constants per ERD_23 section 10\.\"\"\"\n\n).*?(\n''',\n    \)\n\n\n\ndef gen_api)",
        r"\1" + PERMISSIONS_PY + r"\2",
        text,
        count=1,
        flags=re.DOTALL,
    )

    # route_actions
    route_actions = '''    route_actions: dict[str, list[tuple[str, str]]] = {
        "portal-accounts": [
            ("submit", "portal.account:submit"),
            ("approve", "portal.account:approve"),
        ],
        "customer-profiles": [
            ("submit", "portal.profile:submit"),
            ("approve", "portal.profile:approve"),
        ],
        "document-accesses": [
            ("submit", "portal.document_access:submit"),
            ("approve", "portal.document_access:approve"),
        ],
        "support-tickets": [
            ("submit", "portal.support_ticket:submit"),
        ],
        "service-requests": [
            ("submit", "portal.service_request:submit"),
        ],
        "notifications": [
            ("acknowledge", "portal.notification:acknowledge"),
        ],
    }'''

    text = re.sub(
        r"    route_actions: dict\[str, list\[tuple\[str, str\]\]\] = \{.*?\}\n",
        route_actions + "\n",
        text,
        count=1,
        flags=re.DOTALL,
    )

    # Router tags
    text = text.replace('tags=["Customer Portal — {name}"]', 'tags=["Portal — {name}"]')

    # gen_seeds permissions file
    text = text.replace('ALEMBIC / "0419_seed_ec_permissions.py"', 'ALEMBIC / "0441_seed_pt_permissions.py"')
    text = text.replace('revision: str = "0419_seed_ec_permissions"', 'revision: str = "0441_seed_pt_permissions"')
    text = text.replace('down_revision: str | None = "0418_ec_report"', 'down_revision: str | None = "0440_pt_report"')
    text = text.replace(
        "from modules.portal.permissions import (\n    MARKETPLACE_MANAGER_PERMISSIONS,\n    PORTAL_ADMIN_PERMISSIONS,\n    PORTAL_MANAGER_PERMISSIONS,\n    PORTAL_PERMISSIONS,\n    STORE_OPERATOR_PERMISSIONS,\n)",
        "from modules.portal.permissions import (\n    CUSTOMER_USER_PERMISSIONS,\n    PORTAL_ADMIN_PERMISSIONS,\n    PORTAL_MANAGER_PERMISSIONS,\n    PORTAL_PERMISSIONS,\n    SUPPORT_USER_PERMISSIONS,\n)",
    )
    text = text.replace(
        '''ROLE_SPECS: list[tuple[str, str, list[str]]] = [
    ("PORTAL_ADMIN", "Customer Portal Admin", PORTAL_ADMIN_PERMISSIONS),
    ("PORTAL_MANAGER", "Customer Portal Manager", PORTAL_MANAGER_PERMISSIONS),
    ("MARKETPLACE_MANAGER", "Marketplace Manager", MARKETPLACE_MANAGER_PERMISSIONS),
    ("STORE_OPERATOR", "Store Operator", STORE_OPERATOR_PERMISSIONS),
]''',
        '''ROLE_SPECS: list[tuple[str, str, list[str]]] = [
    ("PORTAL_ADMIN", "Portal Admin", PORTAL_ADMIN_PERMISSIONS),
    ("PORTAL_MANAGER", "Portal Manager", PORTAL_MANAGER_PERMISSIONS),
    ("CUSTOMER_USER", "Customer User", CUSTOMER_USER_PERMISSIONS),
    ("SUPPORT_USER", "Support User", SUPPORT_USER_PERMISSIONS),
]''',
    )

    # workflow seed
    text = text.replace('ALEMBIC / "0420_seed_portal_workflows.py"', 'ALEMBIC / "0442_seed_portal_workflows.py"')
    text = text.replace('revision: str = "0420_seed_portal_workflows"', 'revision: str = "0442_seed_portal_workflows"')
    text = text.replace('down_revision: str | None = "0419_seed_ec_permissions"', 'down_revision: str | None = "0441_seed_pt_permissions"')

    workflows = '''WORKFLOWS: list[tuple[str, str, str, list[tuple[int, str, str, str]]]] = [
    (
        "PT_ACCOUNT_APPROVAL",
        "Portal Account Approval",
        "pt_portal_account",
        [
            (1, "SUPPORT_USER", "Support User Submit", "role"),
            (2, "PORTAL_MANAGER", "Portal Manager Approval", "role"),
            (3, "PORTAL_ADMIN", "Portal Admin Approval", "role"),
        ],
    ),
    (
        "PT_PROFILE_APPROVAL",
        "Customer Profile Approval",
        "pt_customer_profile",
        [
            (1, "CUSTOMER_USER", "Customer User Submit", "role"),
            (2, "PORTAL_MANAGER", "Portal Manager Approval", "role"),
            (3, "PORTAL_ADMIN", "Portal Admin Approval", "role"),
        ],
    ),
    (
        "PT_DOCUMENT_ACCESS",
        "Document Access Approval",
        "pt_document_access",
        [
            (1, "SUPPORT_USER", "Support User Submit", "role"),
            (2, "PORTAL_MANAGER", "Portal Manager Approval", "role"),
            (3, "PORTAL_ADMIN", "Portal Admin Approval", "role"),
        ],
    ),
    (
        "PT_SUPPORT_REQUEST",
        "Support Request Approval",
        "pt_support_ticket",
        [
            (1, "CUSTOMER_USER", "Customer User Submit", "role"),
            (2, "SUPPORT_USER", "Support User Triage", "role"),
            (3, "PORTAL_MANAGER", "Portal Manager Review", "role"),
        ],
    ),
    (
        "PT_SERVICE_REQUEST",
        "Service Request Approval",
        "pt_service_request",
        [
            (1, "CUSTOMER_USER", "Customer User Submit", "role"),
            (2, "SUPPORT_USER", "Support User Triage", "role"),
            (3, "PORTAL_MANAGER", "Portal Manager Review", "role"),
        ],
    ),
]'''

    text = re.sub(
        r"WORKFLOWS: list\[tuple\[str, str, str, list\[tuple\[int, str, str, str\]\]\]\] = \[.*?\]\n\]",
        workflows,
        text,
        count=1,
        flags=re.DOTALL,
    )
    text = text.replace("VALUES (:id, :tid, :code, :name, 'integration', :doc, 1, true, :now, :now)", "VALUES (:id, :tid, :code, :name, 'portal', :doc, 1, true, :now, :now)")

    # gen_wiring after ecommerce
    text = text.replace(
        '''    patch_file(
        SHARED / "router.py",
        "from modules.integration.router import integration_router\\n",
        "from modules.integration.router import integration_router\\n"
        "from modules.portal.router import portal_router\\n",
    )
    patch_file(
        SHARED / "router.py",
        "api_v1_router.include_router(integration_router)\\n",
        "api_v1_router.include_router(integration_router)\\n"
        "api_v1_router.include_router(portal_router)\\n",
    )
    patch_file(
        ROOT / "alembic" / "env.py",
        "import modules.integration.models  # noqa: F401 — register ORM metadata\\n",
        "import modules.integration.models  # noqa: F401 — register ORM metadata\\n"
        "import modules.portal.models  # noqa: F401 — register ORM metadata\\n",
    )
    patch_file(
        ROOT / "src" / "workers" / "celery_app.py",
        '        "modules.integration",\\n',
        '        "modules.integration",\\n        "modules.portal",\\n',
    )
    patch_file(
        ROOT / "pyproject.toml",
        '    "modules.integration.*",\\n',
        '    "modules.integration.*",\\n    "modules.portal.*",\\n',
    )''',
        '''    patch_file(
        SHARED / "router.py",
        "from modules.ecommerce.router import ecommerce_router\\n",
        "from modules.ecommerce.router import ecommerce_router\\n"
        "from modules.portal.router import portal_router\\n",
    )
    patch_file(
        SHARED / "router.py",
        "api_v1_router.include_router(ecommerce_router)\\n",
        "api_v1_router.include_router(ecommerce_router)\\n"
        "api_v1_router.include_router(portal_router)\\n",
    )
    patch_file(
        ROOT / "alembic" / "env.py",
        "import modules.ecommerce.models  # noqa: F401 — register ORM metadata\\n",
        "import modules.ecommerce.models  # noqa: F401 — register ORM metadata\\n"
        "import modules.portal.models  # noqa: F401 — register ORM metadata\\n",
    )
    patch_file(
        ROOT / "src" / "workers" / "celery_app.py",
        '        "modules.ecommerce",\\n',
        '        "modules.ecommerce",\\n        "modules.portal",\\n',
    )
    patch_file(
        ROOT / "pyproject.toml",
        '    "modules.ecommerce.*",\\n',
        '    "modules.ecommerce.*",\\n    "modules.portal.*",\\n',
    )''',
    )

    ruff_old = '''    ruff_marker = (
        '"src/modules/integration/**" = ["E501", "SIM102"]\\n'
        '"src/modules/integration/domain/enums.py" = ["UP042"]\\n'
    )
    ruff_new = (
        ruff_marker
        + '"src/modules/portal/**" = ["E501", "SIM102"]\\n'
        + '"src/modules/portal/domain/enums.py" = ["UP042"]\\n'
    )'''

    ruff_new_block = '''    ruff_marker = (
        '"src/modules/ecommerce/**" = ["E501", "SIM102"]\\n'
        '"src/modules/ecommerce/domain/enums.py" = ["UP042"]\\n'
    )
    ruff_new = (
        ruff_marker
        + '"src/modules/portal/**" = ["E501", "SIM102"]\\n'
        + '"src/modules/portal/domain/enums.py" = ["UP042"]\\n'
    )'''

    text = text.replace(ruff_old, ruff_new_block)
    text = text.replace(
        'alt = \'"src/modules/integration/domain/enums.py" = ["UP042"]\\n\'',
        'alt = \'"src/modules/ecommerce/domain/enums.py" = ["UP042"]\\n\'',
    )

    # Remove resolve_company_id instance override if present
    text = re.sub(
        r"\n    def resolve_company_id\(self, ctx: TenantContext, company_id: UUID \| None\) -> UUID:\n        return PortalScopedRepository\.resolve_company_id\(ctx, company_id\)\n",
        "\n",
        text,
    )

    adapters_fn = '''def gen_adapters() -> None:
    w(
        PORTAL / "adapters" / "master_data_port.py",
        \'\'\'"""Master Data port — customer / employee / product (C-01)."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.service.customer_service import CustomerService
from modules.master_data.service.employee_service import EmployeeService
from modules.master_data.service.product_service import ProductService


class PortalMasterDataAdapter:
    def __init__(self, db: Session) -> None:
        self._customers = CustomerService(db)
        self._employees = EmployeeService(db)
        self._products = ProductService(db)

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._customers.get_customer(ctx, customer_id)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._employees.get_employee(ctx, employee_id)

    def get_product(self, ctx: TenantContext, product_id: UUID):
        return self._products.get_product(ctx, product_id)
\'\'\',
    )
    w(
        PORTAL / "adapters" / "organization_port.py",
        \'\'\'"""Organization port — read org_department only."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.hierarchy_repository import DepartmentRepository


class PortalOrganizationAdapter:
    def __init__(self, db: Session) -> None:
        self._departments = DepartmentRepository(db)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        row = self._departments.get_by_id(ctx, department_id)
        if row is None:
            raise NotFoundException("Department not found")
        return row
\'\'\',
    )
    w(
        PORTAL / "adapters" / "crm_port.py",
        \'\'\'"""CRM port — UUID-only stubs; no crm_* FK / ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalCrmAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_party_ref(self, ctx: TenantContext, crm_party_ref_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return crm_party_ref_id
\'\'\',
    )
    w(
        PORTAL / "adapters" / "sales_port.py",
        \'\'\'"""Sales port — order authority via service; UUID refs only."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalSalesAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_sales_order_ref(self, ctx: TenantContext, sales_order_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return sales_order_id
\'\'\',
    )
    w(
        PORTAL / "adapters" / "finance_port.py",
        \'\'\'"""Finance port — PostingService.post_system_journal only; store finance_journal_id."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.finance.domain.enums import JournalType
from modules.finance.service.journal_service import JournalService
from modules.finance.service.posting_service import PostingService
from modules.foundation.domain.value_objects import TenantContext
from modules.portal.models import PtInvoiceView


class PortalFinanceAdapter:
    def __init__(self, db: Session) -> None:
        self._journals = JournalService(db)
        self._posting = PostingService(db)

    def resolve_invoice_ref(self, ctx: TenantContext, finance_invoice_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db if hasattr(self, "_db") else None)
        return finance_invoice_id

    def post_portal_fee(
        self,
        ctx: TenantContext,
        row: PtInvoiceView,
        *,
        amount: Decimal,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        amount = amount.quantize(Decimal("0.0001"))
        resolved_branch_id = row.branch_id if hasattr(row, "branch_id") else ctx.branch_id
        if resolved_branch_id is None:
            msg = "branch_id is required for portal finance posting"
            raise ValueError(msg)
        journal = self._journals.create_journal(
            ctx,
            company_id=row.company_id,
            branch_id=resolved_branch_id,
            journal_date=date.today(),
            description=f"Portal fee {row.view_number}",
            journal_type=JournalType.SYSTEM.value,
            fiscal_year_id=fiscal_year_id,
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=1,
            account_id=debit_account_id,
            debit_amount=float(amount),
            credit_amount=0,
            description="Portal fee debit",
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=2,
            account_id=credit_account_id,
            debit_amount=0,
            credit_amount=float(amount),
            description="Portal fee credit",
        )
        self._posting.post_system_journal(ctx, journal.id)
        return journal.id
\'\'\',
    )
    w(
        PORTAL / "adapters" / "document_port.py",
        \'\'\'"""Document port — UUID-only stubs; no doc_* FK / ORM writes."""

from uuid import UUID


class PortalDocumentAdapter:
    def resolve_document_uuid(self, document_id: UUID | None) -> UUID | None:
        return document_id
\'\'\',
    )
    w(
        PORTAL / "adapters" / "helpdesk_port.py",
        \'\'\'"""Helpdesk port — UUID-only stubs; no hd_* FK / ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalHelpdeskAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_ticket_ref(self, ctx: TenantContext, helpdesk_ticket_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return helpdesk_ticket_id
\'\'\',
    )
    w(
        PORTAL / "adapters" / "service_port.py",
        \'\'\'"""Service port — UUID-only stubs; no svc_* FK / ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalServiceAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_request_ref(self, ctx: TenantContext, service_request_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return service_request_id
\'\'\',
    )
    w(
        PORTAL / "adapters" / "analytics_port.py",
        \'\'\'"""Analytics port — read-only UUID refs."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalAnalyticsAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_report_ref(self, ctx: TenantContext, bi_report_ref_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return bi_report_ref_id
\'\'\',
    )
    w(
        PORTAL / "adapters" / "integration_port.py",
        \'\'\'"""Integration Hub port — connector UUID refs only."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalIntegrationAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_connector_ref(self, ctx: TenantContext, int_connector_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return int_connector_id
\'\'\',
    )
    w(
        PORTAL / "adapters" / "ecommerce_port.py",
        \'\'\'"""E-Commerce port — optional channel order UUID refs only."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalEcommerceAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_order_ref(self, ctx: TenantContext, ec_order_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return ec_order_id
\'\'\',
    )
    w(PORTAL / "adapters" / "__init__.py", \'\'\'"""Customer Portal peer adapters."""\n\'\'\')
'''

    text = re.sub(r"def gen_adapters\(\) -> None:.*?def gen_permissions\(\)", adapters_fn + "\n\n\ndef gen_permissions()", text, count=1, flags=re.DOTALL)

    tasks_fn = '''def gen_tasks_tests() -> None:
    w(
        PORTAL / "tasks.py",
        \'\'\'"""Customer Portal Celery task stubs per ERD_23 section 11."""

from workers.celery_app import celery_app


@celery_app.task(name="portal.session_expiry_sweeper")
def session_expiry_sweeper() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.portal.models import PtPortalSession

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(PtPortalSession).where(
                    PtPortalSession.is_deleted.is_(False),
                    PtPortalSession.status == "active",
                )
            ).all()
        )
        return {"status": "ok", "active_sessions": len(rows)}
    finally:
        db.close()


@celery_app.task(name="portal.order_view_sync")
def order_view_sync() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.portal.models import PtOrderView

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(PtOrderView).where(
                    PtOrderView.is_deleted.is_(False),
                    PtOrderView.status.in_(["visible", "stale"]),
                )
            ).all()
        )
        return {"status": "ok", "order_views": len(rows)}
    finally:
        db.close()


@celery_app.task(name="portal.invoice_view_sync")
def invoice_view_sync() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.portal.models import PtInvoiceView

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(PtInvoiceView).where(
                    PtInvoiceView.is_deleted.is_(False),
                    PtInvoiceView.status.in_(["visible", "stale"]),
                )
            ).all()
        )
        return {"status": "ok", "invoice_views": len(rows)}
    finally:
        db.close()


@celery_app.task(name="portal.notification_dispatcher")
def notification_dispatcher() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.portal.models import PtNotification

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(PtNotification).where(
                    PtNotification.is_deleted.is_(False),
                    PtNotification.delivery_status == "pending",
                )
            ).all()
        )
        return {"status": "ok", "pending_notifications": len(rows)}
    finally:
        db.close()


@celery_app.task(name="portal.login_audit_retention")
def login_audit_retention() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.portal.models import PtLoginAudit

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(PtLoginAudit).where(
                    PtLoginAudit.is_deleted.is_(False),
                    PtLoginAudit.status == "recorded",
                )
            ).all()
        )
        return {"status": "ok", "audit_rows": len(rows)}
    finally:
        db.close()


@celery_app.task(name="portal.ticket_status_poller")
def ticket_status_poller() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.portal.models import PtSupportTicket

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(PtSupportTicket).where(
                    PtSupportTicket.is_deleted.is_(False),
                    PtSupportTicket.status.in_(["submitted", "open", "in_progress", "waiting"]),
                )
            ).all()
        )
        return {"status": "ok", "tickets_to_poll": len(rows)}
    finally:
        db.close()

\'\'\',
    )

    w(
        TESTS / "unit" / "portal" / "test_pt_hub_engines.py",
        \'\'\'"""Unit tests for Customer Portal engines."""

from types import SimpleNamespace

from modules.portal.service.engines import (
    CustomerProfileEngine,
    DocumentAccessEngine,
    PortalAccountEngine,
    SupportTicketEngine,
)


def test_portal_account_lifecycle():
    row = SimpleNamespace(status="draft")
    eng = PortalAccountEngine()
    eng.submit(row)
    assert row.status == "submitted"
    eng.approve(row)
    assert row.status == "approved"


def test_customer_profile_lifecycle():
    row = SimpleNamespace(status="draft")
    eng = CustomerProfileEngine()
    eng.submit(row)
    eng.approve(row)
    assert row.status == "approved"


def test_document_access_lifecycle():
    row = SimpleNamespace(status="draft")
    eng = DocumentAccessEngine()
    eng.submit(row)
    eng.approve(row)
    assert row.status == "approved"


def test_support_ticket_submit():
    row = SimpleNamespace(status="draft")
    eng = SupportTicketEngine()
    eng.submit(row)
    assert row.status == "submitted"
\'\'\',
    )
    w(
        TESTS / "unit" / "portal" / "test_pt_hub_tasks.py",
        \'\'\'"""Unit tests for Customer Portal Celery task names."""

from modules.portal import tasks


def test_portal_task_names_registered():
    assert tasks.session_expiry_sweeper.name == "portal.session_expiry_sweeper"
    assert tasks.order_view_sync.name == "portal.order_view_sync"
    assert tasks.invoice_view_sync.name == "portal.invoice_view_sync"
    assert tasks.notification_dispatcher.name == "portal.notification_dispatcher"
    assert tasks.login_audit_retention.name == "portal.login_audit_retention"
    assert tasks.ticket_status_poller.name == "portal.ticket_status_poller"
\'\'\',
    )
    w(
        TESTS / "security" / "portal" / "test_pt_hub_permissions.py",
        \'\'\'"""Security tests for Customer Portal permissions."""

from modules.portal.permissions import (
    CUSTOMER_USER_PERMISSIONS,
    PORTAL_ADMIN_PERMISSIONS,
    PORTAL_MANAGER_PERMISSIONS,
    PORTAL_PERMISSIONS,
    SUPPORT_USER_PERMISSIONS,
)


def test_portal_permissions_defined():
    codes = [p[0] for p in PORTAL_PERMISSIONS]
    assert "portal.account:approve" in codes
    assert "portal.document_access:submit" in codes
    assert "portal.support_ticket:submit" in codes


def test_portal_roles():
    assert len(PORTAL_ADMIN_PERMISSIONS) == len(PORTAL_PERMISSIONS)
    assert any("portal.dashboard" in p for p in CUSTOMER_USER_PERMISSIONS)
    assert any("portal.support_ticket" in p for p in SUPPORT_USER_PERMISSIONS)
    assert any("portal.account" in p for p in PORTAL_MANAGER_PERMISSIONS)
\'\'\',
    )
    w(
        TESTS / "integration" / "portal" / "test_pt_hub_module_import.py",
        \'\'\'"""Customer Portal module import smoke tests."""

from modules.portal.models import PtPortalAccount, PtCustomerProfile, PtOrderView
from modules.portal.router import portal_router
from modules.portal.service import (
    PortalAccountService,
    CustomerProfileService,
    OrderViewService,
    PortalApplicationService,
    PortalIntegrationService,
)
from modules.portal.service.engines import PortalAccountEngine, CustomerProfileEngine


def test_portal_models_importable():
    assert PtPortalAccount is not None
    assert PtCustomerProfile is not None
    assert PtOrderView is not None


def test_portal_router_mounted():
    assert portal_router.prefix == "/portal"
    assert len(portal_router.routes) > 0


def test_portal_services_and_engines_importable():
    assert PortalAccountService is not None
    assert CustomerProfileService is not None
    assert OrderViewService is not None
    assert PortalApplicationService is not None
    assert PortalIntegrationService is not None
    assert PortalAccountEngine is not None
    assert CustomerProfileEngine is not None
\'\'\',
    )
'''

    text = re.sub(r"def gen_tasks_tests\(\) -> None:.*?def gen_seeds\(\)", tasks_fn + "\n\n\ndef gen_seeds()", text, count=1, flags=re.DOTALL)

    GEN.write_text(text, encoding="utf-8")
    print("finalized portal generator")


if __name__ == "__main__":
    main()
