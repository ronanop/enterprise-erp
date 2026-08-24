"""Marketing campaign ORM."""

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.models.mixins import MktMasterMixin


class MktCampaign(Base, *MktMasterMixin):
    __tablename__ = "mkt_campaign"
    __table_args__ = (
        UniqueConstraint("company_id", "campaign_code", name="uk_mkt_campaign_company_code"),
        CheckConstraint(
            "status IN ('draft','active','paused','completed','cancelled')",
            name="ck_mkt_campaign_status",
        ),
        CheckConstraint(
            "campaign_type IN ('brand','product','social','email','event','mixed')",
            name="ck_mkt_campaign_type",
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
    campaign_code: Mapped[str] = mapped_column(String(50), nullable=False)
    campaign_name: Mapped[str] = mapped_column(String(255), nullable=False)
    campaign_type: Mapped[str] = mapped_column(String(30), nullable=False, default="social")
    objective: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    budget_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    currency_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Soft link to CRM campaign — no cross-module FK (C-02)
    crm_campaign_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    owner_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
