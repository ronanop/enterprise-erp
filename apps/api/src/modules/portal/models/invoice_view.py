"""Invoice view ORM per ERD_23 section 5.10."""

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
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="visible", index=True)
