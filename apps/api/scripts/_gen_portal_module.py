"""Generate Sprint 23 Customer Portal module. Run from apps/api:
.venv\\Scripts\\python.exe scripts/_gen_portal_module.py
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
PORTAL = SRC / "modules" / "portal"
ALEMBIC = ROOT / "alembic" / "versions"
TESTS = SRC / "tests"
SHARED = SRC / "shared"

FILES_WRITTEN: list[Path] = []

WF_FIELDS = """
    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
"""

OPT_BRANCH = """
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
"""


def w(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not content.endswith("\n"):
        content += "\n"
    path.write_text(content, encoding="utf-8")
    FILES_WRITTEN.append(path)
    print("wrote", path.relative_to(ROOT))


def patch_file(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new.strip() in text:
        print("skip (already)", path.relative_to(ROOT))
        return
    if old not in text:
        raise SystemExit(f"patch failed in {path}: marker not found")
    path.write_text(text.replace(old, new), encoding="utf-8")
    print("patched", path.relative_to(ROOT))


# table_key, ORM class, stem, branch_scoped
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
]



CLASS_MAP = {t[0]: t[1] for t in TABLES}

MIGRATIONS: list[tuple[str, str | list[str], str]] = [
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
]



# route prefix, schema name, service class, perm resource, branch_required
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
]



ENGINE_NAMES = [
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
]



ENGINE_FILE_MAP = {
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
}




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


def _vendor_fk(col: str = "vendor_id", nullable: bool = True) -> str:
    null = "True" if nullable else "False"
    mapped = "UUID | None" if nullable else "UUID"
    return f'''
    {col}: Mapped[{mapped}] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_vendor.id", ondelete="RESTRICT"),
        nullable={null},
        index=True,
    )'''


def _uuid_only(col: str) -> str:
    return f'''
    {col}: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)'''


def _fk(
    col: str,
    table: str,
    *,
    nullable: bool = True,
    ondelete: str = "SET NULL",
    use_alter: bool = False,
    name: str | None = None,
) -> str:
    null = "True" if nullable else "False"
    mapped = "UUID | None" if nullable else "UUID"
    extra = ""
    if use_alter:
        fk_name = name or f"fk_pt_{col}"
        extra = f',\n            use_alter=True,\n            name="{fk_name}"'
    return f'''
    {col}: Mapped[{mapped}] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "{table}",
            ondelete="{ondelete}"{extra},
        ),
        nullable={null},
        index=True,
    )'''


MODELS: dict[str, str] = {}

MODELS["portal_account"] = '''"""Portal account ORM per ERD_23 section 5.1."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    account_number: Mapped[str] = mapped_column(String(50), nullable=False)
    login_email: Mapped[str] = mapped_column(String(255), nullable=False)

    customer_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    customer_profile_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    credential_vault_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    owner_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
'''

MODELS["customer_profile"] = '''"""Customer profile ORM per ERD_23 section 5.2."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    profile_number: Mapped[str] = mapped_column(String(50), nullable=False)

    customer_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    preferred_language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    billing_contact_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    shipping_contact_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    crm_party_ref_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
'''

MODELS["portal_session"] = '''"""Portal session ORM per ERD_23 section 5.3."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    device_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)'''

MODELS["dashboard"] = '''"""Dashboard ORM per ERD_23 section 5.4."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    dashboard_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    dashboard_code: Mapped[str] = mapped_column(String(50), nullable=False)
    dashboard_name: Mapped[str] = mapped_column(String(255), nullable=False)
    layout_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)'''

MODELS["dashboard_widget"] = '''"""Dashboard widget ORM per ERD_23 section 5.5."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    dashboard_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_dashboard.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    widget_type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    config_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)'''

MODELS["notification"] = '''"""Notification ORM per ERD_23 section 5.6."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    notification_type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    related_entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    related_entity_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(nullable=True)
    delivery_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)'''

MODELS["message_thread"] = '''"""Message thread ORM per ERD_23 section 5.8."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    thread_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    related_entity_type: Mapped[str] = mapped_column(String(40), nullable=False, default="general")
    related_entity_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)'''

MODELS["message"] = '''"""Message ORM per ERD_23 section 5.7."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    message_number: Mapped[str] = mapped_column(String(50), nullable=False)

    message_thread_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_message_thread.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    sender_account_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    sender_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="sent", index=True)'''

MODELS["order_view"] = '''"""Order view ORM per ERD_23 section 5.9."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    view_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    customer_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    sales_order_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    ec_order_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    order_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    order_status_text: Mapped[str | None] = mapped_column(String(100), nullable=True)

    product_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    ordered_at: Mapped[datetime | None] = mapped_column(nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="visible", index=True)'''

MODELS["invoice_view"] = '''"""Invoice view ORM per ERD_23 section 5.10."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    view_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    customer_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    finance_invoice_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    sales_invoice_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    invoice_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    amount_due: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(nullable=True)

    finance_journal_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="visible", index=True)'''

MODELS["document_access"] = '''"""Document access ORM per ERD_23 section 5.11."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    access_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    access_level: Mapped[str] = mapped_column(String(30), nullable=False, default="view")

    granted_by_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    granted_at: Mapped[datetime | None] = mapped_column(nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
'''

MODELS["support_ticket"] = '''"""Support ticket ORM per ERD_23 section 5.12."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    ticket_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    customer_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")

    helpdesk_ticket_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    assigned_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
'''

MODELS["service_request"] = '''"""Service request ORM per ERD_23 section 5.13."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    request_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    customer_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    request_type: Mapped[str] = mapped_column(String(40), nullable=False, default="other")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    service_request_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    preferred_slot_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
'''

MODELS["download_history"] = '''"""Download history ORM per ERD_23 section 5.14."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    download_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    document_access_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_document_access.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    downloaded_at: Mapped[datetime | None] = mapped_column(nullable=True)
    bytes_transferred: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="recorded", index=True)'''

MODELS["saved_report"] = '''"""Saved report ORM per ERD_23 section 5.15."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    saved_report_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    report_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False, default="portal")

    bi_report_ref_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    definition_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)'''

MODELS["saved_search"] = '''"""Saved search ORM per ERD_23 section 5.16."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    saved_search_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    search_name: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    query_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)'''

MODELS["preference"] = '''"""Preference ORM per ERD_23 section 5.17."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    preference_key: Mapped[str] = mapped_column(String(100), nullable=False)
    preference_value_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)'''

MODELS["device"] = '''"""Device ORM per ERD_23 section 5.18."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    device_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    device_fingerprint: Mapped[str] = mapped_column(String(255), nullable=False)
    device_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    platform: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(nullable=True)
    is_trusted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)'''

MODELS["login_audit"] = '''"""Login audit ORM per ERD_23 section 5.19."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    audit_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    device_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_device.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    occurred_at: Mapped[datetime | None] = mapped_column(nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="recorded", index=True)'''

MODELS["report"] = '''"""Portal report ORM per ERD_23 section 5.20."""

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
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    report_code: Mapped[str] = mapped_column(String(50), nullable=False)
    report_type: Mapped[str] = mapped_column(String(40), nullable=False)
    period_start: Mapped[date | None] = mapped_column(nullable=True)
    period_end: Mapped[date | None] = mapped_column(nullable=True)
    metrics_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)'''




# Engine bodies continued in part 2 — written by gen via ENGINE_BODIES below
ENGINE_BODIES: dict[str, str] = {
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
}




def gen_scaffold() -> None:
    w(PORTAL / "__init__.py", '"""Customer Portal / External Channel module — Sprint 23."""\n')
    w(PORTAL / "domain" / "__init__.py", '"""Customer Portal domain layer."""\n')
    w(PORTAL / "adapters" / "__init__.py", '"""Customer Portal cross-module adapters."""\n')
    w(PORTAL / "service" / "__init__.py", '"""Customer Portal services — populated after generation."""\n')
    w(PORTAL / "service" / "engines" / "__init__.py", '"""Customer Portal engines — populated after generation."""\n')
    w(PORTAL / "repository" / "__init__.py", '"""Customer Portal repositories."""\n')
    w(PORTAL / "models" / "__init__.py", '"""Customer Portal models — populated after generation."""\n')
    w(
        PORTAL / "models" / "mixins.py",
        '''"""Customer Portal ORM mixin bundles per ERD_23."""

from database.mixins import (
    AuditMixin,
    CompanyMixin,
    SoftDeleteMixin,
    TenantMixin,
    VersionMixin,
)

PtRowMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    SoftDeleteMixin,
    VersionMixin,
)
''',
    )


def gen_domain() -> None:
    w(
        PORTAL / "domain" / "enums.py",
        '''"""Customer Portal domain enums per ERD_23 section 8."""

"""Customer Portal domain enums per ERD_23 section 8."""

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

''',
    )
    exc_lines = []
    for _, _, name, _ in TABLES:
        exc_lines.append(
            f'''
class Invalid{name}State(ConflictException):
    def __init__(self, message: str = "Invalid {name.lower()} state") -> None:
        super().__init__(message)
'''
        )
    w(
        PORTAL / "domain" / "exceptions.py",
        '"""Customer Portal domain exceptions."""\n\nfrom core.exceptions import ConflictException\n'
        + "".join(exc_lines),
    )
    w(
        PORTAL / "domain" / "value_objects.py",
        '''"""Customer Portal value objects."""

from dataclasses import dataclass


@dataclass(frozen=True)
class PortalCodes:
    document_number: str
''',
    )
    w(
        PORTAL / "domain" / "entities.py",
        '''"""Customer Portal domain entity markers."""

from dataclasses import dataclass
from uuid import UUID


@dataclass
class PortalAccountIdentity:
    account_id: UUID
    account_number: str
''',
    )


def gen_models() -> None:
    for key, body in MODELS.items():
        w(PORTAL / "models" / f"{key}.py", body)
    imports = "\n".join(
        f"from modules.portal.models.{k} import {CLASS_MAP[k]}" for k in CLASS_MAP
    )
    all_names = ",\n    ".join(f'"{CLASS_MAP[k]}"' for k in CLASS_MAP)
    w(
        PORTAL / "models" / "__init__.py",
        f'"""Customer Portal ORM models."""\n\n{imports}\n\n__all__ = [\n    {all_names},\n]\n',
    )


def gen_migrations() -> None:
    w(
        ALEMBIC / "0421_create_portal_schema.py",
        '''"""Create portal schema."""

from collections.abc import Sequence

from alembic import op

revision: str = "0421_create_portal_schema"
down_revision: str | None = "0420_seed_ecommerce_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS portal")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS portal CASCADE")
''',
    )
    for rev, target, down in MIGRATIONS:
        if target == "schema" or (isinstance(target, str) and target.startswith("seed")):
            continue
        if isinstance(target, list):
            imports = "\n".join(
                f"from modules.portal.models.{m} import {CLASS_MAP[m]}  # noqa: F401"
                for m in target
            )
            creates = "\n    ".join(
                f"{CLASS_MAP[m]}.__table__.create(bind=op.get_bind(), checkfirst=True)"
                for m in target
            )
            drops = "\n    ".join(
                f"{CLASS_MAP[m]}.__table__.drop(bind=op.get_bind(), checkfirst=True)"
                for m in reversed(target)
            )
            w(
                ALEMBIC / f"{rev}.py",
                f'''"""Create portal dual-table migration."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

{imports}

revision: str = "{rev}"
down_revision: str | None = "{down}"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    {creates}


def downgrade() -> None:
    {drops}
''',
            )
        else:
            cls = CLASS_MAP[target]
            w(
                ALEMBIC / f"{rev}.py",
                f'''"""Create {cls} table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.portal.models.{target} import {cls}  # noqa: F401

revision: str = "{rev}"
down_revision: str | None = "{down}"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    {cls}.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    {cls}.__table__.drop(bind=op.get_bind(), checkfirst=True)
''',
            )


def repo_template(module: str, cls: str, name: str, branch: bool) -> str:
    return f'''"""Customer Portal {cls} repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.portal.models import {cls}
from modules.portal.repository.base import PortalScopedRepository, utcnow


class {name}Repository(PortalScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> {cls} | None:
        stmt = select({cls}).where({cls}.id == row_id, {cls}.is_deleted.is_(False))
        stmt = self.apply_portal_filter(stmt, {cls}, ctx, branch_scoped={branch})
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select({cls}).where(
            {cls}.company_id == company_id,
            {cls}.is_deleted.is_(False),
        )
        stmt = self.apply_portal_filter(stmt, {cls}, ctx, branch_scoped={branch})
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> {cls}:
        row = {cls}(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> {cls} | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
'''


