"""Asset register ORM per ERD_15 section 6.2."""

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstTransactionMixin


class AstAsset(Base, *AstTransactionMixin):
    __tablename__ = "ast_asset"
    __table_args__ = (
        UniqueConstraint("company_id", "asset_code", name="uk_ast_asset_company_code"),
        CheckConstraint(
            "asset_type IN ('fixed','consumable','digital','leased')",
            name="ck_ast_asset_type",
        ),
        CheckConstraint(
            "depreciation_method IS NULL OR depreciation_method IN "
            "('straight_line','wdv','units_of_production')",
            name="ck_ast_asset_depr_method",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','active','in_maintenance',"
            "'transferred','disposed','written_off','cancelled')",
            name="ck_ast_asset_status",
        ),
        CheckConstraint(
            "operational_status IS NULL OR operational_status IN "
            "('READY_TO_MOVE','ASSIGNED','RETIRED','PENDING_DISPOSAL','DISPOSED')",
            name="ck_ast_asset_operational_status",
        ),
        CheckConstraint(
            "purchase_cost IS NULL OR purchase_cost >= 0",
            name="ck_ast_asset_purchase_cost",
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    asset_code: Mapped[str] = mapped_column(String(50), nullable=False)
    asset_name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_category_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_asset_category.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    asset_type: Mapped[str] = mapped_column(String(40), nullable=False)
    master_asset_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_asset.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    product_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    supplier_vendor_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_vendor.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    serial_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    barcode: Mapped[str | None] = mapped_column(String(100), nullable=True)
    qr_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    rfid_tag: Mapped[str | None] = mapped_column(String(100), nullable=True)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    purchase_cost: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    current_book_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    salvage_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    currency_code: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    depreciation_method: Mapped[str | None] = mapped_column(String(40), nullable=True)
    useful_life_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    custodian_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    purchase_order_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    grn_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    inventory_receipt_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    inventory_issue_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    project_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    production_order_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    quality_inspection_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    is_shared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    operational_status: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
    discovery_profile_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

