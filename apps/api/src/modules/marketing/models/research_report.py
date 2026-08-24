"""Research report ORM."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.models.mixins import MktTransactionMixin


class MktResearchReport(Base, *MktTransactionMixin):
    __tablename__ = "mkt_research_report"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','processing','completed','failed')",
            name="ck_mkt_research_report_status",
        ),
        {"schema": "marketing"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    campaign_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_campaign.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    report_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    topic: Mapped[str] = mapped_column(String(500), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    findings: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
