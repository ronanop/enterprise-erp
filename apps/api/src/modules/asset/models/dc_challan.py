"""Delivery challan tracking (IT → SCM paperwork) — standalone from assignment DC fields."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstTransactionMixin

DC_CHALLAN_OPEN_STATUSES = (
    "PENDING",
    "SENT_TO_SCM",
    "DOCUMENT_RECEIVED",
    "SIGNED",
)

_OPEN_STATUS_SQL = (
    "is_deleted = false AND status IN "
    "('PENDING','SENT_TO_SCM','DOCUMENT_RECEIVED','SIGNED')"
)


class AstDcChallan(Base, *AstTransactionMixin):
    """Standalone DC challan row. branch_id is pinned at create (does not follow transfers)."""

    __tablename__ = "ast_dc_challan"
    __table_args__ = (
        UniqueConstraint("company_id", "dc_number", name="uk_ast_dc_challan_company_number"),
        CheckConstraint(
            "status IN "
            "('PENDING','SENT_TO_SCM','DOCUMENT_RECEIVED','SIGNED','RECEIVED','CANCELLED')",
            name="ck_ast_dc_challan_status",
        ),
        Index(
            "uq_ast_dc_challan_one_open_per_asset",
            "asset_id",
            unique=True,
            postgresql_where=text(_OPEN_STATUS_SQL),
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    dc_number: Mapped[str] = mapped_column(String(50), nullable=False)

    asset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_asset.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    assignment_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_asset_assignment.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING", index=True)

    employee_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    employee_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    employee_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    employee_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    deployed_to: Mapped[str | None] = mapped_column(String(255), nullable=True)

    asset_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    asset_tag: Mapped[str | None] = mapped_column(String(50), nullable=True)
    make: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    serial_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    purchase_cost: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)

    sent_to_scm_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scm_reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    scm_document_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    scm_document_uploaded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    signed_document_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    signed_document_uploaded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
