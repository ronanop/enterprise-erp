"""Order view ORM per ERD_23 section 5.9."""

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
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="visible", index=True)
