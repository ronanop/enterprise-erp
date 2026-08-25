"""Pure helpers for GRN receipt-batch reversal (PO qty + status)."""

from decimal import Decimal

from core.exceptions import ConflictException
from modules.procurement.domain.enums import OrderStatus
from modules.procurement.domain.exceptions import InvalidDocumentState


def subtract_received(current: Decimal, reverse_qty: Decimal) -> Decimal:
    nxt = Decimal(str(current or 0)) - Decimal(str(reverse_qty or 0))
    if nxt < 0:
        return Decimal("0")
    return nxt


def line_receipt_status(ordered: Decimal, received: Decimal) -> str:
    qty = Decimal(str(ordered or 0))
    got = Decimal(str(received or 0))
    if got <= 0:
        return "open"
    if qty > 0 and got >= qty:
        return "received"
    return "partially_received"


def order_receipt_status(lines: list) -> tuple[str, Decimal]:
    """Return (order_status, received_amount) after GRN qty changes.

    A completed / closed PO reopens automatically when remaining receipts
    no longer cover every ordered line.
    """
    active = [ln for ln in lines if not getattr(ln, "is_deleted", False)]
    orderable = [ln for ln in active if Decimal(str(getattr(ln, "quantity", 0) or 0)) > 0]
    all_delivered = bool(orderable) and all(
        Decimal(str(getattr(ln, "quantity_received", 0) or 0))
        >= Decimal(str(getattr(ln, "quantity", 0) or 0))
        for ln in orderable
    )
    any_received = any(
        Decimal(str(getattr(ln, "quantity_received", 0) or 0)) > 0 for ln in active
    )
    if all_delivered:
        received_amount = sum(
            (Decimal(str(getattr(ln, "quantity", 0) or 0)) * Decimal(str(getattr(ln, "unit_cost", 0) or 0)))
            for ln in orderable
        )
        return OrderStatus.RECEIVED.value, received_amount
    if any_received:
        received_amount = sum(
            (
                Decimal(str(getattr(ln, "quantity_received", 0) or 0))
                * Decimal(str(getattr(ln, "unit_cost", 0) or 0))
            )
            for ln in active
        )
        return OrderStatus.PARTIALLY_RECEIVED.value, received_amount
    return OrderStatus.SENT.value, Decimal("0")


def assert_batch_reversible(*, reversal_status: str | None, order_status: str | None) -> None:
    status = (reversal_status or "posted").strip().lower()
    if status == "reversed":
        raise ConflictException("This GRN has already been reversed")
    order = (order_status or "").strip().lower()
    if order in {OrderStatus.CANCELLED.value, OrderStatus.DRAFT.value, OrderStatus.SUBMITTED.value}:
        raise InvalidDocumentState("Receipts can only be reversed on issued purchase orders")
