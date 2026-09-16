"""Inventory application service - sole façade for stock mutations."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.inventory.domain.entities import StockMovementResult
from modules.inventory.domain.enums import InvEntityType, ReservationStatus, SourceModule
from modules.inventory.domain.exceptions import InsufficientStock
from modules.inventory.domain.value_objects import StockKey
from modules.inventory.models.ledger import InvStockLedger
from modules.inventory.models.reservation import InvReservation
from modules.inventory.repository.balance_repository import BalanceRepository
from modules.inventory.repository.base import utcnow
from modules.inventory.repository.ledger_repository import LedgerRepository
from modules.inventory.repository.reservation_repository import ReservationRepository
from modules.inventory.repository.valuation_repository import ValuationRepository
from modules.inventory.service.document_number_service import DocumentNumberService
from modules.inventory.service.engines import (
    IssueEngine,
    ReceiptEngine,
    ReservationEngine,
    StockEngine,
    ValuationEngine,
)
from modules.inventory.service.inventory_scope_validator import InventoryScopeValidator


class InventoryApplicationService:
    """Only entry point for Procurement/Sales stock effects."""

    def __init__(self, db: Session) -> None:
        self._db = db
        self._balances = BalanceRepository(db)
        self._ledger = LedgerRepository(db)
        self._reservations = ReservationRepository(db)
        self._valuation = ValuationRepository(db)
        self._numbers = DocumentNumberService(db)
        self._scope = InventoryScopeValidator(db)
        self._stock = StockEngine()
        self._reservation_engine = ReservationEngine()
        self._receipt_engine = ReceiptEngine()
        self._issue_engine = IssueEngine()
        self._fifo = ValuationEngine()
        self._audit = AuditService(db)

    def _already_processed(
        self,
        ctx: TenantContext,
        *,
        source_module: str,
        source_document_type: str,
        source_document_id: UUID,
        source_line_id: UUID | None,
        movement_type: str,
    ) -> bool:
        rows = self._ledger.find_by_source(
            ctx,
            source_module=source_module,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            source_line_id=source_line_id,
            movement_type=movement_type,
        )
        return len(rows) > 0

    def receive_goods(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        warehouse_id: UUID,
        product_id: UUID,
        uom_id: UUID,
        quantity: Decimal,
        source_module: str,
        source_document_type: str,
        source_document_id: UUID,
        source_line_id: UUID | None = None,
        bin_id: UUID | None = None,
        batch_id: UUID | None = None,
        unit_cost: Decimal | None = None,
        currency_code: str = "USD",
        quality_status: str = "available",
    ) -> StockMovementResult:
        self._scope.validate_company_access(ctx, company_id)
        movement = self._receipt_engine.movement_type_for(source_document_type)
        if self._already_processed(
            ctx,
            source_module=source_module,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            source_line_id=source_line_id,
            movement_type=movement,
        ):
            bal = self._balances.get_for_update(
                ctx,
                company_id=company_id,
                warehouse_id=warehouse_id,
                product_id=product_id,
                bin_id=bin_id,
                batch_id=batch_id,
                quality_status=quality_status,
            )
            return StockMovementResult(
                balance_id=bal.id if bal else source_document_id,
                ledger_id=source_document_id,
                on_hand_qty=Decimal(str(bal.on_hand_qty)) if bal else Decimal("0"),
                reserved_qty=Decimal(str(bal.reserved_qty)) if bal else Decimal("0"),
                available_qty=Decimal(str(bal.available_qty)) if bal else Decimal("0"),
                already_processed=True,
            )

        balance = self._balances.get_or_create_for_update(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            warehouse_id=warehouse_id,
            product_id=product_id,
            uom_id=uom_id,
            bin_id=bin_id,
            batch_id=batch_id,
            quality_status=quality_status,
        )
        self._stock.apply_receipt(balance, quantity)
        self._balances.touch(balance, ctx)

        cost = unit_cost or Decimal("0")
        total = (cost * quantity).quantize(Decimal("0.0001"))
        entry_number = self._numbers.generate(
            InvEntityType.LEDGER,
            company_id,
            model=InvStockLedger,
            code_column="entry_number",
        )
        ledger = self._ledger.insert(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            entry_number=entry_number,
            product_id=product_id,
            warehouse_id=warehouse_id,
            uom_id=uom_id,
            movement_type=movement,
            quantity_in=float(quantity),
            quantity_out=0,
            source_module=source_module,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            source_line_id=source_line_id,
            bin_id=bin_id,
            batch_id=batch_id,
            unit_cost=float(cost),
            total_cost=float(total),
        )
        self._valuation.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            warehouse_id=warehouse_id,
            product_id=product_id,
            batch_id=batch_id,
            received_at=utcnow(),
            original_qty=float(quantity),
            remaining_qty=float(quantity),
            unit_cost=float(cost),
            currency_code=currency_code,
            source_module=source_module,
            source_document_id=source_document_id,
            status="open",
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="inv_stock_balance",
            entity_id=balance.id,
            operation="receive",
            performed_by=ctx.user_id,
            new_value={"qty": str(quantity), "source": source_document_type},
        )
        return StockMovementResult(
            balance_id=balance.id,
            ledger_id=ledger.id,
            on_hand_qty=Decimal(str(balance.on_hand_qty)),
            reserved_qty=Decimal(str(balance.reserved_qty)),
            available_qty=Decimal(str(balance.available_qty)),
            total_cost=total,
        )

    def issue_goods(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        warehouse_id: UUID,
        product_id: UUID,
        uom_id: UUID,
        quantity: Decimal,
        source_module: str,
        source_document_type: str,
        source_document_id: UUID,
        source_line_id: UUID | None = None,
        bin_id: UUID | None = None,
        batch_id: UUID | None = None,
        reservation_id: UUID | None = None,
        quality_status: str = "available",
    ) -> StockMovementResult:
        self._scope.validate_company_access(ctx, company_id)
        movement = self._issue_engine.movement_type_for(source_document_type)
        if self._already_processed(
            ctx,
            source_module=source_module,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            source_line_id=source_line_id,
            movement_type=movement,
        ):
            bal = self._balances.get_for_update(
                ctx,
                company_id=company_id,
                warehouse_id=warehouse_id,
                product_id=product_id,
                bin_id=bin_id,
                batch_id=batch_id,
                quality_status=quality_status,
            )
            return StockMovementResult(
                balance_id=bal.id if bal else source_document_id,
                ledger_id=source_document_id,
                on_hand_qty=Decimal(str(bal.on_hand_qty)) if bal else Decimal("0"),
                reserved_qty=Decimal(str(bal.reserved_qty)) if bal else Decimal("0"),
                available_qty=Decimal(str(bal.available_qty)) if bal else Decimal("0"),
                already_processed=True,
            )

        balance = self._balances.get_or_create_for_update(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            warehouse_id=warehouse_id,
            product_id=product_id,
            uom_id=uom_id,
            bin_id=bin_id,
            batch_id=batch_id,
            quality_status=quality_status,
        )
        against_res = reservation_id is not None
        if against_res:
            assert reservation_id is not None
            reservation = self._reservations.get_for_update(ctx, reservation_id)
            if reservation is None:
                raise InsufficientStock("Reservation not found")
            self._reservation_engine.apply_issue(reservation, quantity)
            self._reservations.touch(reservation, ctx)

        self._stock.apply_issue(balance, quantity, against_reservation=against_res)
        self._balances.touch(balance, ctx)

        layers = self._valuation.list_open_fifo(
            ctx, company_id=company_id, warehouse_id=warehouse_id, product_id=product_id
        )
        fifo = self._fifo.consume_fifo(layers, quantity)
        for layer in layers:
            self._valuation.touch(layer, ctx)

        entry_number = self._numbers.generate(
            InvEntityType.LEDGER,
            company_id,
            model=InvStockLedger,
            code_column="entry_number",
        )
        ledger = self._ledger.insert(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            entry_number=entry_number,
            product_id=product_id,
            warehouse_id=warehouse_id,
            uom_id=uom_id,
            movement_type=movement,
            quantity_in=0,
            quantity_out=float(quantity),
            source_module=source_module,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            source_line_id=source_line_id,
            bin_id=bin_id,
            batch_id=batch_id,
            unit_cost=float(fifo.average_unit_cost),
            total_cost=float(fifo.total_cost),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="inv_stock_balance",
            entity_id=balance.id,
            operation="issue",
            performed_by=ctx.user_id,
            new_value={"qty": str(quantity), "cogs": str(fifo.total_cost)},
        )
        return StockMovementResult(
            balance_id=balance.id,
            ledger_id=ledger.id,
            on_hand_qty=Decimal(str(balance.on_hand_qty)),
            reserved_qty=Decimal(str(balance.reserved_qty)),
            available_qty=Decimal(str(balance.available_qty)),
            total_cost=fifo.total_cost,
        )

    def reserve(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        warehouse_id: UUID,
        product_id: UUID,
        uom_id: UUID,
        quantity: Decimal,
        source_module: str = SourceModule.SALES.value,
        source_document_type: str = "sales_order",
        source_document_id: UUID,
        source_line_id: UUID | None = None,
        bin_id: UUID | None = None,
        batch_id: UUID | None = None,
    ) -> InvReservation:
        self._scope.validate_company_access(ctx, company_id)
        existing = self._reservations.list_by_source(
            ctx,
            source_module=source_module,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
        )
        if source_line_id:
            for row in existing:
                if row.source_line_id == source_line_id and row.status in {
                    ReservationStatus.ACTIVE.value,
                    ReservationStatus.PARTIALLY_ISSUED.value,
                }:
                    return row

        balance = self._balances.get_or_create_for_update(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            warehouse_id=warehouse_id,
            product_id=product_id,
            uom_id=uom_id,
            bin_id=bin_id,
            batch_id=batch_id,
        )
        self._stock.apply_reserve(balance, quantity)
        self._balances.touch(balance, ctx)
        reservation = self._reservations.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            warehouse_id=warehouse_id,
            product_id=product_id,
            uom_id=uom_id,
            bin_id=bin_id,
            batch_id=batch_id,
            quantity_reserved=float(quantity),
            quantity_issued=0,
            source_module=source_module,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            source_line_id=source_line_id,
            status=ReservationStatus.ACTIVE.value,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="inv_reservation",
            entity_id=reservation.id,
            operation="reserve",
            performed_by=ctx.user_id,
        )
        return reservation

    def release_reservation(self, ctx: TenantContext, reservation_id: UUID) -> InvReservation:
        reservation = self._reservations.get_for_update(ctx, reservation_id)
        if reservation is None:
            raise InsufficientStock("Reservation not found")
        remaining = self._reservation_engine.release(reservation)
        reservation.released_at = utcnow()
        balance = self._balances.get_or_create_for_update(
            ctx,
            company_id=reservation.company_id,
            branch_id=reservation.branch_id,
            warehouse_id=reservation.warehouse_id,
            product_id=reservation.product_id,
            uom_id=reservation.uom_id,
            bin_id=reservation.bin_id,
            batch_id=reservation.batch_id,
        )
        if remaining > 0:
            self._stock.apply_release(balance, remaining)
            self._balances.touch(balance, ctx)
        self._reservations.touch(reservation, ctx)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="inv_reservation",
            entity_id=reservation.id,
            operation="release",
            performed_by=ctx.user_id,
        )
        return reservation

    def adjust(
        self,
        ctx: TenantContext,
        *,
        key: StockKey,
        signed_qty: Decimal,
        source_document_type: str,
        source_document_id: UUID,
        source_line_id: UUID | None = None,
        unit_cost: Decimal | None = None,
    ) -> StockMovementResult:
        balance = self._balances.get_or_create_for_update(
            ctx,
            company_id=key.company_id,
            branch_id=key.branch_id,
            warehouse_id=key.warehouse_id,
            product_id=key.product_id,
            uom_id=key.uom_id,
            bin_id=key.bin_id,
            batch_id=key.batch_id,
            quality_status=key.quality_status,
        )
        movement = self._stock.apply_adjustment(balance, signed_qty)
        self._balances.touch(balance, ctx)
        qty = abs(signed_qty)
        qty_in = float(qty) if signed_qty > 0 else 0.0
        qty_out = float(qty) if signed_qty < 0 else 0.0
        cost = unit_cost or Decimal("0")
        total = (cost * qty).quantize(Decimal("0.0001"))
        if signed_qty > 0:
            self._valuation.create(
                ctx,
                company_id=key.company_id,
                branch_id=key.branch_id,
                warehouse_id=key.warehouse_id,
                product_id=key.product_id,
                batch_id=key.batch_id,
                received_at=utcnow(),
                original_qty=float(qty),
                remaining_qty=float(qty),
                unit_cost=float(cost),
                currency_code="USD",
                source_module=SourceModule.INVENTORY.value,
                source_document_id=source_document_id,
                status="open",
            )
        else:
            layers = self._valuation.list_open_fifo(
                ctx,
                company_id=key.company_id,
                warehouse_id=key.warehouse_id,
                product_id=key.product_id,
            )
            fifo = self._fifo.consume_fifo(layers, qty)
            total = fifo.total_cost
            cost = fifo.average_unit_cost
            for layer in layers:
                self._valuation.touch(layer, ctx)

        entry_number = self._numbers.generate(
            InvEntityType.LEDGER,
            key.company_id,
            model=InvStockLedger,
            code_column="entry_number",
        )
        ledger = self._ledger.insert(
            ctx,
            company_id=key.company_id,
            branch_id=key.branch_id,
            entry_number=entry_number,
            product_id=key.product_id,
            warehouse_id=key.warehouse_id,
            uom_id=key.uom_id,
            movement_type=movement,
            quantity_in=qty_in,
            quantity_out=qty_out,
            source_module=SourceModule.INVENTORY.value,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            source_line_id=source_line_id,
            bin_id=key.bin_id,
            batch_id=key.batch_id,
            unit_cost=float(cost),
            total_cost=float(total),
        )
        return StockMovementResult(
            balance_id=balance.id,
            ledger_id=ledger.id,
            on_hand_qty=Decimal(str(balance.on_hand_qty)),
            reserved_qty=Decimal(str(balance.reserved_qty)),
            available_qty=Decimal(str(balance.available_qty)),
            total_cost=total,
        )
