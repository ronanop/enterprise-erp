"""CRM campaign member ORM."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmMasterMixin


class CrmCampaignMember(Base, *CrmMasterMixin):
    __tablename__ = "crm_campaign_member"
    __table_args__ = (
        CheckConstraint("member_type IN ('lead','customer')", name="ck_crm_cm_type"),
        CheckConstraint(
            "member_status IN ('invited','responded','converted','unsubscribed')",
            name="ck_crm_cm_status",
        ),
        CheckConstraint(
            "(lead_id IS NOT NULL AND customer_id IS NULL) OR "
            "(lead_id IS NULL AND customer_id IS NOT NULL)",
            name="ck_crm_cm_xor",
        ),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    campaign_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_campaign.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    member_type: Mapped[str] = mapped_column(String(30), nullable=False)
    lead_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("crm.crm_lead.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    member_status: Mapped[str] = mapped_column(String(30), nullable=False, default="invited")
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
