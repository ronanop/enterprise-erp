"""Customer-facing order tracking by the customer's own PO number.

Customers ask "where is my order?" far more often than anyone can answer by
mail, so this resolves a customer PO number to a short, milestone-level
timeline. It is deliberately commercial-free: no prices, margins, vendor names,
or internal document numbers ever leave this service.

Because the lookup is unauthenticated, the caller must present both the PO
number and the email registered against that account. That prevents anyone from
walking PO numbers to read another customer's status.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.procurement.adapters.crm_adapter import ProcurementCrmAdapter
from modules.procurement.domain.enums import OrderStatus
from modules.procurement.models.order import ProcOrderHeader

# Milestones shown to the customer, in order.
ORDER_PLACED = "order_placed"
WITH_SUPPLIER = "with_supplier"
DELIVERY_DATE_CONFIRMED = "delivery_date_confirmed"
MATERIAL_RECEIVED = "material_received"
DISPATCHED = "dispatched"

_STAGE_LABELS: dict[str, str] = {
    ORDER_PLACED: "Order received",
    WITH_SUPPLIER: "Order placed with supplier",
    DELIVERY_DATE_CONFIRMED: "Delivery date confirmed",
    MATERIAL_RECEIVED: "Material received at our warehouse",
    DISPATCHED: "Dispatched to you",
}

_RECEIVED_STATUSES = {
    OrderStatus.PARTIALLY_RECEIVED.value,
    OrderStatus.RECEIVED.value,
    OrderStatus.CLOSED.value,
}

_LIVE_WITH_SUPPLIER = {
    OrderStatus.SENT.value,
    OrderStatus.APPROVED.value,
}


@dataclass(frozen=True)
class _Milestone:
    stage: str
    done: bool
    on: date | None = None


def _as_date(value: datetime | date | None) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    return value


class OrderTrackingService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._crm = ProcurementCrmAdapter(db)

    def _find_ovf(self, order_number: str, email: str) -> Any:
        """Match the customer PO number and the account's registered email."""
        ovf = self._crm.find_ovf_by_customer_po(order_number=order_number, email=email)
        if ovf is None:
            raise NotFoundException("No order found for those details")
        return ovf

    def _orders_for(self, ovf: Any) -> list[ProcOrderHeader]:
        stmt = select(ProcOrderHeader).where(
            ProcOrderHeader.tenant_id == ovf.tenant_id,
            ProcOrderHeader.is_deleted.is_(False),
            ProcOrderHeader.source_module == "crm",
            ProcOrderHeader.source_document_type == "ovf",
            ProcOrderHeader.source_document_id == ovf.id,
            ProcOrderHeader.status != OrderStatus.CANCELLED.value,
        )
        return list(self._db.scalars(stmt).all())

    def _milestones(self, ovf: Any, orders: list[ProcOrderHeader]) -> list[_Milestone]:
        statuses = {order.status for order in orders}
        etds = [o.expected_delivery_date for o in orders if o.expected_delivery_date]

        with_supplier = bool(statuses & (_LIVE_WITH_SUPPLIER | _RECEIVED_STATUSES))
        received = bool(statuses & _RECEIVED_STATUSES)
        dispatched = ovf.invoice_submitted_at is not None

        return [
            _Milestone(ORDER_PLACED, True, _as_date(ovf.shared_to_scm_at or ovf.created_at)),
            _Milestone(
                WITH_SUPPLIER,
                with_supplier,
                min((o.document_date for o in orders if o.document_date), default=None),
            ),
            _Milestone(DELIVERY_DATE_CONFIRMED, bool(etds), max(etds) if etds else None),
            _Milestone(MATERIAL_RECEIVED, received),
            _Milestone(DISPATCHED, dispatched, _as_date(ovf.invoice_submitted_at)),
        ]

    def track(self, *, order_number: str, email: str) -> dict[str, Any]:
        ovf = self._find_ovf(order_number, email)
        orders = self._orders_for(ovf)
        milestones = self._milestones(ovf, orders)

        current = next(
            (m.stage for m in reversed(milestones) if m.done),
            ORDER_PLACED,
        )
        etds = [o.expected_delivery_date for o in orders if o.expected_delivery_date]

        return {
            "order_number": ovf.po_number,
            "customer_name": ovf.customer_name,
            "order_date": ovf.po_date or _as_date(ovf.created_at),
            "current_stage": current,
            "current_stage_label": _STAGE_LABELS[current],
            "expected_delivery_date": max(etds) if etds else None,
            "milestones": [
                {
                    "stage": m.stage,
                    "label": _STAGE_LABELS[m.stage],
                    "done": m.done,
                    "on": m.on,
                }
                for m in milestones
            ],
        }
