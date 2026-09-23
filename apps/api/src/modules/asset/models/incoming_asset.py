"""Incoming asset arrival + QC tracking (IT receiving / Sub-phase 1–2).

Arrival tracks expected vs arrived against Procurement GRN lines.
QC dispositions (accept/reject) are Asset-owned and do not create ast_asset
or call Inventory quarantine/release.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from modules.asset.models.mixins import AstDetailMixin, AstTransactionMixin


class AstIncomingAssetLine(Base, *AstTransactionMixin):
    __tablename__ = "ast_incoming_asset_line"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "grn_line_id",
            name="uk_ast_incoming_line_company_grn_line",
        ),
        CheckConstraint(
            "expected_quantity > 0",
            name="ck_ast_incoming_line_expected_qty",
        ),
        CheckConstraint(
            "arrived_quantity >= 0",
            name="ck_ast_incoming_line_arrived_qty_nonneg",
        ),
        CheckConstraint(
            "arrived_quantity <= expected_quantity",
            name="ck_ast_incoming_line_arrived_lte_expected",
        ),
        CheckConstraint(
            "accepted_quantity >= 0",
            name="ck_ast_incoming_line_accepted_nonneg",
        ),
        CheckConstraint(
            "rejected_quantity >= 0",
            name="ck_ast_incoming_line_rejected_nonneg",
        ),
        CheckConstraint(
            "accepted_quantity + rejected_quantity <= arrived_quantity",
            name="ck_ast_incoming_line_qc_lte_arrived",
        ),
        CheckConstraint(
            "status IN ('EXPECTED','PARTIALLY_ARRIVED','ARRIVED')",
            name="ck_ast_incoming_line_status",
        ),
        CheckConstraint(
            "qc_status IN ('PENDING','IN_PROGRESS','ACCEPTED','REJECTED')",
            name="ck_ast_incoming_line_qc_status",
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    grn_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    grn_line_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    purchase_order_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True, index=True
    )
    product_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    vendor_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    grn_document_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    po_document_number: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    product_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    product_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    document_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)

    expected_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    arrived_quantity: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=Decimal("0")
    )
    accepted_quantity: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=Decimal("0")
    )
    rejected_quantity: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=Decimal("0")
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="EXPECTED", index=True)
    qc_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="PENDING", index=True
    )
    qc_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    qc_started_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    qc_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    quality_inspection_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True, index=True
    )

    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    units: Mapped[list[AstIncomingAssetUnit]] = relationship(
        back_populates="incoming_line",
        cascade="all, delete-orphan",
    )
    arrival_events: Mapped[list[AstIncomingArrivalEvent]] = relationship(
        back_populates="incoming_line",
        cascade="all, delete-orphan",
    )
    qc_events: Mapped[list[AstIncomingQcEvent]] = relationship(
        back_populates="incoming_line",
        cascade="all, delete-orphan",
    )


class AstIncomingAssetUnit(Base, *AstDetailMixin):
    __tablename__ = "ast_incoming_asset_unit"
    __table_args__ = (
        UniqueConstraint(
            "incoming_line_id",
            "unit_index",
            name="uk_ast_incoming_unit_line_index",
        ),
        CheckConstraint(
            "unit_index > 0",
            name="ck_ast_incoming_unit_index",
        ),
        CheckConstraint(
            "status IN ('PENDING','ARRIVED')",
            name="ck_ast_incoming_unit_status",
        ),
        CheckConstraint(
            "qc_status IN ('PENDING_QC','ACCEPTED','REJECTED')",
            name="ck_ast_incoming_unit_qc_status",
        ),
        UniqueConstraint(
            "registered_asset_id",
            name="uk_ast_incoming_unit_registered_asset",
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    incoming_line_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_incoming_asset_line.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    unit_index: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    serial_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING", index=True)
    arrived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    arrived_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    qc_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="PENDING_QC", index=True
    )
    tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tested_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    qc_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    evidence_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    quality_inspection_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
    )

    registered_asset_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True, index=True
    )
    registered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    registered_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    incoming_line: Mapped[AstIncomingAssetLine] = relationship(back_populates="units")


class AstIncomingArrivalEvent(Base, *AstDetailMixin):
    """Immutable-ish arrival audit row (who / when / qty). Soft-delete mixin for consistency."""

    __tablename__ = "ast_incoming_arrival_event"
    __table_args__ = (
        CheckConstraint(
            "quantity > 0",
            name="ck_ast_incoming_arrival_qty",
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    incoming_line_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_incoming_asset_line.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit_indexes_json: Mapped[str | None] = mapped_column(String(500), nullable=True)

    incoming_line: Mapped[AstIncomingAssetLine] = relationship(back_populates="arrival_events")


class AstIncomingQcEvent(Base, *AstDetailMixin):
    """QC accept/reject audit row (who / when / qty / disposition)."""

    __tablename__ = "ast_incoming_qc_event"
    __table_args__ = (
        CheckConstraint(
            "quantity > 0",
            name="ck_ast_incoming_qc_qty",
        ),
        CheckConstraint(
            "disposition IN ('ACCEPT','REJECT','START')",
            name="ck_ast_incoming_qc_disposition",
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    incoming_line_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_incoming_asset_line.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    disposition: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("1"))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    evidence_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    unit_ids_json: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    quality_inspection_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    incoming_line: Mapped[AstIncomingAssetLine] = relationship(back_populates="qc_events")
