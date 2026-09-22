"""Inventory port - Manufacturing never writes inv_* tables."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.inventory.domain.enums import SourceModule
from modules.inventory.service.inventory_application_service import InventoryApplicationService


class ManufacturingInventoryAdapter:
    def __init__(self, db: Session) -> None:
        self._inv = InventoryApplicationService(db)

    def issue_for_material_issue(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        warehouse_id: UUID,
        product_id: UUID,
        uom_id: UUID,
        quantity: Decimal,
        source_document_id: UUID,
        source_line_id: UUID | None = None,
        bin_id: UUID | None = None,
        batch_id: UUID | None = None,
    ):
        return self._inv.issue_goods(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            warehouse_id=warehouse_id,
            product_id=product_id,
            uom_id=uom_id,
            quantity=quantity,
            source_module=SourceModule.MANUFACTURING.value,
            source_document_type="material_issue",
            source_document_id=source_document_id,
            source_line_id=source_line_id,
            bin_id=bin_id,
            batch_id=batch_id,
        )

    def receive_for_material_return(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        warehouse_id: UUID,
        product_id: UUID,
        uom_id: UUID,
        quantity: Decimal,
        source_document_id: UUID,
        source_line_id: UUID | None = None,
        unit_cost: Decimal | None = None,
        bin_id: UUID | None = None,
        batch_id: UUID | None = None,
    ):
        return self._inv.receive_goods(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            warehouse_id=warehouse_id,
            product_id=product_id,
            uom_id=uom_id,
            quantity=quantity,
            source_module=SourceModule.MANUFACTURING.value,
            source_document_type="material_return",
            source_document_id=source_document_id,
            source_line_id=source_line_id,
            unit_cost=unit_cost,
            bin_id=bin_id,
            batch_id=batch_id,
        )

    def receive_for_production_receipt(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        warehouse_id: UUID,
        product_id: UUID,
        uom_id: UUID,
        quantity: Decimal,
        source_document_id: UUID,
        source_line_id: UUID | None = None,
        unit_cost: Decimal | None = None,
        quality_status: str = "available",
    ):
        return self._inv.receive_goods(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            warehouse_id=warehouse_id,
            product_id=product_id,
            uom_id=uom_id,
            quantity=quantity,
            source_module=SourceModule.MANUFACTURING.value,
            source_document_type="production_receipt",
            source_document_id=source_document_id,
            source_line_id=source_line_id,
            unit_cost=unit_cost,
            quality_status=quality_status,
        )