def gen_repos() -> None:
    w(
        PORTAL / "repository" / "base.py",
        '''"""Customer Portal scoped repository base."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.base import OrgScopedRepository


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PortalScopedRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    @staticmethod
    def apply_portal_filter(stmt, model, ctx: TenantContext, *, branch_scoped: bool = False):
        stmt = PortalScopedRepository.apply_tenant_filter(stmt, model, ctx)
        if ctx.company_id and ctx.user_type not in {"super_admin", "tenant_admin"}:
            stmt = stmt.where(model.company_id == ctx.company_id)
        if (
            branch_scoped
            and ctx.branch_id
            and ctx.user_type not in {"super_admin", "tenant_admin"}
            and hasattr(model, "branch_id")
        ):
            stmt = stmt.where(model.branch_id == ctx.branch_id)
        return stmt

    @staticmethod
    def resolve_company_id(ctx: TenantContext, company_id: UUID | None) -> UUID:
        if company_id is not None:
            PortalScopedRepository.ensure_company_access(ctx, company_id)
            return company_id
        if ctx.company_id is None:
            raise ForbiddenException("Company context required")
        return ctx.company_id
''',
    )
    w(
        PORTAL / "repository" / "code_sequence_repository.py",
        '''"""Customer Portal code sequences."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.portal.domain.enums import CODE_PREFIXES, PortalEntityType


class CodeSequenceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def next_code(self, entity: PortalEntityType, company_id: UUID, model, code_column: str) -> str:
        prefix, width, include_year = CODE_PREFIXES[entity]
        year = datetime.now(timezone.utc).year
        full_prefix = f"{prefix}{year}-" if include_year else prefix
        stmt = select(getattr(model, code_column)).where(
            model.company_id == company_id,
            getattr(model, code_column).like(f"{full_prefix}%"),
            model.is_deleted.is_(False),
        )
        existing = list(self.db.scalars(stmt).all())
        seq = 1
        if existing:
            nums = []
            for code in existing:
                try:
                    nums.append(int(str(code).rsplit("-", 1)[-1]))
                except ValueError:
                    continue
            if nums:
                seq = max(nums) + 1
        return f"{full_prefix}{seq:0{width}d}"
''',
    )
    for module, cls, name, branch in TABLES:
        w(
            PORTAL / "repository" / f"{module}_repository.py",
            repo_template(module, cls, name, branch),
        )


def gen_engines() -> None:
    status_imports = {n: f"{n}Status" for n in ENGINE_NAMES}
    exc_imports = {
        "PortalAccount": "InvalidPortalAccountState",
        "CustomerProfile": "InvalidCustomerProfileState",
        "DocumentAccess": "InvalidDocumentAccessState",
        "SupportTicket": "InvalidSupportTicketState",
        "ServiceRequest": "InvalidServiceRequestState",
    }
    for eng_name, body in ENGINE_BODIES.items():
        fname = ENGINE_FILE_MAP[eng_name]
        st = status_imports[eng_name]
        header = f'"""{eng_name} lifecycle engine."""\n\n'
        header += f"from modules.portal.domain.enums import (\n    {st},\n)\n"
        if eng_name in exc_imports:
            header += (
                f"from modules.portal.domain.exceptions import (\n"
                f"    {exc_imports[eng_name]},\n)\n"
            )
        header += "\n"
        w(PORTAL / "service" / "engines" / f"{fname}_engine.py", header + body.lstrip("\n"))
    lines = [
        f"from modules.portal.service.engines.{ENGINE_FILE_MAP[n]}_engine "
        f"import {n}Engine"
        for n in ENGINE_NAMES
    ]
    all_names = ",\n    ".join(f'"{n}Engine"' for n in ENGINE_NAMES)
    w(
        PORTAL / "service" / "engines" / "__init__.py",
        '"""Customer Portal business engines."""\n\n'
        + "\n".join(lines)
        + f"\n\n__all__ = [\n    {all_names},\n]\n",
    )


def catalog_service(
    svc_name: str,
    cls: str,
    repo_name: str,
    entity: str,
    engine_name: str,
) -> str:
    return f'''"""{svc_name} application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.portal.models import {cls}
from modules.portal.repository.{entity}_repository import {repo_name}Repository
from modules.portal.service.engines import {engine_name}Engine
from modules.portal.service.portal_scope_validator import PortalScopeValidator


class {svc_name}:
    def __init__(self, db: Session) -> None:
        self._repo = {repo_name}Repository(db)
        self._scope = PortalScopeValidator(db)
        self._engine = {engine_name}Engine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> {cls}:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("{svc_name} not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        row = self._repo.create(ctx, company_id=cid, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="pt_{entity}",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("{svc_name} not found")
        return row
'''


def numbered_service(
    svc_name: str,
    cls: str,
    repo_name: str,
    entity: str,
    entity_type: str,
    code_col: str,
    engine_name: str,
    actions: list[str],
) -> str:
    action_methods = ""
    for act in actions:
        action_methods += f'''
    def {act}(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.{act}(row)
        return self._repo.update(ctx, row_id, status=row.status)
'''
    return f'''"""{svc_name}."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.portal.domain.enums import PortalEntityType
from modules.portal.models import {cls}
from modules.portal.repository.{entity}_repository import {repo_name}Repository
from modules.portal.service.engines import {engine_name}Engine
from modules.portal.service.portal_number_service import PortalNumberService
from modules.portal.service.portal_scope_validator import PortalScopeValidator


class {svc_name}:
    def __init__(self, db: Session) -> None:
        self._repo = {repo_name}Repository(db)
        self._scope = PortalScopeValidator(db)
        self._numbers = PortalNumberService(db)
        self._engine = {engine_name}Engine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> {cls}:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("{svc_name} not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        doc = self._numbers.generate(PortalEntityType.{entity_type}, cid, {cls}, "{code_col}")
        return self._repo.create(ctx, company_id=cid, {code_col}=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("{svc_name} not found")
        return row
{action_methods}
'''


