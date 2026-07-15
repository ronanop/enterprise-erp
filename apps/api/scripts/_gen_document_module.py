"""Generate Sprint 18 Document Management System module. Run from apps/api:
.venv\\Scripts\\python.exe scripts/_gen_document_module.py
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
DOC = SRC / "modules" / "document"
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
    ("folder", "DocFolder", "Folder", False),
    ("document", "DocDocument", "Document", True),
    ("document_version", "DocDocumentVersion", "DocumentVersion", False),
    ("document_metadata", "DocDocumentMetadata", "DocumentMetadata", False),
    ("document_tag", "DocDocumentTag", "DocumentTag", False),
    ("document_tag_map", "DocDocumentTagMap", "DocumentTagMap", False),
    ("document_permission", "DocDocumentPermission", "DocumentPermission", False),
    ("document_share", "DocDocumentShare", "DocumentShare", False),
    ("document_comment", "DocDocumentComment", "DocumentComment", False),
    ("document_approval", "DocDocumentApproval", "DocumentApproval", True),
    ("document_workflow", "DocDocumentWorkflow", "DocumentWorkflow", False),
    ("document_checkout", "DocDocumentCheckout", "DocumentCheckout", True),
    ("document_audit", "DocDocumentAudit", "DocumentAudit", False),
    ("document_attachment", "DocDocumentAttachment", "DocumentAttachment", False),
    ("template", "DocTemplate", "Template", False),
    ("template_field", "DocTemplateField", "TemplateField", False),
    ("retention_policy", "DocRetentionPolicy", "RetentionPolicy", False),
    ("archive", "DocArchive", "Archive", True),
    ("notification", "DocNotification", "Notification", False),
    ("report", "DocReport", "Report", False),
]

CLASS_MAP = {t[0]: t[1] for t in TABLES}

MIGRATIONS: list[tuple[str, str | list[str], str]] = [
    ("0311_create_document_schema", "schema", "0310_seed_helpdesk_workflows"),
    ("0312_doc_folder", "folder", "0311_create_document_schema"),
    ("0313_doc_document", "document", "0312_doc_folder"),
    ("0314_doc_document_version", "document_version", "0313_doc_document"),
    ("0315_doc_document_metadata", "document_metadata", "0314_doc_document_version"),
    ("0316_doc_tag_and_map", ["document_tag", "document_tag_map"], "0315_doc_document_metadata"),
    ("0317_doc_document_permission", "document_permission", "0316_doc_tag_and_map"),
    ("0318_doc_document_share", "document_share", "0317_doc_document_permission"),
    ("0319_doc_document_comment", "document_comment", "0318_doc_document_share"),
    ("0320_doc_document_approval", "document_approval", "0319_doc_document_comment"),
    ("0321_doc_document_workflow", "document_workflow", "0320_doc_document_approval"),
    ("0322_doc_document_checkout", "document_checkout", "0321_doc_document_workflow"),
    ("0323_doc_document_audit", "document_audit", "0322_doc_document_checkout"),
    ("0324_doc_document_attachment", "document_attachment", "0323_doc_document_audit"),
    ("0325_doc_template", "template", "0324_doc_document_attachment"),
    ("0326_doc_template_field", "template_field", "0325_doc_template"),
    ("0327_doc_retention_policy", "retention_policy", "0326_doc_template_field"),
    ("0328_doc_archive", "archive", "0327_doc_retention_policy"),
    ("0329_doc_notification", "notification", "0328_doc_archive"),
    ("0330_doc_report", "report", "0329_doc_notification"),
    ("0331_seed_document_permissions", "seed_perms", "0330_doc_report"),
    ("0332_seed_document_workflows", "seed_wf", "0331_seed_document_permissions"),
]

# route prefix, schema name, service class, perm resource, branch_required
ROUTE_SPECS: list[tuple[str, str, str, str, bool]] = [
    ("folders", "Folder", "FolderService", "document.folder", False),
    ("documents", "Document", "DocumentService", "document.document", True),
    ("document-versions", "DocumentVersion", "DocumentVersionService", "document.version", False),
    ("document-metadata", "DocumentMetadata", "MetadataService", "document.metadata", False),
    ("document-tags", "DocumentTag", "TagService", "document.tag", False),
    ("document-tag-maps", "DocumentTagMap", "TagService", "document.tag", False),
    ("document-permissions", "DocumentPermission", "PermissionService", "document.permission", False),
    ("document-shares", "DocumentShare", "ShareService", "document.share", False),
    ("document-comments", "DocumentComment", "CommentService", "document.comment", False),
    ("document-approvals", "DocumentApproval", "ApprovalService", "document.approval", True),
    ("document-workflows", "DocumentWorkflow", "WorkflowService", "document.workflow", False),
    ("document-checkouts", "DocumentCheckout", "CheckoutService", "document.checkout", True),
    ("document-audits", "DocumentAudit", "DocumentAuditService", "document.audit", False),
    ("document-attachments", "DocumentAttachment", "AttachmentService", "document.attachment", False),
    ("templates", "Template", "TemplateService", "document.template", False),
    ("template-fields", "TemplateField", "TemplateService", "document.template", False),
    ("retention-policies", "RetentionPolicy", "RetentionPolicyService", "document.retention", False),
    ("archives", "Archive", "ArchiveService", "document.archive", True),
    ("notifications", "Notification", "NotificationService", "document.notification", False),
    ("reports", "Report", "DocumentReportService", "document.report", False),
]

ENGINE_NAMES = [
    "Folder",
    "Document",
    "DocumentVersion",
    "DocumentMetadata",
    "DocumentTag",
    "DocumentTagMap",
    "DocumentPermission",
    "DocumentShare",
    "DocumentComment",
    "DocumentApproval",
    "DocumentWorkflow",
    "DocumentCheckout",
    "DocumentAudit",
    "DocumentAttachment",
    "Template",
    "TemplateField",
    "RetentionPolicy",
    "Archive",
    "Notification",
    "Report",
]

ENGINE_FILE_MAP = {
    "Folder": "folder",
    "Document": "document",
    "DocumentVersion": "document_version",
    "DocumentMetadata": "document_metadata",
    "DocumentTag": "document_tag",
    "DocumentTagMap": "document_tag_map",
    "DocumentPermission": "document_permission",
    "DocumentShare": "document_share",
    "DocumentComment": "document_comment",
    "DocumentApproval": "document_approval",
    "DocumentWorkflow": "document_workflow",
    "DocumentCheckout": "document_checkout",
    "DocumentAudit": "document_audit",
    "DocumentAttachment": "document_attachment",
    "Template": "template",
    "TemplateField": "template_field",
    "RetentionPolicy": "retention_policy",
    "Archive": "archive",
    "Notification": "notification",
    "Report": "report",
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


def _doc_fk(nullable: bool = False) -> str:
    null = "True" if nullable else "False"
    mapped = "UUID | None" if nullable else "UUID"
    return f'''
    document_id: Mapped[{mapped}] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_document.id", ondelete="RESTRICT"),
        nullable={null},
        index=True,
    )'''


MODELS: dict[str, str] = {}

MODELS["folder"] = f'''"""Folder ORM per ERD_18 section 6.1."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocMasterMixin


class DocFolder(Base, *DocMasterMixin):
    __tablename__ = "doc_folder"
    __table_args__ = (
        UniqueConstraint("company_id", "folder_code", name="uk_doc_folder_code"),
        CheckConstraint(
            "folder_type IN ('system','business','user')",
            name="ck_doc_folder_type",
        ),
        CheckConstraint(
            "status IN ('active','inactive','archived')",
            name="ck_doc_folder_status",
        ),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    folder_code: Mapped[str] = mapped_column(String(50), nullable=False)
    folder_name: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_folder_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_folder.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    folder_type: Mapped[str] = mapped_column(String(30), nullable=False, default="business")
{_dept_fk()}
{_emp_fk("owner_employee_id")}
    path_label: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["document"] = f'''"""Document ORM per ERD_18 section 6.2."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocTransactionMixin


class DocDocument(Base, *DocTransactionMixin):
    __tablename__ = "doc_document"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_doc_document_number"),
        CheckConstraint(
            "classification_level IN ('public','internal','confidential','restricted')",
            name="ck_doc_document_classification",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','published','checked_out',"
            "'archived','expired','disposed','cancelled')",
            name="ck_doc_document_status",
        ),
        CheckConstraint("file_size_bytes IS NULL OR file_size_bytes >= 0", name="ck_doc_document_size"),
        Index("ix_doc_document_tenant_co_status", "tenant_id", "company_id", "status"),
        Index("ix_doc_document_classification", "classification_level"),
        Index("ix_doc_document_expires_at", "expires_at"),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    folder_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_folder.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    classification_level: Mapped[str] = mapped_column(String(30), nullable=False, default="internal")
    document_category: Mapped[str | None] = mapped_column(String(40), nullable=True)
{_emp_fk("owner_employee_id", nullable=False)}
    customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
{_dept_fk()}
    template_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "document.doc_template.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_doc_document_template",
        ),
        nullable=True,
        index=True,
    )
    retention_policy_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "document.doc_retention_policy.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_doc_document_retention",
        ),
        nullable=True,
        index=True,
    )
    workflow_config_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "document.doc_document_workflow.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_doc_document_workflow_cfg",
        ),
        nullable=True,
        index=True,
    )
    current_version_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    mime_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    file_extension: Mapped[str | None] = mapped_column(String(20), nullable=True)
    storage_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    helpdesk_ticket_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    service_request_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    project_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    asset_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    crm_opportunity_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    inventory_ref_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    production_order_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    quality_ref_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    finance_journal_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["document_version"] = f'''"""Document version ORM per ERD_18 section 6.3."""

from uuid import UUID, uuid4

from sqlalchemy import BigInteger, Boolean, CheckConstraint, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocDocumentVersion(Base, *DocDetailMixin):
    __tablename__ = "doc_document_version"
    __table_args__ = (
        UniqueConstraint("document_id", "version_no", name="uk_doc_document_version_no"),
        CheckConstraint(
            "status IN ('active','superseded','deleted_soft')",
            name="ck_doc_document_version_status",
        ),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{_doc_fk()}
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    change_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
{_emp_fk("created_by_employee_id")}
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["document_metadata"] = f'''"""Document metadata ORM per ERD_18 section 6.4."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocDocumentMetadata(Base, *DocDetailMixin):
    __tablename__ = "doc_document_metadata"
    __table_args__ = (
        UniqueConstraint("document_id", "meta_key", name="uk_doc_document_metadata_key"),
        CheckConstraint(
            "value_type IN ('string','number','date','boolean','json')",
            name="ck_doc_document_metadata_type",
        ),
        CheckConstraint("status IN ('active','inactive')", name="ck_doc_document_metadata_status"),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{_doc_fk()}
    meta_key: Mapped[str] = mapped_column(String(100), nullable=False)
    meta_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_type: Mapped[str] = mapped_column(String(20), nullable=False, default="string")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["document_tag"] = '''"""Document tag ORM per ERD_18 section 6.5."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocMasterMixin


class DocDocumentTag(Base, *DocMasterMixin):
    __tablename__ = "doc_document_tag"
    __table_args__ = (
        UniqueConstraint("company_id", "tag_code", name="uk_doc_document_tag_code"),
        CheckConstraint("status IN ('active','inactive')", name="ck_doc_document_tag_status"),
        {"schema": "document"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    tag_code: Mapped[str] = mapped_column(String(50), nullable=False)
    tag_name: Mapped[str] = mapped_column(String(255), nullable=False)
    tag_group: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["document_tag_map"] = f'''"""Document tag map ORM per ERD_18 section 6.6."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocDocumentTagMap(Base, *DocDetailMixin):
    __tablename__ = "doc_document_tag_map"
    __table_args__ = (
        UniqueConstraint("document_id", "tag_id", name="uk_doc_document_tag_map"),
        CheckConstraint("status IN ('active','removed')", name="ck_doc_document_tag_map_status"),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{_doc_fk()}
    tag_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_document_tag.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
{_emp_fk("tagged_by_employee_id")}
    tagged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["document_permission"] = f'''"""Document permission ORM per ERD_18 section 6.7."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocDocumentPermission(Base, *DocDetailMixin):
    __tablename__ = "doc_document_permission"
    __table_args__ = (
        CheckConstraint(
            "grantee_type IN ('employee','role','department')",
            name="ck_doc_document_permission_grantee",
        ),
        CheckConstraint(
            "permission_level IN ('view','comment','edit','approve','admin')",
            name="ck_doc_document_permission_level",
        ),
        CheckConstraint("status IN ('active','revoked')", name="ck_doc_document_permission_status"),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{_doc_fk(nullable=True)}
    folder_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_folder.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    grantee_type: Mapped[str] = mapped_column(String(30), nullable=False)
{_emp_fk("grantee_employee_id")}
    grantee_role_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
{_dept_fk("grantee_department_id")}
    permission_level: Mapped[str] = mapped_column(String(30), nullable=False, default="view")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["document_share"] = f'''"""Document share ORM per ERD_18 section 6.8."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocDocumentShare(Base, *DocDetailMixin):
    __tablename__ = "doc_document_share"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_doc_document_share_number"),
        CheckConstraint("permission_level IN ('view','comment')", name="ck_doc_document_share_level"),
        CheckConstraint(
            "status IN ('active','expired','revoked')",
            name="ck_doc_document_share_status",
        ),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
{_doc_fk()}
{_emp_fk("shared_with_employee_id")}
    shared_with_customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    share_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    permission_level: Mapped[str] = mapped_column(String(30), nullable=False, default="view")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["document_comment"] = f'''"""Document comment ORM per ERD_18 section 6.9."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocDocumentComment(Base, *DocDetailMixin):
    __tablename__ = "doc_document_comment"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','deleted_soft')",
            name="ck_doc_document_comment_status",
        ),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{_doc_fk()}
    version_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
{_emp_fk("author_employee_id", nullable=False)}
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    commented_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["document_approval"] = f'''"""Document approval ORM per ERD_18 section 6.10."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocTransactionMixin


class DocDocumentApproval(Base, *DocTransactionMixin):
    __tablename__ = "doc_document_approval"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_doc_document_approval_number"),
        CheckConstraint(
            "approval_type IN ('content_approval','publish','archive')",
            name="ck_doc_document_approval_type",
        ),
        CheckConstraint(
            "decision IN ('pending','approved','rejected')",
            name="ck_doc_document_approval_decision",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','completed','cancelled')",
            name="ck_doc_document_approval_status",
        ),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_doc_fk()}
    approval_type: Mapped[str] = mapped_column(String(40), nullable=False, default="content_approval")
{_emp_fk("requested_by_employee_id", nullable=False)}
{_emp_fk("approver_employee_id")}
    decision: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["document_workflow"] = '''"""Document workflow config ORM per ERD_18 section 6.11."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocMasterMixin


class DocDocumentWorkflow(Base, *DocMasterMixin):
    __tablename__ = "doc_document_workflow"
    __table_args__ = (
        UniqueConstraint("company_id", "workflow_code", name="uk_doc_document_workflow_code"),
        CheckConstraint("status IN ('active','inactive')", name="ck_doc_document_workflow_status"),
        {"schema": "document"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    workflow_code: Mapped[str] = mapped_column(String(80), nullable=False)
    workflow_name: Mapped[str] = mapped_column(String(255), nullable=False)
    applies_to_category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    foundation_workflow_code: Mapped[str] = mapped_column(String(80), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["document_checkout"] = f'''"""Document checkout ORM per ERD_18 section 6.12."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocTransactionMixin


class DocDocumentCheckout(Base, *DocTransactionMixin):
    __tablename__ = "doc_document_checkout"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_doc_document_checkout_number"),
        CheckConstraint(
            "status IN ('draft','active','submitted','completed','cancelled')",
            name="ck_doc_document_checkout_status",
        ),
        Index("ix_doc_checkout_by_emp_status", "checked_out_by_employee_id", "status"),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_doc_fk()}
{_emp_fk("checked_out_by_employee_id", nullable=False)}
    checked_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_back_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lock_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["document_audit"] = f'''"""Document audit ORM per ERD_18 section 6.13."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocDocumentAudit(Base, *DocDetailMixin):
    __tablename__ = "doc_document_audit"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('created','uploaded','viewed','downloaded','edited','approved',"
            "'published','shared','checked_out','checked_in','archived','deleted','other')",
            name="ck_doc_document_audit_event",
        ),
        CheckConstraint("status IN ('recorded')", name="ck_doc_document_audit_status"),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{_doc_fk()}
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
{_emp_fk("actor_employee_id")}
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="recorded", index=True)
'''

MODELS["document_attachment"] = f'''"""Document attachment ORM per ERD_18 section 6.14."""

from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocDocumentAttachment(Base, *DocDetailMixin):
    __tablename__ = "doc_document_attachment"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','superseded','archived')",
            name="ck_doc_document_attachment_status",
        ),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{_doc_fk()}
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    storage_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
{_emp_fk("uploaded_by_employee_id")}
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["template"] = f'''"""Template ORM per ERD_18 section 6.15."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocMasterMixin


class DocTemplate(Base, *DocMasterMixin):
    __tablename__ = "doc_template"
    __table_args__ = (
        UniqueConstraint("company_id", "template_code", name="uk_doc_template_code"),
        CheckConstraint(
            "status IN ('active','inactive','archived')",
            name="ck_doc_template_status",
        ),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    template_code: Mapped[str] = mapped_column(String(50), nullable=False)
    template_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    storage_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
{_emp_fk("owner_employee_id")}
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["template_field"] = '''"""Template field ORM per ERD_18 section 6.16."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocTemplateField(Base, *DocDetailMixin):
    __tablename__ = "doc_template_field"
    __table_args__ = (
        UniqueConstraint("template_id", "field_code", name="uk_doc_template_field_code"),
        CheckConstraint(
            "field_type IN ('text','number','date','boolean','list')",
            name="ck_doc_template_field_type",
        ),
        CheckConstraint("status IN ('active','inactive')", name="ck_doc_template_field_status"),
        {"schema": "document"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    template_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_template.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    field_code: Mapped[str] = mapped_column(String(80), nullable=False)
    field_label: Mapped[str] = mapped_column(String(255), nullable=False)
    field_type: Mapped[str] = mapped_column(String(30), nullable=False, default="text")
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    default_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["retention_policy"] = f'''"""Retention policy ORM per ERD_18 section 6.17."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocMasterMixin


class DocRetentionPolicy(Base, *DocMasterMixin):
    __tablename__ = "doc_retention_policy"
    __table_args__ = (
        UniqueConstraint("company_id", "policy_code", name="uk_doc_retention_policy_code"),
        CheckConstraint("retention_days > 0", name="ck_doc_retention_policy_days"),
        CheckConstraint(
            "action_on_expiry IN ('archive','dispose','review')",
            name="ck_doc_retention_policy_action",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','active','inactive')",
            name="ck_doc_retention_policy_status",
        ),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    policy_code: Mapped[str] = mapped_column(String(50), nullable=False)
    policy_name: Mapped[str] = mapped_column(String(255), nullable=False)
    retention_days: Mapped[int] = mapped_column(Integer, nullable=False)
    action_on_expiry: Mapped[str] = mapped_column(String(30), nullable=False, default="archive")
    applies_to_category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    applies_to_classification: Mapped[str | None] = mapped_column(String(30), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["archive"] = f'''"""Archive ORM per ERD_18 section 6.18."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocTransactionMixin


class DocArchive(Base, *DocTransactionMixin):
    __tablename__ = "doc_archive"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_doc_archive_number"),
        CheckConstraint(
            "status IN ('draft','submitted','archived','restored','disposed')",
            name="ck_doc_archive_status",
        ),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_doc_fk()}
    retention_policy_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_retention_policy.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
{_emp_fk("archived_by_employee_id", nullable=False)}
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archive_location_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["notification"] = f'''"""Document notification ORM per ERD_18 section 6.19."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocNotification(Base, *DocDetailMixin):
    __tablename__ = "doc_notification"
    __table_args__ = (
        CheckConstraint(
            "notification_type IN ('approval_due','review_due','checkout_overdue','expiry',"
            "'retention','archived','shared','other')",
            name="ck_doc_notification_type",
        ),
        CheckConstraint(
            "delivery_status IN ('pending','sent','failed','read')",
            name="ck_doc_notification_delivery",
        ),
        CheckConstraint("status IN ('active','archived')", name="ck_doc_notification_status"),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{_doc_fk(nullable=True)}
    notification_type: Mapped[str] = mapped_column(String(40), nullable=False)
    recipient_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
{_emp_fk("recipient_employee_id")}
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivery_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["report"] = f'''"""Document report ORM per ERD_18 section 6.20."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocReport(Base, *DocDetailMixin):
    __tablename__ = "doc_report"
    __table_args__ = (
        UniqueConstraint("company_id", "report_code", name="uk_doc_report_code"),
        CheckConstraint(
            "report_type IN ('volume','classification_mix','retention_due','checkout_ages',"
            "'approval_backlog','storage_usage')",
            name="ck_doc_report_type",
        ),
        CheckConstraint("status IN ('draft','finalized')", name="ck_doc_report_status"),
        {{"schema": "document"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    report_code: Mapped[str] = mapped_column(String(50), nullable=False)
    report_type: Mapped[str] = mapped_column(String(40), nullable=False)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
{_dept_fk()}
    folder_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_folder.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    metrics_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
'''

# Fix accidental unused ForeignKey import markers — models with only *imports via helper are fine.

ENGINE_IMPORTS = """
from modules.document.domain.enums import (
    ArchiveStatus,
    DocumentApprovalStatus,
    DocumentAttachmentStatus,
    DocumentAuditStatus,
    DocumentCheckoutStatus,
    DocumentCommentStatus,
    DocumentMetadataStatus,
    DocumentPermissionStatus,
    DocumentShareStatus,
    DocumentStatus,
    DocumentTagMapStatus,
    DocumentTagStatus,
    DocumentVersionStatus,
    DocumentWorkflowStatus,
    FolderStatus,
    NotificationStatus,
    ReportStatus,
    RetentionPolicyStatus,
    TemplateFieldStatus,
    TemplateStatus,
)
from modules.document.domain.exceptions import (
    InvalidArchiveState,
    InvalidDocumentApprovalState,
    InvalidDocumentCheckoutState,
    InvalidDocumentState,
    InvalidRetentionPolicyState,
)
"""

ENGINE_BODIES: dict[str, str] = {
    "Folder": '''
class FolderEngine:
    def activate(self, row) -> None:
        row.status = FolderStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = FolderStatus.INACTIVE.value

    def archive(self, row) -> None:
        row.status = FolderStatus.ARCHIVED.value
''',
    "Document": '''
class DocumentEngine:
    def submit(self, row) -> None:
        if row.status != DocumentStatus.DRAFT.value:
            raise InvalidDocumentState("Only draft documents can be submitted")
        row.status = DocumentStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != DocumentStatus.SUBMITTED.value:
            raise InvalidDocumentState("Only submitted documents can be approved")
        row.status = DocumentStatus.APPROVED.value

    def publish(self, row) -> None:
        if row.status != DocumentStatus.APPROVED.value:
            raise InvalidDocumentState("Only approved documents can be published")
        row.status = DocumentStatus.PUBLISHED.value

    def check_out(self, row) -> None:
        if row.status != DocumentStatus.PUBLISHED.value:
            raise InvalidDocumentState("Only published documents can check out")
        row.status = DocumentStatus.CHECKED_OUT.value

    def archive(self, row) -> None:
        row.status = DocumentStatus.ARCHIVED.value

    def cancel(self, row) -> None:
        row.status = DocumentStatus.CANCELLED.value
''',
    "DocumentVersion": '''
class DocumentVersionEngine:
    def supersede(self, row) -> None:
        row.status = DocumentVersionStatus.SUPERSEDED.value
        row.is_current = False

    def soft_delete(self, row) -> None:
        row.status = DocumentVersionStatus.DELETED_SOFT.value
''',
    "DocumentMetadata": '''
class DocumentMetadataEngine:
    def activate(self, row) -> None:
        row.status = DocumentMetadataStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = DocumentMetadataStatus.INACTIVE.value
''',
    "DocumentTag": '''
class DocumentTagEngine:
    def activate(self, row) -> None:
        row.status = DocumentTagStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = DocumentTagStatus.INACTIVE.value
''',
    "DocumentTagMap": '''
class DocumentTagMapEngine:
    def remove(self, row) -> None:
        row.status = DocumentTagMapStatus.REMOVED.value
''',
    "DocumentPermission": '''
class DocumentPermissionEngine:
    def revoke(self, row) -> None:
        row.status = DocumentPermissionStatus.REVOKED.value
''',
    "DocumentShare": '''
class DocumentShareEngine:
    def revoke(self, row) -> None:
        row.status = DocumentShareStatus.REVOKED.value

    def expire(self, row) -> None:
        row.status = DocumentShareStatus.EXPIRED.value
''',
    "DocumentComment": '''
class DocumentCommentEngine:
    def soft_delete(self, row) -> None:
        if row.status != DocumentCommentStatus.ACTIVE.value:
            raise ValueError("Only active comments can soft-delete")
        row.status = DocumentCommentStatus.DELETED_SOFT.value
''',
    "DocumentApproval": '''
class DocumentApprovalEngine:
    def submit(self, row) -> None:
        if row.status != DocumentApprovalStatus.DRAFT.value:
            raise InvalidDocumentApprovalState("Only draft approvals can be submitted")
        row.status = DocumentApprovalStatus.SUBMITTED.value

    def complete(self, row) -> None:
        if row.status != DocumentApprovalStatus.SUBMITTED.value:
            raise InvalidDocumentApprovalState("Only submitted approvals can complete")
        row.status = DocumentApprovalStatus.COMPLETED.value

    def cancel(self, row) -> None:
        row.status = DocumentApprovalStatus.CANCELLED.value
''',
    "DocumentWorkflow": '''
class DocumentWorkflowEngine:
    def activate(self, row) -> None:
        row.status = DocumentWorkflowStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = DocumentWorkflowStatus.INACTIVE.value
''',
    "DocumentCheckout": '''
class DocumentCheckoutEngine:
    def submit(self, row) -> None:
        if row.status != DocumentCheckoutStatus.DRAFT.value:
            raise InvalidDocumentCheckoutState("Only draft checkouts can be submitted")
        row.status = DocumentCheckoutStatus.SUBMITTED.value

    def activate(self, row) -> None:
        if row.status not in {
            DocumentCheckoutStatus.DRAFT.value,
            DocumentCheckoutStatus.SUBMITTED.value,
        }:
            raise InvalidDocumentCheckoutState("Checkout not activatable")
        row.status = DocumentCheckoutStatus.ACTIVE.value

    def complete(self, row) -> None:
        if row.status == DocumentCheckoutStatus.SUBMITTED.value:
            row.status = DocumentCheckoutStatus.ACTIVE.value
        if row.status != DocumentCheckoutStatus.ACTIVE.value:
            raise InvalidDocumentCheckoutState("Only active checkouts can complete")
        row.status = DocumentCheckoutStatus.COMPLETED.value

    def checkin(self, row) -> None:
        self.complete(row)

    def cancel(self, row) -> None:
        row.status = DocumentCheckoutStatus.CANCELLED.value
''',
    "DocumentAudit": '''
class DocumentAuditEngine:
    def record(self, row) -> None:
        row.status = DocumentAuditStatus.RECORDED.value
''',
    "DocumentAttachment": '''
class DocumentAttachmentEngine:
    def supersede(self, row) -> None:
        row.status = DocumentAttachmentStatus.SUPERSEDED.value

    def archive(self, row) -> None:
        row.status = DocumentAttachmentStatus.ARCHIVED.value
''',
    "Template": '''
class TemplateEngine:
    def activate(self, row) -> None:
        row.status = TemplateStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = TemplateStatus.INACTIVE.value

    def archive(self, row) -> None:
        row.status = TemplateStatus.ARCHIVED.value
''',
    "TemplateField": '''
class TemplateFieldEngine:
    def activate(self, row) -> None:
        row.status = TemplateFieldStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = TemplateFieldStatus.INACTIVE.value
''',
    "RetentionPolicy": '''
class RetentionPolicyEngine:
    def submit(self, row) -> None:
        if row.status != RetentionPolicyStatus.DRAFT.value:
            raise InvalidRetentionPolicyState("Only draft policies can be submitted")
        row.status = RetentionPolicyStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != RetentionPolicyStatus.SUBMITTED.value:
            raise InvalidRetentionPolicyState("Only submitted policies can be approved")
        row.status = RetentionPolicyStatus.APPROVED.value

    def activate(self, row) -> None:
        if row.status != RetentionPolicyStatus.APPROVED.value:
            raise InvalidRetentionPolicyState("Only approved policies can activate")
        row.status = RetentionPolicyStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = RetentionPolicyStatus.INACTIVE.value
''',
    "Archive": '''
class ArchiveEngine:
    def submit(self, row) -> None:
        if row.status != ArchiveStatus.DRAFT.value:
            raise InvalidArchiveState("Only draft archives can be submitted")
        row.status = ArchiveStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != ArchiveStatus.SUBMITTED.value:
            raise InvalidArchiveState("Only submitted archives can be approved")
        row.status = ArchiveStatus.ARCHIVED.value

    def restore(self, row) -> None:
        if row.status != ArchiveStatus.ARCHIVED.value:
            raise InvalidArchiveState("Only archived rows can restore")
        row.status = ArchiveStatus.RESTORED.value

    def dispose(self, row) -> None:
        row.status = ArchiveStatus.DISPOSED.value
''',
    "Notification": '''
class NotificationEngine:
    def archive(self, row) -> None:
        row.status = NotificationStatus.ARCHIVED.value
''',
    "Report": '''
class ReportEngine:
    def finalize(self, row) -> None:
        row.status = ReportStatus.FINALIZED.value
''',
}


def gen_scaffold() -> None:
    w(DOC / "__init__.py", '"""Document Management System module — Sprint 18."""\n')
    w(DOC / "domain" / "__init__.py", '"""Document domain layer."""\n')
    w(DOC / "adapters" / "__init__.py", '"""Document cross-module adapters."""\n')
    w(DOC / "service" / "__init__.py", '"""Document services — populated after generation."""\n')
    w(DOC / "service" / "engines" / "__init__.py", '"""Document engines — populated after generation."""\n')
    w(DOC / "repository" / "__init__.py", '"""Document repositories."""\n')
    w(DOC / "models" / "__init__.py", '"""Document models — populated after generation."""\n')
    w(
        DOC / "models" / "mixins.py",
        '''"""Document ORM mixin bundles per ERD_18."""

from database.mixins import (
    AuditMixin,
    BranchMixin,
    CompanyMixin,
    SoftDeleteMixin,
    TenantMixin,
    VersionMixin,
)

DocMasterMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    SoftDeleteMixin,
    VersionMixin,
)

DocTransactionMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    BranchMixin,
    SoftDeleteMixin,
    VersionMixin,
)

DocDetailMixin = (
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
        DOC / "domain" / "enums.py",
        '''"""Document domain enums per ERD_18 section 11."""

from enum import Enum


class FolderStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"


class DocumentStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PUBLISHED = "published"
    CHECKED_OUT = "checked_out"
    ARCHIVED = "archived"
    EXPIRED = "expired"
    DISPOSED = "disposed"
    CANCELLED = "cancelled"


class DocumentVersionStatus(str, Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    DELETED_SOFT = "deleted_soft"


class DocumentMetadataStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class DocumentTagStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class DocumentTagMapStatus(str, Enum):
    ACTIVE = "active"
    REMOVED = "removed"


class DocumentPermissionStatus(str, Enum):
    ACTIVE = "active"
    REVOKED = "revoked"


class DocumentShareStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"


class DocumentCommentStatus(str, Enum):
    ACTIVE = "active"
    DELETED_SOFT = "deleted_soft"


class DocumentApprovalStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DocumentWorkflowStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class DocumentCheckoutStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    SUBMITTED = "submitted"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DocumentAuditStatus(str, Enum):
    RECORDED = "recorded"


class DocumentAttachmentStatus(str, Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    ARCHIVED = "archived"


class TemplateStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"


class TemplateFieldStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class RetentionPolicyStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    INACTIVE = "inactive"


class ArchiveStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    ARCHIVED = "archived"
    RESTORED = "restored"
    DISPOSED = "disposed"


class NotificationStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class ReportStatus(str, Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"


class DocEntityType(str, Enum):
    DOCUMENT = "document"
    SHARE = "share"
    APPROVAL = "approval"
    CHECKOUT = "checkout"
    ARCHIVE = "archive"
    FOLDER = "folder"
    TAG = "tag"
    TEMPLATE = "template"
    WORKFLOW = "workflow"
    RETENTION = "retention"
    REPORT = "report"


CODE_PREFIXES: dict[DocEntityType, tuple[str, int, bool]] = {
    DocEntityType.DOCUMENT: ("DOC-", 6, True),
    DocEntityType.SHARE: ("DSHR-", 6, True),
    DocEntityType.APPROVAL: ("DAPR-", 6, True),
    DocEntityType.CHECKOUT: ("DOUT-", 6, True),
    DocEntityType.ARCHIVE: ("DARC-", 6, True),
    DocEntityType.FOLDER: ("DF-", 6, False),
    DocEntityType.TAG: ("DTAG-", 6, False),
    DocEntityType.TEMPLATE: ("DTPL-", 6, False),
    DocEntityType.WORKFLOW: ("DWF-", 6, False),
    DocEntityType.RETENTION: ("DRTN-", 6, False),
    DocEntityType.REPORT: ("DRPT-", 6, False),
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
        DOC / "domain" / "exceptions.py",
        '"""Document domain exceptions."""\n\nfrom core.exceptions import ConflictException\n'
        + "".join(exc_lines),
    )
    w(
        DOC / "domain" / "value_objects.py",
        '''"""Document value objects."""

from dataclasses import dataclass


@dataclass(frozen=True)
class DocumentCodes:
    document_number: str
''',
    )
    w(
        DOC / "domain" / "entities.py",
        '''"""Document domain entity markers."""

from dataclasses import dataclass
from uuid import UUID


@dataclass
class DocumentIdentity:
    document_id: UUID
    document_number: str
    owner_employee_id: UUID
''',
    )


def gen_models() -> None:
    for key, body in MODELS.items():
        w(DOC / "models" / f"{key}.py", body)
    imports = "\n".join(f"from modules.document.models.{k} import {CLASS_MAP[k]}" for k in CLASS_MAP)
    all_names = ",\n    ".join(f'"{CLASS_MAP[k]}"' for k in CLASS_MAP)
    w(
        DOC / "models" / "__init__.py",
        f'"""Document ORM models."""\n\n{imports}\n\n__all__ = [\n    {all_names},\n]\n',
    )


def gen_migrations() -> None:
    w(
        ALEMBIC / "0311_create_document_schema.py",
        '''"""Create document schema."""

from collections.abc import Sequence

from alembic import op

revision: str = "0311_create_document_schema"
down_revision: str | None = "0310_seed_helpdesk_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS document")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS document CASCADE")
''',
    )
    for rev, target, down in MIGRATIONS:
        if target == "schema" or (isinstance(target, str) and target.startswith("seed")):
            continue
        if isinstance(target, list):
            imports = "\n".join(
                f"from modules.document.models.{m} import {CLASS_MAP[m]}  # noqa: F401"
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
                f'''"""Create document tag and tag_map tables."""

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

from modules.document.models.{target} import {cls}  # noqa: F401

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
    return f'''"""Document {cls} repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.document.models import {cls}
from modules.document.repository.base import DocScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class {name}Repository(DocScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> {cls} | None:
        stmt = select({cls}).where({cls}.id == row_id, {cls}.is_deleted.is_(False))
        stmt = self.apply_doc_filter(stmt, {cls}, ctx, branch_scoped={branch})
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select({cls}).where(
            {cls}.company_id == company_id,
            {cls}.is_deleted.is_(False),
        )
        stmt = self.apply_doc_filter(stmt, {cls}, ctx, branch_scoped={branch})
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
        DOC / "repository" / "base.py",
        '''"""Document scoped repository base."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.base import OrgScopedRepository


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DocScopedRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    @staticmethod
    def apply_doc_filter(stmt, model, ctx: TenantContext, *, branch_scoped: bool = False):
        stmt = DocScopedRepository.apply_tenant_filter(stmt, model, ctx)
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
            DocScopedRepository.ensure_company_access(ctx, company_id)
            return company_id
        if ctx.company_id is None:
            raise ForbiddenException("Company context required")
        return ctx.company_id
''',
    )
    w(
        DOC / "repository" / "code_sequence_repository.py",
        '''"""Document code sequences."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.document.domain.enums import CODE_PREFIXES, DocEntityType


class CodeSequenceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def next_code(self, entity: DocEntityType, company_id: UUID, model, code_column: str) -> str:
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
        w(DOC / "repository" / f"{module}_repository.py", repo_template(module, cls, name, branch))


def gen_engines() -> None:
    for eng_name, body in ENGINE_BODIES.items():
        fname = ENGINE_FILE_MAP[eng_name]
        w(
            DOC / "service" / "engines" / f"{fname}_engine.py",
            f'"""{eng_name} lifecycle engine."""\n{ENGINE_IMPORTS}\n{body}\n',
        )
    lines = [
        f"from modules.document.service.engines.{ENGINE_FILE_MAP[n]}_engine import {n}Engine"
        for n in ENGINE_NAMES
    ]
    all_names = ",\n    ".join(f'"{n}Engine"' for n in ENGINE_NAMES)
    w(
        DOC / "service" / "engines" / "__init__.py",
        '"""Document business engines."""\n\n'
        + "\n".join(lines)
        + f"\n\n__all__ = [\n    {all_names},\n]\n",
    )


def catalog_service(
    svc_name: str,
    cls: str,
    repo_name: str,
    entity: str,
    branch: bool,
    engine_name: str,
) -> str:
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
from modules.document.models import {cls}
from modules.document.repository.{entity}_repository import {repo_name}Repository
from modules.document.service.document_scope_validator import DocumentScopeValidator
from modules.document.service.engines import {engine_name}Engine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class {svc_name}:
    def __init__(self, db: Session) -> None:
        self._repo = {repo_name}Repository(db)
        self._scope = DocumentScopeValidator(db)
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

    def create(self, ctx: TenantContext, company_id: UUID | None = None{branch_arg}, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
{branch_fields}
        row = self._repo.create(ctx, company_id=cid, {branch_create} **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="doc_{entity}",
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
        doc = self._numbers.generate(DocEntityType.{entity_type}, cid, {cls}, "{code_col}")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, {code_col}=doc, **fields)
'''
        create_sig = "self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields"
    else:
        create_body = f'''
        cid = self._scope.resolve_company_id(ctx, company_id)
        doc = self._numbers.generate(DocEntityType.{entity_type}, cid, {cls}, "{code_col}")
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
from modules.document.domain.enums import DocEntityType
from modules.document.models import {cls}
from modules.document.repository.{entity}_repository import {repo_name}Repository
from modules.document.service.document_number_service import DocumentNumberService
from modules.document.service.document_scope_validator import DocumentScopeValidator
from modules.document.service.engines import {engine_name}Engine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class {svc_name}:
    def __init__(self, db: Session) -> None:
        self._repo = {repo_name}Repository(db)
        self._scope = DocumentScopeValidator(db)
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
        DOC / "service" / "document_scope_validator.py",
        '''"""Document scope validator."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.document.repository.base import DocScopedRepository
from modules.foundation.domain.value_objects import TenantContext


class DocumentScopeValidator(DocScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def validate_company_access(self, ctx: TenantContext, company_id: UUID) -> None:
        self.ensure_company_access(ctx, company_id)

    def validate_branch_access(self, ctx: TenantContext, branch_id: UUID) -> None:
        self.ensure_branch_access(ctx, branch_id)
''',
    )
    w(
        DOC / "service" / "document_number_service.py",
        '''"""Document numbering."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.document.domain.enums import DocEntityType
from modules.document.repository.code_sequence_repository import CodeSequenceRepository


class DocumentNumberService:
    def __init__(self, db: Session) -> None:
        self._seq = CodeSequenceRepository(db)

    def generate(self, entity: DocEntityType, company_id: UUID, model, code_column: str) -> str:
        return self._seq.next_code(entity, company_id, model, code_column)
''',
    )

    # Catalog / simple services
    simple_specs = [
        ("FolderService", "DocFolder", "Folder", "folder", False, "Folder", "folder_service.py"),
        ("DocumentVersionService", "DocDocumentVersion", "DocumentVersion", "document_version", False, "DocumentVersion", "document_version_service.py"),
        ("MetadataService", "DocDocumentMetadata", "DocumentMetadata", "document_metadata", False, "DocumentMetadata", "metadata_service.py"),
        ("PermissionService", "DocDocumentPermission", "DocumentPermission", "document_permission", False, "DocumentPermission", "permission_service.py"),
        ("ShareService", "DocDocumentShare", "DocumentShare", "document_share", False, "DocumentShare", "share_service.py"),
        ("CommentService", "DocDocumentComment", "DocumentComment", "document_comment", False, "DocumentComment", "comment_service.py"),
        ("WorkflowService", "DocDocumentWorkflow", "DocumentWorkflow", "document_workflow", False, "DocumentWorkflow", "workflow_service.py"),
        ("DocumentAuditService", "DocDocumentAudit", "DocumentAudit", "document_audit", False, "DocumentAudit", "document_audit_service.py"),
        ("AttachmentService", "DocDocumentAttachment", "DocumentAttachment", "document_attachment", False, "DocumentAttachment", "attachment_service.py"),
        ("NotificationService", "DocNotification", "Notification", "notification", False, "Notification", "notification_service.py"),
    ]
    for svc, cls, repo, entity, branch, eng, fname in simple_specs:
        w(DOC / "service" / fname, catalog_service(svc, cls, repo, entity, branch, eng))

    # TagService with tag-map ops
    w(
        DOC / "service" / "tag_service.py",
        '''"""TagService — tags and tag-map operations."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.document.models import DocDocumentTag, DocDocumentTagMap
from modules.document.repository.document_tag_map_repository import DocumentTagMapRepository
from modules.document.repository.document_tag_repository import DocumentTagRepository
from modules.document.service.document_scope_validator import DocumentScopeValidator
from modules.document.service.engines import DocumentTagEngine, DocumentTagMapEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class TagService:
    def __init__(self, db: Session) -> None:
        self._tag_repo = DocumentTagRepository(db)
        self._map_repo = DocumentTagMapRepository(db)
        self._scope = DocumentScopeValidator(db)
        self._tag_engine = DocumentTagEngine()
        self._map_engine = DocumentTagMapEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._tag_repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> DocDocumentTag | DocDocumentTagMap:
        row = self._tag_repo.get(ctx, row_id)
        if row is not None:
            return row
        row = self._map_repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("TagService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        if ("tag_id" in fields or "document_id" in fields) and "tag_code" not in fields:
            row = self._map_repo.create(ctx, company_id=cid, **fields)
            entity_name = "doc_document_tag_map"
        else:
            row = self._tag_repo.create(ctx, company_id=cid, **fields)
            entity_name = "doc_document_tag"
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=entity_name,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        if self._tag_repo.get(ctx, row_id) is not None:
            row = self._tag_repo.update(ctx, row_id, **fields)
        else:
            row = self._map_repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("TagService not found")
        return row
''',
    )

    # TemplateService covers templates + fields
    w(
        DOC / "service" / "template_service.py",
        '''"""TemplateService — templates and template fields."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.document.models import DocTemplate, DocTemplateField
from modules.document.repository.template_field_repository import TemplateFieldRepository
from modules.document.repository.template_repository import TemplateRepository
from modules.document.service.document_scope_validator import DocumentScopeValidator
from modules.document.service.engines import TemplateEngine, TemplateFieldEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class TemplateService:
    def __init__(self, db: Session) -> None:
        self._tpl_repo = TemplateRepository(db)
        self._field_repo = TemplateFieldRepository(db)
        self._scope = DocumentScopeValidator(db)
        self._tpl_engine = TemplateEngine()
        self._field_engine = TemplateFieldEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._tpl_repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> DocTemplate | DocTemplateField:
        row = self._tpl_repo.get(ctx, row_id)
        if row is not None:
            return row
        row = self._field_repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("TemplateService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        if "template_id" in fields and "template_code" not in fields:
            row = self._field_repo.create(ctx, company_id=cid, **fields)
            entity_name = "doc_template_field"
        else:
            row = self._tpl_repo.create(ctx, company_id=cid, **fields)
            entity_name = "doc_template"
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=entity_name,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        if self._tpl_repo.get(ctx, row_id) is not None:
            row = self._tpl_repo.update(ctx, row_id, **fields)
        else:
            row = self._field_repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("TemplateService not found")
        return row
''',
    )

    w(
        DOC / "service" / "document_service.py",
        numbered_service(
            "DocumentService", "DocDocument", "Document", "document", "DOCUMENT",
            "document_number", True, "Document", ["submit", "approve", "publish"],
        ),
    )
    w(
        DOC / "service" / "approval_service.py",
        numbered_service(
            "ApprovalService", "DocDocumentApproval", "DocumentApproval",
            "document_approval", "APPROVAL", "document_number", True, "DocumentApproval",
            ["submit", "complete"],
        ),
    )
    w(
        DOC / "service" / "checkout_service.py",
        numbered_service(
            "CheckoutService", "DocDocumentCheckout", "DocumentCheckout",
            "document_checkout", "CHECKOUT", "document_number", True, "DocumentCheckout",
            ["submit", "complete", "checkin"],
        ),
    )
    w(
        DOC / "service" / "retention_policy_service.py",
        numbered_service(
            "RetentionPolicyService", "DocRetentionPolicy", "RetentionPolicy",
            "retention_policy", "RETENTION", "policy_code", False, "RetentionPolicy",
            ["submit", "approve"],
        ),
    )
    w(
        DOC / "service" / "archive_service.py",
        numbered_service(
            "ArchiveService", "DocArchive", "Archive",
            "archive", "ARCHIVE", "document_number", True, "Archive",
            ["submit", "approve"],
        ),
    )
    w(
        DOC / "service" / "document_report_service.py",
        numbered_service(
            "DocumentReportService", "DocReport", "Report",
            "report", "REPORT", "report_code", False, "Report",
            ["finalize"],
        ),
    )

    w(
        DOC / "service" / "integration_service.py",
        '''"""Document integration — cross-module reads / UUID stubs; no peer ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.document.adapters.helpdesk_port import DocumentHelpdeskAdapter
from modules.document.adapters.master_data_port import DocumentMasterDataAdapter
from modules.document.adapters.organization_port import DocumentOrganizationAdapter
from modules.document.adapters.payroll_port import DocumentPayrollAdapter
from modules.document.adapters.service_port import DocumentServiceAdapter
from modules.foundation.domain.value_objects import TenantContext


class DocumentIntegrationService:
    def __init__(self, db: Session) -> None:
        self._master = DocumentMasterDataAdapter(db)
        self._org = DocumentOrganizationAdapter(db)
        self._payroll = DocumentPayrollAdapter(db)
        self._service = DocumentServiceAdapter()
        self._helpdesk = DocumentHelpdeskAdapter()

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._master.get_employee(ctx, employee_id)

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._master.get_customer(ctx, customer_id)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        return self._org.get_department(ctx, department_id)

    def resolve_service_request(self, service_request_id: UUID | None) -> UUID | None:
        return self._service.resolve_service_request_uuid(service_request_id)

    def resolve_helpdesk_ticket(self, helpdesk_ticket_id: UUID | None) -> UUID | None:
        return self._helpdesk.resolve_ticket_uuid(helpdesk_ticket_id)

    def labor_cost_hint(self, ctx: TenantContext, employee_id: UUID) -> None:
        return self._payroll.labor_cost_hint(ctx, employee_id)
''',
    )

    w(
        DOC / "service" / "application_service.py",
        '''"""Document application service facade."""

from sqlalchemy.orm import Session

from modules.document.service.approval_service import ApprovalService
from modules.document.service.archive_service import ArchiveService
from modules.document.service.attachment_service import AttachmentService
from modules.document.service.checkout_service import CheckoutService
from modules.document.service.comment_service import CommentService
from modules.document.service.document_audit_service import DocumentAuditService
from modules.document.service.document_report_service import DocumentReportService
from modules.document.service.document_service import DocumentService
from modules.document.service.document_version_service import DocumentVersionService
from modules.document.service.folder_service import FolderService
from modules.document.service.integration_service import DocumentIntegrationService
from modules.document.service.metadata_service import MetadataService
from modules.document.service.notification_service import NotificationService
from modules.document.service.permission_service import PermissionService
from modules.document.service.retention_policy_service import RetentionPolicyService
from modules.document.service.share_service import ShareService
from modules.document.service.tag_service import TagService
from modules.document.service.template_service import TemplateService
from modules.document.service.workflow_service import WorkflowService


class DocumentApplicationService:
    def __init__(self, db: Session) -> None:
        self.folders = FolderService(db)
        self.documents = DocumentService(db)
        self.versions = DocumentVersionService(db)
        self.metadata = MetadataService(db)
        self.tags = TagService(db)
        self.permissions = PermissionService(db)
        self.shares = ShareService(db)
        self.comments = CommentService(db)
        self.approvals = ApprovalService(db)
        self.workflows = WorkflowService(db)
        self.checkouts = CheckoutService(db)
        self.audits = DocumentAuditService(db)
        self.attachments = AttachmentService(db)
        self.templates = TemplateService(db)
        self.retention = RetentionPolicyService(db)
        self.archives = ArchiveService(db)
        self.notifications = NotificationService(db)
        self.reports = DocumentReportService(db)
        self.integration = DocumentIntegrationService(db)
''',
    )

    w(
        DOC / "service" / "__init__.py",
        '''"""Document services."""

from modules.document.service.application_service import DocumentApplicationService
from modules.document.service.approval_service import ApprovalService
from modules.document.service.archive_service import ArchiveService
from modules.document.service.attachment_service import AttachmentService
from modules.document.service.checkout_service import CheckoutService
from modules.document.service.comment_service import CommentService
from modules.document.service.document_audit_service import DocumentAuditService
from modules.document.service.document_report_service import DocumentReportService
from modules.document.service.document_service import DocumentService
from modules.document.service.document_version_service import DocumentVersionService
from modules.document.service.folder_service import FolderService
from modules.document.service.integration_service import DocumentIntegrationService
from modules.document.service.metadata_service import MetadataService
from modules.document.service.notification_service import NotificationService
from modules.document.service.permission_service import PermissionService
from modules.document.service.retention_policy_service import RetentionPolicyService
from modules.document.service.share_service import ShareService
from modules.document.service.tag_service import TagService
from modules.document.service.template_service import TemplateService
from modules.document.service.workflow_service import WorkflowService

__all__ = [
    "ApprovalService",
    "ArchiveService",
    "AttachmentService",
    "CheckoutService",
    "CommentService",
    "DocumentApplicationService",
    "DocumentAuditService",
    "DocumentIntegrationService",
    "DocumentReportService",
    "DocumentService",
    "DocumentVersionService",
    "FolderService",
    "MetadataService",
    "NotificationService",
    "PermissionService",
    "RetentionPolicyService",
    "ShareService",
    "TagService",
    "TemplateService",
    "WorkflowService",
]
''',
    )


def gen_adapters() -> None:
    w(
        DOC / "adapters" / "master_data_port.py",
        '''"""Master Data port — employee / customer only (C-01)."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.service.customer_service import CustomerService
from modules.master_data.service.employee_service import EmployeeService


class DocumentMasterDataAdapter:
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
        DOC / "adapters" / "organization_port.py",
        '''"""Organization port — read org_department only."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.hierarchy_repository import DepartmentRepository


class DocumentOrganizationAdapter:
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
        DOC / "adapters" / "finance_port.py",
        '''"""Finance port — PostingService.post_system_journal only; store finance_journal_id."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.document.models import DocDocument
from modules.finance.domain.enums import JournalType
from modules.finance.service.journal_service import JournalService
from modules.finance.service.posting_service import PostingService
from modules.foundation.domain.value_objects import TenantContext


class DocumentFinanceAdapter:
    def __init__(self, db: Session) -> None:
        self._journals = JournalService(db)
        self._posting = PostingService(db)

    def post_document_charge(
        self,
        ctx: TenantContext,
        row: DocDocument,
        *,
        amount: Decimal,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        amount = amount.quantize(Decimal("0.0001"))
        resolved_branch_id = row.branch_id if row.branch_id is not None else ctx.branch_id
        if resolved_branch_id is None:
            msg = "branch_id is required for document finance posting"
            raise ValueError(msg)
        journal = self._journals.create_journal(
            ctx,
            company_id=row.company_id,
            branch_id=resolved_branch_id,
            journal_date=date.today(),
            description=f"Document charge {row.document_number}",
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
            description="Document charge debit",
        )
        self._journals.add_line(
            ctx,
            journal.id,
            line_number=2,
            account_id=credit_account_id,
            debit_amount=0,
            credit_amount=float(amount),
            description="Document charge credit",
        )
        self._posting.post_system_journal(ctx, journal.id)
        return journal.id
''',
    )
    w(
        DOC / "adapters" / "service_port.py",
        '''"""Service port — UUID-only stubs; no svc_* FK / ORM writes."""

from uuid import UUID


class DocumentServiceAdapter:
    def resolve_service_request_uuid(self, service_request_id: UUID | None) -> UUID | None:
        return service_request_id
''',
    )
    w(
        DOC / "adapters" / "helpdesk_port.py",
        '''"""Helpdesk port — UUID-only stubs; no hd_* FK / ORM writes."""

from uuid import UUID


class DocumentHelpdeskAdapter:
    def resolve_ticket_uuid(self, helpdesk_ticket_id: UUID | None) -> UUID | None:
        return helpdesk_ticket_id
''',
    )
    w(
        DOC / "adapters" / "payroll_port.py",
        '''"""Payroll port — read-only labor hint stub; no pay_* writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class DocumentPayrollAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def labor_cost_hint(self, ctx: TenantContext, employee_id: UUID) -> None:
        _ = (ctx, employee_id, self._db)
        return None
''',
    )


def gen_permissions() -> None:
    w(
        DOC / "permissions.py",
        '''"""Document permission constants per ERD_18 section 14."""

DOCUMENT_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("document.folder:read", "document.folder", "read", "document"),
    ("document.folder:create", "document.folder", "create", "document"),
    ("document.folder:update", "document.folder", "update", "document"),
    ("document.document:read", "document.document", "read", "document"),
    ("document.document:create", "document.document", "create", "document"),
    ("document.document:update", "document.document", "update", "document"),
    ("document.document:submit", "document.document", "submit", "document"),
    ("document.document:approve", "document.document", "approve", "document"),
    ("document.document:publish", "document.document", "publish", "document"),
    ("document.version:read", "document.version", "read", "document"),
    ("document.version:create", "document.version", "create", "document"),
    ("document.version:update", "document.version", "update", "document"),
    ("document.metadata:read", "document.metadata", "read", "document"),
    ("document.metadata:create", "document.metadata", "create", "document"),
    ("document.metadata:update", "document.metadata", "update", "document"),
    ("document.tag:read", "document.tag", "read", "document"),
    ("document.tag:create", "document.tag", "create", "document"),
    ("document.tag:update", "document.tag", "update", "document"),
    ("document.permission:read", "document.permission", "read", "document"),
    ("document.permission:create", "document.permission", "create", "document"),
    ("document.permission:revoke", "document.permission", "revoke", "document"),
    ("document.share:read", "document.share", "read", "document"),
    ("document.share:create", "document.share", "create", "document"),
    ("document.share:revoke", "document.share", "revoke", "document"),
    ("document.comment:read", "document.comment", "read", "document"),
    ("document.comment:create", "document.comment", "create", "document"),
    ("document.comment:update", "document.comment", "update", "document"),
    ("document.approval:read", "document.approval", "read", "document"),
    ("document.approval:create", "document.approval", "create", "document"),
    ("document.approval:submit", "document.approval", "submit", "document"),
    ("document.approval:complete", "document.approval", "complete", "document"),
    ("document.workflow:read", "document.workflow", "read", "document"),
    ("document.workflow:create", "document.workflow", "create", "document"),
    ("document.workflow:update", "document.workflow", "update", "document"),
    ("document.checkout:read", "document.checkout", "read", "document"),
    ("document.checkout:create", "document.checkout", "create", "document"),
    ("document.checkout:submit", "document.checkout", "submit", "document"),
    ("document.checkout:complete", "document.checkout", "complete", "document"),
    ("document.audit:read", "document.audit", "read", "document"),
    ("document.attachment:read", "document.attachment", "read", "document"),
    ("document.attachment:create", "document.attachment", "create", "document"),
    ("document.attachment:update", "document.attachment", "update", "document"),
    ("document.template:read", "document.template", "read", "document"),
    ("document.template:create", "document.template", "create", "document"),
    ("document.template:update", "document.template", "update", "document"),
    ("document.retention:read", "document.retention", "read", "document"),
    ("document.retention:create", "document.retention", "create", "document"),
    ("document.retention:submit", "document.retention", "submit", "document"),
    ("document.retention:approve", "document.retention", "approve", "document"),
    ("document.archive:read", "document.archive", "read", "document"),
    ("document.archive:create", "document.archive", "create", "document"),
    ("document.archive:submit", "document.archive", "submit", "document"),
    ("document.archive:approve", "document.archive", "approve", "document"),
    ("document.notification:read", "document.notification", "read", "document"),
    ("document.report:read", "document.report", "read", "document"),
    ("document.report:export", "document.report", "export", "document"),
]

_ALL = [p[0] for p in DOCUMENT_PERMISSIONS]

DOCUMENT_MANAGER_PERMISSIONS = list(_ALL)
DOCUMENT_EDITOR_PERMISSIONS = [
    p for p in _ALL
    if not any(
        x in p
        for x in (
            ":approve",
            "document:publish",
            "permission:create",
            "permission:revoke",
            "retention:",
            "archive:approve",
            "workflow:create",
            "workflow:update",
            "report:export",
        )
    )
]
DOCUMENT_REVIEWER_PERMISSIONS = [
    p for p in _ALL
    if any(
        x in p
        for x in (
            ":read",
            "document:approve",
            "approval:",
            "comment:",
            "document:publish",
        )
    )
    and "report:export" not in p
]
DOCUMENT_ADMIN_PERMISSIONS = list(_ALL)
''',
    )
def gen_api() -> None:
    w(
        DOC / "dependencies.py",
        '''"""Document module dependencies."""

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
        '"""Document Pydantic schemas."""',
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
    w(DOC / "schemas.py", "\n".join(schema_lines) + "\n")

    router_parts: list[str] = [
        '"""Document API route handlers."""',
        "",
        "from typing import Annotated",
        "from uuid import UUID",
        "",
        "from fastapi import APIRouter, Depends",
        "from sqlalchemy.orm import Session",
        "",
        "from modules.document.dependencies import (",
        "    PaginationParams,",
        "    extract_update_fields,",
        "    get_db,",
        "    get_pagination,",
        "    paginate,",
        "    require_permission,",
        ")",
        "from modules.document.schemas import (",
    ]
    for _, name, _, _, _ in ROUTE_SPECS:
        router_parts.append(f"    {name}Create,")
        router_parts.append(f"    {name}Response,")
        router_parts.append(f"    {name}Update,")
    router_parts += [
        ")",
        "from modules.document.service import (",
    ]
    # unique services for import
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
    for prefix, name, svc, perm, branch in ROUTE_SPECS:
        rname = f"{prefix.replace('-', '_')}_router"
        exports.append(rname)
        router_parts.append(f'{rname} = APIRouter(prefix="/{prefix}", tags=["Document — {name}"])')
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
        if perm == "document.report":
            update_perm = "document.report:export"
            create_perm = "document.report:export"
        elif perm == "document.permission":
            update_perm = "document.permission:revoke"
        elif perm == "document.share":
            update_perm = "document.share:revoke"
        elif perm == "document.audit":
            update_perm = "document.audit:read"
            create_perm = "document.audit:read"
        elif perm == "document.notification":
            update_perm = "document.notification:read"
            create_perm = "document.notification:read"
        elif perm == "document.approval":
            update_perm = "document.approval:create"
        elif perm == "document.checkout":
            update_perm = "document.checkout:create"
        elif perm == "document.retention":
            update_perm = "document.retention:create"
        elif perm == "document.archive":
            update_perm = "document.archive:create"

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
        if svc == "DocumentService":
            actions = [
                ("submit", "document.document:submit"),
                ("approve", "document.document:approve"),
                ("publish", "document.document:publish"),
            ]
        elif svc == "ApprovalService":
            actions = [
                ("submit", "document.approval:submit"),
                ("complete", "document.approval:complete"),
            ]
        elif svc == "CheckoutService":
            actions = [
                ("submit", "document.checkout:submit"),
                ("complete", "document.checkout:complete"),
                ("checkin", "document.checkout:complete"),
            ]
        elif svc == "RetentionPolicyService":
            actions = [
                ("submit", "document.retention:submit"),
                ("approve", "document.retention:approve"),
            ]
        elif svc == "ArchiveService":
            actions = [
                ("submit", "document.archive:submit"),
                ("approve", "document.archive:approve"),
            ]

        # Only attach actions to primary routes (not tag-maps / template-fields duplicates)
        if prefix in {
            "documents",
            "document-approvals",
            "document-checkouts",
            "retention-policies",
            "archives",
        }:
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

    w(DOC / "routers" / "__init__.py", "\n".join(router_parts) + "\n")

    import_list = ",\n    ".join(exports)
    w(
        DOC / "router.py",
        f'''"""Document module router aggregation."""

from fastapi import APIRouter

from modules.document.routers import (
    {import_list},
)

document_router = APIRouter(prefix="/documents")
)
'''
        + "\n".join(f"document_router.include_router({e})" for e in exports)
        + "\n",
    )


def gen_tasks_tests() -> None:
    w(
        DOC / "tasks.py",
        '''"""Document Celery task stubs per ERD_18 section 15."""

from workers.celery_app import celery_app


@celery_app.task(name="document.retention_policy_runner")
def retention_policy_runner() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.document.models import DocRetentionPolicy

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(DocRetentionPolicy).where(
                    DocRetentionPolicy.is_deleted.is_(False),
                    DocRetentionPolicy.status == "active",
                )
            ).all()
        )
        return {"status": "ok", "active_policies": len(rows)}
    finally:
        db.close()


@celery_app.task(name="document.archive_scheduler")
def archive_scheduler() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.document.models import DocArchive

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(DocArchive).where(
                    DocArchive.is_deleted.is_(False),
                    DocArchive.status.in_(["draft", "submitted"]),
                )
            ).all()
        )
        return {"status": "ok", "pending_archives": len(rows)}
    finally:
        db.close()


@celery_app.task(name="document.document_expiry_notifications")
def document_expiry_notifications() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.document.models import DocDocument

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(DocDocument).where(
                    DocDocument.is_deleted.is_(False),
                    DocDocument.expires_at.is_not(None),
                    DocDocument.status.in_(["published", "approved"]),
                )
            ).all()
        )
        return {"status": "ok", "expiring_documents": len(rows)}
    finally:
        db.close()


@celery_app.task(name="document.document_review_reminders")
def document_review_reminders() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.document.models import DocDocumentApproval

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(DocDocumentApproval).where(
                    DocDocumentApproval.is_deleted.is_(False),
                    DocDocumentApproval.status == "submitted",
                )
            ).all()
        )
        return {"status": "ok", "pending_approvals": len(rows)}
    finally:
        db.close()


@celery_app.task(name="document.metadata_index_refresh")
def metadata_index_refresh() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.document.models import DocDocumentMetadata

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(DocDocumentMetadata).where(
                    DocDocumentMetadata.is_deleted.is_(False),
                    DocDocumentMetadata.status == "active",
                )
            ).all()
        )
        return {"status": "ok", "active_metadata_rows": len(rows)}
    finally:
        db.close()


