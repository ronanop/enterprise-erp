"""Inventory engines - domain stock math and state machines."""

from decimal import Decimal

from modules.inventory.domain.enums import (
    AdjustmentStatus,
    CycleCountStatus,
    MovementType,
    ReservationStatus,
    TransferStatus,
    ValuationLayerStatus,
    VarianceType,
)
from modules.inventory.domain.exceptions import (
    InsufficientStock,
    InvalidDocumentState,
    ValuationError,
)
from modules.inventory.domain.value_objects import FifoConsumeResult
from modules.inventory.models.adjustment import InvAdjustmentHeader
from modules.inventory.models.balance import InvStockBalance
from modules.inventory.models.cycle_count import InvCycleCountHeader, InvCycleCountLine
from modules.inventory.models.reservation import InvReservation
from modules.inventory.models.transfer import InvTransferHeader
from modules.inventory.models.valuation import InvValuationLayer


class StockEngine:
    def recompute_available(self, balance: InvStockBalance) -> Decimal:
        on_hand = Decimal(str(balance.on_hand_qty))
        reserved = Decimal(str(balance.reserved_qty))
        available = on_hand - reserved
        if available < 0:
            raise InsufficientStock(
                f"Available would be negative (on_hand={on_hand}, reserved={reserved})"
            )
        balance.available_qty = float(available.quantize(Decimal("0.0001")))
        return available

    def apply_receipt(self, balance: InvStockBalance, qty: Decimal) -> None:
        if qty <= 0:
            raise InvalidDocumentState("Receipt quantity must be positive")
        balance.on_hand_qty = float(
            (Decimal(str(balance.on_hand_qty)) + qty).quantize(Decimal("0.0001"))
        )
        self.recompute_available(balance)

    def apply_issue(
        self, balance: InvStockBalance, qty: Decimal, *, against_reservation: bool
    ) -> None:
        if qty <= 0:
            raise InvalidDocumentState("Issue quantity must be positive")
        on_hand = Decimal(str(balance.on_hand_qty))
        reserved = Decimal(str(balance.reserved_qty))
        if against_reservation:
            if reserved < qty:
                raise InsufficientStock("Issue exceeds reserved quantity")
            balance.reserved_qty = float((reserved - qty).quantize(Decimal("0.0001")))
        else:
            available = on_hand - reserved
            if available < qty:
                raise InsufficientStock("Insufficient available stock for issue")
        balance.on_hand_qty = float((on_hand - qty).quantize(Decimal("0.0001")))
        self.recompute_available(balance)

    def apply_reserve(self, balance: InvStockBalance, qty: Decimal) -> None:
        if qty <= 0:
            raise InvalidDocumentState("Reserve quantity must be positive")
        available = Decimal(str(balance.available_qty))
        if available < qty:
            raise InsufficientStock("Insufficient available stock to reserve")
        balance.reserved_qty = float(
            (Decimal(str(balance.reserved_qty)) + qty).quantize(Decimal("0.0001"))
        )
        self.recompute_available(balance)

    def apply_release(self, balance: InvStockBalance, qty: Decimal) -> None:
        if qty <= 0:
            raise InvalidDocumentState("Release quantity must be positive")
        reserved = Decimal(str(balance.reserved_qty))
        if reserved < qty:
            raise InsufficientStock("Release exceeds reserved quantity")
        balance.reserved_qty = float((reserved - qty).quantize(Decimal("0.0001")))
        self.recompute_available(balance)

    def apply_adjustment(self, balance: InvStockBalance, signed_qty: Decimal) -> str:
        if signed_qty == 0:
            raise InvalidDocumentState("Adjustment quantity cannot be zero")
        if signed_qty > 0:
            self.apply_receipt(balance, signed_qty)
            return MovementType.ADJUSTMENT_IN.value
        issue_qty = abs(signed_qty)
        self.apply_issue(balance, issue_qty, against_reservation=False)
        return MovementType.ADJUSTMENT_OUT.value


class ReservationEngine:
    def remaining(self, reservation: InvReservation) -> Decimal:
        return Decimal(str(reservation.quantity_reserved)) - Decimal(
            str(reservation.quantity_issued)
        )

    def validate_active(self, reservation: InvReservation) -> None:
        if reservation.status not in {
            ReservationStatus.ACTIVE.value,
            ReservationStatus.PARTIALLY_ISSUED.value,
        }:
            raise InvalidDocumentState("Reservation is not active")

    def apply_issue(self, reservation: InvReservation, qty: Decimal) -> None:
        self.validate_active(reservation)
        remaining = self.remaining(reservation)
        if qty > remaining:
            raise InsufficientStock("Issue exceeds reservation remaining quantity")
        reservation.quantity_issued = float(
            (Decimal(str(reservation.quantity_issued)) + qty).quantize(Decimal("0.0001"))
        )
        remaining_after = self.remaining(reservation)
        if remaining_after == 0:
            reservation.status = ReservationStatus.FULFILLED.value
        else:
            reservation.status = ReservationStatus.PARTIALLY_ISSUED.value

    def release(self, reservation: InvReservation) -> Decimal:
        self.validate_active(reservation)
        remaining = self.remaining(reservation)
        reservation.status = ReservationStatus.RELEASED.value
        return remaining


