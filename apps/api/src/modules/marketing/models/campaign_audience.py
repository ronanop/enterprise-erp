"""Marketing campaign audience model."""

from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.domain.enums import AudienceMemberStatus
from modules.marketing.models.mixins import MktDetailMixin


class MktCampaignAudience(Base, *MktDetailMixin):
    __tablename__ = "mkt_campaign_audience"
    __table_args__ = {"schema": "marketing"}

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    campaign_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_campaign.id"),
        nullable=False,
    )
    segment_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default=AudienceMemberStatus.TARGETED.value)
    estimated_size: Mapped[int | None] = mapped_column(nullable=True)
