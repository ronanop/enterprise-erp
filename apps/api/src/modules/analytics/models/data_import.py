"""Data import ORM per ERD_20 section 6.18."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiDataImport(Base, *BiRowMixin):
    __tablename__ = "bi_data_import"
    __table_args__ = (
        UniqueConstraint("company_id", "import_number", name="uk_bi_data_import_number"),
        CheckConstraint(
            "format IN ('csv','xlsx','json')",
            name="ck_bi_data_import_format",
        ),
        CheckConstraint(
            "status IN ('queued','running','succeeded','failed','cancelled')",
            name="ck_bi_data_import_status",
        ),
        CheckConstraint("rows_loaded IS NULL OR rows_loaded >= 0", name="ck_bi_import_rows_loaded"),
        {"schema": "analytics"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    import_number: Mapped[str] = mapped_column(String(50), nullable=False)
    dataset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("analytics.bi_dataset.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    requested_by_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    source_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    format: Mapped[str] = mapped_column(String(20), nullable=False)
    rows_loaded: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="queued", index=True)
