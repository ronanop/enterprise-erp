"""Brand voice source ORM."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.models.mixins import MktDetailMixin


class MktBrandVoiceSource(Base, *MktDetailMixin):
    __tablename__ = "mkt_brand_voice_source"
    __table_args__ = (
        CheckConstraint(
            "source_type IN ('url','document','social_post','manual')",
            name="ck_mkt_brand_voice_source_type",
        ),
        CheckConstraint(
            "status IN ('pending','processed','failed')",
            name="ck_mkt_brand_voice_source_status",
        ),
        {"schema": "marketing"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    brand_voice_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_brand_voice.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)
    source_label: Mapped[str] = mapped_column(String(255), nullable=False)
    source_uri: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    source_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending", index=True)
