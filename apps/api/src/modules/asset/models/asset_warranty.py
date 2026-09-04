"""Asset warranty ORM per ERD_15 section 6.7."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstDetailMixin


class AstAssetWarranty(Base, *AstDetailMixin):
    __tablename__ = "ast_asset_warranty"
    __table_args__ = (
        CheckConstraint(
            "warranty_type IN ('manufacturer','extended','service')",
            name="ck_ast_asset_warranty_type",
        ),
        CheckConstraint(
            "status IN ('draft','active','extended','expired','void')",
            name="ck_ast_asset_warranty_status",
        ),
        CheckConstraint("end_date >= start_date", name="ck_ast_asset_warranty_dates"),
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
    vendor_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_vendor.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    warranty_type: Mapped[str] = mapped_column(String(40), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    coverage_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
