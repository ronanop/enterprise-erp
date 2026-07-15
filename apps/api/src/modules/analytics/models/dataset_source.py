"""Dataset source ORM per ERD_20 section 6.7."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiDatasetSource(Base, *BiRowMixin):
    __tablename__ = "bi_dataset_source"
    __table_args__ = (
        UniqueConstraint("dataset_id", "source_code", name="uk_bi_dataset_source_code"),
        CheckConstraint(
            "source_module IN ('foundation','organization','master','finance','sales',"
            "'procurement','inventory','manufacturing','quality','crm','hr','payroll',"
            "'recruitment','project','asset','service','helpdesk','document','grc','external')",
            name="ck_bi_dataset_source_module",
        ),
        CheckConstraint("status IN ('active','inactive')", name="ck_bi_dataset_source_status"),
        Index("ix_bi_dataset_source_module_ref", "source_module", "source_ref_id"),
        {"schema": "analytics"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    dataset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("analytics.bi_dataset.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    source_code: Mapped[str] = mapped_column(String(50), nullable=False)
    source_module: Mapped[str] = mapped_column(String(40), nullable=False)
    source_entity: Mapped[str | None] = mapped_column(String(100), nullable=True)

    source_ref_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    connection_key: Mapped[str | None] = mapped_column(String(100), nullable=True)
    extract_query_key: Mapped[str | None] = mapped_column(String(100), nullable=True)
    filter_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
