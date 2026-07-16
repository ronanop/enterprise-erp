"""Saved report ORM per ERD_23 section 5.15."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtSavedReport(Base, *PtRowMixin):
    __tablename__ = "pt_saved_report"
    __table_args__ = (
        UniqueConstraint("company_id", "saved_report_number", name="uk_pt_saved_report_number"),
        CheckConstraint(
            "source_type IN ('portal','analytics_ref')",
            name="ck_pt_saved_report_source_type",
        ),
        CheckConstraint(
            "status IN ('active','archived')",
            name="ck_pt_saved_report_status",
        ),
        Index("ix_pt_saved_report_tenant_co_status", "tenant_id", "company_id", "status"),
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    saved_report_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    report_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False, default="portal")

    bi_report_ref_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    definition_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
