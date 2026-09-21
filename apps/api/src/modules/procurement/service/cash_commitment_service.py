"""Procurement's cash-side view, published for other modules.

Finance needs two things procurement owns: purchase orders that are committed
but not yet invoiced, and goods that have been received and paid for but are
still sitting in the warehouse because the customer is not ready.

Both are exposed as plain dataclasses so the finance module never reaches into
procurement tables directly.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.models.inventory_stock import ProcInventoryStockUnit
from modules.procurement.models.order import ProcOrderHeader, ProcOrderLine

# Orders that represent real money already committed to a vendor.
COMMITTED_ORDER_STATUSES = (
    "approved",
    "sent",
    "partially_received",
    "received",
    "closed",
)

# Fallback when a PO carries no parseable payment terms.
DEFAULT_PAYMENT_TERM_DAYS = 30

_DAYS_RE = re.compile(r"(\d+)")


@dataclass(frozen=True, kw_only=True)
class CommittedOrder:
    """A purchase order balance that still has to be paid."""

    order_id: UUID
    document_number: str
    vendor_id: UUID
    amount: Decimal
    expected_payment_date: date
    expected_delivery_date: date | None
    document_date: date
    payment_term_days: int
    status: str


@dataclass(frozen=True, kw_only=True)
class HeldStockUnit:
    """A received unit still in the warehouse, with the cash it represents."""

    stock_unit_id: UUID
    order_id: UUID
    document_number: str
    product_name: str
    grn_number: str
    quantity: Decimal
    value: Decimal
    received_on: date | None
    days_held: int


def parse_payment_term_days(payment_terms: str | None) -> int:
    """Pull a day count out of free-text terms such as ``"Net 45"`` or ``"60 days"``."""
    if not payment_terms:
        return DEFAULT_PAYMENT_TERM_DAYS
    match = _DAYS_RE.search(payment_terms)
    if not match:
        return DEFAULT_PAYMENT_TERM_DAYS
    days = int(match.group(1))
    return days if 0 <= days <= 365 else DEFAULT_PAYMENT_TERM_DAYS


class CashCommitmentService:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_committed_orders(
        self, ctx: TenantContext, company_id: UUID, *, as_of: date | None = None
    ) -> list[CommittedOrder]:
        """Purchase orders with an uninvoiced balance, dated by their payment terms."""
        as_of = as_of or date.today()
        stmt = select(ProcOrderHeader).where(
            ProcOrderHeader.tenant_id == ctx.tenant_id,
            ProcOrderHeader.company_id == company_id,
            ProcOrderHeader.is_deleted.is_(False),
            ProcOrderHeader.status.in_(COMMITTED_ORDER_STATUSES),
        )

        commitments: list[CommittedOrder] = []
        for row in self._db.scalars(stmt).all():
            total = Decimal(str(row.total_amount or 0))
            invoiced = Decimal(str(row.invoiced_amount or 0))
            outstanding = total - invoiced
            if outstanding <= 0:
                continue

            term_days = parse_payment_term_days(row.payment_terms)
            # Payment follows delivery; without an ETD, fall back to the order date.
            anchor = row.expected_delivery_date or row.document_date or as_of
            commitments.append(
                CommittedOrder(
                    order_id=row.id,
                    document_number=row.document_number,
                    vendor_id=row.vendor_id,
                    amount=outstanding,
                    expected_payment_date=anchor + timedelta(days=term_days),
                    expected_delivery_date=row.expected_delivery_date,
                    document_date=row.document_date,
                    payment_term_days=term_days,
                    status=row.status,
                )
            )
        return commitments

    def list_held_stock(
        self, ctx: TenantContext, company_id: UUID, *, as_of: date | None = None
    ) -> list[HeldStockUnit]:
        """Received stock still on hand, valued at the purchase cost that bought it."""
        as_of = as_of or date.today()
        stmt = (
            select(ProcInventoryStockUnit, ProcOrderLine, ProcOrderHeader)
            .join(ProcOrderLine, ProcOrderLine.id == ProcInventoryStockUnit.order_line_id)
            .join(
                ProcOrderHeader,
                ProcOrderHeader.id == ProcInventoryStockUnit.order_header_id,
            )
            .where(
                ProcInventoryStockUnit.tenant_id == ctx.tenant_id,
                ProcInventoryStockUnit.company_id == company_id,
                ProcInventoryStockUnit.is_deleted.is_(False),
                ProcOrderHeader.is_deleted.is_(False),
            )
        )

        held: list[HeldStockUnit] = []
        for unit, line, header in self._db.execute(stmt).all():
            quantity = Decimal(str(unit.quantity or 0))
            if quantity <= 0:
                continue
            unit_cost = Decimal(str(line.unit_cost or 0))
            received_on = _as_date(unit.receipt_at)
            held.append(
                HeldStockUnit(
                    stock_unit_id=unit.id,
                    order_id=header.id,
                    document_number=header.document_number,
                    product_name=unit.product_name,
                    grn_number=unit.grn_number,
                    quantity=quantity,
                    value=quantity * unit_cost,
                    received_on=received_on,
                    days_held=(as_of - received_on).days if received_on else 0,
                )
            )
        return held


def _as_date(value: datetime | date | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(UTC).date() if value.tzinfo else value.date()
    return value