def gen_services() -> None:
    w(
        PORTAL / "service" / "portal_scope_validator.py",
        '''"""Customer Portal scope validator."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.portal.repository.base import PortalScopedRepository


class PortalScopeValidator(PortalScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def validate_company_access(self, ctx: TenantContext, company_id: UUID) -> None:
        self.ensure_company_access(ctx, company_id)

    def validate_branch_access(self, ctx: TenantContext, branch_id: UUID) -> None:
        self.ensure_branch_access(ctx, branch_id)
''',
    )
    w(
        PORTAL / "service" / "portal_number_service.py",
        '''"""Customer Portal numbering."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.portal.domain.enums import PortalEntityType
from modules.portal.repository.code_sequence_repository import CodeSequenceRepository


class PortalNumberService:
    def __init__(self, db: Session) -> None:
        self._seq = CodeSequenceRepository(db)

    def generate(self, entity: PortalEntityType, company_id: UUID, model, code_column: str) -> str:
        return self._seq.next_code(entity, company_id, model, code_column)
''',
    )

    simple_specs = [
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
    ]

    for svc, cls, repo, entity, eng, fname in simple_specs:
        body = catalog_service(svc, cls, repo, entity, eng)
        if svc == "NotificationService":
            body = body.rstrip() + '''

    def acknowledge(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.acknowledge(row)
        return self._repo.update(ctx, row_id, delivery_status=row.delivery_status, status=row.status)
'''
        w(PORTAL / "service" / fname, body)

    numbered = [
        ("PortalAccountService", "PtPortalAccount", "PortalAccount", "portal_account", "PORTAL_ACCOUNT", "account_number", "PortalAccount", ["submit", "approve"], "portal_account_service.py"),
        ("CustomerProfileService", "PtCustomerProfile", "CustomerProfile", "customer_profile", "CUSTOMER_PROFILE", "profile_number", "CustomerProfile", ["submit", "approve"], "customer_profile_service.py"),
        ("PortalSessionService", "PtPortalSession", "PortalSession", "portal_session", "PORTAL_SESSION", "session_number", "PortalSession", [], "portal_session_service.py"),
        ("DashboardService", "PtDashboard", "Dashboard", "dashboard", "DASHBOARD", "dashboard_number", "Dashboard", [], "dashboard_service.py"),
        ("DocumentAccessService", "PtDocumentAccess", "DocumentAccess", "document_access", "DOCUMENT_ACCESS", "access_number", "DocumentAccess", ["submit", "approve"], "document_access_service.py"),
        ("SupportTicketService", "PtSupportTicket", "SupportTicket", "support_ticket", "SUPPORT_TICKET", "ticket_number", "SupportTicket", ["submit"], "support_ticket_service.py"),
        ("ServiceRequestService", "PtServiceRequest", "ServiceRequest", "service_request", "SERVICE_REQUEST", "request_number", "ServiceRequest", ["submit"], "service_request_service.py"),
        ("DeviceService", "PtDevice", "Device", "device", "DEVICE", "device_number", "Device", [], "device_service.py"),
    ]

    for svc, cls, repo, entity, etype, col, eng, acts, fname in numbered:
        w(
            PORTAL / "service" / fname,
            numbered_service(svc, cls, repo, entity, etype, col, eng, acts),
        )

    w(
PORTAL / "service" / "portal_integration_service.py",
        '''"""Customer Portal integration service using peer adapters (C-01 + UUID refs)."""

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
''',
    )

    svc_imports = """from modules.portal.service.customer_profile_service import CustomerProfileService
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
from modules.portal.service.support_ticket_service import SupportTicketService"""

    w(
        PORTAL / "service" / "application_service.py",
        f'''"""Customer Portal application service facade."""

from sqlalchemy.orm import Session

{svc_imports}


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
''',
    )

    w(
        PORTAL / "service" / "__init__.py",
        f'''"""Customer Portal services."""

from modules.portal.service.application_service import PortalApplicationService
{svc_imports}

__all__ = [
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
]
''',
    )


def gen_adapters() -> None:
    w(
        PORTAL / "adapters" / "master_data_port.py",
        '''"""Master Data port — customer / employee / product (C-01)."""

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
''',
    )
    w(
        PORTAL / "adapters" / "organization_port.py",
        '''"""Organization port — read org_department only."""

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
''',
    )
    w(
        PORTAL / "adapters" / "crm_port.py",
        '''"""CRM port — UUID-only stubs; no crm_* FK / ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalCrmAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_party_ref(self, ctx: TenantContext, crm_party_ref_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return crm_party_ref_id
''',
    )
    w(
        PORTAL / "adapters" / "sales_port.py",
        '''"""Sales port — order authority via service; UUID refs only."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalSalesAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_sales_order_ref(self, ctx: TenantContext, sales_order_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return sales_order_id
''',
    )
    w(
        PORTAL / "adapters" / "finance_port.py",
        '''"""Finance port — PostingService.post_system_journal only; store finance_journal_id."""

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
''',
    )
    w(
        PORTAL / "adapters" / "document_port.py",
        '''"""Document port — UUID-only stubs; no doc_* FK / ORM writes."""

from uuid import UUID


class PortalDocumentAdapter:
    def resolve_document_uuid(self, document_id: UUID | None) -> UUID | None:
        return document_id
''',
    )
    w(
        PORTAL / "adapters" / "helpdesk_port.py",
        '''"""Helpdesk port — UUID-only stubs; no hd_* FK / ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalHelpdeskAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_ticket_ref(self, ctx: TenantContext, helpdesk_ticket_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return helpdesk_ticket_id
''',
    )
    w(
        PORTAL / "adapters" / "service_port.py",
        '''"""Service port — UUID-only stubs; no svc_* FK / ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalServiceAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_request_ref(self, ctx: TenantContext, service_request_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return service_request_id
''',
    )
    w(
        PORTAL / "adapters" / "analytics_port.py",
        '''"""Analytics port — read-only UUID refs."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalAnalyticsAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_report_ref(self, ctx: TenantContext, bi_report_ref_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return bi_report_ref_id
''',
    )
    w(
        PORTAL / "adapters" / "integration_port.py",
        '''"""Integration Hub port — connector UUID refs only."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalIntegrationAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_connector_ref(self, ctx: TenantContext, int_connector_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return int_connector_id
''',
    )
    w(
        PORTAL / "adapters" / "ecommerce_port.py",
        '''"""E-Commerce port — optional channel order UUID refs only."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalEcommerceAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_order_ref(self, ctx: TenantContext, ec_order_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return ec_order_id
''',
    )
    w(PORTAL / "adapters" / "__init__.py", '''"""Customer Portal peer adapters."""
''')



