"""Asset component ORM per ERD_15 section 6.3 (FP-ASSET-019).

Active-code uniqueness is enforced by partial unique index
``uq_ast_asset_component_active_code`` (migration 0484), not a table UK,
so replaced/disposed history may retain the same component_code.
"""

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstDetailMixin


class AstAssetComponent(Base, *AstDetailMixin):
    __tablename__ = "ast_asset_component"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','replaced','disposed')",
            name="ck_ast_asset_component_status",
        ),
        CheckConstraint(
            "component_type IN ("
            "'CHARGER','MOUSE','KEYBOARD','CABLE','PENDRIVE','LAPTOP_BAG','OTHER'"
            ")",
            name="ck_ast_asset_component_type",
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
    component_code: Mapped[str] = mapped_column(String(50), nullable=False)
    component_name: Mapped[str] = mapped_column(String(255), nullable=False)
    component_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="OTHER", index=True
    )
    product_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    serial_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