@celery_app.task(name="document.retry_finance_posting")
def retry_finance_posting() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.document.models import DocDocument

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(DocDocument).where(
                    DocDocument.is_deleted.is_(False),
                    DocDocument.status == "published",
                    DocDocument.finance_journal_id.is_(None),
                )
            ).all()
        )
        return {"status": "ok", "unposted_documents": len(rows)}
    finally:
        db.close()
''',
    )

    w(
        TESTS / "unit" / "document" / "test_document_engines.py",
        '''"""Unit tests for document engines."""

from types import SimpleNamespace

from modules.document.service.engines import (
    ArchiveEngine,
    DocumentApprovalEngine,
    DocumentCheckoutEngine,
    DocumentEngine,
    RetentionPolicyEngine,
)


def test_document_lifecycle():
    engine = DocumentEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    assert row.status == "submitted"
    engine.approve(row)
    assert row.status == "approved"
    engine.publish(row)
    assert row.status == "published"


def test_approval_complete():
    engine = DocumentApprovalEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.complete(row)
    assert row.status == "completed"


def test_checkout_checkin():
    engine = DocumentCheckoutEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.activate(row)
    engine.checkin(row)
    assert row.status == "completed"


def test_retention_approve():
    engine = RetentionPolicyEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    assert row.status == "approved"


