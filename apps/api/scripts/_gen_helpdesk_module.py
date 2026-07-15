"""Generate Sprint 17 Helpdesk & Customer Support module. Run from apps/api:
.venv\\Scripts\\python.exe scripts/_gen_helpdesk_module.py
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
HD = SRC / "modules" / "helpdesk"
ALEMBIC = ROOT / "alembic" / "versions"
TESTS = SRC / "tests"
SHARED = SRC / "shared"

FILES_WRITTEN: list[Path] = []

OPT_BRANCH = """
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
"""

WF_FIELDS = """
    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
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
    ("ticket_category", "HdTicketCategory", "TicketCategory", False),
    ("ticket_priority", "HdTicketPriority", "TicketPriority", False),
    ("ticket", "HdTicket", "Ticket", True),
    ("ticket_assignment", "HdTicketAssignment", "TicketAssignment", True),
    ("ticket_status_history", "HdTicketStatusHistory", "TicketStatusHistory", False),
    ("ticket_comment", "HdTicketComment", "TicketComment", False),
    ("ticket_attachment", "HdTicketAttachment", "TicketAttachment", False),
    ("ticket_activity", "HdTicketActivity", "TicketActivity", False),
    ("ticket_sla", "HdTicketSla", "TicketSla", False),
    ("ticket_escalation", "HdTicketEscalation", "TicketEscalation", True),
    ("knowledge_base", "HdKnowledgeBase", "KnowledgeBase", False),
    ("knowledge_article", "HdKnowledgeArticle", "KnowledgeArticle", False),
    ("resolution", "HdResolution", "Resolution", True),
    ("customer_feedback", "HdCustomerFeedback", "CustomerFeedback", False),
    ("support_team", "HdSupportTeam", "SupportTeam", False),
    ("support_shift", "HdSupportShift", "SupportShift", False),
    ("support_schedule", "HdSupportSchedule", "SupportSchedule", True),
    ("ticket_notification", "HdTicketNotification", "TicketNotification", False),
    ("ticket_report", "HdTicketReport", "TicketReport", False),
    ("ticket_dashboard", "HdTicketDashboard", "TicketDashboard", False),
]

CLASS_MAP = {t[0]: t[1] for t in TABLES}

MIGRATIONS: list[tuple[str, str | list[str], str]] = [
    ("0289_create_helpdesk_schema", "schema", "0288_seed_service_workflows"),
    ("0290_hd_ticket_category", "ticket_category", "0289_create_helpdesk_schema"),
    ("0291_hd_ticket_priority", "ticket_priority", "0290_hd_ticket_category"),
    ("0292_hd_ticket", "ticket", "0291_hd_ticket_priority"),
    ("0293_hd_ticket_assignment", "ticket_assignment", "0292_hd_ticket"),
    ("0294_hd_ticket_status_history", "ticket_status_history", "0293_hd_ticket_assignment"),
    ("0295_hd_ticket_comment_attach", ["ticket_comment", "ticket_attachment"], "0294_hd_ticket_status_history"),
    ("0296_hd_ticket_activity", "ticket_activity", "0295_hd_ticket_comment_attach"),
    ("0297_hd_ticket_sla", "ticket_sla", "0296_hd_ticket_activity"),
    ("0298_hd_ticket_escalation", "ticket_escalation", "0297_hd_ticket_sla"),
    ("0299_hd_knowledge_base", "knowledge_base", "0298_hd_ticket_escalation"),
    ("0300_hd_knowledge_article", "knowledge_article", "0299_hd_knowledge_base"),
    ("0301_hd_resolution", "resolution", "0300_hd_knowledge_article"),
    ("0302_hd_customer_feedback", "customer_feedback", "0301_hd_resolution"),
    ("0303_hd_support_team", "support_team", "0302_hd_customer_feedback"),
    ("0304_hd_support_shift", "support_shift", "0303_hd_support_team"),
    ("0305_hd_support_schedule", "support_schedule", "0304_hd_support_shift"),
    ("0306_hd_ticket_notification", "ticket_notification", "0305_hd_support_schedule"),
    ("0307_hd_ticket_report", "ticket_report", "0306_hd_ticket_notification"),
    ("0308_hd_ticket_dashboard", "ticket_dashboard", "0307_hd_ticket_report"),
    ("0309_seed_helpdesk_permissions", "seed_perms", "0308_hd_ticket_dashboard"),
    ("0310_seed_helpdesk_workflows", "seed_wf", "0309_seed_helpdesk_permissions"),
]

# route prefix, schema name, service class, perm resource, branch_required
ROUTE_SPECS: list[tuple[str, str, str, str, bool]] = [
    ("ticket-categories", "TicketCategory", "TicketCategoryService", "helpdesk.category", False),
    ("ticket-priorities", "TicketPriority", "TicketPriorityService", "helpdesk.priority", False),
    ("tickets", "Ticket", "TicketService", "helpdesk.ticket", True),
    ("ticket-assignments", "TicketAssignment", "TicketAssignmentService", "helpdesk.assignment", True),
    ("ticket-status-history", "TicketStatusHistory", "TicketStatusHistoryService", "helpdesk.activity", False),
    ("ticket-comments", "TicketComment", "TicketCommentService", "helpdesk.comment", False),
    ("ticket-attachments", "TicketAttachment", "TicketAttachmentService", "helpdesk.attachment", False),
    ("ticket-activities", "TicketActivity", "TicketActivityService", "helpdesk.activity", False),
    ("ticket-slas", "TicketSla", "TicketSlaService", "helpdesk.sla", False),
    ("ticket-escalations", "TicketEscalation", "TicketEscalationService", "helpdesk.escalation", True),
    ("knowledge-bases", "KnowledgeBase", "KnowledgeBaseService", "helpdesk.knowledge", False),
    ("knowledge-articles", "KnowledgeArticle", "KnowledgeArticleService", "helpdesk.knowledge", False),
    ("resolutions", "Resolution", "ResolutionService", "helpdesk.resolution", True),
    ("customer-feedback", "CustomerFeedback", "CustomerFeedbackService", "helpdesk.feedback", False),
    ("support-teams", "SupportTeam", "SupportTeamService", "helpdesk.team", False),
    ("support-shifts", "SupportShift", "SupportShiftService", "helpdesk.shift", False),
    ("support-schedules", "SupportSchedule", "SupportScheduleService", "helpdesk.schedule", True),
    ("ticket-notifications", "TicketNotification", "TicketNotificationService", "helpdesk.notification", False),
    ("ticket-reports", "TicketReport", "HelpdeskReportService", "helpdesk.report", False),
    ("ticket-dashboards", "TicketDashboard", "HelpdeskDashboardService", "helpdesk.dashboard", False),
]

# ---------------------------------------------------------------------------
# MODEL BODIES — ALL columns from ERD_17 §6
# ---------------------------------------------------------------------------

MODELS: dict[str, str] = {}

MODELS["ticket_category"] = f'''"""Ticket category ORM per ERD_17 section 6.1."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdMasterMixin


class HdTicketCategory(Base, *HdMasterMixin):
    __tablename__ = "hd_ticket_category"
    __table_args__ = (
        UniqueConstraint("company_id", "category_code", name="uk_hd_ticket_category_code"),
        CheckConstraint(
            "status IN ('active','inactive')",
            name="ck_hd_ticket_category_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    category_code: Mapped[str] = mapped_column(String(50), nullable=False)
    category_name: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_category_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket_category.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    default_priority_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "helpdesk.hd_ticket_priority.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_hd_category_default_priority",
        ),
        nullable=True,
        index=True,
    )
    default_sla_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "helpdesk.hd_ticket_sla.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_hd_category_default_sla",
        ),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["ticket_priority"] = f'''"""Ticket priority ORM per ERD_17 section 6.2."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Integer, SmallInteger, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdMasterMixin


class HdTicketPriority(Base, *HdMasterMixin):
    __tablename__ = "hd_ticket_priority"
    __table_args__ = (
        UniqueConstraint("company_id", "priority_code", name="uk_hd_ticket_priority_code"),
        CheckConstraint(
            "status IN ('active','inactive')",
            name="ck_hd_ticket_priority_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    priority_code: Mapped[str] = mapped_column(String(50), nullable=False)
    priority_name: Mapped[str] = mapped_column(String(255), nullable=False)
    rank_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    default_response_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_resolution_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["ticket"] = f'''"""Ticket ORM per ERD_17 section 6.3."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdTransactionMixin


class HdTicket(Base, *HdTransactionMixin):
    __tablename__ = "hd_ticket"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_hd_ticket_doc"),
        CheckConstraint(
            "ticket_type IN ('incident','service_request','problem','change')",
            name="ck_hd_ticket_type",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','new','assigned','in_progress',"
            "'pending','resolved','closed','cancelled')",
            name="ck_hd_ticket_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    category_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket_category.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    priority_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket_priority.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    ticket_type: Mapped[str] = mapped_column(String(40), nullable=False)
    customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    requester_employee_id: Mapped[UUID | None] = mapped_column(
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
    support_team_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "helpdesk.hd_support_team.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_hd_ticket_support_team",
        ),
        nullable=True,
        index=True,
    )
    sla_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "helpdesk.hd_ticket_sla.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_hd_ticket_sla",
        ),
        nullable=True,
        index=True,
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    channel: Mapped[str | None] = mapped_column(String(40), nullable=True)
    impact: Mapped[str | None] = mapped_column(String(20), nullable=True)
    urgency: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sla_status: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    is_shared_queue: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    service_request_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    service_ticket_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    work_order_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    crm_opportunity_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    crm_customer_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    project_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    asset_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    inventory_issue_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    quality_case_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    production_order_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["ticket_assignment"] = f'''"""Ticket assignment ORM per ERD_17 section 6.4."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdTransactionMixin


class HdTicketAssignment(Base, *HdTransactionMixin):
    __tablename__ = "hd_ticket_assignment"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_hd_ticket_assignment_doc"),
        CheckConstraint(
            "role_on_ticket IN ('primary','secondary','watcher')",
            name="ck_hd_ticket_assignment_role",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','active','completed','cancelled')",
            name="ck_hd_ticket_assignment_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    ticket_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assignee_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    support_team_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "helpdesk.hd_support_team.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_hd_assignment_support_team",
        ),
        nullable=True,
        index=True,
    )
    role_on_ticket: Mapped[str] = mapped_column(String(30), nullable=False, default="primary")
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    unassigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["ticket_status_history"] = f'''"""Ticket status history ORM per ERD_17 section 6.5."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdDetailMixin


class HdTicketStatusHistory(Base, *HdDetailMixin):
    __tablename__ = "hd_ticket_status_history"
    __table_args__ = (
        CheckConstraint("status IN ('recorded')", name="ck_hd_ticket_status_history_status"),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    ticket_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    to_status: Mapped[str] = mapped_column(String(30), nullable=False)
    changed_by_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="recorded", index=True)
'''

MODELS["ticket_comment"] = f'''"""Ticket comment ORM per ERD_17 section 6.6."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdDetailMixin


