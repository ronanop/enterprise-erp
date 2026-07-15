"""Control test ORM per ERD_19 section 6.5."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcTransactionMixin


class GrcControlTest(Base, *GrcTransactionMixin):
    __tablename__ = "grc_control_test"
    __table_args__ = (
        UniqueConstraint("company_id", "test_number", name="uk_grc_control_test_number"),
        CheckConstraint(
            "test_result IN ('effective','partially_effective','ineffective','not_tested')",
            name="ck_grc_control_test_result",
        ),
        CheckConstraint(
            "status IN ('draft','completed','archived')",
            name="ck_grc_control_test_status",
        ),
        {"schema": "grc"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    control_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_control.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    test_number: Mapped[str] = mapped_column(String(50), nullable=False)

    tested_by_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    test_result: Mapped[str | None] = mapped_column(String(40), nullable=True)
    sample_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    findings_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    document_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