def test_archive_approve():
    engine = ArchiveEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    assert row.status == "archived"
''',
    )

    w(
        TESTS / "unit" / "document" / "test_document_tasks.py",
        '''"""Unit tests for document Celery tasks."""

from modules.document import tasks as document_tasks


def test_document_task_names_registered():
    assert document_tasks.retention_policy_runner.name == "document.retention_policy_runner"
    assert document_tasks.archive_scheduler.name == "document.archive_scheduler"
    assert document_tasks.document_expiry_notifications.name == "document.document_expiry_notifications"
    assert document_tasks.document_review_reminders.name == "document.document_review_reminders"
    assert document_tasks.metadata_index_refresh.name == "document.metadata_index_refresh"
    assert document_tasks.retry_finance_posting.name == "document.retry_finance_posting"
''',
    )

    w(
        TESTS / "security" / "document" / "test_document_permissions.py",
        '''"""Document RBAC permission tests."""

from modules.document.permissions import (
    DOCUMENT_ADMIN_PERMISSIONS,
    DOCUMENT_EDITOR_PERMISSIONS,
    DOCUMENT_MANAGER_PERMISSIONS,
    DOCUMENT_PERMISSIONS,
    DOCUMENT_REVIEWER_PERMISSIONS,
)


def test_document_permissions_defined():
    assert len(DOCUMENT_PERMISSIONS) >= 40
    assert "document.document:approve" in [p[0] for p in DOCUMENT_PERMISSIONS]
    assert "document.document:publish" in [p[0] for p in DOCUMENT_PERMISSIONS]