def gen_permissions() -> None:
    w(
        PORTAL / "permissions.py",
        '''"""Customer Portal permission constants per ERD_23 section 10."""

PORTAL_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("portal.store:read", "portal.store", "read", "portal"),
    ("portal.store:create", "portal.store", "create", "portal"),
    ("portal.store:update", "portal.store", "update", "portal"),
    ("portal.store:submit", "portal.store", "submit", "portal"),
    ("portal.store:approve", "portal.store", "approve", "portal"),
    ("portal.channel:read", "portal.channel", "read", "portal"),
    ("portal.channel:create", "portal.channel", "create", "portal"),
    ("portal.channel:update", "portal.channel", "update", "portal"),
    ("portal.channel:submit", "portal.channel", "submit", "portal"),
    ("portal.channel:approve", "portal.channel", "approve", "portal"),
    ("portal.listing:read", "portal.listing", "read", "portal"),
    ("portal.listing:create", "portal.listing", "create", "portal"),
    ("portal.listing:update", "portal.listing", "update", "portal"),
    ("portal.listing:submit", "portal.listing", "submit", "portal"),
    ("portal.listing:approve", "portal.listing", "approve", "portal"),
    ("portal.listing:publish", "portal.listing", "publish", "portal"),
    ("portal.price:read", "portal.price", "read", "portal"),
    ("portal.price:create", "portal.price", "create", "portal"),
    ("portal.price:update", "portal.price", "update", "portal"),
    ("portal.price:submit", "portal.price", "submit", "portal"),
    ("portal.price:approve", "portal.price", "approve", "portal"),
    ("portal.price:publish", "portal.price", "publish", "portal"),
    ("portal.listing_inventory:read", "portal.listing_inventory", "read", "portal"),
    ("portal.listing_inventory:create", "portal.listing_inventory", "create", "portal"),
    ("portal.listing_inventory:update", "portal.listing_inventory", "update", "portal"),
    ("portal.listing_inventory:submit", "portal.listing_inventory", "submit", "portal"),
    ("portal.listing_inventory:approve", "portal.listing_inventory", "approve", "portal"),
    ("portal.listing_inventory:publish", "portal.listing_inventory", "publish", "portal"),
    ("portal.cart:read", "portal.cart", "read", "portal"),
    ("portal.cart:create", "portal.cart", "create", "portal"),
    ("portal.cart:update", "portal.cart", "update", "portal"),
    ("portal.order:read", "portal.order", "read", "portal"),
    ("portal.order:create", "portal.order", "create", "portal"),
    ("portal.order:update", "portal.order", "update", "portal"),
    ("portal.order:submit", "portal.order", "submit", "portal"),
    ("portal.order:review", "portal.order", "review", "portal"),
    ("portal.order:accept", "portal.order", "accept", "portal"),
    ("portal.order:cancel", "portal.order", "cancel", "portal"),
    ("portal.payment:read", "portal.payment", "read", "portal"),
    ("portal.payment:create", "portal.payment", "create", "portal"),
    ("portal.payment:capture", "portal.payment", "capture", "portal"),
    ("portal.payment:refund", "portal.payment", "refund", "portal"),
    ("portal.payment_txn:read", "portal.payment_txn", "read", "portal"),
    ("portal.payment_txn:create", "portal.payment_txn", "create", "portal"),
    ("portal.payment_txn:capture", "portal.payment_txn", "capture", "portal"),
    ("portal.payment_txn:refund", "portal.payment_txn", "refund", "portal"),
    ("portal.shipment:read", "portal.shipment", "read", "portal"),
    ("portal.shipment:create", "portal.shipment", "create", "portal"),
    ("portal.shipment:update", "portal.shipment", "update", "portal"),
    ("portal.tracking:read", "portal.tracking", "read", "portal"),
    ("portal.tracking:create", "portal.tracking", "create", "portal"),
    ("portal.tracking:update", "portal.tracking", "update", "portal"),
    ("portal.return:read", "portal.return", "read", "portal"),
    ("portal.return:create", "portal.return", "create", "portal"),
    ("portal.return:submit", "portal.return", "submit", "portal"),
    ("portal.return:approve", "portal.return", "approve", "portal"),
    ("portal.return:reject", "portal.return", "reject", "portal"),
    ("portal.coupon:read", "portal.coupon", "read", "portal"),
    ("portal.coupon:create", "portal.coupon", "create", "portal"),
    ("portal.coupon:update", "portal.coupon", "update", "portal"),
    ("portal.promotion:read", "portal.promotion", "read", "portal"),
    ("portal.promotion:create", "portal.promotion", "create", "portal"),
    ("portal.promotion:update", "portal.promotion", "update", "portal"),
    ("portal.marketplace:read", "portal.marketplace", "read", "portal"),
    ("portal.marketplace:create", "portal.marketplace", "create", "portal"),
    ("portal.marketplace:update", "portal.marketplace", "update", "portal"),
    ("portal.marketplace:submit", "portal.marketplace", "submit", "portal"),
    ("portal.marketplace:approve", "portal.marketplace", "approve", "portal"),
    ("portal.marketplace:sync", "portal.marketplace", "sync", "portal"),
    ("portal.notification:read", "portal.notification", "read", "portal"),
    ("portal.notification:acknowledge", "portal.notification", "acknowledge", "portal"),
    ("portal.report:read", "portal.report", "read", "portal"),
    ("portal.report:export", "portal.report", "export", "portal"),
]

_ALL = [p[0] for p in PORTAL_PERMISSIONS]

PORTAL_ADMIN_PERMISSIONS = list(_ALL)
PORTAL_MANAGER_PERMISSIONS = [
    p for p in _ALL
    if ":approve" not in p and ":reject" not in p
]
MARKETPLACE_MANAGER_PERMISSIONS = [
    p for p in _ALL
    if any(
        x in p
        for x in (
            "portal.marketplace",
            "portal.listing",
            "portal.channel",
            "portal.store:read",
            "portal.report:read",
            "portal.notification:read",
        )
    )
]
STORE_OPERATOR_PERMISSIONS = [
    p for p in _ALL
    if any(
        x in p
        for x in (
            "portal.store",
            "portal.channel",
            "portal.listing",
            "portal.cart",
            "portal.order",
            "portal.shipment",
            "portal.tracking",
            "portal.return",
            "portal.notification",
            "portal.report:read",
        )
    )
    and ":approve" not in p
]
''',
    )


