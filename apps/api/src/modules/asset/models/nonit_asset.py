"""Non-IT asset inventory row — separate register from IT ast_asset."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstTransactionMixin


class AstNonitAsset(Base, *AstTransactionMixin):
    __tablename__ = "ast_nonit_asset"
    __table_args__ = (
        UniqueConstraint("company_id", "asset_code", name="uk_ast_nonit_asset_company_code"),
        CheckConstraint(
            "status IN ('IN_STOCK','ASSIGNED','MAINTENANCE','DISPOSED')",
            name="ck_ast_nonit_asset_status",
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    asset_code: Mapped[str] = mapped_column(String(50), nullable=False)
    asset_type_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_nonit_asset_type.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="IN_STOCK",
        server_default="IN_STOCK",
        index=True,
    )
    serial_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    condition: Mapped[str | None] = mapped_column(String(100), nullable=True)
    current_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    current_location_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_nonit_location.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Maintenance (status = MAINTENANCE)
    maintenance_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    maintenance_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    maintenance_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    maintenance_provider: Mapped[str | None] = mapped_column(String(255), nullable=True)
    maintenance_cost: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)

    # Disposal (status = DISPOSED — terminal)
    disposal_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    disposal_date: Mapped[date | None] = mapped_column(Date, nullable=True)
