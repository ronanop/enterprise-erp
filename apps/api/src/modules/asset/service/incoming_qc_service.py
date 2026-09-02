"""Incoming Assets QC orchestration (Sub-phase 2).

Accept/Reject dispositions for arrived quantities/units.
Does not create ast_asset and does not call Inventory/Quality stock ports.
"""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.asset.domain.enums import IncomingAssetQcStatus
from modules.asset.models.incoming_asset import AstIncomingAssetLine
from modules.asset.repository.incoming_asset_repository import (
    IncomingAssetQcListFilters,
    IncomingAssetRepository,
)
from modules.asset.schemas import (
    IncomingAssetQcEventResponse,
    IncomingAssetQcLineResponse,
    IncomingAssetUnitResponse,
)
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

ENTITY = "ast_incoming_asset_line"


def _pending_qc(row: AstIncomingAssetLine) -> Decimal:
    arrived = Decimal(str(row.arrived_quantity or 0))
    accepted = Decimal(str(row.accepted_quantity or 0))
    rejected = Decimal(str(row.rejected_quantity or 0))
    return max(arrived - accepted - rejected, Decimal("0"))


def to_qc_line_response(row: AstIncomingAssetLine) -> IncomingAssetQcLineResponse:
    expected = Decimal(str(row.expected_quantity))
    arrived = Decimal(str(row.arrived_quantity or 0))
    accepted = Decimal(str(row.accepted_quantity or 0))
    rejected = Decimal(str(row.rejected_quantity or 0))
    pending = max(arrived - accepted - rejected, Decimal("0"))
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
    events = [
        IncomingAssetQcEventResponse.model_validate(e)
        for e in (row.qc_events or [])
        if not getattr(e, "is_deleted", False)
    ]
    events.sort(key=lambda e: e.created_at or e.id, reverse=True)
    return IncomingAssetQcLineResponse(
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
        accepted_quantity=accepted,
        rejected_quantity=rejected,
        pending_qc_quantity=pending,
        pending_quantity=max(expected - arrived, Decimal("0")),
        status=row.status,
        qc_status=row.qc_status,
        qc_started_at=row.qc_started_at,
        qc_started_by=row.qc_started_by,
        qc_notes=row.qc_notes,
        quality_inspection_id=row.quality_inspection_id,
        version=int(row.version or 1),
        units=units,
        qc_events=events,
    )


class IncomingAssetQcService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = IncomingAssetRepository(db)
        self._scope = AssetScopeValidator(db)
        self._audit = AuditService(db)

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        qc_status: str | None = None,
        grn_id: UUID | None = None,
        purchase_order_id: UUID | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstIncomingAssetLine], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)
        filters = IncomingAssetQcListFilters(
            company_id=cid,
            branch_id=branch_id,
            qc_status=qc_status,
            grn_id=grn_id,
            purchase_order_id=purchase_order_id,
            search=search,
            require_arrived=True,
        )
        return self._repo.search_qc(ctx, filters, offset=offset, limit=limit)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstIncomingAssetLine:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Incoming asset line not found")
        if Decimal(str(row.arrived_quantity or 0)) <= 0:
            raise ConflictException("Incoming line has no arrived quantity for QC")
        return row

    def start(self, ctx: TenantContext, row_id: UUID) -> AstIncomingAssetLine:
        row = self._repo.get_for_update(ctx, row_id)
        if row is None:
            raise NotFoundException("Incoming asset line not found")
        self._scope.validate_branch_access(ctx, row.branch_id)
        try:
            updated = self._repo.apply_qc_start(ctx, row)
        except ValueError as exc:
            raise ConflictException(str(exc)) from exc
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY,
            entity_id=updated.id,
            operation="qc_start",
            performed_by=ctx.user_id,
            new_value={"qc_status": updated.qc_status},
        )
        return self._repo.get(ctx, updated.id) or updated

    def accept(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        quantity: float | None = None,
        unit_ids: list[UUID] | None = None,
        notes: str | None = None,
        evidence_uri: str | None = None,
        quality_inspection_id: UUID | None = None,
        mark_all_pending: bool = False,
    ) -> AstIncomingAssetLine:
        return self._dispose(
            ctx,
            row_id,
            accept=True,
            quantity=quantity,
            unit_ids=unit_ids,
            notes=notes,
            evidence_uri=evidence_uri,
            quality_inspection_id=quality_inspection_id,
            mark_all_pending=mark_all_pending,
        )

    def reject(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        quantity: float | None = None,
        unit_ids: list[UUID] | None = None,
        notes: str | None = None,
        rejection_reason: str | None = None,
        evidence_uri: str | None = None,
        quality_inspection_id: UUID | None = None,
        mark_all_pending: bool = False,
    ) -> AstIncomingAssetLine:
        if not rejection_reason or not str(rejection_reason).strip():
            raise ConflictException("rejection_reason is required")
        return self._dispose(
            ctx,
            row_id,
            accept=False,
            quantity=quantity,
            unit_ids=unit_ids,
            notes=notes,
            rejection_reason=rejection_reason.strip(),
            evidence_uri=evidence_uri,
            quality_inspection_id=quality_inspection_id,
            mark_all_pending=mark_all_pending,
        )

    def _dispose(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        accept: bool,
        quantity: float | None,
        unit_ids: list[UUID] | None,
        notes: str | None,
        rejection_reason: str | None = None,
        evidence_uri: str | None = None,
        quality_inspection_id: UUID | None = None,
        mark_all_pending: bool = False,
    ) -> AstIncomingAssetLine:
        row = self._repo.get_for_update(ctx, row_id)
        if row is None:
            raise NotFoundException("Incoming asset line not found")
        self._scope.validate_branch_access(ctx, row.branch_id)

        pending = _pending_qc(row)
        if pending <= 0:
            raise ConflictException("No pending QC quantity remaining")

        qty = quantity
        if mark_all_pending and not unit_ids:
            qty = float(pending)

        try:
            updated = self._repo.apply_qc_disposition(
                ctx,
                row,
                accept=accept,
                quantity=None if unit_ids else (Decimal(str(qty)) if qty is not None else None),
                unit_ids=unit_ids,
                notes=notes,
                rejection_reason=rejection_reason,
                evidence_uri=evidence_uri,
                quality_inspection_id=quality_inspection_id,
            )
        except ValueError as exc:
            raise ConflictException(str(exc)) from exc

        # Explicit guarantee: never create ast_asset here
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY,
            entity_id=updated.id,
            operation="qc_accept" if accept else "qc_reject",
            performed_by=ctx.user_id,
            new_value={
                "accepted_quantity": float(updated.accepted_quantity),
                "rejected_quantity": float(updated.rejected_quantity),
                "pending_qc_quantity": float(_pending_qc(updated)),
                "qc_status": updated.qc_status,
                "ast_asset_created": False,
            },
        )
        return self._repo.get(ctx, updated.id) or updated
