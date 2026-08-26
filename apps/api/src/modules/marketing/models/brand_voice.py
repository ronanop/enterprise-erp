"""Brand voice ORM."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.models.mixins import MktMasterMixin


class MktBrandVoice(Base, *MktMasterMixin):
    __tablename__ = "mkt_brand_voice"
    __table_args__ = (
        UniqueConstraint("company_id", "voice_code", name="uk_mkt_brand_voice_company_code"),
        CheckConstraint(
            "status IN ('draft','training','active','archived')",
            name="ck_mkt_brand_voice_status",
        ),
        {"schema": "marketing"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    voice_code: Mapped[str] = mapped_column(String(50), nullable=False)
    voice_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tone_keywords: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    guidelines: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
