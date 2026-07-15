"""Fact table metadata ORM per ERD_20 section 6.11."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiFactTable(Base, *BiRowMixin):
    __tablename__ = "bi_fact_table"
    __table_args__ = (
        UniqueConstraint("company_id", "fact_code", name="uk_bi_fact_table_code"),
        CheckConstraint(
            "status IN ('draft','active','rebuilding','retired')",
            name="ck_bi_fact_table_status",
        ),
        {"schema": "analytics"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    fact_code: Mapped[str] = mapped_column(String(50), nullable=False)
    fact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    dataset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("analytics.bi_dataset.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    grain_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    measure_codes_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    dimension_codes_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    storage_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    physical_table_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
