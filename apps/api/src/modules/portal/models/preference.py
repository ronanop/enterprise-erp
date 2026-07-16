"""Preference ORM per ERD_23 section 5.17."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtPreference(Base, *PtRowMixin):
    __tablename__ = "pt_preference"
    __table_args__ = (
        UniqueConstraint("portal_account_id", "preference_key", name="uk_pt_preference_key"),
        CheckConstraint(
            "status = 'active'",
            name="ck_pt_preference_status",
        ),
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    preference_key: Mapped[str] = mapped_column(String(100), nullable=False)
    preference_value_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
