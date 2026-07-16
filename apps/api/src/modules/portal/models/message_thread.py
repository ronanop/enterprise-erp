"""Message thread ORM per ERD_23 section 5.8."""

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
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)
