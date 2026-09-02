"""Marketing platform catalog ORM."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.models.mixins import MktMasterMixin


class MktPlatform(Base, *MktMasterMixin):
    __tablename__ = "mkt_platform"
    __table_args__ = (
        UniqueConstraint("company_id", "platform_code", name="uk_mkt_platform_company_code"),
        CheckConstraint(
            "status IN ('active','inactive')",
            name="ck_mkt_platform_status",
        ),
        {"schema": "marketing"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    platform_code: Mapped[str] = mapped_column(String(50), nullable=False)
    platform_name: Mapped[str] = mapped_column(String(100), nullable=False)
    channel_type: Mapped[str] = mapped_column(String(50), nullable=False, default="social")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
