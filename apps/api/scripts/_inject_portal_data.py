"""Inject portal-specific data into _gen_portal_module.py."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT / "scripts" / "_gen_portal_module.py"

TABLES_BLOCK = '''# table_key, ORM class, stem, branch_scoped
TABLES: list[tuple[str, str, str, bool]] = [
    ("portal_account", "PtPortalAccount", "PortalAccount", False),
    ("customer_profile", "PtCustomerProfile", "CustomerProfile", False),
    ("portal_session", "PtPortalSession", "PortalSession", False),
    ("dashboard", "PtDashboard", "Dashboard", False),
    ("dashboard_widget", "PtDashboardWidget", "DashboardWidget", False),
    ("notification", "PtNotification", "Notification", False),
    ("message_thread", "PtMessageThread", "MessageThread", False),
    ("message", "PtMessage", "Message", False),
    ("order_view", "PtOrderView", "OrderView", False),
    ("invoice_view", "PtInvoiceView", "InvoiceView", False),
    ("document_access", "PtDocumentAccess", "DocumentAccess", False),
    ("support_ticket", "PtSupportTicket", "SupportTicket", False),
    ("service_request", "PtServiceRequest", "ServiceRequest", False),
    ("download_history", "PtDownloadHistory", "DownloadHistory", False),
    ("saved_report", "PtSavedReport", "SavedReport", False),
    ("saved_search", "PtSavedSearch", "SavedSearch", False),
    ("preference", "PtPreference", "Preference", False),
    ("device", "PtDevice", "Device", False),
    ("login_audit", "PtLoginAudit", "LoginAudit", False),
    ("report", "PtReport", "PortalReport", False),
]'''

MIGRATIONS_BLOCK = '''MIGRATIONS: list[tuple[str, str | list[str], str]] = [
    ("0421_create_portal_schema", "schema", "0420_seed_ecommerce_workflows"),
    ("0422_pt_portal_account", "portal_account", "0421_create_portal_schema"),
    ("0423_pt_customer_profile", "customer_profile", "0422_pt_portal_account"),
    ("0424_pt_portal_session", "portal_session", "0423_pt_customer_profile"),
    ("0425_pt_dashboard", "dashboard", "0424_pt_portal_session"),
    ("0426_pt_dashboard_widget", "dashboard_widget", "0425_pt_dashboard"),
    ("0427_pt_notification", "notification", "0426_pt_dashboard_widget"),
    ("0428_pt_thread_and_message", ["message_thread", "message"], "0427_pt_notification"),
    ("0429_pt_order_view", "order_view", "0428_pt_thread_and_message"),
    ("0430_pt_invoice_view", "invoice_view", "0429_pt_order_view"),
    ("0431_pt_document_access", "document_access", "0430_pt_invoice_view"),
    ("0432_pt_support_ticket", "support_ticket", "0431_pt_document_access"),
    ("0433_pt_service_request", "service_request", "0432_pt_support_ticket"),
    ("0434_pt_download_history", "download_history", "0433_pt_service_request"),
    ("0435_pt_saved_report", "saved_report", "0434_pt_download_history"),
    ("0436_pt_saved_search", "saved_search", "0435_pt_saved_report"),
    ("0437_pt_preference", "preference", "0436_pt_saved_search"),
    ("0438_pt_device", "device", "0437_pt_preference"),
    ("0439_pt_login_audit", "login_audit", "0438_pt_device"),
    ("0440_pt_report", "report", "0439_pt_login_audit"),
    ("0441_seed_pt_permissions", "seed_perms", "0440_pt_report"),
    ("0442_seed_portal_workflows", "seed_wf", "0441_seed_pt_permissions"),
]'''

ROUTE_SPECS_BLOCK = '''# route prefix, schema name, service class, perm resource, branch_required
ROUTE_SPECS: list[tuple[str, str, str, str, bool]] = [
    ("portal-accounts", "PortalAccount", "PortalAccountService", "portal.account", False),
    ("customer-profiles", "CustomerProfile", "CustomerProfileService", "portal.profile", False),
    ("portal-sessions", "PortalSession", "PortalSessionService", "portal.session", False),
    ("dashboards", "Dashboard", "DashboardService", "portal.dashboard", False),
    ("dashboard-widgets", "DashboardWidget", "DashboardWidgetService", "portal.widget", False),
    ("notifications", "Notification", "NotificationService", "portal.notification", False),
    ("message-threads", "MessageThread", "MessageThreadService", "portal.thread", False),
    ("messages", "Message", "MessageService", "portal.message", False),
    ("order-views", "OrderView", "OrderViewService", "portal.order_view", False),
    ("invoice-views", "InvoiceView", "InvoiceViewService", "portal.invoice_view", False),
    ("document-accesses", "DocumentAccess", "DocumentAccessService", "portal.document_access", False),
    ("support-tickets", "SupportTicket", "SupportTicketService", "portal.support_ticket", False),
    ("service-requests", "ServiceRequest", "ServiceRequestService", "portal.service_request", False),
    ("download-histories", "DownloadHistory", "DownloadHistoryService", "portal.download", False),
    ("saved-reports", "SavedReport", "SavedReportService", "portal.saved_report", False),
    ("saved-searches", "SavedSearch", "SavedSearchService", "portal.saved_search", False),
    ("preferences", "Preference", "PreferenceService", "portal.preference", False),
    ("devices", "Device", "DeviceService", "portal.device", False),
    ("login-audits", "LoginAudit", "LoginAuditService", "portal.login_audit", False),
    ("reports", "PortalReport", "PortalReportService", "portal.report", False),
]'''

ENGINE_NAMES_BLOCK = '''ENGINE_NAMES = [
    "PortalAccount",
    "CustomerProfile",
    "PortalSession",
    "Dashboard",
    "DashboardWidget",
    "Notification",
    "MessageThread",
    "Message",
    "OrderView",
    "InvoiceView",
    "DocumentAccess",
    "SupportTicket",
    "ServiceRequest",
    "DownloadHistory",
    "SavedReport",
    "SavedSearch",
    "Preference",
    "Device",
    "LoginAudit",
    "PortalReport",
]'''

ENGINE_FILE_MAP_BLOCK = '''ENGINE_FILE_MAP = {
    "PortalAccount": "portal_account",
    "CustomerProfile": "customer_profile",
    "PortalSession": "portal_session",
    "Dashboard": "dashboard",
    "DashboardWidget": "dashboard_widget",
    "Notification": "notification",
    "MessageThread": "message_thread",
    "Message": "message",
    "OrderView": "order_view",
    "InvoiceView": "invoice_view",
    "DocumentAccess": "document_access",
    "SupportTicket": "support_ticket",
    "ServiceRequest": "service_request",
    "DownloadHistory": "download_history",
    "SavedReport": "saved_report",
    "SavedSearch": "saved_search",
    "Preference": "preference",
    "Device": "device",
    "LoginAudit": "login_audit",
    "PortalReport": "report",
}'''


def _fk(col: str, table: str, *, nullable: bool = True, ondelete: str = "SET NULL") -> str:
    null = "True" if nullable else "False"
    mapped = "UUID | None" if nullable else "UUID"
    return f'''
    {col}: Mapped[{mapped}] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "{table}",
            ondelete="{ondelete}",
        ),
        nullable={null},
        index=True,
    )'''


def _emp_fk(col: str, nullable: bool = True) -> str:
    null = "True" if nullable else "False"
    mapped = "UUID | None" if nullable else "UUID"
    return f'''
    {col}: Mapped[{mapped}] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable={null},
        index=True,
    )'''


def _dept_fk(col: str = "department_id", nullable: bool = True) -> str:
    null = "True" if nullable else "False"
    mapped = "UUID | None" if nullable else "UUID"
    return f'''
    {col}: Mapped[{mapped}] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable={null},
        index=True,
    )'''


def _customer_fk(col: str = "customer_id", nullable: bool = True) -> str:
    null = "True" if nullable else "False"
    mapped = "UUID | None" if nullable else "UUID"
    return f'''
    {col}: Mapped[{mapped}] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable={null},
        index=True,
    )'''


def _product_fk(col: str = "product_id", nullable: bool = True) -> str:
    null = "True" if nullable else "False"
    mapped = "UUID | None" if nullable else "UUID"
    return f'''
    {col}: Mapped[{mapped}] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable={null},
        index=True,
    )'''


def _uuid_only(col: str) -> str:
    return f'''
    {col}: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)'''


WF = '''
    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
'''

MODELS: dict[str, str] = {}

MODELS["portal_account"] = f'''"""Portal account ORM per ERD_23 section 5.1."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtPortalAccount(Base, *PtRowMixin):
    __tablename__ = "pt_portal_account"
    __table_args__ = (
        UniqueConstraint("company_id", "account_number", name="uk_pt_portal_account_number"),
        UniqueConstraint("company_id", "login_email", name="uk_pt_portal_account_login_email"),
        CheckConstraint(
            "status IN ('draft','submitted','approved','active','locked','suspended','retired')",
            name="ck_pt_portal_account_status",
        ),
        Index("ix_pt_portal_account_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    account_number: Mapped[str] = mapped_column(String(50), nullable=False)
    login_email: Mapped[str] = mapped_column(String(255), nullable=False)
{_customer_fk("customer_id", nullable=False)}
{_uuid_only("customer_profile_id")}
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    credential_vault_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{_emp_fk("owner_employee_id")}
{_dept_fk()}
{WF}'''

MODELS["customer_profile"] = f'''"""Customer profile ORM per ERD_23 section 5.2."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtCustomerProfile(Base, *PtRowMixin):
    __tablename__ = "pt_customer_profile"
    __table_args__ = (
        UniqueConstraint("company_id", "profile_number", name="uk_pt_customer_profile_number"),
        CheckConstraint(
            "status IN ('draft','submitted','approved','active','inactive')",
            name="ck_pt_customer_profile_status",
        ),
        Index("ix_pt_customer_profile_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    profile_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_customer_fk("customer_id", nullable=False)}
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    preferred_language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    billing_contact_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    shipping_contact_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
{_uuid_only("crm_party_ref_id")}
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF}'''

MODELS["portal_session"] = f'''"""Portal session ORM per ERD_23 section 5.3."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtPortalSession(Base, *PtRowMixin):
    __tablename__ = "pt_portal_session"
    __table_args__ = (
        UniqueConstraint("company_id", "session_number", name="uk_pt_portal_session_number"),
        CheckConstraint(
            "status IN ('active','expired','revoked')",
            name="ck_pt_portal_session_status",
        ),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_fk("portal_account_id", "portal.pt_portal_account.id", nullable=False, ondelete="RESTRICT")}
{_uuid_only("device_id")}
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)'''

MODELS["dashboard"] = f'''"""Dashboard ORM per ERD_23 section 5.4."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtDashboard(Base, *PtRowMixin):
    __tablename__ = "pt_dashboard"
    __table_args__ = (
        UniqueConstraint("company_id", "dashboard_number", name="uk_pt_dashboard_number"),
        CheckConstraint(
            "status IN ('draft','active','archived')",
            name="ck_pt_dashboard_status",
        ),
        Index("ix_pt_dashboard_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    dashboard_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_fk("portal_account_id", "portal.pt_portal_account.id", nullable=False, ondelete="RESTRICT")}
    dashboard_code: Mapped[str] = mapped_column(String(50), nullable=False)
    dashboard_name: Mapped[str] = mapped_column(String(255), nullable=False)
    layout_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)'''

MODELS["dashboard_widget"] = f'''"""Dashboard widget ORM per ERD_23 section 5.5."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtDashboardWidget(Base, *PtRowMixin):
    __tablename__ = "pt_dashboard_widget"
    __table_args__ = (
        CheckConstraint(
            "widget_type IN ('order_summary','invoice_summary','ticket_status','service_status',"
            "'document_list','notification_feed','custom')",
            name="ck_pt_dashboard_widget_type",
        ),
        CheckConstraint(
            "status IN ('active','hidden')",
            name="ck_pt_dashboard_widget_status",
        ),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{_fk("dashboard_id", "portal.pt_dashboard.id", nullable=False, ondelete="RESTRICT")}
    widget_type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    config_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)'''

MODELS["notification"] = f'''"""Notification ORM per ERD_23 section 5.6."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtNotification(Base, *PtRowMixin):
    __tablename__ = "pt_notification"
    __table_args__ = (
        CheckConstraint(
            "notification_type IN ('order_update','invoice_ready','document_shared','ticket_update',"
            "'service_update','message','system')",
            name="ck_pt_notification_type",
        ),
        CheckConstraint(
            "delivery_status IN ('pending','sent','failed','read')",
            name="ck_pt_notification_delivery_status",
        ),
        CheckConstraint(
            "status IN ('active','archived')",
            name="ck_pt_notification_status",
        ),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{_fk("portal_account_id", "portal.pt_portal_account.id", nullable=False, ondelete="RESTRICT")}
    notification_type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    related_entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    related_entity_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(nullable=True)
    delivery_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)'''

MODELS["message_thread"] = f'''"""Message thread ORM per ERD_23 section 5.8."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtMessageThread(Base, *PtRowMixin):
    __tablename__ = "pt_message_thread"
    __table_args__ = (
        UniqueConstraint("company_id", "thread_number", name="uk_pt_message_thread_number"),
        CheckConstraint(
            "related_entity_type IN ('support_ticket','service_request','order_view',"
            "'invoice_view','document_access','general')",
            name="ck_pt_message_thread_entity_type",
        ),
        CheckConstraint(
            "status IN ('open','waiting','closed')",
            name="ck_pt_message_thread_status",
        ),
        Index("ix_pt_message_thread_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    thread_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_fk("portal_account_id", "portal.pt_portal_account.id", nullable=False, ondelete="RESTRICT")}
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    related_entity_type: Mapped[str] = mapped_column(String(40), nullable=False, default="general")
    related_entity_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)'''

MODELS["message"] = f'''"""Message ORM per ERD_23 section 5.7."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtMessage(Base, *PtRowMixin):
    __tablename__ = "pt_message"
    __table_args__ = (
        UniqueConstraint("company_id", "message_number", name="uk_pt_message_number"),
        CheckConstraint(
            "status IN ('sent','delivered','read','deleted')",
            name="ck_pt_message_status",
        ),
        Index("ix_pt_message_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    message_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_fk("message_thread_id", "portal.pt_message_thread.id", nullable=False, ondelete="RESTRICT")}
{_fk("sender_account_id", "portal.pt_portal_account.id", nullable=True, ondelete="SET NULL")}
{_emp_fk("sender_employee_id")}
    body: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="sent", index=True)'''

# Continue with remaining models in the script output...
# I'll build MODELS_BLOCK as serialized Python source

def serialize_models() -> str:
    lines = ["MODELS: dict[str, str] = {}"]
    for key, body in MODELS.items():
        escaped = body.replace('"""', '\\"\\"\\"')
        lines.append(f'\nMODELS["{key}"] = f\'\'\'{body}\'\'\'')
    return "\n".join(lines)


# Build remaining models
MODELS["order_view"] = f'''"""Order view ORM per ERD_23 section 5.9."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtOrderView(Base, *PtRowMixin):
    __tablename__ = "pt_order_view"
    __table_args__ = (
        UniqueConstraint("company_id", "view_number", name="uk_pt_order_view_number"),
        CheckConstraint(
            "status IN ('visible','hidden','stale')",
            name="ck_pt_order_view_status",
        ),
        Index("ix_pt_order_view_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    view_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_fk("portal_account_id", "portal.pt_portal_account.id", nullable=False, ondelete="RESTRICT")}
{_customer_fk("customer_id", nullable=False)}
{_uuid_only("sales_order_id")}
{_uuid_only("ec_order_id")}
    order_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    order_status_text: Mapped[str | None] = mapped_column(String(100), nullable=True)
{_product_fk("product_id")}
    ordered_at: Mapped[datetime | None] = mapped_column(nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="visible", index=True)'''

MODELS["invoice_view"] = f'''"""Invoice view ORM per ERD_23 section 5.10."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtInvoiceView(Base, *PtRowMixin):
    __tablename__ = "pt_invoice_view"
    __table_args__ = (
        UniqueConstraint("company_id", "view_number", name="uk_pt_invoice_view_number"),
        CheckConstraint(
            "status IN ('visible','hidden','stale','paid_snapshot')",
            name="ck_pt_invoice_view_status",
        ),
        Index("ix_pt_invoice_view_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    view_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_fk("portal_account_id", "portal.pt_portal_account.id", nullable=False, ondelete="RESTRICT")}
{_customer_fk("customer_id", nullable=False)}
{_uuid_only("finance_invoice_id")}
{_uuid_only("sales_invoice_id")}
    invoice_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    amount_due: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(nullable=True)
{_uuid_only("finance_journal_id")}
    last_synced_at: Mapped[datetime | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="visible", index=True)'''

MODELS["document_access"] = f'''"""Document access ORM per ERD_23 section 5.11."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtDocumentAccess(Base, *PtRowMixin):
    __tablename__ = "pt_document_access"
    __table_args__ = (
        UniqueConstraint("company_id", "access_number", name="uk_pt_document_access_number"),
        CheckConstraint(
            "access_level IN ('view','download')",
            name="ck_pt_document_access_level",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','active','revoked','expired')",
            name="ck_pt_document_access_status",
        ),
        Index("ix_pt_document_access_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    access_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_fk("portal_account_id", "portal.pt_portal_account.id", nullable=False, ondelete="RESTRICT")}
{_uuid_only("document_id")}
    access_level: Mapped[str] = mapped_column(String(30), nullable=False, default="view")
{_emp_fk("granted_by_employee_id", nullable=False)}
    granted_at: Mapped[datetime | None] = mapped_column(nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF}'''

MODELS["support_ticket"] = f'''"""Support ticket ORM per ERD_23 section 5.12."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtSupportTicket(Base, *PtRowMixin):
    __tablename__ = "pt_support_ticket"
    __table_args__ = (
        UniqueConstraint("company_id", "ticket_number", name="uk_pt_support_ticket_number"),
        CheckConstraint(
            "priority IN ('low','medium','high','urgent')",
            name="ck_pt_support_ticket_priority",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','open','in_progress','waiting','resolved','closed','cancelled')",
            name="ck_pt_support_ticket_status",
        ),
        Index("ix_pt_support_ticket_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    ticket_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_fk("portal_account_id", "portal.pt_portal_account.id", nullable=False, ondelete="RESTRICT")}
{_customer_fk("customer_id", nullable=False)}
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
{_uuid_only("helpdesk_ticket_id")}
{_emp_fk("assigned_employee_id")}
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF}'''

MODELS["service_request"] = f'''"""Service request ORM per ERD_23 section 5.13."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtServiceRequest(Base, *PtRowMixin):
    __tablename__ = "pt_service_request"
    __table_args__ = (
        UniqueConstraint("company_id", "request_number", name="uk_pt_service_request_number"),
        CheckConstraint(
            "request_type IN ('install','repair','visit','consultation','other')",
            name="ck_pt_service_request_type",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','accepted','scheduled','completed','cancelled')",
            name="ck_pt_service_request_status",
        ),
        Index("ix_pt_service_request_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    request_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_fk("portal_account_id", "portal.pt_portal_account.id", nullable=False, ondelete="RESTRICT")}
{_customer_fk("customer_id", nullable=False)}
    request_type: Mapped[str] = mapped_column(String(40), nullable=False, default="other")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
{_uuid_only("service_request_id")}
    preferred_slot_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF}'''

MODELS["download_history"] = f'''"""Download history ORM per ERD_23 section 5.14."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtDownloadHistory(Base, *PtRowMixin):
    __tablename__ = "pt_download_history"
    __table_args__ = (
        UniqueConstraint("company_id", "download_number", name="uk_pt_download_history_number"),
        CheckConstraint(
            "status IN ('recorded','failed')",
            name="ck_pt_download_history_status",
        ),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    download_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_fk("portal_account_id", "portal.pt_portal_account.id", nullable=False, ondelete="RESTRICT")}
{_fk("document_access_id", "portal.pt_document_access.id", nullable=False, ondelete="RESTRICT")}
{_uuid_only("document_id")}
    downloaded_at: Mapped[datetime | None] = mapped_column(nullable=True)
    bytes_transferred: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="recorded", index=True)'''

MODELS["saved_report"] = f'''"""Saved report ORM per ERD_23 section 5.15."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtSavedReport(Base, *PtRowMixin):
    __tablename__ = "pt_saved_report"
    __table_args__ = (
        UniqueConstraint("company_id", "saved_report_number", name="uk_pt_saved_report_number"),
        CheckConstraint(
            "source_type IN ('portal','analytics_ref')",
            name="ck_pt_saved_report_source_type",
        ),
        CheckConstraint(
            "status IN ('active','archived')",
            name="ck_pt_saved_report_status",
        ),
        Index("ix_pt_saved_report_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    saved_report_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_fk("portal_account_id", "portal.pt_portal_account.id", nullable=False, ondelete="RESTRICT")}
    report_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False, default="portal")
{_uuid_only("bi_report_ref_id")}
    definition_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)'''

MODELS["saved_search"] = f'''"""Saved search ORM per ERD_23 section 5.16."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtSavedSearch(Base, *PtRowMixin):
    __tablename__ = "pt_saved_search"
    __table_args__ = (
        UniqueConstraint("company_id", "saved_search_number", name="uk_pt_saved_search_number"),
        CheckConstraint(
            "entity_type IN ('order','invoice','document','ticket','service_request')",
            name="ck_pt_saved_search_entity_type",
        ),
        CheckConstraint(
            "status IN ('active','archived')",
            name="ck_pt_saved_search_status",
        ),
        Index("ix_pt_saved_search_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    saved_search_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_fk("portal_account_id", "portal.pt_portal_account.id", nullable=False, ondelete="RESTRICT")}
    search_name: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    query_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)'''

MODELS["preference"] = f'''"""Preference ORM per ERD_23 section 5.17."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtPreference(Base, *PtRowMixin):
    __tablename__ = "pt_preference"
    __table_args__ = (
        UniqueConstraint("portal_account_id", "preference_key", name="uk_pt_preference_key"),
        CheckConstraint(
            "status IN ('active',)",
            name="ck_pt_preference_status",
        ),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{_fk("portal_account_id", "portal.pt_portal_account.id", nullable=False, ondelete="RESTRICT")}
    preference_key: Mapped[str] = mapped_column(String(100), nullable=False)
    preference_value_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)'''

MODELS["device"] = f'''"""Device ORM per ERD_23 section 5.18."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtDevice(Base, *PtRowMixin):
    __tablename__ = "pt_device"
    __table_args__ = (
        UniqueConstraint("company_id", "device_number", name="uk_pt_device_number"),
        CheckConstraint(
            "status IN ('active','revoked')",
            name="ck_pt_device_status",
        ),
        Index("ix_pt_device_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    device_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_fk("portal_account_id", "portal.pt_portal_account.id", nullable=False, ondelete="RESTRICT")}
    device_fingerprint: Mapped[str] = mapped_column(String(255), nullable=False)
    device_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    platform: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(nullable=True)
    is_trusted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)'''

MODELS["login_audit"] = f'''"""Login audit ORM per ERD_23 section 5.19."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtLoginAudit(Base, *PtRowMixin):
    __tablename__ = "pt_login_audit"
    __table_args__ = (
        UniqueConstraint("company_id", "audit_number", name="uk_pt_login_audit_number"),
        CheckConstraint(
            "event_type IN ('login_success','login_failure','logout','lockout','password_reset')",
            name="ck_pt_login_audit_event_type",
        ),
        CheckConstraint(
            "status IN ('recorded',)",
            name="ck_pt_login_audit_status",
        ),
        Index("ix_pt_login_audit_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    audit_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_fk("portal_account_id", "portal.pt_portal_account.id", nullable=True, ondelete="SET NULL")}
{_fk("device_id", "portal.pt_device.id", nullable=True, ondelete="SET NULL")}
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    occurred_at: Mapped[datetime | None] = mapped_column(nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="recorded", index=True)'''

MODELS["report"] = f'''"""Portal report ORM per ERD_23 section 5.20."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtReport(Base, *PtRowMixin):
    __tablename__ = "pt_report"
    __table_args__ = (
        UniqueConstraint("company_id", "report_code", name="uk_pt_report_code"),
        CheckConstraint(
            "report_type IN ('active_users','login_failures','ticket_volume','service_volume',"
            "'document_downloads','session_metrics')",
            name="ck_pt_report_type",
        ),
        CheckConstraint(
            "status IN ('draft','finalized')",
            name="ck_pt_report_status",
        ),
        Index("ix_pt_report_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "portal"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    report_code: Mapped[str] = mapped_column(String(50), nullable=False)
    report_type: Mapped[str] = mapped_column(String(40), nullable=False)
    period_start: Mapped[date | None] = mapped_column(nullable=True)
    period_end: Mapped[date | None] = mapped_column(nullable=True)
    metrics_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)'''


def build_models_block() -> str:
    parts = ["MODELS: dict[str, str] = {}"]
    for key, body in MODELS.items():
        parts.append(f'\nMODELS["{key}"] = f\'\'\'{body}\'\'\'')
    return "\n".join(parts)


ENGINE_BODIES_BLOCK = '''ENGINE_BODIES: dict[str, str] = {
    "PortalAccount": """
class PortalAccountEngine:
    def submit(self, row) -> None:
        if row.status != PortalAccountStatus.DRAFT.value:
            raise InvalidPortalAccountState("Only draft accounts can be submitted")
        row.status = PortalAccountStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != PortalAccountStatus.SUBMITTED.value:
            raise InvalidPortalAccountState("Only submitted accounts can be approved")
        row.status = PortalAccountStatus.APPROVED.value
""",
    "CustomerProfile": """
class CustomerProfileEngine:
    def submit(self, row) -> None:
        if row.status != CustomerProfileStatus.DRAFT.value:
            raise InvalidCustomerProfileState("Only draft profiles can be submitted")
        row.status = CustomerProfileStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != CustomerProfileStatus.SUBMITTED.value:
            raise InvalidCustomerProfileState("Only submitted profiles can be approved")
        row.status = CustomerProfileStatus.APPROVED.value
""",
    "PortalSession": """
class PortalSessionEngine:
    def expire(self, row) -> None:
        row.status = PortalSessionStatus.EXPIRED.value

    def revoke(self, row) -> None:
        row.status = PortalSessionStatus.REVOKED.value
""",
    "Dashboard": """
class DashboardEngine:
    def activate(self, row) -> None:
        row.status = DashboardStatus.ACTIVE.value

    def archive(self, row) -> None:
        row.status = DashboardStatus.ARCHIVED.value
""",
    "DashboardWidget": """
class DashboardWidgetEngine:
    def hide(self, row) -> None:
        row.status = DashboardWidgetStatus.HIDDEN.value

    def show(self, row) -> None:
        row.status = DashboardWidgetStatus.ACTIVE.value
""",
    "Notification": """
class NotificationEngine:
    def acknowledge(self, row) -> None:
        row.delivery_status = "read"
        row.status = NotificationStatus.ARCHIVED.value
""",
    "MessageThread": """
class MessageThreadEngine:
    def close(self, row) -> None:
        row.status = MessageThreadStatus.CLOSED.value
""",
    "Message": """
class MessageEngine:
    def mark_read(self, row) -> None:
        row.status = MessageStatus.READ.value
""",
    "OrderView": """
class OrderViewEngine:
    def mark_stale(self, row) -> None:
        row.status = OrderViewStatus.STALE.value
""",
    "InvoiceView": """
class InvoiceViewEngine:
    def mark_stale(self, row) -> None:
        row.status = InvoiceViewStatus.STALE.value
""",
    "DocumentAccess": """
class DocumentAccessEngine:
    def submit(self, row) -> None:
        if row.status != DocumentAccessStatus.DRAFT.value:
            raise InvalidDocumentAccessState("Only draft access grants can be submitted")
        row.status = DocumentAccessStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != DocumentAccessStatus.SUBMITTED.value:
            raise InvalidDocumentAccessState("Only submitted access grants can be approved")
        row.status = DocumentAccessStatus.APPROVED.value

    def revoke(self, row) -> None:
        row.status = DocumentAccessStatus.REVOKED.value
""",
    "SupportTicket": """
class SupportTicketEngine:
    def submit(self, row) -> None:
        if row.status != SupportTicketStatus.DRAFT.value:
            raise InvalidSupportTicketState("Only draft tickets can be submitted")
        row.status = SupportTicketStatus.SUBMITTED.value
""",
    "ServiceRequest": """
class ServiceRequestEngine:
    def submit(self, row) -> None:
        if row.status != ServiceRequestStatus.DRAFT.value:
            raise InvalidServiceRequestState("Only draft requests can be submitted")
        row.status = ServiceRequestStatus.SUBMITTED.value
""",
    "DownloadHistory": """
class DownloadHistoryEngine:
    def record(self, row) -> None:
        row.status = DownloadHistoryStatus.RECORDED.value
""",
    "SavedReport": """
class SavedReportEngine:
    def archive(self, row) -> None:
        row.status = SavedReportStatus.ARCHIVED.value
""",
    "SavedSearch": """
class SavedSearchEngine:
    def archive(self, row) -> None:
        row.status = SavedSearchStatus.ARCHIVED.value
""",
    "Preference": """
class PreferenceEngine:
    pass
""",
    "Device": """
class DeviceEngine:
    def revoke(self, row) -> None:
        row.status = DeviceStatus.REVOKED.value
""",
    "LoginAudit": """
class LoginAuditEngine:
    pass
""",
    "PortalReport": """
class PortalReportEngine:
    def finalize(self, row) -> None:
        row.status = PortalReportStatus.FINALIZED.value
""",
}'''


def replace_section(text: str, start_marker: str, end_marker: str, new_block: str) -> str:
    pattern = re.compile(
        re.escape(start_marker) + r".*?" + re.escape(end_marker),
        re.DOTALL,
    )
    if not pattern.search(text):
        raise SystemExit(f"section not found: {start_marker}")
    return pattern.sub(new_block + "\n\n" + end_marker, text, count=1)


def main() -> None:
    text = GEN.read_text(encoding="utf-8")

    text = replace_section(text, "# table_key, ORM class, stem, branch_scoped", "CLASS_MAP =", TABLES_BLOCK + "\n\n")
    text = replace_section(text, "MIGRATIONS: list", "# route prefix", MIGRATIONS_BLOCK + "\n\n")
    text = replace_section(text, "# route prefix, schema name", "ENGINE_NAMES =", ROUTE_SPECS_BLOCK + "\n\n")
    text = replace_section(text, "ENGINE_NAMES =", "ENGINE_FILE_MAP =", ENGINE_NAMES_BLOCK + "\n\n")
    text = replace_section(text, "ENGINE_FILE_MAP =", "def _emp_fk", ENGINE_FILE_MAP_BLOCK + "\n\n\n")
    text = replace_section(text, "MODELS: dict[str, str] = {}", "# Engine bodies continued", build_models_block() + "\n\n\n")
    text = replace_section(text, "ENGINE_BODIES: dict[str, str] = {", "def gen_scaffold", ENGINE_BODIES_BLOCK + "\n\n\n")

    # Fix fk prefix and schema migration id
    text = text.replace('fk_ec_', 'fk_pt_')
    text = text.replace('0421_create_portal_schema.py', '0421_create_portal_schema.py')
    text = text.replace('"0399_create_portal_schema"', '"0421_create_portal_schema"')
    text = text.replace('revision: str = "0399_create_portal_schema"', 'revision: str = "0421_create_portal_schema"')
    text = text.replace('down_revision: str | None = "0398_seed_integration_workflows"', 'down_revision: str | None = "0420_seed_ecommerce_workflows"')
    text = text.replace('CREATE SCHEMA IF NOT EXISTS portal', 'CREATE SCHEMA IF NOT EXISTS portal')
    text = text.replace('DROP SCHEMA IF NOT EXISTS portal CASCADE', 'DROP SCHEMA IF NOT EXISTS portal CASCADE')
    text = text.replace('"""Create ec_shipment and ec_shipping_tracking tables."""', '"""Create portal dual-table migration."""')
    text = text.replace('entity_name="ec_', 'entity_name="pt_')
    text = text.replace('portal_router = APIRouter(prefix="/portal")', 'portal_router = APIRouter(prefix="/portal")')

    # Remove OPT_BRANCH from portal (no branch scoping)
    text = text.replace("{OPT_BRANCH}\n", "")

    # Fix main() head
    text = text.replace('print("OK portal module generated', 'print("OK portal module generated')
    text = text.replace('Alembic head revision: 0420_seed_portal_workflows', 'Alembic head revision: 0442_seed_portal_workflows')
    text = text.replace('print(f"OK portal module generated — {len(FILES_WRITTEN)} files")', 'print(f"OK portal module generated — {len(FILES_WRITTEN)} files")')

    GEN.write_text(text, encoding="utf-8")
    print("injected portal data structures")


if __name__ == "__main__":
    main()