def gen_api() -> None:
    w(
        PORTAL / "dependencies.py",
        '''"""Customer Portal module dependencies."""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Query

from database.session import get_db
from modules.foundation.dependencies import get_tenant_context, require_permission
from modules.foundation.domain.value_objects import TenantContext

__all__ = [
    "PaginationParams",
    "get_pagination",
    "get_tenant_context",
    "require_permission",
    "TenantContext",
    "get_db",
    "paginate",
    "extract_update_fields",
]


@dataclass(frozen=True)
class PaginationParams:
    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def get_pagination(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 25,
) -> PaginationParams:
    return PaginationParams(page=page, page_size=page_size)


def paginate(items: list, pagination: PaginationParams) -> list:
    return items[pagination.offset : pagination.offset + pagination.page_size]


def extract_update_fields(body) -> dict:
    fields = body.model_dump(exclude_unset=True)
    fields.pop("version", None)
    return fields
''',
    )

    schema_lines = [
        '"""Customer Portal Pydantic schemas."""',
        "",
        "from uuid import UUID",
        "",
        "from pydantic import BaseModel, ConfigDict",
        "",
        "",
        "class OrmModel(BaseModel):",
        "    model_config = ConfigDict(from_attributes=True)",
        "",
    ]
    for _, name, _, _, _ in ROUTE_SPECS:
        schema_lines += [
            "",
            f"class {name}Create(BaseModel):",
            "    company_id: UUID | None = None",
            "    status: str | None = None",
            "",
            f"class {name}Update(BaseModel):",
            "    status: str | None = None",
            "    version: int | None = None",
            "",
            f"class {name}Response(OrmModel):",
            "    id: UUID",
            "    company_id: UUID",
            "    status: str",
            "    version: int",
        ]
    w(PORTAL / "schemas.py", "\n".join(schema_lines) + "\n")

    router_parts: list[str] = [
        '"""Customer Portal API route handlers."""',
        "",
        "from typing import Annotated",
        "from uuid import UUID",
        "",
        "from fastapi import APIRouter, Depends",
        "from sqlalchemy.orm import Session",
        "",
        "from modules.portal.dependencies import (",
        "    PaginationParams,",
        "    extract_update_fields,",
        "    get_db,",
        "    get_pagination,",
        "    paginate,",
        "    require_permission,",
        ")",
        "from modules.portal.schemas import (",
    ]
    for _, name, _, _, _ in ROUTE_SPECS:
        router_parts.append(f"    {name}Create,")
        router_parts.append(f"    {name}Response,")
        router_parts.append(f"    {name}Update,")
    router_parts += [
        ")",
        "from modules.portal.service import (",
    ]
    seen_svc: set[str] = set()
    for _, _, svc, _, _ in ROUTE_SPECS:
        if svc not in seen_svc:
            router_parts.append(f"    {svc},")
            seen_svc.add(svc)
    router_parts.append(")")
    router_parts.append("from modules.foundation.domain.value_objects import TenantContext")
    router_parts.append("from shared.schemas import APIResponse")
    router_parts.append("")

    exports: list[str] = []
    route_actions: dict[str, list[tuple[str, str]]] = {
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
    }

    for prefix, name, svc, perm, _branch in ROUTE_SPECS:
        rname = f"{prefix.replace('-', '_')}_router"
        exports.append(rname)
        router_parts.append(f'{rname} = APIRouter(prefix="/{prefix}", tags=["Portal — {name}"])')
        router_parts.append("")
        create_call = f"{svc}(db).create(ctx, **body.model_dump(exclude_none=True))"
        update_perm = f"{perm}:update"
        create_perm = f"{perm}:create"
        if perm in {"portal.usage"}:
            pass
        elif perm == "portal.notification":
            create_perm = "portal.notification:read"
            update_perm = "portal.notification:read"
        elif perm == "portal.monitor":
            create_perm = "portal.monitor:read"
            update_perm = "portal.monitor:acknowledge"
        elif perm == "portal.report":
            create_perm = "portal.report:read"
            update_perm = "portal.report:export"
        elif perm == "portal.retry":
            update_perm = "portal.retry:review"
            create_perm = "portal.retry:read"
        elif perm == "portal.dlq":
            update_perm = "portal.dlq:review"
            create_perm = "portal.dlq:read"
        elif perm == "portal.sync" and prefix == "sync-logs":
            create_perm = "portal.sync:read"
            update_perm = "portal.sync:read"
        elif perm == "portal.message":
            update_perm = "portal.message:requeue"

        fn = prefix.replace("-", "_")
        router_parts += [
            f'@{rname}.get("", response_model=APIResponse[list[{name}Response]])',
            f"def list_{fn}(",
            f'    ctx: Annotated[TenantContext, Depends(require_permission("{perm}:read"))],',
            "    db: Annotated[Session, Depends(get_db)],",
            "    pagination: Annotated[PaginationParams, Depends(get_pagination)],",
            "    company_id: UUID | None = None,",
            "):",
            f"    items = {svc}(db).list(ctx, company_id=company_id)",
            '    return APIResponse(message="OK", data=paginate(items, pagination))',
            "",
            f'@{rname}.get("/{{row_id}}", response_model=APIResponse[{name}Response])',
            f"def get_{fn}(",
            "    row_id: UUID,",
            f'    ctx: Annotated[TenantContext, Depends(require_permission("{perm}:read"))],',
            "    db: Annotated[Session, Depends(get_db)],",
            "):",
            f'    return APIResponse(message="OK", data={svc}(db).get(ctx, row_id))',
            "",
            f'@{rname}.post("", response_model=APIResponse[{name}Response])',
            f"def create_{fn}(",
            f"    body: {name}Create,",
            f'    ctx: Annotated[TenantContext, Depends(require_permission("{create_perm}"))],',
            "    db: Annotated[Session, Depends(get_db)],",
            "):",
            f'    return APIResponse(message="Created", data={create_call})',
            "",
            f'@{rname}.patch("/{{row_id}}", response_model=APIResponse[{name}Response])',
            f"def update_{fn}(",
            "    row_id: UUID,",
            f"    body: {name}Update,",
            f'    ctx: Annotated[TenantContext, Depends(require_permission("{update_perm}"))],',
            "    db: Annotated[Session, Depends(get_db)],",
            "):",
            (
                f'    return APIResponse(message="Updated", '
                f"data={svc}(db).update(ctx, row_id, **extract_update_fields(body)))"
            ),
            "",
        ]

        for act, pcode in route_actions.get(prefix, []):
            router_parts += [
                f'@{rname}.post("/{{row_id}}/{act}", response_model=APIResponse[{name}Response])',
                f"def {act}_{fn}(",
                "    row_id: UUID,",
                f'    ctx: Annotated[TenantContext, Depends(require_permission("{pcode}"))],',
                "    db: Annotated[Session, Depends(get_db)],",
                "):",
                f'    return APIResponse(message="{act}", data={svc}(db).{act}(ctx, row_id))',
                "",
            ]

    w(PORTAL / "routers" / "__init__.py", "\n".join(router_parts) + "\n")

    import_list = ",\n    ".join(exports)
    include_lines = "\n".join(f"portal_router.include_router({e})" for e in exports)
    w(
        PORTAL / "router.py",
        f'''"""Customer Portal module router aggregation."""

from fastapi import APIRouter

from modules.portal.routers import (
    {import_list},
)

portal_router = APIRouter(prefix="/portal")
{include_lines}
''',
    )


