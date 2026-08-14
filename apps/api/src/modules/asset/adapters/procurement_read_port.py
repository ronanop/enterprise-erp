"""Read-only procurement validation for asset registration (ADR-REG-03)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select

from core.exceptions import NotFoundException
from modules.asset.domain.exceptions import RegistrationValidationError
from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.domain.enums import GrnStatus, OrderStatus
from modules.procurement.models.grn import ProcGrnHeader
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


@dataclass(frozen=True)
class IncomingGrnLineCandidate:
    """Quantity-level GRN line eligible for Asset Incoming receiving."""

    grn_id: UUID
    grn_line_id: UUID
    grn_document_number: str
    document_date: date | None
    company_id: UUID
    branch_id: UUID
    vendor_id: UUID
    purchase_order_id: UUID | None
    po_document_number: str | None
    product_id: UUID
    product_code: str | None
    product_name: str | None
    expected_quantity: float


class ProcurementReadPort:
    """Validates PO/GRN references; optional GRN prefill / incoming candidates (no writes)."""

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
        self._db = db
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
                    "unit_price": float(line.unit_price)
                    if getattr(line, "unit_price", None) is not None
                    else None,
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

    def list_incoming_grn_line_candidates(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        branch_id: UUID | None = None,
    ) -> list[IncomingGrnLineCandidate]:
        """Read-only: eligible GRN lines for IT Incoming Assets queue."""
        stmt = (
            select(ProcGrnHeader)
            .options(selectinload(ProcGrnHeader.lines))
            .where(
                ProcGrnHeader.company_id == company_id,
                ProcGrnHeader.is_deleted.is_(False),
                ProcGrnHeader.status.in_(tuple(self.ELIGIBLE_GRN_STATUSES)),
            )
        )
        stmt = self._grns.apply_proc_filter(stmt, ProcGrnHeader, ctx, branch_scoped=True)
        if branch_id is not None:
            stmt = stmt.where(ProcGrnHeader.branch_id == branch_id)
        grns = list(self._db.scalars(stmt.order_by(ProcGrnHeader.document_date.desc())).all())

        order_cache: dict[UUID, object] = {}
        out: list[IncomingGrnLineCandidate] = []
        for grn in grns:
            po_number: str | None = None
            order = None
            if grn.order_header_id:
                if grn.order_header_id not in order_cache:
                    order_cache[grn.order_header_id] = self._orders.get_order(
                        ctx, grn.order_header_id
                    )
                order = order_cache[grn.order_header_id]
                if order is not None:
                    po_number = getattr(order, "document_number", None)

            order_lines_by_id = {}
            if order is not None:
                for ol in getattr(order, "lines", None) or []:
                    order_lines_by_id[ol.id] = ol

            for line in grn.lines or []:
                if getattr(line, "is_deleted", False):
                    continue
                qty = float(line.quantity or 0) - float(line.quantity_rejected or 0)
                if qty <= 0:
                    continue
                ol = order_lines_by_id.get(line.order_line_id)
                out.append(
                    IncomingGrnLineCandidate(
                        grn_id=grn.id,
                        grn_line_id=line.id,
                        grn_document_number=grn.document_number,
                        document_date=grn.document_date,
                        company_id=grn.company_id,
                        branch_id=grn.branch_id,
                        vendor_id=grn.vendor_id,
                        purchase_order_id=grn.order_header_id,
                        po_document_number=po_number,
                        product_id=line.product_id,
                        product_code=getattr(ol, "product_code", None) if ol else None,
                        product_name=getattr(ol, "product_name", None) if ol else None,
                        expected_quantity=qty,
                    )
                )
        return out