def test_document_roles():
    assert DOCUMENT_MANAGER_PERMISSIONS
    assert DOCUMENT_EDITOR_PERMISSIONS
    assert DOCUMENT_REVIEWER_PERMISSIONS
    assert DOCUMENT_ADMIN_PERMISSIONS
    assert "document.document:approve" in DOCUMENT_MANAGER_PERMISSIONS
    assert "document.folder:create" in DOCUMENT_ADMIN_PERMISSIONS
''',
    )

    w(
        TESTS / "integration" / "document" / "test_document_module_import.py",
        '''"""Integration smoke: Document module imports and router mount."""

from modules.document.models import DocDocument, DocFolder, DocRetentionPolicy
from modules.document.router import document_router
from modules.document.service import (
    DocumentApplicationService,
    DocumentAuditService,
    DocumentIntegrationService,
    DocumentReportService,
    DocumentService,
    FolderService,
)
from modules.document.service.engines import DocumentEngine, FolderEngine


def test_document_models_importable():
    assert DocFolder.__tablename__ == "doc_folder"
    assert DocDocument.__tablename__ == "doc_document"
    assert DocRetentionPolicy.__tablename__ == "doc_retention_policy"


def test_document_router_mounted():
    assert document_router.prefix == "/documents"
    paths = [getattr(r, "path", "") for r in document_router.routes]
    assert any("/{row_id}" in p for p in paths)
    assert any("documents" in p for p in paths)
    assert any("folders" in p for p in paths)


