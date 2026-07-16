"""Portal report ORM per ERD_23 section 5.20."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtReport(Base, *PtRowMixin):
    __tablename__ = "pt_report"
    __table_args__ = (
        UniqueConstraint("company_id", "report_code", name="uk_pt_report_code"),
        CheckConstraint(
            "report_type IN ('active_users','login_failures','ticket_volume','service_volume',"
            "'document_downloads','session_metrics')",
            name="ck_pt_report_type",
        ),
        CheckConstraint(
            "status IN ('draft','finalized')",
            name="ck_pt_report_status",
        ),
        Index("ix_pt_report_tenant_co_status", "tenant_id", "company_id", "status"),
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    report_code: Mapped[str] = mapped_column(String(50), nullable=False)
    report_type: Mapped[str] = mapped_column(String(40), nullable=False)
    period_start: Mapped[date | None] = mapped_column(nullable=True)
    period_end: Mapped[date | None] = mapped_column(nullable=True)
    metrics_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