class HdTicketComment(Base, *HdDetailMixin):
    __tablename__ = "hd_ticket_comment"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','deleted_soft')",
            name="ck_hd_ticket_comment_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    ticket_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    author_customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    commented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["ticket_attachment"] = f'''"""Ticket attachment ORM per ERD_17 section 6.7."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdDetailMixin


class HdTicketAttachment(Base, *HdDetailMixin):
    __tablename__ = "hd_ticket_attachment"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','superseded','archived')",
            name="ck_hd_ticket_attachment_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    ticket_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    comment_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket_comment.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    storage_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    uploaded_by_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["ticket_activity"] = f'''"""Ticket activity ORM per ERD_17 section 6.8."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdDetailMixin


class HdTicketActivity(Base, *HdDetailMixin):
    __tablename__ = "hd_ticket_activity"
    __table_args__ = (
        CheckConstraint("status IN ('recorded')", name="ck_hd_ticket_activity_status"),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    ticket_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    activity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    actor_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="recorded", index=True)
'''

MODELS["ticket_sla"] = f'''"""Ticket SLA ORM per ERD_17 section 6.9."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdMasterMixin


class HdTicketSla(Base, *HdMasterMixin):
    __tablename__ = "hd_ticket_sla"
    __table_args__ = (
        UniqueConstraint("company_id", "sla_code", name="uk_hd_ticket_sla_code"),
        CheckConstraint(
            "status IN ('active','inactive')",
            name="ck_hd_ticket_sla_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    sla_code: Mapped[str] = mapped_column(String(50), nullable=False)
    sla_name: Mapped[str] = mapped_column(String(255), nullable=False)
    priority_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket_priority.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    response_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    resolution_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    business_hours_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["ticket_escalation"] = f'''"""Ticket escalation ORM per ERD_17 section 6.10."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdTransactionMixin


class HdTicketEscalation(Base, *HdTransactionMixin):
    __tablename__ = "hd_ticket_escalation"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_hd_ticket_escalation_doc"),
        CheckConstraint(
            "reason_code IN ('sla_at_risk','sla_breached','customer_complaint','management')",
            name="ck_hd_ticket_escalation_reason",
        ),
        CheckConstraint(
            "status IN ('open','acknowledged','resolved','cancelled')",
            name="ck_hd_ticket_escalation_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    ticket_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sla_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket_sla.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    escalation_level: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    reason_code: Mapped[str] = mapped_column(String(40), nullable=False)
    escalated_to_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    escalated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)
{WF_FIELDS}
'''

MODELS["knowledge_base"] = f'''"""Knowledge base ORM per ERD_17 section 6.11."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdMasterMixin


class HdKnowledgeBase(Base, *HdMasterMixin):
    __tablename__ = "hd_knowledge_base"
    __table_args__ = (
        UniqueConstraint("company_id", "kb_code", name="uk_hd_knowledge_base_code"),
        CheckConstraint(
            "status IN ('active','inactive')",
            name="ck_hd_knowledge_base_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    kb_code: Mapped[str] = mapped_column(String(50), nullable=False)
    kb_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["knowledge_article"] = f'''"""Knowledge article ORM per ERD_17 section 6.12."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdDetailMixin


