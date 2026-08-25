"""Social account ORM."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.models.mixins import MktMasterMixin


class MktSocialAccount(Base, *MktMasterMixin):
    __tablename__ = "mkt_social_account"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "platform_id",
            "account_handle",
            name="uk_mkt_social_account_handle",
        ),
        CheckConstraint(
            "status IN ('draft','connected','disconnected','error')",
            name="ck_mkt_social_account_status",
        ),
        {"schema": "marketing"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    platform_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_platform.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_handle: Mapped[str] = mapped_column(String(255), nullable=False)
    external_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
