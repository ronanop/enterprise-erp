"""Inventory stock ledger repository - insert only."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.inventory.models.ledger import InvStockLedger
from modules.inventory.repository.base import InvScopedRepository, utcnow


class LedgerRepository(InvScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def find_by_source(
        self,
        ctx: TenantContext,
        *,
        source_module: str,
        source_document_type: str,
        source_document_id: UUID,
        source_line_id: UUID | None = None,
        movement_type: str | None = None,
    ) -> list[InvStockLedger]:
        stmt = select(InvStockLedger).where(
            InvStockLedger.source_module == source_module,
            InvStockLedger.source_document_type == source_document_type,
            InvStockLedger.source_document_id == source_document_id,
        )
        if source_line_id is not None:
            stmt = stmt.where(InvStockLedger.source_line_id == source_line_id)
        if movement_type is not None:
            stmt = stmt.where(InvStockLedger.movement_type == movement_type)
        stmt = self.apply_tenant_filter(stmt, InvStockLedger, ctx)
        return list(self.db.scalars(stmt).all())

    def list_ledger(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        warehouse_id: UUID | None = None,
        product_id: UUID | None = None,
        limit: int = 200,
    ) -> list[InvStockLedger]:
        stmt = (
            select(InvStockLedger)
            .where(InvStockLedger.company_id == company_id)
            .order_by(InvStockLedger.posted_at.desc())
            .limit(limit)
        )
        if warehouse_id:
            stmt = stmt.where(InvStockLedger.warehouse_id == warehouse_id)
        if product_id:
            stmt = stmt.where(InvStockLedger.product_id == product_id)
        stmt = self.apply_inv_filter(stmt, InvStockLedger, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def get(self, ctx: TenantContext, entry_id: UUID) -> InvStockLedger | None:
        stmt = select(InvStockLedger).where(InvStockLedger.id == entry_id)
        stmt = self.apply_inv_filter(stmt, InvStockLedger, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def insert(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        entry_number: str,
        product_id: UUID,
        warehouse_id: UUID,
        uom_id: UUID,
        movement_type: str,
        quantity_in: float,
        quantity_out: float,
        source_module: str,
        source_document_type: str,
        source_document_id: UUID,
        source_line_id: UUID | None = None,
        bin_id: UUID | None = None,
        batch_id: UUID | None = None,
        serial_id: UUID | None = None,
        unit_cost: float | None = None,
        total_cost: float | None = None,
        finance_journal_id: UUID | None = None,
        reversal_of_ledger_id: UUID | None = None,
    ) -> InvStockLedger:
        row = InvStockLedger(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            entry_number=entry_number,
            posted_at=utcnow(),
            posted_by=ctx.user_id,
            product_id=product_id,
            warehouse_id=warehouse_id,
            uom_id=uom_id,
            bin_id=bin_id,
            batch_id=batch_id,
            serial_id=serial_id,
            movement_type=movement_type,
            quantity_in=quantity_in,
            quantity_out=quantity_out,
            unit_cost=unit_cost,
            total_cost=total_cost,
            source_module=source_module,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            source_line_id=source_line_id,
            finance_journal_id=finance_journal_id,
            reversal_of_ledger_id=reversal_of_ledger_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self.db.add(row)
        self.db.flush()
        return row
