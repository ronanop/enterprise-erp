"""Marketing channel model."""

from uuid import UUID

from sqlalchemy import Boolean, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.domain.enums import ChannelPlatform
from modules.marketing.models.mixins import MktMasterMixin


class MktChannel(Base, *MktMasterMixin):
    __tablename__ = "mkt_channel"
    __table_args__ = {"schema": "marketing"}

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    platform: Mapped[str] = mapped_column(String(50), nullable=False, default=ChannelPlatform.OTHER.value)
    handle: Mapped[str | None] = mapped_column(String(255), nullable=True)
    profile_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    default_handler_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