def test_document_services_and_engines_importable():
    assert DocumentApplicationService is not None
    assert DocumentService is not None
    assert FolderService is not None
    assert DocumentReportService is not None
    assert DocumentAuditService is not None
    assert DocumentIntegrationService is not None
    assert DocumentEngine is not None
    assert FolderEngine is not None
''',
    )


def gen_seeds() -> None:
    w(
        ALEMBIC / "0331_seed_document_permissions.py",
        '''"""Seed document permissions and roles."""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.document.permissions import (
    DOCUMENT_ADMIN_PERMISSIONS,
    DOCUMENT_EDITOR_PERMISSIONS,
    DOCUMENT_MANAGER_PERMISSIONS,
    DOCUMENT_PERMISSIONS,
    DOCUMENT_REVIEWER_PERMISSIONS,
)

revision: str = "0331_seed_document_permissions"
down_revision: str | None = "0330_doc_report"
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
    ("DOCUMENT_MANAGER", "Document Manager", DOCUMENT_MANAGER_PERMISSIONS),
    ("DOCUMENT_EDITOR", "Document Editor", DOCUMENT_EDITOR_PERMISSIONS),
    ("DOCUMENT_REVIEWER", "Document Reviewer", DOCUMENT_REVIEWER_PERMISSIONS),
    ("DOCUMENT_ADMIN", "Document Admin", DOCUMENT_ADMIN_PERMISSIONS),
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


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    perm_ids: dict[str, str] = {}
    for code, resource, action, module in DOCUMENT_PERMISSIONS:
        perm_ids[code] = _ensure_permission(conn, now, code, resource, action, module)

    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code, role_name, role_perms in ROLE_SPECS:
            role_row = conn.execute(
                sa.text(
                    """
                    SELECT id FROM foundation.sec_role
                    WHERE tenant_id = :tid AND role_code = :code
                    """
                ),
                {"tid": tid, "code": role_code},
            ).first()
            if role_row:
                role_id = str(role_row[0])
            else:
                role_id = str(uuid4())
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.sec_role
                        (id, tenant_id, role_code, role_name, status, created_at, updated_at)
                        VALUES (:id, :tid, :code, :name, 'active', :now, :now)
                        """
                    ),
                    {"id": role_id, "tid": tid, "code": role_code, "name": role_name, "now": now},
                )
            for pcode in role_perms:
                pid = perm_ids.get(pcode)
                if not pid:
                    continue
                exists = conn.execute(
                    sa.text(
                        """
                        SELECT 1 FROM foundation.sec_role_permission
                        WHERE role_id = :rid AND permission_id = :pid
                        """
                    ),
                    {"rid": role_id, "pid": pid},
                ).first()
                if exists:
                    continue
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.sec_role_permission
                        (id, tenant_id, role_id, permission_id, status, granted_at, created_at, updated_at)
                        VALUES (:id, :tid, :rid, :pid, 'active', :now, :now, :now)
                        """
                    ),
                    {"id": str(uuid4()), "tid": tid, "rid": role_id, "pid": pid, "now": now},
                )


