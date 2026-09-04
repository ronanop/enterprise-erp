"""Asset location ORM per ERD_15 section 6.6."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstDetailMixin


class AstAssetLocation(Base, *AstDetailMixin):
    __tablename__ = "ast_asset_location"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','historical')",
            name="ck_ast_asset_location_status",
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    asset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_asset.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    location_label: Mapped[str] = mapped_column(String(255), nullable=False)
    org_location_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    location_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_location.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    building_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_building.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
