"""Document ORM per ERD_18 section 6.2."""

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
        {"schema": "document"},
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

    owner_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
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

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )

