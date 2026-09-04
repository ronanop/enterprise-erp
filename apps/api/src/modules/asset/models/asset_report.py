"""Asset report ORM per ERD_15 section 6.20."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstDetailMixin


class AstAssetReport(Base, *AstDetailMixin):
    __tablename__ = "ast_asset_report"
    __table_args__ = (
        UniqueConstraint("company_id", "report_code", name="uk_ast_asset_report_code"),
        CheckConstraint(
            "report_type IN ("
            "'register','depreciation_schedule','utilization',"
            "'maintenance_due','insurance_expiry','audit_variance',"
            "'warranty_expiry','allocation','transfer','disposal',"
            "'documents','checklists','meters','notifications'"
            ")",
            name="ck_ast_asset_report_type",
        ),
        CheckConstraint(
            "status IN ('draft','finalized')",
            name="ck_ast_asset_report_status",
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    report_code: Mapped[str] = mapped_column(String(50), nullable=False)
    report_type: Mapped[str] = mapped_column(String(40), nullable=False)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    category_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_asset_category.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    metrics_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
