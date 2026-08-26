"""Content pillar ORM."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.models.mixins import MktMasterMixin


class MktContentPillar(Base, *MktMasterMixin):
    __tablename__ = "mkt_content_pillar"
    __table_args__ = (
        UniqueConstraint("company_id", "pillar_code", name="uk_mkt_pillar_company_code"),
        CheckConstraint("status IN ('active','inactive')", name="ck_mkt_pillar_status"),
        {"schema": "marketing"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    pillar_code: Mapped[str] = mapped_column(String(50), nullable=False)
    pillar_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_mix_pct: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