def gen_tasks_tests() -> None:
    w(
        PORTAL / "tasks.py",
        '''"""Customer Portal Celery task stubs per ERD_23 section 11."""

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

''',
    )

    w(
        TESTS / "unit" / "portal" / "test_pt_hub_engines.py",
        '''"""Unit tests for Customer Portal engines."""

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
''',
    )
    w(
        TESTS / "unit" / "portal" / "test_pt_hub_tasks.py",
        '''"""Unit tests for Customer Portal Celery task names."""

from modules.portal import tasks


def test_portal_task_names_registered():
    assert tasks.session_expiry_sweeper.name == "portal.session_expiry_sweeper"
    assert tasks.order_view_sync.name == "portal.order_view_sync"
    assert tasks.invoice_view_sync.name == "portal.invoice_view_sync"
    assert tasks.notification_dispatcher.name == "portal.notification_dispatcher"
    assert tasks.login_audit_retention.name == "portal.login_audit_retention"
    assert tasks.ticket_status_poller.name == "portal.ticket_status_poller"
''',
    )
    w(
        TESTS / "security" / "portal" / "test_pt_hub_permissions.py",
        '''"""Security tests for Customer Portal permissions."""

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
''',
    )
    w(
        TESTS / "integration" / "portal" / "test_pt_hub_module_import.py",
        '''"""Customer Portal module import smoke tests."""

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
''',
    )