class ValuationEngine:
    def consume_fifo(
        self, layers: list[InvValuationLayer], qty: Decimal
    ) -> FifoConsumeResult:
        if qty <= 0:
            raise ValuationError("FIFO consume quantity must be positive")
        remaining = qty
        total_cost = Decimal("0")
        touched = 0
        for layer in layers:
            if remaining <= 0:
                break
            if layer.status != ValuationLayerStatus.OPEN.value:
                continue
            layer_qty = Decimal(str(layer.remaining_qty))
            if layer_qty <= 0:
                continue
            take = min(layer_qty, remaining)
            unit = Decimal(str(layer.unit_cost))
            total_cost += take * unit
            new_remaining = layer_qty - take
            layer.remaining_qty = float(new_remaining.quantize(Decimal("0.0001")))
            if new_remaining == 0:
                layer.status = ValuationLayerStatus.DEPLETED.value
            remaining -= take
            touched += 1
        if remaining > 0:
            raise ValuationError("Insufficient FIFO layers to cover issue quantity")
        avg = (total_cost / qty).quantize(Decimal("0.0001")) if qty else Decimal("0")
        return FifoConsumeResult(
            total_cost=total_cost.quantize(Decimal("0.0001")),
            average_unit_cost=avg,
            layers_touched=touched,
        )


class ReceiptEngine:
    def movement_type_for(self, source_document_type: str) -> str:
        if source_document_type in {
            "sales_return",
            "purchase_return_receive",
            "material_return",
        }:
            return MovementType.RETURN_IN.value
        if source_document_type == "transfer":
            return MovementType.TRANSFER_IN.value
        if source_document_type == "cycle_count":
            return MovementType.COUNT_GAIN.value
        return MovementType.RECEIPT.value


class IssueEngine:
    def movement_type_for(self, source_document_type: str) -> str:
        if source_document_type in {"purchase_return", "sales_return_issue"}:
            return MovementType.RETURN_OUT.value
        if source_document_type == "transfer":
            return MovementType.TRANSFER_OUT.value
        if source_document_type == "cycle_count":
            return MovementType.COUNT_LOSS.value
        return MovementType.ISSUE.value


class TransferEngine:
    def validate_submittable(self, header: InvTransferHeader) -> None:
        if header.status != TransferStatus.DRAFT.value:
            raise InvalidDocumentState("Only draft transfers can be submitted")
        active = [ln for ln in header.lines if not ln.is_deleted]
        if not active:
            raise InvalidDocumentState("Transfer has no lines")

    def validate_approvable(self, header: InvTransferHeader) -> None:
        if header.status != TransferStatus.SUBMITTED.value:
            raise InvalidDocumentState("Only submitted transfers can be approved")

    def validate_shippable(self, header: InvTransferHeader) -> None:
        if header.status != TransferStatus.APPROVED.value:
            raise InvalidDocumentState("Only approved transfers can be shipped")

    def validate_receivable(self, header: InvTransferHeader) -> None:
        if header.status != TransferStatus.IN_TRANSIT.value:
            raise InvalidDocumentState("Only in-transit transfers can be received")


class AdjustmentEngine:
    def validate_submittable(self, header: InvAdjustmentHeader) -> None:
        if header.status != AdjustmentStatus.DRAFT.value:
            raise InvalidDocumentState("Only draft adjustments can be submitted")
        if not [ln for ln in header.lines if not ln.is_deleted]:
            raise InvalidDocumentState("Adjustment has no lines")

    def validate_approvable(self, header: InvAdjustmentHeader) -> None:
        if header.status != AdjustmentStatus.SUBMITTED.value:
            raise InvalidDocumentState("Only submitted adjustments can be approved")

    def validate_postable(self, header: InvAdjustmentHeader) -> None:
        if header.status != AdjustmentStatus.APPROVED.value:
            raise InvalidDocumentState("Only approved adjustments can be posted")
        if header.period_id is None:
            raise InvalidDocumentState("Period is required to post adjustment")


class CycleCountEngine:
    def compute_variance(self, line: InvCycleCountLine) -> None:
        system = Decimal(str(line.system_qty))
        counted = Decimal(str(line.counted_qty))
        variance = counted - system
        line.variance_qty = float(variance.quantize(Decimal("0.0001")))
        if variance == 0:
            line.variance_type = VarianceType.MATCH.value
        elif variance < 0:
            line.variance_type = VarianceType.SHORTAGE.value
        else:
            line.variance_type = VarianceType.EXCESS.value

    def validate_submittable(self, header: InvCycleCountHeader) -> None:
        if header.status not in {
            CycleCountStatus.DRAFT.value,
            CycleCountStatus.IN_PROGRESS.value,
        }:
            raise InvalidDocumentState("Cycle count cannot be submitted in current state")
        if not [ln for ln in header.lines if not ln.is_deleted]:
            raise InvalidDocumentState("Cycle count has no lines")

    def validate_approvable(self, header: InvCycleCountHeader) -> None:
        if header.status != CycleCountStatus.SUBMITTED.value:
            raise InvalidDocumentState("Only submitted cycle counts can be approved")

    def validate_postable(self, header: InvCycleCountHeader) -> None:
        if header.status != CycleCountStatus.APPROVED.value:
            raise InvalidDocumentState("Only approved cycle counts can be posted")

    def has_variances(self, header: InvCycleCountHeader) -> bool:
        return any(
            ln.variance_type != VarianceType.MATCH.value
            for ln in header.lines
            if not ln.is_deleted
        )
