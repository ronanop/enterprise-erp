"""Asset category ORM per ERD_15 section 6.1."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstMasterMixin


class AstAssetCategory(Base, *AstMasterMixin):
    __tablename__ = "ast_asset_category"
    __table_args__ = (
        UniqueConstraint("company_id", "category_code", name="uk_ast_asset_category_code"),
        CheckConstraint(
            "default_depreciation_method IS NULL OR default_depreciation_method IN "
            "('straight_line','wdv','units_of_production')",
            name="ck_ast_asset_category_depr_method",
        ),
        CheckConstraint(
            "status IN ('active','inactive')",
            name="ck_ast_asset_category_status",
        ),
        CheckConstraint(
            "asset_domain IS NULL OR asset_domain IN ('IT','NON_IT')",
            name="ck_ast_asset_category_domain",
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

    category_code: Mapped[str] = mapped_column(String(50), nullable=False)
    category_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # NULL = usable by both domains; existing rows backfilled to IT
    asset_domain: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    default_useful_life_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_depreciation_method: Mapped[str | None] = mapped_column(String(40), nullable=True)
    gl_asset_account_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    gl_accum_depr_account_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    gl_expense_account_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
