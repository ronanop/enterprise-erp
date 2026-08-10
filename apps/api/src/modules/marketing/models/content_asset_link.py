"""Marketing content-asset link model."""

from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.models.mixins import MktDetailMixin


class MktContentAssetLink(Base, *MktDetailMixin):
    __tablename__ = "mkt_content_asset_link"
    __table_args__ = {"schema": "marketing"}

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    content_item_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_content_item.id"),
        nullable=False,
    )
    media_asset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_media_asset.id"),
        nullable=False,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    asset_role: Mapped[str | None] = mapped_column(String(30), nullable=True)
