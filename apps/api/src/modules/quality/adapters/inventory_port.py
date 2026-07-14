"""Inventory port — Quality never writes inv_* tables."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.inventory.domain.enums import SourceModule
from modules.inventory.service.inventory_application_service import InventoryApplicationService


class QualityInventoryAdapter:
    def __init__(self, db: Session) -> None:
        self._inv = InventoryApplicationService(db)

    def quarantine_stock(
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
        return self._inv.receive_goods(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            warehouse_id=warehouse_id,
            product_id=product_id,
            uom_id=uom_id,
            quantity=quantity,
            source_module=SourceModule.QUALITY.value,
            source_document_type="quality_quarantine",
            source_document_id=source_document_id,
            source_line_id=source_line_id,
            bin_id=bin_id,
            batch_id=batch_id,
            quality_status="quarantine",
        )

    def release_stock(
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
        unit_cost: Decimal | None = None,
    ):
        return self._inv.receive_goods(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            warehouse_id=warehouse_id,
            product_id=product_id,
            uom_id=uom_id,
            quantity=quantity,
            source_module=SourceModule.QUALITY.value,
            source_document_type="quality_release",
            source_document_id=source_document_id,
            source_line_id=source_line_id,
            bin_id=bin_id,
            batch_id=batch_id,
            unit_cost=unit_cost,
            quality_status="available",
        )

    def reject_stock(
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
        issue_from_quarantine: bool = False,
    ):
        if issue_from_quarantine:
            return self._inv.issue_goods(
                ctx,
                company_id=company_id,
                branch_id=branch_id,
                warehouse_id=warehouse_id,
                product_id=product_id,
                uom_id=uom_id,
                quantity=quantity,
                source_module=SourceModule.QUALITY.value,
                source_document_type="quality_reject",
                source_document_id=source_document_id,
                source_line_id=source_line_id,
                bin_id=bin_id,
                batch_id=batch_id,
            )
        return self._inv.receive_goods(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            warehouse_id=warehouse_id,
            product_id=product_id,
            uom_id=uom_id,
            quantity=quantity,
            source_module=SourceModule.QUALITY.value,
            source_document_type="quality_reject",
            source_document_id=source_document_id,
            source_line_id=source_line_id,
            bin_id=bin_id,
            batch_id=batch_id,
            quality_status="rejected",
        )
