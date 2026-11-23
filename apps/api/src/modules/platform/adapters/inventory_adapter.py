"""IInventoryStock stub — standalone HRMS has no inventory module."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.platform.dto import StockKey, StockMovementResultDTO


def _empty_result(quantity: Decimal) -> StockMovementResultDTO:
    return StockMovementResultDTO(
        balance_id=uuid4(),
        ledger_id=None,
        on_hand_qty=quantity,
        reserved_qty=Decimal("0"),
        available_qty=quantity,
        reservation_id=None,
        total_cost=None,
    )


class InventoryStockAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def reserve(
        self,
        ctx: TenantContext,
        key: StockKey,
        quantity: Decimal,
        *,
        source_module: str,
        source_document_type: str,
        source_document_id: UUID,
        source_line_id: UUID | None = None,
    ) -> StockMovementResultDTO:
        _ = (ctx, key, source_module, source_document_type, source_document_id, source_line_id, self._db)
        return _empty_result(quantity)

    def release(
        self,
        ctx: TenantContext,
        key: StockKey,
        quantity: Decimal,
        *,
        source_module: str,
        source_document_type: str,
        source_document_id: UUID,
        source_line_id: UUID | None = None,
    ) -> StockMovementResultDTO:
        _ = (ctx, key, source_module, source_document_type, source_document_id, source_line_id, self._db)
        return _empty_result(quantity)

    def issue(
        self,
        ctx: TenantContext,
        key: StockKey,
        quantity: Decimal,
        *,
        source_module: str,
        source_document_type: str,
        source_document_id: UUID,
        source_line_id: UUID | None = None,
    ) -> StockMovementResultDTO:
        _ = (ctx, key, source_module, source_document_type, source_document_id, source_line_id, self._db)
        return _empty_result(quantity)

    def receive(
        self,
        ctx: TenantContext,
        key: StockKey,
        quantity: Decimal,
        *,
        source_module: str,
        source_document_type: str,
        source_document_id: UUID,
        source_line_id: UUID | None = None,
    ) -> StockMovementResultDTO:
        _ = (ctx, key, source_module, source_document_type, source_document_id, source_line_id, self._db)
        return _empty_result(quantity)
