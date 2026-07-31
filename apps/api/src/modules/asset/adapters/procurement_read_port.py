"""Read-only procurement validation for asset registration (ADR-REG-03)."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.exceptions import RegistrationValidationError
from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.domain.enums import GrnStatus, OrderStatus
from modules.procurement.repository.grn_repository import GrnRepository
from modules.procurement.repository.order_repository import OrderRepository


@dataclass(frozen=True)
class GrnPrefillPayload:
    grn_id: UUID
    company_id: UUID
    branch_id: UUID
    vendor_id: UUID
    purchase_order_id: UUID
    currency_code: str
    lines: list[dict]


class ProcurementReadPort:
    """Validates PO/GRN references; optional GRN prefill (no writes)."""

    ELIGIBLE_ORDER_STATUSES = {
        OrderStatus.APPROVED.value,
        OrderStatus.SENT.value,
        OrderStatus.PARTIALLY_RECEIVED.value,
        OrderStatus.RECEIVED.value,
        OrderStatus.CLOSED.value,
    }
    ELIGIBLE_GRN_STATUSES = {
        GrnStatus.RECEIVED.value,
        GrnStatus.PARTIALLY_RECEIVED.value,
    }

    def __init__(self, db: Session) -> None:
        self._orders = OrderRepository(db)
        self._grns = GrnRepository(db)

    def validate_purchase_order(
        self, ctx: TenantContext, company_id: UUID, purchase_order_id: UUID
    ) -> None:
        order = self._orders.get_order(ctx, purchase_order_id)
        if order is None:
            raise RegistrationValidationError("Purchase order not found")
        if order.company_id != company_id:
            raise RegistrationValidationError("Purchase order does not belong to this company")
        if order.status not in self.ELIGIBLE_ORDER_STATUSES:
            raise RegistrationValidationError(
                f"Purchase order status '{order.status}' is not eligible for asset registration"
            )

    def validate_grn(self, ctx: TenantContext, company_id: UUID, grn_id: UUID) -> None:
        grn = self._grns.get_grn(ctx, grn_id)
        if grn is None:
            raise RegistrationValidationError("GRN not found")
        if grn.company_id != company_id:
            raise RegistrationValidationError("GRN does not belong to this company")
        if grn.status not in self.ELIGIBLE_GRN_STATUSES:
            raise RegistrationValidationError(
                f"GRN status '{grn.status}' is not eligible for asset registration"
            )

    def get_grn(self, ctx: TenantContext, grn_id: UUID):
        grn = self._grns.get_grn(ctx, grn_id)
        if grn is None:
            raise NotFoundException("GRN not found")
        return grn

    def prefill_from_grn(self, ctx: TenantContext, grn_id: UUID) -> GrnPrefillPayload:
        grn = self._grns.get_grn(ctx, grn_id)
        if grn is None:
            raise NotFoundException("GRN not found")
        self.validate_grn(ctx, grn.company_id, grn_id)
        lines = []
        for line in grn.lines or []:
            lines.append(
                {
                    "line_id": str(line.id),
                    "product_id": str(line.product_id) if line.product_id else None,
                    "quantity": float(line.quantity or 0),
                    "unit_price": float(line.unit_price) if getattr(line, "unit_price", None) is not None else None,
                }
            )
        return GrnPrefillPayload(
            grn_id=grn.id,
            company_id=grn.company_id,
            branch_id=grn.branch_id,
            vendor_id=grn.vendor_id,
            purchase_order_id=grn.order_header_id,
            currency_code="USD",
            lines=lines,
        )
