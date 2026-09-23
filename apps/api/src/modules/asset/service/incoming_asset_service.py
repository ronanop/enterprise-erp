"""Incoming Assets service — IT receiving against Procurement GRN lines (Sub-phase 1).

Does not create ast_asset records. Does not write to Procurement/Inventory.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.asset.adapters.procurement_read_port import (
    IncomingGrnLineCandidate,
    ProcurementReadPort,
)
from modules.asset.domain.enums import IncomingAssetArrivalStatus
from modules.asset.models.incoming_asset import AstIncomingAssetLine
from modules.asset.repository.base import utcnow
from modules.asset.repository.incoming_asset_repository import (
    IncomingAssetListFilters,
    IncomingAssetRepository,
    compute_arrival_status,
)
from modules.asset.schemas import IncomingAssetLineResponse, IncomingAssetUnitResponse
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

ENTITY = "ast_incoming_asset_line"


def to_incoming_line_response(row: AstIncomingAssetLine) -> IncomingAssetLineResponse:
    expected = Decimal(str(row.expected_quantity))
    arrived = Decimal(str(row.arrived_quantity))
    accepted = Decimal(str(getattr(row, "accepted_quantity", 0) or 0))
    rejected = Decimal(str(getattr(row, "rejected_quantity", 0) or 0))
    units = [
        IncomingAssetUnitResponse(
            id=u.id,
            unit_index=u.unit_index,
            serial_number=u.serial_number,
            status=u.status,
            arrived_at=u.arrived_at,
            arrived_by=u.arrived_by,
            qc_status=getattr(u, "qc_status", None),
            tested_at=getattr(u, "tested_at", None),
            tested_by=getattr(u, "tested_by", None),
            qc_notes=getattr(u, "qc_notes", None),
            rejection_reason=getattr(u, "rejection_reason", None),
            evidence_uri=getattr(u, "evidence_uri", None),
            quality_inspection_id=getattr(u, "quality_inspection_id", None),
            registered_asset_id=getattr(u, "registered_asset_id", None),
            registered_at=getattr(u, "registered_at", None),
            registered_by=getattr(u, "registered_by", None),
        )
        for u in (row.units or [])
        if not getattr(u, "is_deleted", False)
    ]
    units.sort(key=lambda u: u.unit_index)
    return IncomingAssetLineResponse(
        id=row.id,
        company_id=row.company_id,
        branch_id=row.branch_id,
        grn_id=row.grn_id,
        grn_line_id=row.grn_line_id,
        purchase_order_id=row.purchase_order_id,
        product_id=row.product_id,
        vendor_id=row.vendor_id,
        grn_document_number=row.grn_document_number,
        po_document_number=row.po_document_number,
        product_code=row.product_code,
        product_name=row.product_name,
        document_date=row.document_date,
        expected_quantity=expected,
        arrived_quantity=arrived,
        pending_quantity=max(expected - arrived, Decimal("0")),
        accepted_quantity=accepted,
        rejected_quantity=rejected,
        pending_qc_quantity=max(arrived - accepted - rejected, Decimal("0")),
        status=row.status,
        qc_status=getattr(row, "qc_status", "PENDING") or "PENDING",
        qc_started_at=getattr(row, "qc_started_at", None),
        qc_started_by=getattr(row, "qc_started_by", None),
        qc_notes=getattr(row, "qc_notes", None),
        quality_inspection_id=getattr(row, "quality_inspection_id", None),
        version=int(row.version or 1),
        units=units,
    )


class IncomingAssetService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = IncomingAssetRepository(db)
        self._scope = AssetScopeValidator(db)
        self._procurement = ProcurementReadPort(db)
        self._audit = AuditService(db)

    def _sync_from_procurement(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        branch_id: UUID | None = None,
    ) -> None:
        candidates = self._procurement.list_incoming_grn_line_candidates(
            ctx, company_id, branch_id=branch_id
        )
        for cand in candidates:
            self._upsert_from_candidate(ctx, cand)

    def _upsert_from_candidate(
        self, ctx: TenantContext, cand: IncomingGrnLineCandidate
    ) -> AstIncomingAssetLine:
        expected = Decimal(str(cand.expected_quantity))
        existing = self._repo.find_by_grn_line(ctx, cand.company_id, cand.grn_line_id)
        now = utcnow()
        if existing is None:
            row = self._repo.create_line(
                ctx,
                company_id=cand.company_id,
                branch_id=cand.branch_id,
                grn_id=cand.grn_id,
                grn_line_id=cand.grn_line_id,
                purchase_order_id=cand.purchase_order_id,
                product_id=cand.product_id,
                vendor_id=cand.vendor_id,
                grn_document_number=cand.grn_document_number,
                po_document_number=cand.po_document_number,
                product_code=cand.product_code,
                product_name=cand.product_name,
                document_date=cand.document_date,
                expected_quantity=expected,
                arrived_quantity=Decimal("0"),
                status=IncomingAssetArrivalStatus.EXPECTED.value,
                last_synced_at=now,
            )
            self._repo.ensure_units(ctx, row)
            return row

        # Refresh denormalized GRN metadata; never reduce arrived qty via sync.
        existing.grn_document_number = cand.grn_document_number
        existing.po_document_number = cand.po_document_number
        existing.product_code = cand.product_code
        existing.product_name = cand.product_name
        existing.document_date = cand.document_date
        existing.vendor_id = cand.vendor_id
        existing.purchase_order_id = cand.purchase_order_id
        # If GRN qty increased, raise expected; if decreased, clamp to max(arrived, new)
        new_expected = max(expected, Decimal(str(existing.arrived_quantity)))
        existing.expected_quantity = new_expected
        existing.status = compute_arrival_status(
            Decimal(str(existing.expected_quantity)),
            Decimal(str(existing.arrived_quantity)),
        )
        existing.last_synced_at = now
        existing.updated_at = now
        existing.updated_by = ctx.user_id
        self._db.flush()
        self._repo.ensure_units(ctx, existing)
        return existing

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        status: str | None = None,
        grn_id: UUID | None = None,
        purchase_order_id: UUID | None = None,
        search: str | None = None,
        document_date_from: date | None = None,
        document_date_to: date | None = None,
        offset: int = 0,
        limit: int = 25,
        sync: bool = True,
    ) -> tuple[list[AstIncomingAssetLine], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)
        if sync:
            self._sync_from_procurement(ctx, cid, branch_id=branch_id)
        filters = IncomingAssetListFilters(
            company_id=cid,
            branch_id=branch_id,
            status=status,
            grn_id=grn_id,
            purchase_order_id=purchase_order_id,
            search=search,
            document_date_from=document_date_from,
            document_date_to=document_date_to,
        )
        return self._repo.search(ctx, filters, offset=offset, limit=limit)

    def summary(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        sync: bool = True,
    ) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)
        if sync:
            self._sync_from_procurement(ctx, cid, branch_id=branch_id)
        return self._repo.summary_counts(ctx, cid, branch_id=branch_id)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstIncomingAssetLine:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Incoming asset line not found")
        return row

    def arrive(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        quantity: float | None = None,
        mark_all: bool = False,
        unit_indexes: list[int] | None = None,
        serials: dict[int, str] | None = None,
        notes: str | None = None,
    ) -> AstIncomingAssetLine:
        row = self._repo.get_for_update(ctx, row_id)
        if row is None:
            raise NotFoundException("Incoming asset line not found")
        self._scope.validate_branch_access(ctx, row.branch_id)

        expected = Decimal(str(row.expected_quantity))
        arrived = Decimal(str(row.arrived_quantity))
        pending = expected - arrived
        if pending <= 0:
            raise ConflictException("Incoming line is already fully arrived")

        if mark_all:
            qty = pending
        elif quantity is not None:
            qty = Decimal(str(quantity))
        elif unit_indexes:
            qty = Decimal(len(unit_indexes))
        else:
            raise ConflictException("Provide quantity, mark_all, or unit_indexes")

        try:
            updated = self._repo.apply_arrival(
                ctx,
                row,
                quantity=qty,
                unit_indexes=unit_indexes,
                serial_by_index=serials,
                notes=notes,
            )
        except ValueError as exc:
            raise ConflictException(str(exc)) from exc

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY,
            entity_id=updated.id,
            operation="arrive",
            performed_by=ctx.user_id,
            new_value={
                "quantity": float(qty),
                "mark_all": mark_all,
                "grn_id": str(updated.grn_id),
                "grn_line_id": str(updated.grn_line_id),
                "arrived_quantity": float(updated.arrived_quantity),
                "pending_quantity": float(
                    Decimal(str(updated.expected_quantity))
                    - Decimal(str(updated.arrived_quantity))
                ),
                "status": updated.status,
            },
        )
        # Reload with units / events for response
        refreshed = self._repo.get(ctx, updated.id)
        return refreshed or updated
