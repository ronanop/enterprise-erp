"""Competitor ORM."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.models.mixins import MktMasterMixin


class MktCompetitor(Base, *MktMasterMixin):
    __tablename__ = "mkt_competitor"
    __table_args__ = (
        UniqueConstraint("company_id", "competitor_code", name="uk_mkt_competitor_company_code"),
        CheckConstraint("status IN ('active','inactive')", name="ck_mkt_competitor_status"),
        {"schema": "marketing"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    competitor_code: Mapped[str] = mapped_column(String(50), nullable=False)
    competitor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    website_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    social_handles: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