class HdKnowledgeArticle(Base, *HdDetailMixin):
    __tablename__ = "hd_knowledge_article"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_hd_knowledge_article_doc"),
        UniqueConstraint("knowledge_base_id", "article_code", name="uk_hd_knowledge_article_code"),
        CheckConstraint(
            "status IN ('draft','submitted','approved','published','archived','cancelled')",
            name="ck_hd_knowledge_article_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    knowledge_base_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_knowledge_base.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    article_code: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket_category.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    author_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["resolution"] = f'''"""Resolution ORM per ERD_17 section 6.13."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdTransactionMixin


class HdResolution(Base, *HdTransactionMixin):
    __tablename__ = "hd_resolution"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_hd_resolution_doc"),
        CheckConstraint(
            "resolution_code IN ('fixed','workaround','duplicate','cannot_reproduce',"
            "'known_error','other')",
            name="ck_hd_resolution_code",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','completed','cancelled')",
            name="ck_hd_resolution_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    ticket_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    resolution_code: Mapped[str] = mapped_column(String(40), nullable=False)
    resolution_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    knowledge_article_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_knowledge_article.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    resolved_by_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    first_time_fix: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    finance_journal_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["customer_feedback"] = f'''"""Customer feedback ORM per ERD_17 section 6.14."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdDetailMixin


class HdCustomerFeedback(Base, *HdDetailMixin):
    __tablename__ = "hd_customer_feedback"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_hd_customer_feedback_rating"),
        CheckConstraint(
            "status IN ('captured','reviewed','archived')",
            name="ck_hd_customer_feedback_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    ticket_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    channel: Mapped[str | None] = mapped_column(String(40), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="captured", index=True)
'''

MODELS["support_team"] = f'''"""Support team ORM per ERD_17 section 6.15."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdMasterMixin


class HdSupportTeam(Base, *HdMasterMixin):
    __tablename__ = "hd_support_team"
    __table_args__ = (
        UniqueConstraint("company_id", "team_code", name="uk_hd_support_team_code"),
        CheckConstraint(
            "status IN ('active','inactive')",
            name="ck_hd_support_team_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    team_code: Mapped[str] = mapped_column(String(50), nullable=False)
    team_name: Mapped[str] = mapped_column(String(255), nullable=False)
    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    lead_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["support_shift"] = f'''"""Support shift ORM per ERD_17 section 6.16."""

from datetime import time
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdDetailMixin


class HdSupportShift(Base, *HdDetailMixin):
    __tablename__ = "hd_support_shift"
    __table_args__ = (
        UniqueConstraint("support_team_id", "shift_code", name="uk_hd_support_shift_code"),
        CheckConstraint(
            "status IN ('active','inactive')",
            name="ck_hd_support_shift_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    support_team_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_support_team.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shift_code: Mapped[str] = mapped_column(String(50), nullable=False)
    shift_name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["support_schedule"] = f'''"""Support schedule ORM per ERD_17 section 6.17."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdTransactionMixin


class HdSupportSchedule(Base, *HdTransactionMixin):
    __tablename__ = "hd_support_schedule"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_hd_support_schedule_doc"),
        CheckConstraint(
            "status IN ('planned','confirmed','completed','cancelled')",
            name="ck_hd_support_schedule_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    support_team_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_support_team.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    support_shift_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_support_shift.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    schedule_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    planned_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    planned_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="planned", index=True)
'''

MODELS["ticket_notification"] = f'''"""Ticket notification ORM per ERD_17 section 6.18."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdDetailMixin


class HdTicketNotification(Base, *HdDetailMixin):
    __tablename__ = "hd_ticket_notification"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','archived')",
            name="ck_hd_ticket_notification_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    ticket_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    notification_type: Mapped[str] = mapped_column(String(40), nullable=False)
    recipient_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    recipient_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    recipient_customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivery_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["ticket_report"] = f'''"""Ticket report ORM per ERD_17 section 6.19."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdDetailMixin


class HdTicketReport(Base, *HdDetailMixin):
    __tablename__ = "hd_ticket_report"
    __table_args__ = (
        UniqueConstraint("company_id", "report_code", name="uk_hd_ticket_report_code"),
        CheckConstraint(
            "status IN ('draft','finalized')",
            name="ck_hd_ticket_report_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    report_code: Mapped[str] = mapped_column(String(50), nullable=False)
    report_type: Mapped[str] = mapped_column(String(40), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    category_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket_category.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    team_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_support_team.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    metrics_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
'''

MODELS["ticket_dashboard"] = f'''"""Ticket dashboard ORM per ERD_17 section 6.20."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdDetailMixin


class HdTicketDashboard(Base, *HdDetailMixin):
    __tablename__ = "hd_ticket_dashboard"
    __table_args__ = (
        UniqueConstraint("company_id", "dashboard_code", name="uk_hd_ticket_dashboard_code"),
        CheckConstraint(
            "status IN ('active','archived')",
            name="ck_hd_ticket_dashboard_status",
        ),
        {{"schema": "helpdesk"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    dashboard_code: Mapped[str] = mapped_column(String(50), nullable=False)
    dashboard_name: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    layout_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    metrics_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    refreshed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

ENGINE_IMPORTS = """
# ruff: noqa: F401
from modules.helpdesk.domain.enums import (
    CustomerFeedbackStatus,
    KnowledgeArticleStatus,
    KnowledgeBaseStatus,
    ResolutionStatus,
    SupportScheduleStatus,
    SupportShiftStatus,
    SupportTeamStatus,
    TicketActivityStatus,
    TicketAssignmentStatus,
    TicketAttachmentStatus,
    TicketCategoryStatus,
    TicketCommentStatus,
    TicketDashboardStatus,
    TicketEscalationStatus,
    TicketNotificationStatus,
    TicketPriorityStatus,
    TicketReportStatus,
    TicketSlaStatus,
    TicketStatus,
    TicketStatusHistoryStatus,
)
from modules.helpdesk.domain.exceptions import (
    InvalidCustomerFeedbackState,
    InvalidKnowledgeArticleState,
    InvalidKnowledgeBaseState,
    InvalidResolutionState,
    InvalidSupportScheduleState,
    InvalidSupportShiftState,
    InvalidSupportTeamState,
    InvalidTicketActivityState,
    InvalidTicketAssignmentState,
    InvalidTicketAttachmentState,
    InvalidTicketCategoryState,
    InvalidTicketCommentState,
    InvalidTicketDashboardState,
    InvalidTicketEscalationState,
    InvalidTicketNotificationState,
    InvalidTicketPriorityState,
    InvalidTicketReportState,
    InvalidTicketSlaState,
    InvalidTicketState,
    InvalidTicketStatusHistoryState,
)
"""

ENGINE_FILE_MAP = {
    "TicketCategory": "ticket_category",
    "TicketPriority": "ticket_priority",
    "Ticket": "ticket",
    "TicketAssignment": "ticket_assignment",
    "TicketStatusHistory": "ticket_status_history",
    "TicketComment": "ticket_comment",
    "TicketAttachment": "ticket_attachment",
    "TicketActivity": "ticket_activity",
    "TicketSla": "ticket_sla",
    "TicketEscalation": "ticket_escalation",
    "KnowledgeBase": "knowledge_base",
    "KnowledgeArticle": "knowledge_article",
    "Resolution": "resolution",
    "CustomerFeedback": "customer_feedback",
    "SupportTeam": "support_team",
    "SupportShift": "support_shift",
    "SupportSchedule": "support_schedule",
    "TicketNotification": "ticket_notification",
    "TicketReport": "ticket_report",
    "TicketDashboard": "ticket_dashboard",
}

ENGINE_BODIES: dict[str, str] = {
    "TicketCategory": '''
class TicketCategoryEngine:
    def activate(self, row) -> None:
        row.status = TicketCategoryStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = TicketCategoryStatus.INACTIVE.value
''',
    "TicketPriority": '''
class TicketPriorityEngine:
    def activate(self, row) -> None:
        row.status = TicketPriorityStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = TicketPriorityStatus.INACTIVE.value
''',
    "Ticket": '''
class TicketEngine:
    def submit(self, row) -> None:
        if row.status != TicketStatus.DRAFT.value:
            raise InvalidTicketState("Only draft tickets can be submitted")
        if not row.customer_id and not row.requester_employee_id:
            raise InvalidTicketState("Ticket requires customer_id or requester_employee_id")
        row.status = TicketStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != TicketStatus.SUBMITTED.value:
            raise InvalidTicketState("Only submitted tickets can be approved")
        row.status = TicketStatus.APPROVED.value

    def activate(self, row) -> None:
        if row.status != TicketStatus.APPROVED.value:
            raise InvalidTicketState("Only approved tickets can become new")
        row.status = TicketStatus.NEW.value

    def assign(self, row) -> None:
        if row.status not in {TicketStatus.APPROVED.value, TicketStatus.NEW.value}:
            raise InvalidTicketState("Ticket not assignable")
        row.status = TicketStatus.ASSIGNED.value

    def start(self, row) -> None:
        if row.status not in {TicketStatus.ASSIGNED.value, TicketStatus.PENDING.value}:
            raise InvalidTicketState("Ticket not startable")
        row.status = TicketStatus.IN_PROGRESS.value

    def resolve(self, row) -> None:
        if row.status != TicketStatus.IN_PROGRESS.value:
            raise InvalidTicketState("Only in-progress tickets can resolve")
        row.status = TicketStatus.RESOLVED.value

    def close(self, row) -> None:
        if row.status != TicketStatus.RESOLVED.value:
            raise InvalidTicketState("Only resolved tickets can close")
        row.status = TicketStatus.CLOSED.value

    def cancel(self, row) -> None:
        if row.status in {TicketStatus.CLOSED.value, TicketStatus.CANCELLED.value}:
            raise InvalidTicketState("Ticket already terminal")
        row.status = TicketStatus.CANCELLED.value
''',
    "TicketAssignment": '''
class TicketAssignmentEngine:
    def submit(self, row) -> None:
        if row.status != TicketAssignmentStatus.DRAFT.value:
            raise InvalidTicketAssignmentState("Only draft assignments can be submitted")
        row.status = TicketAssignmentStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != TicketAssignmentStatus.SUBMITTED.value:
            raise InvalidTicketAssignmentState("Only submitted assignments can be approved")
        row.status = TicketAssignmentStatus.APPROVED.value

    def activate(self, row) -> None:
        if row.status != TicketAssignmentStatus.APPROVED.value:
            raise InvalidTicketAssignmentState("Only approved assignments can activate")
        row.status = TicketAssignmentStatus.ACTIVE.value

    def complete(self, row) -> None:
        if row.status != TicketAssignmentStatus.ACTIVE.value:
            raise InvalidTicketAssignmentState("Only active assignments can complete")
        row.status = TicketAssignmentStatus.COMPLETED.value

    def cancel(self, row) -> None:
        row.status = TicketAssignmentStatus.CANCELLED.value
''',
    "TicketStatusHistory": '''
class TicketStatusHistoryEngine:
    def record(self, row) -> None:
        row.status = TicketStatusHistoryStatus.RECORDED.value
''',
    "TicketComment": '''
class TicketCommentEngine:
    def soft_delete(self, row) -> None:
        if row.status != TicketCommentStatus.ACTIVE.value:
            raise InvalidTicketCommentState("Only active comments can soft-delete")
        row.status = TicketCommentStatus.DELETED_SOFT.value
''',
    "TicketAttachment": '''
class TicketAttachmentEngine:
    def supersede(self, row) -> None:
        row.status = TicketAttachmentStatus.SUPERSEDED.value

    def archive(self, row) -> None:
        row.status = TicketAttachmentStatus.ARCHIVED.value
''',
    "TicketActivity": '''
class TicketActivityEngine:
    def record(self, row) -> None:
        row.status = TicketActivityStatus.RECORDED.value
''',
    "TicketSla": '''
class TicketSlaEngine:
    def activate(self, row) -> None:
        row.status = TicketSlaStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = TicketSlaStatus.INACTIVE.value
''',
    "TicketEscalation": '''
class TicketEscalationEngine:
    def escalate(self, row) -> None:
        if row.status != TicketEscalationStatus.OPEN.value:
            raise InvalidTicketEscalationState("Only open escalations can escalate further")
        row.escalation_level = int(row.escalation_level or 1) + 1

    def acknowledge(self, row) -> None:
        if row.status != TicketEscalationStatus.OPEN.value:
            raise InvalidTicketEscalationState("Only open escalations can be acknowledged")
        row.status = TicketEscalationStatus.ACKNOWLEDGED.value

    def resolve(self, row) -> None:
        if row.status not in {
            TicketEscalationStatus.OPEN.value,
            TicketEscalationStatus.ACKNOWLEDGED.value,
        }:
            raise InvalidTicketEscalationState("Escalation not resolvable")
        row.status = TicketEscalationStatus.RESOLVED.value

    def cancel(self, row) -> None:
        row.status = TicketEscalationStatus.CANCELLED.value
''',
    "KnowledgeBase": '''
class KnowledgeBaseEngine:
    def activate(self, row) -> None:
        row.status = KnowledgeBaseStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = KnowledgeBaseStatus.INACTIVE.value
''',
    "KnowledgeArticle": '''
class KnowledgeArticleEngine:
    def submit(self, row) -> None:
        if row.status != KnowledgeArticleStatus.DRAFT.value:
            raise InvalidKnowledgeArticleState("Only draft articles can be submitted")
        row.status = KnowledgeArticleStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != KnowledgeArticleStatus.SUBMITTED.value:
            raise InvalidKnowledgeArticleState("Only submitted articles can be approved")
        row.status = KnowledgeArticleStatus.APPROVED.value

    def publish(self, row) -> None:
        if row.status != KnowledgeArticleStatus.APPROVED.value:
            raise InvalidKnowledgeArticleState("Only approved articles can be published")
        row.status = KnowledgeArticleStatus.PUBLISHED.value

    def archive(self, row) -> None:
        row.status = KnowledgeArticleStatus.ARCHIVED.value

    def cancel(self, row) -> None:
        row.status = KnowledgeArticleStatus.CANCELLED.value
''',
    "Resolution": '''
class ResolutionEngine:
    def submit(self, row) -> None:
        if row.status != ResolutionStatus.DRAFT.value:
            raise InvalidResolutionState("Only draft resolutions can be submitted")
        row.status = ResolutionStatus.SUBMITTED.value

    def complete(self, row) -> None:
        if row.status != ResolutionStatus.SUBMITTED.value:
            raise InvalidResolutionState("Only submitted resolutions can complete")
        row.status = ResolutionStatus.COMPLETED.value

    def cancel(self, row) -> None:
        row.status = ResolutionStatus.CANCELLED.value
''',
    "CustomerFeedback": '''
class CustomerFeedbackEngine:
    def review(self, row) -> None:
        if row.status != CustomerFeedbackStatus.CAPTURED.value:
            raise InvalidCustomerFeedbackState("Only captured feedback can be reviewed")
        row.status = CustomerFeedbackStatus.REVIEWED.value

    def archive(self, row) -> None:
        row.status = CustomerFeedbackStatus.ARCHIVED.value
''',
    "SupportTeam": '''
class SupportTeamEngine:
    def activate(self, row) -> None:
        row.status = SupportTeamStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = SupportTeamStatus.INACTIVE.value
''',
    "SupportShift": '''
class SupportShiftEngine:
    def activate(self, row) -> None:
        row.status = SupportShiftStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = SupportShiftStatus.INACTIVE.value
''',
    "SupportSchedule": '''
class SupportScheduleEngine:
    def confirm(self, row) -> None:
        if row.status != SupportScheduleStatus.PLANNED.value:
            raise InvalidSupportScheduleState("Only planned schedules can confirm")
        row.status = SupportScheduleStatus.CONFIRMED.value

    def complete(self, row) -> None:
        if row.status not in {
            SupportScheduleStatus.PLANNED.value,
            SupportScheduleStatus.CONFIRMED.value,
        }:
            raise InvalidSupportScheduleState("Schedule not completable")
        row.status = SupportScheduleStatus.COMPLETED.value

    def cancel(self, row) -> None:
        row.status = SupportScheduleStatus.CANCELLED.value
''',
    "TicketNotification": '''
class TicketNotificationEngine:
    def archive(self, row) -> None:
        row.status = TicketNotificationStatus.ARCHIVED.value
''',
    "TicketReport": '''
class TicketReportEngine:
    def finalize(self, row) -> None:
        if row.status != TicketReportStatus.DRAFT.value:
            raise InvalidTicketReportState("Only draft reports can finalize")
        row.status = TicketReportStatus.FINALIZED.value
''',
    "TicketDashboard": '''
class TicketDashboardEngine:
    def archive(self, row) -> None:
        row.status = TicketDashboardStatus.ARCHIVED.value
''',
}


def gen_scaffold() -> None:
    w(HD / "__init__.py", '"""Helpdesk & Customer Support module — Sprint 17."""\n')
    w(HD / "domain" / "__init__.py", '"""Helpdesk domain layer."""\n')
    w(HD / "adapters" / "__init__.py", '"""Helpdesk cross-module adapters."""\n')
    w(HD / "service" / "__init__.py", '"""Helpdesk services — populated after generation."""\n')
    w(HD / "service" / "engines" / "__init__.py", '"""Helpdesk engines — populated after generation."""\n')
    w(HD / "repository" / "__init__.py", '"""Helpdesk repositories."""\n')
    w(HD / "models" / "__init__.py", '"""Helpdesk models — populated after generation."""\n')
    w(
        HD / "models" / "mixins.py",
        '''"""Helpdesk ORM mixin bundles per ERD_17."""

from database.mixins import (
    AuditMixin,
    BranchMixin,
    CompanyMixin,
    SoftDeleteMixin,
    TenantMixin,
    VersionMixin,
)

HdMasterMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    SoftDeleteMixin,
    VersionMixin,
)

HdTransactionMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    BranchMixin,
    SoftDeleteMixin,
    VersionMixin,
)

HdDetailMixin = (
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
        HD / "domain" / "enums.py",
        '''"""Helpdesk domain enums per ERD_17 section 11."""

from enum import Enum


class TicketCategoryStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class TicketPriorityStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class TicketStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    NEW = "new"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    PENDING = "pending"
    RESOLVED = "resolved"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class TicketAssignmentStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TicketStatusHistoryStatus(str, Enum):
    RECORDED = "recorded"


class TicketCommentStatus(str, Enum):
    ACTIVE = "active"
    DELETED_SOFT = "deleted_soft"


class TicketAttachmentStatus(str, Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    ARCHIVED = "archived"


class TicketActivityStatus(str, Enum):
    RECORDED = "recorded"


class TicketSlaStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class TicketEscalationStatus(str, Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"


class KnowledgeBaseStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class KnowledgeArticleStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    CANCELLED = "cancelled"


class ResolutionStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class CustomerFeedbackStatus(str, Enum):
    CAPTURED = "captured"
    REVIEWED = "reviewed"
    ARCHIVED = "archived"


class SupportTeamStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class SupportShiftStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class SupportScheduleStatus(str, Enum):
    PLANNED = "planned"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TicketNotificationStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class TicketReportStatus(str, Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"


class TicketDashboardStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class HdEntityType(str, Enum):
    TICKET = "ticket"
    ASSIGNMENT = "assignment"
    ESCALATION = "escalation"
    ARTICLE = "article"
    RESOLUTION = "resolution"
    SCHEDULE = "schedule"
    CATEGORY = "category"
    PRIORITY = "priority"
    SLA = "sla"
    KB = "kb"
    TEAM = "team"
    REPORT = "report"
    DASHBOARD = "dashboard"


CODE_PREFIXES: dict[HdEntityType, tuple[str, int, bool]] = {
    HdEntityType.TICKET: ("TKT-", 6, True),
    HdEntityType.ASSIGNMENT: ("HDAS-", 6, True),
    HdEntityType.ESCALATION: ("HDES-", 6, True),
    HdEntityType.ARTICLE: ("HDKA-", 6, True),
    HdEntityType.RESOLUTION: ("HDRES-", 6, True),
    HdEntityType.SCHEDULE: ("HDSS-", 6, True),
    HdEntityType.CATEGORY: ("HDCAT-", 6, False),
    HdEntityType.PRIORITY: ("HDPRI-", 6, False),
    HdEntityType.SLA: ("HDSLA-", 6, False),
    HdEntityType.KB: ("HDKB-", 6, False),
    HdEntityType.TEAM: ("HDTM-", 6, False),
    HdEntityType.REPORT: ("HDRPT-", 6, False),
    HdEntityType.DASHBOARD: ("HDDash-", 6, False),
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
        HD / "domain" / "exceptions.py",
        '"""Helpdesk domain exceptions."""\n\nfrom core.exceptions import ConflictException\n'
        + "".join(exc_lines),
    )
    w(
        HD / "domain" / "value_objects.py",
        '''"""Helpdesk value objects."""

from dataclasses import dataclass


@dataclass(frozen=True)
class HelpdeskCodes:
    document_number: str
''',
    )
    w(
        HD / "domain" / "entities.py",
        '''"""Helpdesk domain entity markers."""

from dataclasses import dataclass
from uuid import UUID


@dataclass
class TicketIdentity:
    ticket_id: UUID
    document_number: str
    customer_id: UUID | None
''',
    )


def gen_models() -> None:
    for key, body in MODELS.items():
        w(HD / "models" / f"{key}.py", body)
    imports = "\n".join(f"from modules.helpdesk.models.{k} import {CLASS_MAP[k]}" for k in CLASS_MAP)
    all_names = ",\n    ".join(f'"{CLASS_MAP[k]}"' for k in CLASS_MAP)
    w(
        HD / "models" / "__init__.py",
        f'"""Helpdesk ORM models."""\n\n{imports}\n\n__all__ = [\n    {all_names},\n]\n',
    )


def gen_migrations() -> None:
    w(
        ALEMBIC / "0289_create_helpdesk_schema.py",
        '''"""Create helpdesk schema."""

from collections.abc import Sequence

from alembic import op

revision: str = "0289_create_helpdesk_schema"
down_revision: str | None = "0288_seed_service_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS helpdesk")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS helpdesk CASCADE")
''',
    )
    for rev, target, down in MIGRATIONS:
        if target == "schema" or (isinstance(target, str) and target.startswith("seed")):
            continue
        if isinstance(target, list):
            imports = "\n".join(
                f"from modules.helpdesk.models.{m} import {CLASS_MAP[m]}  # noqa: F401"
                for m in target
            )
            creates = "\n    ".join(
                f"{CLASS_MAP[m]}.__table__.create(bind=op.get_bind(), checkfirst=True)" for m in target
            )
            drops = "\n    ".join(
                f"{CLASS_MAP[m]}.__table__.drop(bind=op.get_bind(), checkfirst=True)"
                for m in reversed(target)
            )
            w(
                ALEMBIC / f"{rev}.py",
                f'''"""Create helpdesk ticket comment and attachment tables."""

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

from modules.helpdesk.models.{target} import {cls}  # noqa: F401

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
    return f'''"""Helpdesk {cls} repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.helpdesk.models import {cls}
from modules.helpdesk.repository.base import HdScopedRepository, utcnow


class {name}Repository(HdScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> {cls} | None:
        stmt = select({cls}).where({cls}.id == row_id, {cls}.is_deleted.is_(False))
        stmt = self.apply_hd_filter(stmt, {cls}, ctx, branch_scoped={branch})
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select({cls}).where(
            {cls}.company_id == company_id,
            {cls}.is_deleted.is_(False),
        )
        stmt = self.apply_hd_filter(stmt, {cls}, ctx, branch_scoped={branch})
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
        HD / "repository" / "base.py",
        '''"""Helpdesk scoped repository base."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.base import OrgScopedRepository


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class HdScopedRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    @staticmethod
    def apply_hd_filter(stmt, model, ctx: TenantContext, *, branch_scoped: bool = False):
        stmt = HdScopedRepository.apply_tenant_filter(stmt, model, ctx)
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
            HdScopedRepository.ensure_company_access(ctx, company_id)
            return company_id
        if ctx.company_id is None:
            raise ForbiddenException("Company context required")
        return ctx.company_id
''',
    )
    w(
        HD / "repository" / "code_sequence_repository.py",
        '''"""Helpdesk document code sequences."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.helpdesk.domain.enums import CODE_PREFIXES, HdEntityType


class CodeSequenceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def next_code(self, entity: HdEntityType, company_id: UUID, model, code_column: str) -> str:
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
        w(HD / "repository" / f"{module}_repository.py", repo_template(module, cls, name, branch))


def gen_engines() -> None:
    for eng_name, body in ENGINE_BODIES.items():
        fname = ENGINE_FILE_MAP[eng_name]
        w(
            HD / "service" / "engines" / f"{fname}_engine.py",
            f'"""{eng_name} lifecycle engine."""\n{ENGINE_IMPORTS}\n{body}\n',
        )
    lines = [
        f"from modules.helpdesk.service.engines.{ENGINE_FILE_MAP[n]}_engine import {n}Engine"
        for n in ENGINE_BODIES
    ]
    all_names = ",\n    ".join(f'"{n}Engine"' for n in ENGINE_BODIES)
    w(
        HD / "service" / "engines" / "__init__.py",
        '"""Helpdesk business engines."""\n\n'
        + "\n".join(lines)
        + f"\n\n__all__ = [\n    {all_names},\n]\n",
    )


def catalog_service(
    svc_name: str,
    cls: str,
    repo_name: str,
    entity: str,
    branch: bool,
    engine_name: str | None = None,
) -> str:
    eng = engine_name or repo_name
    branch_arg = ", *, branch_id: UUID | None = None" if branch else ""
    branch_fields = (
        "\n        if branch_id is not None:\n"
        "            self._scope.validate_branch_access(ctx, branch_id)\n"
        if branch
        else ""
    )
    branch_create = "branch_id=branch_id," if branch else ""
    return f'''"""{svc_name} application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.helpdesk.models import {cls}
from modules.helpdesk.repository.{entity}_repository import {repo_name}Repository
from modules.helpdesk.service.engines import {eng}Engine
from modules.helpdesk.service.helpdesk_scope_validator import HelpdeskScopeValidator


class {svc_name}:
    def __init__(self, db: Session) -> None:
        self._repo = {repo_name}Repository(db)
        self._scope = HelpdeskScopeValidator(db)
        self._engine = {eng}Engine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> {cls}:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("{svc_name} not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None{branch_arg}, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
{branch_fields}
        row = self._repo.create(ctx, company_id=cid, {branch_create} **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hd_{entity}",
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
    branch_required: bool,
    engine_name: str,
    actions: list[str],
) -> str:
    if branch_required:
        create_body = f'''
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(HdEntityType.{entity_type}, cid, {cls}, "{code_col}")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, {code_col}=doc, **fields)
'''
        create_sig = "self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields"
    else:
        create_body = f'''
        cid = self._scope.resolve_company_id(ctx, company_id)
        doc = self._numbers.generate(HdEntityType.{entity_type}, cid, {cls}, "{code_col}")
        return self._repo.create(ctx, company_id=cid, {code_col}=doc, **fields)
'''
        create_sig = "self, ctx: TenantContext, company_id: UUID | None = None, **fields"

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
from modules.helpdesk.domain.enums import HdEntityType
from modules.helpdesk.models import {cls}
from modules.helpdesk.repository.{entity}_repository import {repo_name}Repository
from modules.helpdesk.service.document_number_service import DocumentNumberService
from modules.helpdesk.service.engines import {engine_name}Engine
from modules.helpdesk.service.helpdesk_scope_validator import HelpdeskScopeValidator


class {svc_name}:
    def __init__(self, db: Session) -> None:
        self._repo = {repo_name}Repository(db)
        self._scope = HelpdeskScopeValidator(db)
        self._numbers = DocumentNumberService(db)
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

    def create({create_sig}):
{create_body}
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
        HD / "service" / "helpdesk_scope_validator.py",
        '''"""Helpdesk scope validator."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.helpdesk.repository.base import HdScopedRepository


class HelpdeskScopeValidator(HdScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def validate_company_access(self, ctx: TenantContext, company_id: UUID) -> None:
        self.ensure_company_access(ctx, company_id)

    def validate_branch_access(self, ctx: TenantContext, branch_id: UUID) -> None:
        self.ensure_branch_access(ctx, branch_id)
''',
    )
    w(
        HD / "service" / "document_number_service.py",
        '''"""Helpdesk document numbering."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.helpdesk.domain.enums import HdEntityType
from modules.helpdesk.repository.code_sequence_repository import CodeSequenceRepository


class DocumentNumberService:
    def __init__(self, db: Session) -> None:
        self._seq = CodeSequenceRepository(db)

    def generate(self, entity: HdEntityType, company_id: UUID, model, code_column: str) -> str:
        return self._seq.next_code(entity, company_id, model, code_column)
''',
    )

    simple = [
        ("TicketCategoryService", "HdTicketCategory", "TicketCategory", "ticket_category", False, "TicketCategory"),
        ("TicketPriorityService", "HdTicketPriority", "TicketPriority", "ticket_priority", False, "TicketPriority"),
        ("TicketStatusHistoryService", "HdTicketStatusHistory", "TicketStatusHistory", "ticket_status_history", False, "TicketStatusHistory"),
        ("TicketCommentService", "HdTicketComment", "TicketComment", "ticket_comment", False, "TicketComment"),
        ("TicketAttachmentService", "HdTicketAttachment", "TicketAttachment", "ticket_attachment", False, "TicketAttachment"),
        ("TicketActivityService", "HdTicketActivity", "TicketActivity", "ticket_activity", False, "TicketActivity"),
        ("TicketSlaService", "HdTicketSla", "TicketSla", "ticket_sla", False, "TicketSla"),
        ("KnowledgeBaseService", "HdKnowledgeBase", "KnowledgeBase", "knowledge_base", False, "KnowledgeBase"),
        ("CustomerFeedbackService", "HdCustomerFeedback", "CustomerFeedback", "customer_feedback", False, "CustomerFeedback"),
        ("SupportTeamService", "HdSupportTeam", "SupportTeam", "support_team", False, "SupportTeam"),
        ("SupportShiftService", "HdSupportShift", "SupportShift", "support_shift", False, "SupportShift"),
        ("TicketNotificationService", "HdTicketNotification", "TicketNotification", "ticket_notification", False, "TicketNotification"),
        ("HelpdeskDashboardService", "HdTicketDashboard", "TicketDashboard", "ticket_dashboard", False, "TicketDashboard"),
    ]
    file_map = {
        "TicketCategoryService": "ticket_category_service.py",
        "TicketPriorityService": "ticket_priority_service.py",
        "TicketStatusHistoryService": "ticket_status_history_service.py",
        "TicketCommentService": "ticket_comment_service.py",
        "TicketAttachmentService": "ticket_attachment_service.py",
        "TicketActivityService": "ticket_activity_service.py",
        "TicketSlaService": "ticket_sla_service.py",
        "KnowledgeBaseService": "knowledge_base_service.py",
        "CustomerFeedbackService": "customer_feedback_service.py",
        "SupportTeamService": "support_team_service.py",
        "SupportShiftService": "support_shift_service.py",
        "TicketNotificationService": "ticket_notification_service.py",
        "HelpdeskDashboardService": "helpdesk_dashboard_service.py",
    }
    for svc, cls, repo, entity, branch, eng in simple:
        w(HD / "service" / file_map[svc], catalog_service(svc, cls, repo, entity, branch, eng))

    w(
        HD / "service" / "ticket_service.py",
        numbered_service(
            "TicketService", "HdTicket", "Ticket", "ticket", "TICKET",
            "document_number", True, "Ticket", ["submit", "approve"],
        ),
    )
    w(
        HD / "service" / "ticket_assignment_service.py",
        numbered_service(
            "TicketAssignmentService", "HdTicketAssignment", "TicketAssignment",
            "ticket_assignment", "ASSIGNMENT", "document_number", True, "TicketAssignment",
            ["submit", "approve", "complete"],
        ),
    )
    w(
        HD / "service" / "ticket_escalation_service.py",
        numbered_service(
            "TicketEscalationService", "HdTicketEscalation", "TicketEscalation",
            "ticket_escalation", "ESCALATION", "document_number", True, "TicketEscalation",
            ["escalate"],
        ),
    )
    w(
        HD / "service" / "knowledge_article_service.py",
        numbered_service(
            "KnowledgeArticleService", "HdKnowledgeArticle", "KnowledgeArticle",
            "knowledge_article", "ARTICLE", "document_number", False, "KnowledgeArticle",
            ["submit", "approve", "publish"],
        ),
    )
    w(
        HD / "service" / "support_schedule_service.py",
        numbered_service(
            "SupportScheduleService", "HdSupportSchedule", "SupportSchedule",
            "support_schedule", "SCHEDULE", "document_number", True, "SupportSchedule",
            [],
        ),
    )
    w(
        HD / "service" / "helpdesk_report_service.py",
        numbered_service(
            "HelpdeskReportService", "HdTicketReport", "TicketReport",
            "ticket_report", "REPORT", "report_code", False, "TicketReport",
            ["finalize"],
        ),
    )

    w(
        HD / "service" / "resolution_service.py",
        '''"""Resolution service — chargeable posts via Finance PostingService only."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.helpdesk.adapters.finance_port import HelpdeskFinanceAdapter
from modules.helpdesk.domain.enums import HdEntityType
from modules.helpdesk.models import HdResolution
from modules.helpdesk.repository.resolution_repository import ResolutionRepository
from modules.helpdesk.service.document_number_service import DocumentNumberService
from modules.helpdesk.service.engines import ResolutionEngine
from modules.helpdesk.service.helpdesk_scope_validator import HelpdeskScopeValidator


class ResolutionService:
    def __init__(self, db: Session) -> None:
        self._repo = ResolutionRepository(db)
        self._scope = HelpdeskScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = ResolutionEngine()
        self._finance = HelpdeskFinanceAdapter(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> HdResolution:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("ResolutionService not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(HdEntityType.RESOLUTION, cid, HdResolution, "document_number")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("ResolutionService not found")
        return row

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def complete(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        chargeable_amount: Decimal | None = None,
        debit_account_id: UUID | None = None,
        credit_account_id: UUID | None = None,
        fiscal_year_id: UUID | None = None,
    ):
        row = self.get(ctx, row_id)
        self._engine.complete(row)
        journal_id = None
        if chargeable_amount is not None and debit_account_id and credit_account_id:
            journal_id = self._finance.post_resolution_charge(
                ctx,
                row,
                amount=chargeable_amount,
                debit_account_id=debit_account_id,
                credit_account_id=credit_account_id,
                fiscal_year_id=fiscal_year_id,
            )
        resolved_at = row.resolved_at or datetime.now(timezone.utc)
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            resolved_at=resolved_at,
            finance_journal_id=journal_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hd_resolution",
            entity_id=row_id,
            operation="complete",
            performed_by=ctx.user_id,
            new_value={"status": row.status, "finance_journal_id": str(journal_id) if journal_id else None},
        )
        return updated
''',
    )

    w(
        HD / "service" / "integration_service.py",
        '''"""Helpdesk integration — cross-module reads / UUID stubs; no peer ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.helpdesk.adapters.master_data_port import HelpdeskMasterDataAdapter
from modules.helpdesk.adapters.organization_port import HelpdeskOrganizationAdapter
from modules.helpdesk.adapters.payroll_port import HelpdeskPayrollAdapter
from modules.helpdesk.adapters.service_port import HelpdeskServiceAdapter


class HelpdeskIntegrationService:
    def __init__(self, db: Session) -> None:
        self._master = HelpdeskMasterDataAdapter(db)
        self._org = HelpdeskOrganizationAdapter(db)
        self._payroll = HelpdeskPayrollAdapter(db)
        self._service = HelpdeskServiceAdapter()

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._master.get_customer(ctx, customer_id)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._master.get_employee(ctx, employee_id)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        return self._org.get_department(ctx, department_id)

    def labor_cost_hint(self, ctx: TenantContext, employee_id: UUID):
        return self._payroll.labor_cost_hint(ctx, employee_id)

    def resolve_service_request(self, service_request_id: UUID | None):
        return self._service.resolve_service_request_uuid(service_request_id)

    def resolve_service_ticket(self, service_ticket_id: UUID | None):
        return self._service.resolve_service_ticket_uuid(service_ticket_id)

    def resolve_work_order(self, work_order_id: UUID | None):
        return self._service.resolve_work_order_uuid(work_order_id)
''',
    )

    w(
        HD / "service" / "application_service.py",
        '''"""Helpdesk application service facade."""

from sqlalchemy.orm import Session

from modules.helpdesk.service.customer_feedback_service import CustomerFeedbackService
from modules.helpdesk.service.helpdesk_dashboard_service import HelpdeskDashboardService
from modules.helpdesk.service.helpdesk_report_service import HelpdeskReportService
from modules.helpdesk.service.integration_service import HelpdeskIntegrationService
from modules.helpdesk.service.knowledge_article_service import KnowledgeArticleService
from modules.helpdesk.service.knowledge_base_service import KnowledgeBaseService
from modules.helpdesk.service.resolution_service import ResolutionService
from modules.helpdesk.service.support_schedule_service import SupportScheduleService
from modules.helpdesk.service.support_shift_service import SupportShiftService
from modules.helpdesk.service.support_team_service import SupportTeamService
from modules.helpdesk.service.ticket_activity_service import TicketActivityService
from modules.helpdesk.service.ticket_assignment_service import TicketAssignmentService
from modules.helpdesk.service.ticket_attachment_service import TicketAttachmentService
from modules.helpdesk.service.ticket_category_service import TicketCategoryService
from modules.helpdesk.service.ticket_comment_service import TicketCommentService
from modules.helpdesk.service.ticket_escalation_service import TicketEscalationService
from modules.helpdesk.service.ticket_notification_service import TicketNotificationService
from modules.helpdesk.service.ticket_priority_service import TicketPriorityService
from modules.helpdesk.service.ticket_service import TicketService
from modules.helpdesk.service.ticket_sla_service import TicketSlaService
from modules.helpdesk.service.ticket_status_history_service import TicketStatusHistoryService


class HelpdeskApplicationService:
    def __init__(self, db: Session) -> None:
        self.categories = TicketCategoryService(db)
        self.priorities = TicketPriorityService(db)
        self.tickets = TicketService(db)
        self.assignments = TicketAssignmentService(db)
        self.status_history = TicketStatusHistoryService(db)
        self.comments = TicketCommentService(db)
        self.attachments = TicketAttachmentService(db)
        self.activities = TicketActivityService(db)
        self.slas = TicketSlaService(db)
        self.escalations = TicketEscalationService(db)
        self.knowledge_bases = KnowledgeBaseService(db)
        self.knowledge_articles = KnowledgeArticleService(db)
        self.resolutions = ResolutionService(db)
        self.feedback = CustomerFeedbackService(db)
        self.teams = SupportTeamService(db)
        self.shifts = SupportShiftService(db)
        self.schedules = SupportScheduleService(db)
        self.notifications = TicketNotificationService(db)
        self.reports = HelpdeskReportService(db)
        self.dashboards = HelpdeskDashboardService(db)
        self.integration = HelpdeskIntegrationService(db)
''',
    )

    svc_exports = [
        "CustomerFeedbackService",
        "HelpdeskApplicationService",
        "HelpdeskDashboardService",
        "HelpdeskIntegrationService",
        "HelpdeskReportService",
        "KnowledgeArticleService",
        "KnowledgeBaseService",
        "ResolutionService",
        "SupportScheduleService",
        "SupportShiftService",
        "SupportTeamService",
        "TicketActivityService",
        "TicketAssignmentService",
        "TicketAttachmentService",
        "TicketCategoryService",
        "TicketCommentService",
        "TicketEscalationService",
        "TicketNotificationService",
        "TicketPriorityService",
        "TicketService",
        "TicketSlaService",
        "TicketStatusHistoryService",
    ]
    import_lines = [
        "from modules.helpdesk.service.application_service import HelpdeskApplicationService",
        "from modules.helpdesk.service.customer_feedback_service import CustomerFeedbackService",
        "from modules.helpdesk.service.helpdesk_dashboard_service import HelpdeskDashboardService",
        "from modules.helpdesk.service.helpdesk_report_service import HelpdeskReportService",
        "from modules.helpdesk.service.integration_service import HelpdeskIntegrationService",
        "from modules.helpdesk.service.knowledge_article_service import KnowledgeArticleService",
        "from modules.helpdesk.service.knowledge_base_service import KnowledgeBaseService",
        "from modules.helpdesk.service.resolution_service import ResolutionService",
        "from modules.helpdesk.service.support_schedule_service import SupportScheduleService",
        "from modules.helpdesk.service.support_shift_service import SupportShiftService",
        "from modules.helpdesk.service.support_team_service import SupportTeamService",
        "from modules.helpdesk.service.ticket_activity_service import TicketActivityService",
        "from modules.helpdesk.service.ticket_assignment_service import TicketAssignmentService",
        "from modules.helpdesk.service.ticket_attachment_service import TicketAttachmentService",
        "from modules.helpdesk.service.ticket_category_service import TicketCategoryService",
        "from modules.helpdesk.service.ticket_comment_service import TicketCommentService",
        "from modules.helpdesk.service.ticket_escalation_service import TicketEscalationService",
        "from modules.helpdesk.service.ticket_notification_service import TicketNotificationService",
        "from modules.helpdesk.service.ticket_priority_service import TicketPriorityService",
        "from modules.helpdesk.service.ticket_service import TicketService",
        "from modules.helpdesk.service.ticket_sla_service import TicketSlaService",
        "from modules.helpdesk.service.ticket_status_history_service import TicketStatusHistoryService",
    ]
    all_names = ",\n    ".join(f'"{n}"' for n in svc_exports)
    w(
        HD / "service" / "__init__.py",
        '"""Helpdesk services."""\n\n'
        + "\n".join(import_lines)
        + f"\n\n__all__ = [\n    {all_names},\n]\n",
    )


def gen_adapters() -> None:
    w(
        HD / "adapters" / "master_data_port.py",
        '''"""Master Data port — customer / employee only (C-01)."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.service.customer_service import CustomerService
from modules.master_data.service.employee_service import EmployeeService


class HelpdeskMasterDataAdapter:
    def __init__(self, db: Session) -> None:
        self._customers = CustomerService(db)
        self._employees = EmployeeService(db)

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._customers.get_customer(ctx, customer_id)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._employees.get_employee(ctx, employee_id)
''',
    )
    w(
        HD / "adapters" / "organization_port.py",
        '''"""Organization port — read org_department only."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.hierarchy_repository import DepartmentRepository


class HelpdeskOrganizationAdapter:
    def __init__(self, db: Session) -> None:
        self._departments = DepartmentRepository(db)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        department = self._departments.get_by_id(ctx, department_id)
        if department is None:
            raise NotFoundException("Department not found")
        return department
''',
    )
    w(
        HD / "adapters" / "finance_port.py",
        '''"""Finance port — JournalService + PostingService.post_system_journal only."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.finance.domain.enums import JournalType
from modules.finance.service.journal_service import JournalService
from modules.finance.service.posting_service import PostingService
from modules.foundation.domain.value_objects import TenantContext
from modules.helpdesk.models import HdResolution


class HelpdeskFinanceAdapter:
    def __init__(self, db: Session) -> None:
        self._journals = JournalService(db)
        self._posting = PostingService(db)

    def post_resolution_charge(
        self,
        ctx: TenantContext,
        row: HdResolution,
        *,
        amount: Decimal,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        amount = amount.quantize(Decimal("0.0001"))
        resolved_branch_id = row.branch_id if row.branch_id is not None else ctx.branch_id
        if resolved_branch_id is None:
            msg = "branch_id is required for helpdesk finance posting"
            raise ValueError(msg)
        journal = self._journals.create_journal(
            ctx,
            company_id=row.company_id,
            branch_id=resolved_branch_id,
            journal_date=date.today(),
            description=f"Helpdesk resolution charge {row.document_number}",
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
            description="Helpdesk resolution debit",
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=2,
            account_id=credit_account_id,
            debit_amount=0,
            credit_amount=float(amount),
            description="Helpdesk resolution credit",
        )
        self._posting.post_system_journal(ctx, journal.id)
        return journal.id
''',
    )
    w(
        HD / "adapters" / "service_port.py",
        '''"""Service port — UUID-only stubs; no svc_* FK / ORM writes."""

from uuid import UUID


class HelpdeskServiceAdapter:
    def resolve_service_request_uuid(self, service_request_id: UUID | None) -> UUID | None:
        return service_request_id

    def resolve_service_ticket_uuid(self, service_ticket_id: UUID | None) -> UUID | None:
        return service_ticket_id

    def resolve_work_order_uuid(self, work_order_id: UUID | None) -> UUID | None:
        return work_order_id
''',
    )
    w(
        HD / "adapters" / "payroll_port.py",
        '''"""Payroll port — read-only labor hint stub; no pay_* writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class HelpdeskPayrollAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def labor_cost_hint(self, ctx: TenantContext, employee_id: UUID) -> dict:
        _ = (ctx, employee_id, self._db)
        return {"read_only": True, "source": "payroll_stub"}
''',
    )


def gen_permissions() -> None:
    w(
        HD / "permissions.py",
        '''"""Helpdesk permission constants per ERD_17 section 14."""

HELPDESK_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("helpdesk.category:read", "helpdesk.category", "read", "helpdesk"),
    ("helpdesk.category:create", "helpdesk.category", "create", "helpdesk"),
    ("helpdesk.category:update", "helpdesk.category", "update", "helpdesk"),
    ("helpdesk.priority:read", "helpdesk.priority", "read", "helpdesk"),
    ("helpdesk.priority:create", "helpdesk.priority", "create", "helpdesk"),
    ("helpdesk.priority:update", "helpdesk.priority", "update", "helpdesk"),
    ("helpdesk.ticket:read", "helpdesk.ticket", "read", "helpdesk"),
    ("helpdesk.ticket:create", "helpdesk.ticket", "create", "helpdesk"),
    ("helpdesk.ticket:update", "helpdesk.ticket", "update", "helpdesk"),
    ("helpdesk.ticket:submit", "helpdesk.ticket", "submit", "helpdesk"),
    ("helpdesk.ticket:approve", "helpdesk.ticket", "approve", "helpdesk"),
    ("helpdesk.assignment:read", "helpdesk.assignment", "read", "helpdesk"),
    ("helpdesk.assignment:create", "helpdesk.assignment", "create", "helpdesk"),
    ("helpdesk.assignment:submit", "helpdesk.assignment", "submit", "helpdesk"),
    ("helpdesk.assignment:approve", "helpdesk.assignment", "approve", "helpdesk"),
    ("helpdesk.assignment:complete", "helpdesk.assignment", "complete", "helpdesk"),
    ("helpdesk.comment:read", "helpdesk.comment", "read", "helpdesk"),
    ("helpdesk.comment:create", "helpdesk.comment", "create", "helpdesk"),
    ("helpdesk.comment:update", "helpdesk.comment", "update", "helpdesk"),
    ("helpdesk.attachment:read", "helpdesk.attachment", "read", "helpdesk"),
    ("helpdesk.attachment:create", "helpdesk.attachment", "create", "helpdesk"),
    ("helpdesk.attachment:update", "helpdesk.attachment", "update", "helpdesk"),
    ("helpdesk.activity:read", "helpdesk.activity", "read", "helpdesk"),
    ("helpdesk.activity:create", "helpdesk.activity", "create", "helpdesk"),
    ("helpdesk.activity:update", "helpdesk.activity", "update", "helpdesk"),
    ("helpdesk.sla:read", "helpdesk.sla", "read", "helpdesk"),
    ("helpdesk.sla:create", "helpdesk.sla", "create", "helpdesk"),
    ("helpdesk.sla:update", "helpdesk.sla", "update", "helpdesk"),
    ("helpdesk.escalation:read", "helpdesk.escalation", "read", "helpdesk"),
    ("helpdesk.escalation:create", "helpdesk.escalation", "create", "helpdesk"),
    ("helpdesk.escalation:update", "helpdesk.escalation", "update", "helpdesk"),
    ("helpdesk.escalation:escalate", "helpdesk.escalation", "escalate", "helpdesk"),
    ("helpdesk.knowledge:read", "helpdesk.knowledge", "read", "helpdesk"),
    ("helpdesk.knowledge:create", "helpdesk.knowledge", "create", "helpdesk"),
    ("helpdesk.knowledge:submit", "helpdesk.knowledge", "submit", "helpdesk"),
    ("helpdesk.knowledge:approve", "helpdesk.knowledge", "approve", "helpdesk"),
    ("helpdesk.knowledge:publish", "helpdesk.knowledge", "publish", "helpdesk"),
    ("helpdesk.resolution:read", "helpdesk.resolution", "read", "helpdesk"),
    ("helpdesk.resolution:create", "helpdesk.resolution", "create", "helpdesk"),
    ("helpdesk.resolution:submit", "helpdesk.resolution", "submit", "helpdesk"),
    ("helpdesk.resolution:complete", "helpdesk.resolution", "complete", "helpdesk"),
    ("helpdesk.feedback:read", "helpdesk.feedback", "read", "helpdesk"),
    ("helpdesk.feedback:create", "helpdesk.feedback", "create", "helpdesk"),
    ("helpdesk.team:read", "helpdesk.team", "read", "helpdesk"),
    ("helpdesk.team:create", "helpdesk.team", "create", "helpdesk"),
    ("helpdesk.team:update", "helpdesk.team", "update", "helpdesk"),
    ("helpdesk.shift:read", "helpdesk.shift", "read", "helpdesk"),
    ("helpdesk.shift:create", "helpdesk.shift", "create", "helpdesk"),
    ("helpdesk.shift:update", "helpdesk.shift", "update", "helpdesk"),
    ("helpdesk.schedule:read", "helpdesk.schedule", "read", "helpdesk"),
    ("helpdesk.schedule:create", "helpdesk.schedule", "create", "helpdesk"),
    ("helpdesk.schedule:update", "helpdesk.schedule", "update", "helpdesk"),
    ("helpdesk.notification:read", "helpdesk.notification", "read", "helpdesk"),
    ("helpdesk.notification:create", "helpdesk.notification", "create", "helpdesk"),
    ("helpdesk.report:read", "helpdesk.report", "read", "helpdesk"),
    ("helpdesk.report:export", "helpdesk.report", "export", "helpdesk"),
    ("helpdesk.dashboard:read", "helpdesk.dashboard", "read", "helpdesk"),
    ("helpdesk.dashboard:export", "helpdesk.dashboard", "export", "helpdesk"),
]

_ALL = [p[0] for p in HELPDESK_PERMISSIONS]

HELPDESK_MANAGER_PERMISSIONS = list(_ALL)
SUPPORT_ENGINEER_PERMISSIONS = [
    p for p in _ALL
    if not any(
        x in p
        for x in (
            ":approve",
            "knowledge:publish",
            "category:create",
            "category:update",
            "priority:create",
            "priority:update",
            "sla:create",
            "sla:update",
            "team:create",
            "team:update",
            "report:export",
            "dashboard:export",
        )
    )
]
HELPDESK_AGENT_PERMISSIONS = [
    p for p in _ALL
    if not any(
        x in p
        for x in (
            ":approve",
            "knowledge:publish",
            "escalation:escalate",
            "category:create",
            "category:update",
            "priority:create",
            "priority:update",
            "sla:create",
            "sla:update",
            "team:create",
            "team:update",
            "shift:create",
            "shift:update",
            "schedule:create",
            "schedule:update",
            "report:export",
            "dashboard:export",
        )
    )
]
HELPDESK_ADMIN_PERMISSIONS = list(_ALL)
''',
    )


def gen_api() -> None:
    w(
        HD / "dependencies.py",
        '''"""Helpdesk module dependencies."""

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
        '"""Helpdesk Pydantic schemas."""',
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
    for _, name, _, _, branch in ROUTE_SPECS:
        schema_lines += [
            "",
            f"class {name}Create(BaseModel):",
            "    company_id: UUID | None = None",
        ]
        if branch:
            schema_lines.append("    branch_id: UUID")
        schema_lines += [
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
    w(HD / "schemas.py", "\n".join(schema_lines) + "\n")

    router_parts: list[str] = [
        '"""Helpdesk API route handlers."""',
        "",
        "from typing import Annotated",
        "from uuid import UUID",
        "",
        "from fastapi import APIRouter, Depends",
        "from sqlalchemy.orm import Session",
        "",
        "from modules.foundation.domain.value_objects import TenantContext",
        "from modules.helpdesk.dependencies import (",
        "    PaginationParams,",
        "    extract_update_fields,",
        "    get_db,",
        "    get_pagination,",
        "    paginate,",
        "    require_permission,",
        ")",
        "from modules.helpdesk.schemas import (",
    ]
    for _, name, _, _, _ in ROUTE_SPECS:
        router_parts.append(f"    {name}Create,")
        router_parts.append(f"    {name}Response,")
        router_parts.append(f"    {name}Update,")
    router_parts += [
        ")",
        "from modules.helpdesk.service import (",
    ]
    for _, _, svc, _, _ in ROUTE_SPECS:
        router_parts.append(f"    {svc},")
    router_parts.append(")")
    router_parts.append("from shared.schemas import APIResponse")
    router_parts.append("")

    exports: list[str] = []
    for prefix, name, svc, perm, branch in ROUTE_SPECS:
        rname = f"{prefix.replace('-', '_')}_router"
        exports.append(rname)
        router_parts.append(f'{rname} = APIRouter(prefix="/{prefix}", tags=["Helpdesk — {name}"])')
        router_parts.append("")
        if branch:
            create_call = (
                f"{svc}(db).create(ctx, branch_id=body.branch_id, "
                f"**body.model_dump(exclude={{'branch_id'}}, exclude_none=True))"
            )
        else:
            create_call = f"{svc}(db).create(ctx, **body.model_dump(exclude_none=True))"

        update_perm = f"{perm}:update"
        create_perm = f"{perm}:create"
        if perm == "helpdesk.report":
            update_perm = "helpdesk.report:export"
            create_perm = "helpdesk.report:export"
        elif perm == "helpdesk.dashboard":
            update_perm = "helpdesk.dashboard:export"
            create_perm = "helpdesk.dashboard:export"
        elif perm == "helpdesk.feedback":
            update_perm = "helpdesk.feedback:create"
        elif perm == "helpdesk.resolution":
            update_perm = "helpdesk.resolution:create"
        elif perm == "helpdesk.knowledge":
            update_perm = "helpdesk.knowledge:create"
        elif perm == "helpdesk.assignment":
            update_perm = "helpdesk.assignment:create"
        elif perm == "helpdesk.notification":
            update_perm = "helpdesk.notification:create"

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
            f'    return APIResponse(message="Updated", data={svc}(db).update(ctx, row_id, **extract_update_fields(body)))',
            "",
        ]

        actions: list[tuple[str, str]] = []
        if svc == "TicketService":
            actions = [("submit", "helpdesk.ticket:submit"), ("approve", "helpdesk.ticket:approve")]
        elif svc == "TicketAssignmentService":
            actions = [
                ("submit", "helpdesk.assignment:submit"),
                ("approve", "helpdesk.assignment:approve"),
                ("complete", "helpdesk.assignment:complete"),
            ]
        elif svc == "TicketEscalationService":
            actions = [("escalate", "helpdesk.escalation:escalate")]
        elif svc == "KnowledgeArticleService":
            actions = [
                ("submit", "helpdesk.knowledge:submit"),
                ("approve", "helpdesk.knowledge:approve"),
                ("publish", "helpdesk.knowledge:publish"),
            ]
        elif svc == "ResolutionService":
            actions = [
                ("submit", "helpdesk.resolution:submit"),
                ("complete", "helpdesk.resolution:complete"),
            ]

        for act, pcode in actions:
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

    w(HD / "routers" / "__init__.py", "\n".join(router_parts) + "\n")

    import_list = ",\n    ".join(exports)
    w(
        HD / "router.py",
        f'''"""Helpdesk module router aggregation."""

from fastapi import APIRouter

from modules.helpdesk.routers import (
    {import_list},
)

helpdesk_router = APIRouter(prefix="/helpdesk")
'''
        + "\n".join(f"helpdesk_router.include_router({e})" for e in exports)
        + "\n",
    )


def gen_tasks_tests() -> None:
    w(
        HD / "tasks.py",
        '''"""Helpdesk Celery task stubs per ERD_17 section 15."""

from workers.celery_app import celery_app


@celery_app.task(name="helpdesk.sla_monitor")
def sla_monitor() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.helpdesk.models import HdTicket

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(HdTicket).where(
                    HdTicket.is_deleted.is_(False),
                    HdTicket.sla_status.in_(["at_risk", "breached"]),
                )
            ).all()
        )
        return {"status": "ok", "at_risk_or_breached": len(rows)}
    finally:
        db.close()


@celery_app.task(name="helpdesk.ticket_assignment_reminders")
def ticket_assignment_reminders() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.helpdesk.models import HdTicket

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(HdTicket).where(
                    HdTicket.is_deleted.is_(False),
                    HdTicket.status.in_(["new", "approved"]),
                )
            ).all()
        )
        return {"status": "ok", "unassigned_tickets": len(rows)}
    finally:
        db.close()


@celery_app.task(name="helpdesk.ticket_escalation_monitor")
def ticket_escalation_monitor() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.helpdesk.models import HdTicketEscalation

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(HdTicketEscalation).where(
                    HdTicketEscalation.is_deleted.is_(False),
                    HdTicketEscalation.status == "open",
                )
            ).all()
        )
        return {"status": "ok", "open_escalations": len(rows)}
    finally:
        db.close()


@celery_app.task(name="helpdesk.knowledge_review_reminders")
def knowledge_review_reminders() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.helpdesk.models import HdKnowledgeArticle

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(HdKnowledgeArticle).where(
                    HdKnowledgeArticle.is_deleted.is_(False),
                    HdKnowledgeArticle.status.in_(["draft", "submitted"]),
                )
            ).all()
        )
        return {"status": "ok", "articles_to_review": len(rows)}
    finally:
        db.close()


@celery_app.task(name="helpdesk.customer_feedback_followups")
def customer_feedback_followups() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.helpdesk.models import HdResolution

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(HdResolution).where(
                    HdResolution.is_deleted.is_(False),
                    HdResolution.status == "completed",
                )
            ).all()
        )
        return {"status": "ok", "completed_resolutions": len(rows)}
    finally:
        db.close()


@celery_app.task(name="helpdesk.retry_finance_posting")
def retry_finance_posting() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.helpdesk.models import HdResolution

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(HdResolution).where(
                    HdResolution.is_deleted.is_(False),
                    HdResolution.status == "completed",
                    HdResolution.finance_journal_id.is_(None),
                )
            ).all()
        )
        return {"status": "ok", "unposted_resolutions": len(rows)}
    finally:
        db.close()
''',
    )

    w(
        TESTS / "unit" / "helpdesk" / "test_helpdesk_engines.py",
        '''"""Unit tests for helpdesk engines."""

from types import SimpleNamespace

from modules.helpdesk.service.engines import (
    KnowledgeArticleEngine,
    ResolutionEngine,
    TicketAssignmentEngine,
    TicketEngine,
    TicketEscalationEngine,
)


def test_ticket_lifecycle():
    engine = TicketEngine()
    row = SimpleNamespace(status="draft", customer_id="c1", requester_employee_id=None)
    engine.submit(row)
    assert row.status == "submitted"
    engine.approve(row)
    assert row.status == "approved"


def test_assignment_complete():
    engine = TicketAssignmentEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    engine.activate(row)
    engine.complete(row)
    assert row.status == "completed"


def test_escalation():
    engine = TicketEscalationEngine()
    row = SimpleNamespace(status="open", escalation_level=1)
    engine.escalate(row)
    assert row.escalation_level == 2
    engine.acknowledge(row)
    assert row.status == "acknowledged"


def test_resolution_complete():
    engine = ResolutionEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.complete(row)
    assert row.status == "completed"


def test_knowledge_publish():
    engine = KnowledgeArticleEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    engine.publish(row)
    assert row.status == "published"
''',
    )

    w(
        TESTS / "unit" / "helpdesk" / "test_helpdesk_tasks.py",
        '''"""Unit tests for helpdesk Celery tasks."""

from modules.helpdesk import tasks as helpdesk_tasks


def test_helpdesk_task_names_registered():
    assert helpdesk_tasks.sla_monitor.name == "helpdesk.sla_monitor"
    assert helpdesk_tasks.ticket_assignment_reminders.name == "helpdesk.ticket_assignment_reminders"
    assert helpdesk_tasks.ticket_escalation_monitor.name == "helpdesk.ticket_escalation_monitor"
    assert helpdesk_tasks.knowledge_review_reminders.name == "helpdesk.knowledge_review_reminders"
    assert helpdesk_tasks.customer_feedback_followups.name == "helpdesk.customer_feedback_followups"
    assert helpdesk_tasks.retry_finance_posting.name == "helpdesk.retry_finance_posting"
''',
    )

    w(
        TESTS / "security" / "helpdesk" / "test_helpdesk_permissions.py",
        '''"""Helpdesk RBAC permission tests."""

from modules.helpdesk.permissions import (
    HELPDESK_ADMIN_PERMISSIONS,
    HELPDESK_AGENT_PERMISSIONS,
    HELPDESK_MANAGER_PERMISSIONS,
    HELPDESK_PERMISSIONS,
    SUPPORT_ENGINEER_PERMISSIONS,
)


def test_helpdesk_permissions_defined():
    assert len(HELPDESK_PERMISSIONS) >= 40
    assert "helpdesk.ticket:approve" in [p[0] for p in HELPDESK_PERMISSIONS]
    assert "helpdesk.knowledge:publish" in [p[0] for p in HELPDESK_PERMISSIONS]


def test_helpdesk_roles():
    assert HELPDESK_MANAGER_PERMISSIONS
    assert HELPDESK_AGENT_PERMISSIONS
    assert SUPPORT_ENGINEER_PERMISSIONS
    assert HELPDESK_ADMIN_PERMISSIONS
    assert "helpdesk.ticket:approve" in HELPDESK_MANAGER_PERMISSIONS
    assert "helpdesk.knowledge:publish" in HELPDESK_ADMIN_PERMISSIONS
''',
    )

    w(
        TESTS / "integration" / "helpdesk" / "test_helpdesk_module_import.py",
        '''"""Integration smoke: Helpdesk module imports and router mount."""

from modules.helpdesk.models import HdTicket, HdTicketCategory, HdResolution
from modules.helpdesk.router import helpdesk_router
from modules.helpdesk.service import (
    HelpdeskApplicationService,
    HelpdeskDashboardService,
    HelpdeskIntegrationService,
    HelpdeskReportService,
    TicketService,
)
from modules.helpdesk.service.engines import TicketEngine, ResolutionEngine


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
''',
    )


def gen_seeds() -> None:
    w(
        ALEMBIC / "0309_seed_helpdesk_permissions.py",
        '''"""Seed helpdesk permissions and roles."""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.helpdesk.permissions import (
    HELPDESK_ADMIN_PERMISSIONS,
    HELPDESK_AGENT_PERMISSIONS,
    HELPDESK_MANAGER_PERMISSIONS,
    HELPDESK_PERMISSIONS,
    SUPPORT_ENGINEER_PERMISSIONS,
)

revision: str = "0309_seed_helpdesk_permissions"
down_revision: str | None = "0308_hd_ticket_dashboard"
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
    ("HELPDESK_AGENT", "Helpdesk Agent", HELPDESK_AGENT_PERMISSIONS),
    ("HELPDESK_MANAGER", "Helpdesk Manager", HELPDESK_MANAGER_PERMISSIONS),
    ("SUPPORT_ENGINEER", "Support Engineer", SUPPORT_ENGINEER_PERMISSIONS),
    ("HELPDESK_ADMIN", "Helpdesk Admin", HELPDESK_ADMIN_PERMISSIONS),
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
    for code, resource, action, module in HELPDESK_PERMISSIONS:
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
    for code, _, _, _ in HELPDESK_PERMISSIONS:
        conn.execute(
            sa.text("DELETE FROM foundation.sec_permission WHERE permission_code = :code"),
            {"code": code},
        )
''',
    )

    w(
        ALEMBIC / "0310_seed_helpdesk_workflows.py",
        '''"""Seed helpdesk workflow definitions per ERD_17."""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0310_seed_helpdesk_workflows"
down_revision: str | None = "0309_seed_helpdesk_permissions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

WORKFLOWS: list[tuple[str, str, str, list[tuple[int, str, str, str]]]] = [
    (
        "HD_TICKET_APPROVAL",
        "Helpdesk Ticket Approval",
        "hd_ticket",
        [
            (1, "HELPDESK_AGENT", "Agent Submit", "role"),
            (2, "HELPDESK_MANAGER", "Helpdesk Manager Approval", "role"),
        ],
    ),
    (
        "HD_ASSIGNMENT_APPROVAL",
        "Helpdesk Assignment Approval",
        "hd_ticket_assignment",
        [
            (1, "HELPDESK_AGENT", "Coordinator Submit", "role"),
            (2, "HELPDESK_MANAGER", "Helpdesk Manager Approval", "role"),
        ],
    ),
    (
        "HD_SLA_ESCALATION",
        "Helpdesk SLA Escalation",
        "hd_ticket_escalation",
        [
            (1, "HELPDESK_AGENT", "Agent Escalation", "role"),
            (2, "SUPPORT_ENGINEER", "Supervisor Escalation", "role"),
            (3, "HELPDESK_MANAGER", "Manager Escalation", "role"),
        ],
    ),
    (
        "HD_RESOLUTION_APPROVAL",
        "Helpdesk Resolution Approval",
        "hd_resolution",
        [
            (1, "SUPPORT_ENGINEER", "Engineer Submit", "role"),
            (2, "HELPDESK_MANAGER", "Helpdesk Manager Approval", "role"),
        ],
    ),
    (
        "HD_KNOWLEDGE_APPROVAL",
        "Helpdesk Knowledge Approval",
        "hd_knowledge_article",
        [
            (1, "SUPPORT_ENGINEER", "Author Submit", "role"),
            (2, "HELPDESK_MANAGER", "Helpdesk Manager Approval", "role"),
            (3, "HELPDESK_ADMIN", "Admin Publish", "role"),
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
                        (id, tenant_id, workflow_code, workflow_name, document_type,
                         version_no, is_active, is_parallel, status,
                         created_at, updated_at, is_deleted, version)
                        VALUES
                        (:id, :tid, :code, :name, :dtype,
                         1, true, false, 'active',
                         :now, :now, false, 1)
                        """
                    ),
                    {
                        "id": wf_id,
                        "tid": tid,
                        "code": workflow_code,
                        "name": workflow_name,
                        "dtype": document_type,
                        "now": now,
                    },
                )
            for step_no, role_code, step_name, assignee_type in steps:
                step_exists = conn.execute(
                    sa.text(
                        """
                        SELECT 1 FROM foundation.wf_step
                        WHERE definition_id = :wid AND step_no = :sno
                        """
                    ),
                    {"wid": wf_id, "sno": step_no},
                ).first()
                if step_exists:
                    continue
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.wf_step
                        (id, tenant_id, definition_id, step_no, step_name,
                         assignee_type, assignee_role_code, status,
                         created_at, updated_at, is_deleted, version)
                        VALUES
                        (:id, :tid, :wid, :sno, :sname,
                         :atype, :role, 'active',
                         :now, :now, false, 1)
                        """
                    ),
                    {
                        "id": str(uuid4()),
                        "tid": tid,
                        "wid": wf_id,
                        "sno": step_no,
                        "sname": step_name,
                        "atype": assignee_type,
                        "role": role_code,
                        "now": now,
                    },
                )


def downgrade() -> None:
    conn = op.get_bind()
    for workflow_code, _, _, _ in reversed(WORKFLOWS):
        conn.execute(
            sa.text(
                """
                DELETE FROM foundation.wf_step
                WHERE definition_id IN (
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
        "from modules.service.router import service_router\n",
        "from modules.service.router import service_router\n"
        "from modules.helpdesk.router import helpdesk_router\n",
    )
    patch_file(
        SHARED / "router.py",
        "api_v1_router.include_router(service_router)\n",
        "api_v1_router.include_router(service_router)\n"
        "api_v1_router.include_router(helpdesk_router)\n",
    )
    patch_file(
        ROOT / "alembic" / "env.py",
        "import modules.service.models  # noqa: F401 — register ORM metadata\n",
        "import modules.service.models  # noqa: F401 — register ORM metadata\n"
        "import modules.helpdesk.models  # noqa: F401 — register ORM metadata\n",
    )
    patch_file(
        ROOT / "src" / "workers" / "celery_app.py",
        '        "modules.service",\n',
        '        "modules.service",\n        "modules.helpdesk",\n',
    )
    patch_file(
        ROOT / "pyproject.toml",
        '    "modules.service.*",\n',
        '    "modules.service.*",\n    "modules.helpdesk.*",\n',
    )
    patch_file(
        ROOT / "pyproject.toml",
        '"src/modules/service/**" = ["E501", "SIM102"]\n'
        '"src/modules/service/domain/enums.py" = ["UP042"]\n',
        '"src/modules/service/**" = ["E501", "SIM102"]\n'
        '"src/modules/service/domain/enums.py" = ["UP042"]\n'
        '"src/modules/helpdesk/**" = ["E501", "SIM102"]\n'
        '"src/modules/helpdesk/domain/enums.py" = ["UP042"]\n',
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
    print(f"OK helpdesk module generated — {len(FILES_WRITTEN)} files")
    print("Alembic head revision: 0310_seed_helpdesk_workflows")


if __name__ == "__main__":
    main()
