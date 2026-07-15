"""Dimension ORM per ERD_20 section 6.10."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiDimension(Base, *BiRowMixin):
    __tablename__ = "bi_dimension"
    __table_args__ = (
        UniqueConstraint("company_id", "dimension_code", name="uk_bi_dimension_code"),
        CheckConstraint(
            "dimension_type IN ('time','geo','org','product','customer','vendor','employee','custom')",
            name="ck_bi_dimension_type",
        ),
        CheckConstraint("status IN ('active','inactive')", name="ck_bi_dimension_status"),
        {"schema": "analytics"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    dimension_code: Mapped[str] = mapped_column(String(50), nullable=False)
    dimension_name: Mapped[str] = mapped_column(String(255), nullable=False)

    dataset_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "analytics.bi_dataset.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )
    dimension_type: Mapped[str] = mapped_column(String(40), nullable=False)
    source_module: Mapped[str | None] = mapped_column(String(40), nullable=True)
    hierarchy_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    master_product_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    master_customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    master_vendor_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_vendor.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