def downgrade() -> None:
    conn = op.get_bind()
    for role_code, _, _ in ROLE_SPECS:
        conn.execute(
            sa.text(
                """
                DELETE FROM foundation.sec_role_permission
                WHERE role_id IN (
                    SELECT id FROM foundation.sec_role WHERE role_code = :code
                )
                """
            ),
            {"code": role_code},
        )
        conn.execute(
            sa.text("DELETE FROM foundation.sec_role WHERE role_code = :code"),
            {"code": role_code},
        )
    for code, _, _, _ in DOCUMENT_PERMISSIONS:
        conn.execute(
            sa.text("DELETE FROM foundation.sec_permission WHERE permission_code = :code"),
            {"code": code},
        )
''',
    )

    w(
        ALEMBIC / "0332_seed_document_workflows.py",
        '''"""Seed document workflow definitions per ERD_18."""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0332_seed_document_workflows"
down_revision: str | None = "0331_seed_document_permissions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

WORKFLOWS: list[tuple[str, str, str, list[tuple[int, str, str, str]]]] = [
    (
        "DOC_DOCUMENT_APPROVAL",
        "Document Approval",
        "doc_document",
        [
            (1, "DOCUMENT_EDITOR", "Editor Submit", "role"),
            (2, "DOCUMENT_REVIEWER", "Document Reviewer Approval", "role"),
            (3, "DOCUMENT_MANAGER", "Document Manager Approval", "role"),
        ],
    ),
    (
        "DOC_DOCUMENT_PUBLISH",
        "Document Publish",
        "doc_document",
        [
            (1, "DOCUMENT_EDITOR", "Author Submit", "role"),
            (2, "DOCUMENT_REVIEWER", "Document Reviewer Approval", "role"),
            (3, "DOCUMENT_MANAGER", "Document Manager Publish", "role"),
        ],
    ),
    (
        "DOC_DOCUMENT_CHECKOUT",
        "Document Checkout",
        "doc_document_checkout",
        [
            (1, "DOCUMENT_EDITOR", "Editor Submit", "role"),
            (2, "DOCUMENT_MANAGER", "Document Manager Approval", "role"),
        ],
    ),
    (
        "DOC_DOCUMENT_ARCHIVE",
        "Document Archive",
        "doc_archive",
        [
            (1, "DOCUMENT_MANAGER", "Records Owner Submit", "role"),
            (2, "DOCUMENT_MANAGER", "Document Manager Approval", "role"),
            (3, "DOCUMENT_ADMIN", "Document Admin Approval", "role"),
        ],
    ),
    (
        "DOC_RETENTION_APPROVAL",
        "Document Retention Approval",
        "doc_retention_policy",
        [
            (1, "DOCUMENT_MANAGER", "Document Manager Submit", "role"),
            (2, "DOCUMENT_ADMIN", "Document Admin Approval", "role"),
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
                        VALUES (:id, :tid, :code, :name, 'document', :doc, 1, true, :now, :now)
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
        "from modules.helpdesk.router import helpdesk_router\n",
        "from modules.helpdesk.router import helpdesk_router\n"
        "from modules.document.router import document_router\n",
    )
    patch_file(
        SHARED / "router.py",
        "api_v1_router.include_router(helpdesk_router)\n",
        "api_v1_router.include_router(helpdesk_router)\n"
        "api_v1_router.include_router(document_router)\n",
    )
    patch_file(
        ROOT / "alembic" / "env.py",
        "import modules.helpdesk.models  # noqa: F401 — register ORM metadata\n",
        "import modules.helpdesk.models  # noqa: F401 — register ORM metadata\n"
        "import modules.document.models  # noqa: F401 — register ORM metadata\n",
    )
    patch_file(
        ROOT / "src" / "workers" / "celery_app.py",
        '        "modules.helpdesk",\n',
        '        "modules.helpdesk",\n        "modules.document",\n',
    )
    patch_file(
        ROOT / "pyproject.toml",
        '    "modules.helpdesk.*",\n',
        '    "modules.helpdesk.*",\n    "modules.document.*",\n',
    )
    patch_file(
        ROOT / "pyproject.toml",
        '"src/modules/helpdesk/**" = ["E501", "SIM102"]\n'
        '"src/modules/helpdesk/domain/enums.py" = ["UP042"]\n',
        '"src/modules/helpdesk/**" = ["E501", "SIM102"]\n'
        '"src/modules/helpdesk/domain/enums.py" = ["UP042"]\n'
        '"src/modules/document/**" = ["E501", "SIM102"]\n'
        '"src/modules/document/domain/enums.py" = ["UP042"]\n',
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
    print(f"OK document module generated — {len(FILES_WRITTEN)} files")
    print("Alembic head revision: 0332_seed_document_workflows")


if __name__ == "__main__":
    main()