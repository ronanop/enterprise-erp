"""Procurement inventory adapters - real stock updates."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.inventory.service.inventory_application_service import InventoryApplicationService
from modules.procurement.domain.entities import GrnReceiptResult
from modules.procurement.repository.grn_repository import GrnRepository
from modules.procurement.repository.order_repository import OrderRepository
from modules.procurement.repository.return_repository import ReturnRepository
from modules.procurement.service.inventory.port import InventoryReceiptPort


class ProcurementInventoryAdapter:
    """Implements InventoryReceiptPort with real InventoryApplicationService."""

    def __init__(self, db: Session) -> None:
        self._db = db
        self._app = InventoryApplicationService(db)
        self._grns = GrnRepository(db)
        self._orders = OrderRepository(db)

    def receive_goods(
        self,
        ctx: TenantContext,
        *,
        grn_id: UUID,
        order_id: UUID,
        warehouse_reference: UUID,
    ) -> GrnReceiptResult:
        grn = self._grns.get_grn(ctx, grn_id)
        if grn is None:
            return GrnReceiptResult(
                grn_id=grn_id,
                order_id=order_id,
                inventory_event_emitted=False,
                stock_updated=False,
            )
        order = self._orders.get_order(ctx, order_id)
        unit_cost_by_line: dict[UUID, Decimal] = {}
        if order is not None:
            for ol in order.lines:
                unit_cost_by_line[ol.id] = Decimal(str(getattr(ol, "unit_cost", 0) or 0))

        updated = False
        for line in [ln for ln in grn.lines if not ln.is_deleted]:
            qty = Decimal(str(line.quantity)) - Decimal(str(line.quantity_rejected or 0))
            if qty <= 0:
                continue
            self._app.receive_goods(
                ctx,
                company_id=grn.company_id,
                branch_id=grn.branch_id,
                warehouse_id=warehouse_reference,
                product_id=line.product_id,
                uom_id=line.uom_id,
                quantity=qty,
                source_module="procurement",
                source_document_type="grn",
                source_document_id=grn.id,
                source_line_id=line.id,
                unit_cost=unit_cost_by_line.get(line.order_line_id, Decimal("0")),
            )
            updated = True
        return GrnReceiptResult(
            grn_id=grn_id,
            order_id=order_id,
            inventory_event_emitted=updated,
            stock_updated=updated,
        )


class ProcurementIssueAdapter:
    """Issue stock for purchase returns."""

    def __init__(self, db: Session) -> None:
        self._db = db
        self._app = InventoryApplicationService(db)
        self._returns = ReturnRepository(db)

    def issue_purchase_return(
        self,
        ctx: TenantContext,
        *,
        return_id: UUID,
        warehouse_id: UUID,
    ) -> bool:
        header = self._returns.get_return(ctx, return_id)
        if header is None:
            return False
        for line in [ln for ln in header.lines if not ln.is_deleted]:
            self._app.issue_goods(
                ctx,
                company_id=header.company_id,
                branch_id=header.branch_id,
                warehouse_id=warehouse_id,
                product_id=line.product_id,
                uom_id=line.uom_id,
                quantity=Decimal(str(line.quantity)),
                source_module="procurement",
                source_document_type="purchase_return",
                source_document_id=header.id,
                source_line_id=line.id,
            )
        return True


def inventory_adapter(db: Session) -> InventoryReceiptPort:
    return ProcurementInventoryAdapter(db)