def gen_seeds() -> None:
    w(
        ALEMBIC / "0441_seed_pt_permissions.py",
        '''"""Seed Customer Portal permissions and roles."""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.portal.permissions import (
    CUSTOMER_USER_PERMISSIONS,
    PORTAL_ADMIN_PERMISSIONS,
    PORTAL_MANAGER_PERMISSIONS,
    PORTAL_PERMISSIONS,
    SUPPORT_USER_PERMISSIONS,
)

revision: str = "0441_seed_pt_permissions"
down_revision: str | None = "0440_pt_report"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PERMISSION_TABLE = sa.table(
    "sec_permission",
    sa.column("id", sa.Uuid),
    sa.column("permission_code", sa.String),
    sa.column("resource", sa.String),
    sa.column("action", sa.String),
    sa.column("module", sa.String),
    sa.column("is_active", sa.Boolean),
    sa.column("created_at", sa.DateTime(timezone=True)),
    schema="foundation",
)

ROLE_SPECS: list[tuple[str, str, list[str]]] = [
    ("PORTAL_ADMIN", "Portal Admin", PORTAL_ADMIN_PERMISSIONS),
    ("PORTAL_MANAGER", "Portal Manager", PORTAL_MANAGER_PERMISSIONS),
    ("CUSTOMER_USER", "Customer User", CUSTOMER_USER_PERMISSIONS),
    ("SUPPORT_USER", "Support User", SUPPORT_USER_PERMISSIONS),
]


def _ensure_permission(conn, now, code, resource, action, module):
    exists = conn.execute(
        sa.text("SELECT id FROM foundation.sec_permission WHERE permission_code = :code"),
        {"code": code},
    ).first()
    if exists:
        return str(exists[0])
    perm_id = str(uuid4())
    conn.execute(
        sa.insert(PERMISSION_TABLE).values(
            id=perm_id,
            permission_code=code,
            resource=resource,
            action=action,
            module=module,
            is_active=True,
            created_at=now,
        )
    )
    return perm_id


def _ensure_role(conn, now, tenant_id, role_code, role_name):
    exists = conn.execute(
        sa.text(
            """
            SELECT id FROM foundation.sec_role
            WHERE tenant_id = :tid AND role_code = :code AND is_deleted = false
            """
        ),
        {"tid": tenant_id, "code": role_code},
    ).first()
    if exists:
        return str(exists[0])
    role_id = str(uuid4())
    conn.execute(
        sa.text(
            """
            INSERT INTO foundation.sec_role
            (id, tenant_id, role_code, role_name, is_system_role, status,
             created_at, updated_at, is_deleted, version)
            VALUES (:id, :tid, :code, :name, true, 'active', :now, :now, false, 1)
            """
        ),
        {"id": role_id, "tid": tenant_id, "code": role_code, "name": role_name, "now": now},
    )
    return role_id


def _grant(conn, now, tenant_id, role_id, perm_id):
    exists = conn.execute(
        sa.text(
            """
            SELECT 1 FROM foundation.sec_role_permission
            WHERE role_id = :rid AND permission_id = :pid
            """
        ),
        {"rid": role_id, "pid": perm_id},
    ).first()
    if exists:
        return
    conn.execute(
        sa.text(
            """
            INSERT INTO foundation.sec_role_permission
            (id, tenant_id, role_id, permission_id, granted_at)
            VALUES (:id, :tid, :rid, :pid, :now)
            """
        ),
        {"id": str(uuid4()), "tid": tenant_id, "rid": role_id, "pid": perm_id, "now": now},
    )


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    perm_ids: dict[str, str] = {}
    for code, resource, action, module in PORTAL_PERMISSIONS:
        perm_ids[code] = _ensure_permission(conn, now, code, resource, action, module)
    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code, role_name, perms in ROLE_SPECS:
            role_id = _ensure_role(conn, now, tid, role_code, role_name)
            for perm_code in perms:
                _grant(conn, now, tid, role_id, perm_ids[perm_code])


def downgrade() -> None:
    conn = op.get_bind()
    for role_code, _, _ in reversed(ROLE_SPECS):
        conn.execute(
            sa.text(
                "DELETE FROM foundation.sec_role WHERE role_code = :code AND is_system_role = true"
            ),
            {"code": role_code},
        )
    for code, _, _, _ in PORTAL_PERMISSIONS:
        conn.execute(
            sa.text("DELETE FROM foundation.sec_permission WHERE permission_code = :code"),
            {"code": code},
        )
''',
    )

    w(
        ALEMBIC / "0442_seed_portal_workflows.py",
        '''"""Seed Customer Portal workflow definitions per ERD_23."""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0442_seed_portal_workflows"
down_revision: str | None = "0441_seed_pt_permissions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

WORKFLOWS: list[tuple[str, str, str, list[tuple[int, str, str, str]]]] = [
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
]


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for workflow_code, workflow_name, document_type, steps in WORKFLOWS:
            exists = conn.execute(
                sa.text(
                    """
                    SELECT id FROM foundation.wf_definition
                    WHERE tenant_id = :tid AND workflow_code = :code AND version_no = 1
                    """
                ),
                {"tid": tid, "code": workflow_code},
            ).first()
            if exists:
                wf_id = str(exists[0])
            else:
                wf_id = str(uuid4())
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.wf_definition
                        (id, tenant_id, workflow_code, workflow_name, module,
                         document_type, version_no, is_active, created_at, updated_at)
                        VALUES (:id, :tid, :code, :name, 'portal', :doc, 1, true, :now, :now)
                        """
                    ),
                    {
                        "id": wf_id,
                        "tid": tid,
                        "code": workflow_code,
                        "name": workflow_name,
                        "doc": document_type,
                        "now": now,
                    },
                )
            for step_order, step_code, step_name, approver_type in steps:
                step_exists = conn.execute(
                    sa.text(
                        """
                        SELECT 1 FROM foundation.wf_step
                        WHERE workflow_id = :wid AND step_order = :ord
                        """
                    ),
                    {"wid": wf_id, "ord": step_order},
                ).first()
                if step_exists:
                    continue
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.wf_step
                        (id, tenant_id, workflow_id, step_order, step_code, step_name,
                         approver_type, is_parallel, created_at, updated_at)
                        VALUES (:id, :tid, :wid, :ord, :code, :name, :atype, false, :now, :now)
                        """
                    ),
                    {
                        "id": str(uuid4()),
                        "tid": tid,
                        "wid": wf_id,
                        "ord": step_order,
                        "code": step_code,
                        "name": step_name,
                        "atype": approver_type,
                        "now": now,
                    },
                )


def downgrade() -> None:
    conn = op.get_bind()
    for workflow_code, _, _, _ in WORKFLOWS:
        conn.execute(
            sa.text(
                """
                DELETE FROM foundation.wf_step
                WHERE workflow_id IN (
                    SELECT id FROM foundation.wf_definition WHERE workflow_code = :code
                )
                """
            ),
            {"code": workflow_code},
        )
        conn.execute(
            sa.text("DELETE FROM foundation.wf_definition WHERE workflow_code = :code"),
            {"code": workflow_code},
        )
''',
    )


def gen_wiring() -> None:
    patch_file(
        SHARED / "router.py",
        "from modules.ecommerce.router import ecommerce_router\n",
        "from modules.ecommerce.router import ecommerce_router\n"
        "from modules.portal.router import portal_router\n",
    )
    patch_file(
        SHARED / "router.py",
        "api_v1_router.include_router(ecommerce_router)\n",
        "api_v1_router.include_router(ecommerce_router)\n"
        "api_v1_router.include_router(portal_router)\n",
    )
    patch_file(
        ROOT / "alembic" / "env.py",
        "import modules.ecommerce.models  # noqa: F401 — register ORM metadata\n",
        "import modules.ecommerce.models  # noqa: F401 — register ORM metadata\n"
        "import modules.portal.models  # noqa: F401 — register ORM metadata\n",
    )
    patch_file(
        ROOT / "src" / "workers" / "celery_app.py",
        '        "modules.ecommerce",\n',
        '        "modules.ecommerce",\n        "modules.portal",\n',
    )
    patch_file(
        ROOT / "pyproject.toml",
        '    "modules.ecommerce.*",\n',
        '    "modules.ecommerce.*",\n    "modules.portal.*",\n',
    )
    pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    ruff_marker = (
        '"src/modules/ecommerce/**" = ["E501", "SIM102"]\n'
        '"src/modules/ecommerce/domain/enums.py" = ["UP042"]\n'
    )
    ruff_new = (
        ruff_marker
        + '"src/modules/portal/**" = ["E501", "SIM102"]\n'
        + '"src/modules/portal/domain/enums.py" = ["UP042"]\n'
    )
    if ruff_marker in pyproject and '"src/modules/portal/**"' not in pyproject:
        patch_file(ROOT / "pyproject.toml", ruff_marker, ruff_new)
    elif '"src/modules/portal/**"' not in pyproject:
        alt = '"src/modules/ecommerce/domain/enums.py" = ["UP042"]\n'
        if alt in pyproject:
            patch_file(
                ROOT / "pyproject.toml",
                alt,
                alt
                + '"src/modules/portal/**" = ["E501", "SIM102"]\n'
                + '"src/modules/portal/domain/enums.py" = ["UP042"]\n',
            )




def main() -> None:
    gen_scaffold()
    gen_domain()
    gen_models()
    gen_migrations()
    gen_repos()
    gen_engines()
    gen_services()
    gen_adapters()
    gen_permissions()
    gen_api()
    gen_tasks_tests()
    gen_seeds()
    gen_wiring()
    print(f"OK portal module generated — {len(FILES_WRITTEN)} files")
    print("Alembic head revision: 0442_seed_portal_workflows")


if __name__ == "__main__":
    main()
