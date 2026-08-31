"""Repository for Asset Incoming arrival tracking."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from modules.asset.domain.enums import (
    IncomingAssetArrivalStatus,
    IncomingAssetQcStatus,
    IncomingAssetUnitQcStatus,
    IncomingAssetUnitStatus,
    IncomingRegistrationStatus,
)
from modules.asset.models.incoming_asset import (
    AstIncomingArrivalEvent,
    AstIncomingAssetLine,
    AstIncomingAssetUnit,
    AstIncomingQcEvent,
)
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


@dataclass(frozen=True)
class IncomingAssetListFilters:
    company_id: UUID
    branch_id: UUID | None = None
    status: str | None = None
    grn_id: UUID | None = None
    purchase_order_id: UUID | None = None
    search: str | None = None
    document_date_from: date | None = None
    document_date_to: date | None = None


@dataclass(frozen=True)
class IncomingRegistrationQueueFilters:
    company_id: UUID
    branch_id: UUID | None = None
    grn_id: UUID | None = None
    purchase_order_id: UUID | None = None
    search: str | None = None
    registration_status: str | None = None
    pending_only: bool = False
    registered_only: bool = False


def compute_arrival_status(expected: Decimal, arrived: Decimal) -> str:
    if arrived <= 0:
        return IncomingAssetArrivalStatus.EXPECTED.value
    if arrived >= expected:
        return IncomingAssetArrivalStatus.ARRIVED.value
    return IncomingAssetArrivalStatus.PARTIALLY_ARRIVED.value


def compute_line_qc_status(
    arrived: Decimal, accepted: Decimal, rejected: Decimal, *, started: bool
) -> str:
    disposed = accepted + rejected
    if arrived <= 0:
        return IncomingAssetQcStatus.PENDING.value
    if disposed <= 0:
        return (
            IncomingAssetQcStatus.IN_PROGRESS.value
            if started
            else IncomingAssetQcStatus.PENDING.value
        )
    if disposed < arrived:
        return IncomingAssetQcStatus.IN_PROGRESS.value
    if accepted <= 0 and rejected > 0:
        return IncomingAssetQcStatus.REJECTED.value
    return IncomingAssetQcStatus.ACCEPTED.value


@dataclass(frozen=True)
class IncomingAssetQcListFilters:
    company_id: UUID
    branch_id: UUID | None = None
    qc_status: str | None = None
    grn_id: UUID | None = None
    purchase_order_id: UUID | None = None
    search: str | None = None
    require_arrived: bool = True


class IncomingAssetRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstIncomingAssetLine | None:
        stmt = (
            select(AstIncomingAssetLine)
            .options(
                selectinload(AstIncomingAssetLine.units),
                selectinload(AstIncomingAssetLine.arrival_events),
                selectinload(AstIncomingAssetLine.qc_events),
            )
            .where(
                AstIncomingAssetLine.id == row_id,
                AstIncomingAssetLine.is_deleted.is_(False),
            )
        )
        stmt = self.apply_ast_filter(stmt, AstIncomingAssetLine, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def get_for_update(self, ctx: TenantContext, row_id: UUID) -> AstIncomingAssetLine | None:
        stmt = (
            select(AstIncomingAssetLine)
            .options(selectinload(AstIncomingAssetLine.units))
            .where(
                AstIncomingAssetLine.id == row_id,
                AstIncomingAssetLine.is_deleted.is_(False),
            )
            .with_for_update()
        )
        stmt = self.apply_ast_filter(stmt, AstIncomingAssetLine, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def find_by_grn_line(
        self, ctx: TenantContext, company_id: UUID, grn_line_id: UUID
    ) -> AstIncomingAssetLine | None:
        stmt = select(AstIncomingAssetLine).where(
            AstIncomingAssetLine.company_id == company_id,
            AstIncomingAssetLine.grn_line_id == grn_line_id,
            AstIncomingAssetLine.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstIncomingAssetLine, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def search(
        self,
        ctx: TenantContext,
        filters: IncomingAssetListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstIncomingAssetLine], int]:
        stmt = select(AstIncomingAssetLine).where(
            AstIncomingAssetLine.company_id == filters.company_id,
            AstIncomingAssetLine.is_deleted.is_(False),
        )
        if filters.branch_id is not None:
            stmt = stmt.where(AstIncomingAssetLine.branch_id == filters.branch_id)
        if filters.status is not None:
            stmt = stmt.where(AstIncomingAssetLine.status == filters.status)
        if filters.grn_id is not None:
            stmt = stmt.where(AstIncomingAssetLine.grn_id == filters.grn_id)
        if filters.purchase_order_id is not None:
            stmt = stmt.where(AstIncomingAssetLine.purchase_order_id == filters.purchase_order_id)
        if filters.document_date_from is not None:
            stmt = stmt.where(AstIncomingAssetLine.document_date >= filters.document_date_from)
        if filters.document_date_to is not None:
            stmt = stmt.where(AstIncomingAssetLine.document_date <= filters.document_date_to)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstIncomingAssetLine.grn_document_number.ilike(term),
                    AstIncomingAssetLine.po_document_number.ilike(term),
                    AstIncomingAssetLine.product_name.ilike(term),
                    AstIncomingAssetLine.product_code.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstIncomingAssetLine, ctx, branch_scoped=True)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(
                    AstIncomingAssetLine.document_date.desc().nullslast(),
                    AstIncomingAssetLine.created_at.desc(),
                )
                .offset(offset)
                .limit(limit)
            ).all()
        )
        return rows, total

    def summary_counts(
        self, ctx: TenantContext, company_id: UUID, *, branch_id: UUID | None = None
    ) -> dict[str, int]:
        stmt = select(AstIncomingAssetLine.status, func.count()).where(
            AstIncomingAssetLine.company_id == company_id,
            AstIncomingAssetLine.is_deleted.is_(False),
        )
        if branch_id is not None:
            stmt = stmt.where(AstIncomingAssetLine.branch_id == branch_id)
        stmt = self.apply_ast_filter(stmt, AstIncomingAssetLine, ctx, branch_scoped=True)
        stmt = stmt.group_by(AstIncomingAssetLine.status)
        buckets = {s.value: 0 for s in IncomingAssetArrivalStatus}
        for status_value, cnt in self.db.execute(stmt).all():
            if status_value in buckets:
                buckets[status_value] = int(cnt or 0)

        qty_stmt = select(
            func.coalesce(func.sum(AstIncomingAssetLine.expected_quantity), 0),
            func.coalesce(func.sum(AstIncomingAssetLine.arrived_quantity), 0),
        ).where(
            AstIncomingAssetLine.company_id == company_id,
            AstIncomingAssetLine.is_deleted.is_(False),
        )
        if branch_id is not None:
            qty_stmt = qty_stmt.where(AstIncomingAssetLine.branch_id == branch_id)
        qty_stmt = self.apply_ast_filter(qty_stmt, AstIncomingAssetLine, ctx, branch_scoped=True)
        expected_sum, arrived_sum = self.db.execute(qty_stmt).one()
        expected_total = float(expected_sum or 0)
        arrived_total = float(arrived_sum or 0)
        return {
            "expected_lines": buckets[IncomingAssetArrivalStatus.EXPECTED.value]
            + buckets[IncomingAssetArrivalStatus.PARTIALLY_ARRIVED.value]
            + buckets[IncomingAssetArrivalStatus.ARRIVED.value],
            "pending_arrival_lines": buckets[IncomingAssetArrivalStatus.EXPECTED.value],
            "partially_arrived_lines": buckets[IncomingAssetArrivalStatus.PARTIALLY_ARRIVED.value],
            "arrived_lines": buckets[IncomingAssetArrivalStatus.ARRIVED.value],
            "expected_quantity_total": expected_total,
            "arrived_quantity_total": arrived_total,
            "pending_quantity_total": max(expected_total - arrived_total, 0),
        }

    def create_line(self, ctx: TenantContext, **fields) -> AstIncomingAssetLine:
        row = AstIncomingAssetLine(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            arrived_quantity=fields.pop("arrived_quantity", Decimal("0")),
            status=fields.pop("status", IncomingAssetArrivalStatus.EXPECTED.value),
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def ensure_units(self, ctx: TenantContext, line: AstIncomingAssetLine) -> None:
        """Create PENDING unit slots when expected qty is a whole number."""
        expected = Decimal(str(line.expected_quantity))
        if expected != expected.to_integral_value() or expected <= 0:
            return
        n = int(expected)
        existing = {u.unit_index: u for u in (line.units or []) if not u.is_deleted}
        for idx in range(1, n + 1):
            if idx in existing:
                continue
            unit = AstIncomingAssetUnit(
                id=uuid4(),
                tenant_id=ctx.tenant_id,
                company_id=line.company_id,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
                incoming_line_id=line.id,
                unit_index=idx,
                status=IncomingAssetUnitStatus.PENDING.value,
                qc_status=IncomingAssetUnitQcStatus.PENDING_QC.value,
            )
            self.db.add(unit)
        self.db.flush()
        self.db.refresh(line)

    def record_arrival_event(
        self,
        ctx: TenantContext,
        line: AstIncomingAssetLine,
        *,
        quantity: Decimal,
        notes: str | None = None,
        unit_indexes: list[int] | None = None,
    ) -> AstIncomingArrivalEvent:
        event = AstIncomingArrivalEvent(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=line.company_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            incoming_line_id=line.id,
            quantity=quantity,
            notes=notes,
            unit_indexes_json=",".join(str(i) for i in unit_indexes) if unit_indexes else None,
        )
        self.db.add(event)
        self.db.flush()
        return event

    def apply_arrival(
        self,
        ctx: TenantContext,
        line: AstIncomingAssetLine,
        *,
        quantity: Decimal,
        unit_indexes: list[int] | None = None,
        serial_by_index: dict[int, str] | None = None,
        notes: str | None = None,
    ) -> AstIncomingAssetLine:
        expected = Decimal(str(line.expected_quantity))
        arrived = Decimal(str(line.arrived_quantity))
        pending = expected - arrived
        if quantity <= 0:
            raise ValueError("quantity must be greater than zero")
        if quantity > pending:
            raise ValueError("quantity exceeds pending quantity")

        self.ensure_units(ctx, line)
        self.db.refresh(line)

        indexes = list(unit_indexes or [])
        if not indexes:
            pending_units = sorted(
                [
                    u
                    for u in (line.units or [])
                    if not u.is_deleted and u.status == IncomingAssetUnitStatus.PENDING.value
                ],
                key=lambda u: u.unit_index,
            )
            # Mark whole units when quantity is integral
            if quantity == quantity.to_integral_value():
                need = int(quantity)
                indexes = [u.unit_index for u in pending_units[:need]]

        now = utcnow()
        serial_by_index = serial_by_index or {}
        for u in line.units or []:
            if u.is_deleted or u.unit_index not in indexes:
                continue
            if u.status == IncomingAssetUnitStatus.ARRIVED.value:
                continue
            u.status = IncomingAssetUnitStatus.ARRIVED.value
            u.arrived_at = now
            u.arrived_by = ctx.user_id
            u.qc_status = IncomingAssetUnitQcStatus.PENDING_QC.value
            if u.unit_index in serial_by_index and serial_by_index[u.unit_index]:
                u.serial_number = serial_by_index[u.unit_index]
            u.updated_at = now
            u.updated_by = ctx.user_id

        line.arrived_quantity = arrived + quantity
        line.status = compute_arrival_status(expected, line.arrived_quantity)
        # Fresh arrivals remain PENDING QC until inspection starts/disposes
        if Decimal(str(line.accepted_quantity or 0)) + Decimal(
            str(line.rejected_quantity or 0)
        ) < Decimal(str(line.arrived_quantity)):
            if line.qc_status == IncomingAssetQcStatus.ACCEPTED.value:
                line.qc_status = IncomingAssetQcStatus.IN_PROGRESS.value
        line.updated_at = now
        line.updated_by = ctx.user_id
        if hasattr(line, "version"):
            line.version = int(line.version or 1) + 1

        self.record_arrival_event(
            ctx, line, quantity=quantity, notes=notes, unit_indexes=indexes or None
        )
        self.db.flush()
        return line

    def search_qc(
        self,
        ctx: TenantContext,
        filters: IncomingAssetQcListFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstIncomingAssetLine], int]:
        stmt = select(AstIncomingAssetLine).where(
            AstIncomingAssetLine.company_id == filters.company_id,
            AstIncomingAssetLine.is_deleted.is_(False),
        )
        if filters.require_arrived:
            stmt = stmt.where(AstIncomingAssetLine.arrived_quantity > 0)
        if filters.branch_id is not None:
            stmt = stmt.where(AstIncomingAssetLine.branch_id == filters.branch_id)
        if filters.qc_status is not None:
            stmt = stmt.where(AstIncomingAssetLine.qc_status == filters.qc_status)
        if filters.grn_id is not None:
            stmt = stmt.where(AstIncomingAssetLine.grn_id == filters.grn_id)
        if filters.purchase_order_id is not None:
            stmt = stmt.where(AstIncomingAssetLine.purchase_order_id == filters.purchase_order_id)
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstIncomingAssetLine.grn_document_number.ilike(term),
                    AstIncomingAssetLine.po_document_number.ilike(term),
                    AstIncomingAssetLine.product_name.ilike(term),
                    AstIncomingAssetLine.product_code.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstIncomingAssetLine, ctx, branch_scoped=True)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.options(selectinload(AstIncomingAssetLine.units))
                .order_by(
                    AstIncomingAssetLine.document_date.desc().nullslast(),
                    AstIncomingAssetLine.created_at.desc(),
                )
                .offset(offset)
                .limit(limit)
            ).all()
        )
        return rows, total

    def record_qc_event(
        self,
        ctx: TenantContext,
        line: AstIncomingAssetLine,
        *,
        disposition: str,
        quantity: Decimal,
        notes: str | None = None,
        rejection_reason: str | None = None,
        evidence_uri: str | None = None,
        unit_ids: list[UUID] | None = None,
        quality_inspection_id: UUID | None = None,
    ) -> AstIncomingQcEvent:
        event = AstIncomingQcEvent(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=line.company_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            incoming_line_id=line.id,
            disposition=disposition,
            quantity=quantity,
            notes=notes,
            rejection_reason=rejection_reason,
            evidence_uri=evidence_uri,
            unit_ids_json=",".join(str(i) for i in unit_ids) if unit_ids else None,
            quality_inspection_id=quality_inspection_id,
        )
        self.db.add(event)
        self.db.flush()
        return event

    def apply_qc_start(self, ctx: TenantContext, line: AstIncomingAssetLine) -> AstIncomingAssetLine:
        arrived = Decimal(str(line.arrived_quantity))
        if arrived <= 0:
            raise ValueError("Cannot start QC before any quantity has arrived")
        accepted = Decimal(str(line.accepted_quantity or 0))
        rejected = Decimal(str(line.rejected_quantity or 0))
        if accepted + rejected >= arrived:
            raise ValueError("QC is already complete for this line")
        now = utcnow()
        if line.qc_started_at is None:
            line.qc_started_at = now
            line.qc_started_by = ctx.user_id
        line.qc_status = IncomingAssetQcStatus.IN_PROGRESS.value
        line.updated_at = now
        line.updated_by = ctx.user_id
        if hasattr(line, "version"):
            line.version = int(line.version or 1) + 1
        self.record_qc_event(ctx, line, disposition="START", quantity=Decimal("1"))
        self.db.flush()
        return line

    def apply_qc_disposition(
        self,
        ctx: TenantContext,
        line: AstIncomingAssetLine,
        *,
        accept: bool,
        quantity: Decimal | None = None,
        unit_ids: list[UUID] | None = None,
        notes: str | None = None,
        rejection_reason: str | None = None,
        evidence_uri: str | None = None,
        quality_inspection_id: UUID | None = None,
    ) -> AstIncomingAssetLine:
        arrived = Decimal(str(line.arrived_quantity))
        accepted = Decimal(str(line.accepted_quantity or 0))
        rejected = Decimal(str(line.rejected_quantity or 0))
        pending_qc = arrived - accepted - rejected
        if pending_qc <= 0:
            raise ValueError("No pending QC quantity remaining")

        now = utcnow()
        units_by_id = {u.id: u for u in (line.units or []) if not u.is_deleted}
        target_units: list[AstIncomingAssetUnit] = []

        if unit_ids:
            for uid in unit_ids:
                u = units_by_id.get(uid)
                if u is None:
                    raise ValueError(f"Unit not found on this line: {uid}")
                if u.status != IncomingAssetUnitStatus.ARRIVED.value:
                    raise ValueError("Only ARRIVED units can be QC'd")
                if u.qc_status != IncomingAssetUnitQcStatus.PENDING_QC.value:
                    raise ValueError("Unit already has a QC disposition")
                target_units.append(u)
            qty = Decimal(len(target_units))
        elif quantity is not None:
            qty = Decimal(str(quantity))
            if qty <= 0:
                raise ValueError("quantity must be greater than zero")
            if qty > pending_qc:
                raise ValueError("quantity exceeds pending QC quantity")
            # Prefer marking PENDING_QC ARRIVED units when integral
            pending_units = sorted(
                [
                    u
                    for u in (line.units or [])
                    if not u.is_deleted
                    and u.status == IncomingAssetUnitStatus.ARRIVED.value
                    and u.qc_status == IncomingAssetUnitQcStatus.PENDING_QC.value
                ],
                key=lambda u: u.unit_index,
            )
            if qty == qty.to_integral_value() and pending_units:
                need = int(qty)
                if need > len(pending_units):
                    # Quantity-only path when units don't cover the qty
                    target_units = []
                else:
                    target_units = pending_units[:need]
        else:
            raise ValueError("Provide quantity or unit_ids")

        if qty > pending_qc:
            raise ValueError("quantity exceeds pending QC quantity")

        new_status = (
            IncomingAssetUnitQcStatus.ACCEPTED.value
            if accept
            else IncomingAssetUnitQcStatus.REJECTED.value
        )
        for u in target_units:
            u.qc_status = new_status
            u.tested_at = now
            u.tested_by = ctx.user_id
            u.qc_notes = notes
            if not accept:
                if not rejection_reason:
                    raise ValueError("rejection_reason is required when rejecting")
                u.rejection_reason = rejection_reason
            if evidence_uri:
                u.evidence_uri = evidence_uri
            if quality_inspection_id:
                u.quality_inspection_id = quality_inspection_id
            u.updated_at = now
            u.updated_by = ctx.user_id

        if accept:
            line.accepted_quantity = accepted + qty
        else:
            if not rejection_reason and not target_units:
                raise ValueError("rejection_reason is required when rejecting")
            line.rejected_quantity = rejected + qty

        if line.qc_started_at is None:
            line.qc_started_at = now
            line.qc_started_by = ctx.user_id
        if notes:
            line.qc_notes = notes
        if quality_inspection_id:
            line.quality_inspection_id = quality_inspection_id

        line.qc_status = compute_line_qc_status(
            Decimal(str(line.arrived_quantity)),
            Decimal(str(line.accepted_quantity)),
            Decimal(str(line.rejected_quantity)),
            started=True,
        )
        line.updated_at = now
        line.updated_by = ctx.user_id
        if hasattr(line, "version"):
            line.version = int(line.version or 1) + 1

        self.record_qc_event(
            ctx,
            line,
            disposition="ACCEPT" if accept else "REJECT",
            quantity=qty,
            notes=notes,
            rejection_reason=rejection_reason,
            evidence_uri=evidence_uri,
            unit_ids=[u.id for u in target_units] or None,
            quality_inspection_id=quality_inspection_id,
        )
        self.db.flush()
        return line

    def ensure_accepted_registration_units(
        self, ctx: TenantContext, line: AstIncomingAssetLine
    ) -> None:
        """Materialize ACCEPTED unit rows to match whole accepted_quantity (qty-only QC)."""
        accepted = Decimal(str(line.accepted_quantity or 0))
        if accepted <= 0 or accepted != accepted.to_integral_value():
            return
        need_total = int(accepted)
        units = [u for u in (line.units or []) if not u.is_deleted]
        accepted_units = [
            u for u in units if u.qc_status == IncomingAssetUnitQcStatus.ACCEPTED.value
        ]
        gap = need_total - len(accepted_units)
        if gap <= 0:
            return

        now = utcnow()
        pending = sorted(
            [
                u
                for u in units
                if u.status == IncomingAssetUnitStatus.ARRIVED.value
                and u.qc_status == IncomingAssetUnitQcStatus.PENDING_QC.value
            ],
            key=lambda u: u.unit_index,
        )
        for u in pending[:gap]:
            u.qc_status = IncomingAssetUnitQcStatus.ACCEPTED.value
            u.tested_at = u.tested_at or now
            u.tested_by = u.tested_by or ctx.user_id
            u.updated_at = now
            u.updated_by = ctx.user_id
            gap -= 1
        while gap > 0:
            next_idx = max((u.unit_index for u in units), default=0) + 1
            unit = AstIncomingAssetUnit(
                id=uuid4(),
                tenant_id=ctx.tenant_id,
                company_id=line.company_id,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
                incoming_line_id=line.id,
                unit_index=next_idx,
                status=IncomingAssetUnitStatus.ARRIVED.value,
                arrived_at=now,
                arrived_by=ctx.user_id,
                qc_status=IncomingAssetUnitQcStatus.ACCEPTED.value,
                tested_at=now,
                tested_by=ctx.user_id,
                quality_inspection_id=line.quality_inspection_id,
            )
            self.db.add(unit)
            units.append(unit)
            gap -= 1
        self.db.flush()
        self.db.refresh(line)

    def get_unit(
        self, ctx: TenantContext, unit_id: UUID
    ) -> AstIncomingAssetUnit | None:
        stmt = (
            select(AstIncomingAssetUnit)
            .where(
                AstIncomingAssetUnit.id == unit_id,
                AstIncomingAssetUnit.is_deleted.is_(False),
            )
            .options(selectinload(AstIncomingAssetUnit.incoming_line))
        )
        stmt = self.apply_ast_filter(stmt, AstIncomingAssetUnit, ctx, branch_scoped=False)
        return self.db.scalars(stmt).first()

    def get_unit_for_update(
        self, ctx: TenantContext, unit_id: UUID
    ) -> AstIncomingAssetUnit | None:
        stmt = (
            select(AstIncomingAssetUnit)
            .where(
                AstIncomingAssetUnit.id == unit_id,
                AstIncomingAssetUnit.is_deleted.is_(False),
            )
            .options(selectinload(AstIncomingAssetUnit.incoming_line))
            .with_for_update()
        )
        stmt = self.apply_ast_filter(stmt, AstIncomingAssetUnit, ctx, branch_scoped=False)
        return self.db.scalars(stmt).first()

    def link_registered_asset(
        self,
        ctx: TenantContext,
        unit: AstIncomingAssetUnit,
        asset_id: UUID,
    ) -> AstIncomingAssetUnit:
        if unit.registered_asset_id is not None:
            raise ValueError("Unit is already registered")
        now = utcnow()
        unit.registered_asset_id = asset_id
        unit.registered_at = now
        unit.registered_by = ctx.user_id
        unit.updated_at = now
        unit.updated_by = ctx.user_id
        self.db.flush()
        return unit

    def search_registration_queue(
        self,
        ctx: TenantContext,
        filters: IncomingRegistrationQueueFilters,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[AstIncomingAssetUnit], int]:
        stmt = (
            select(AstIncomingAssetUnit)
            .join(
                AstIncomingAssetLine,
                AstIncomingAssetUnit.incoming_line_id == AstIncomingAssetLine.id,
            )
            .where(
                AstIncomingAssetUnit.is_deleted.is_(False),
                AstIncomingAssetLine.is_deleted.is_(False),
                AstIncomingAssetLine.company_id == filters.company_id,
                AstIncomingAssetUnit.qc_status == IncomingAssetUnitQcStatus.ACCEPTED.value,
            )
            .options(selectinload(AstIncomingAssetUnit.incoming_line))
        )
        if filters.branch_id is not None:
            stmt = stmt.where(AstIncomingAssetLine.branch_id == filters.branch_id)
        if filters.grn_id is not None:
            stmt = stmt.where(AstIncomingAssetLine.grn_id == filters.grn_id)
        if filters.purchase_order_id is not None:
            stmt = stmt.where(AstIncomingAssetLine.purchase_order_id == filters.purchase_order_id)
        if filters.pending_only:
            stmt = stmt.where(AstIncomingAssetUnit.registered_asset_id.is_(None))
        elif filters.registered_only:
            stmt = stmt.where(AstIncomingAssetUnit.registered_asset_id.is_not(None))
        if filters.registration_status == IncomingRegistrationStatus.PENDING_REGISTRATION.value:
            stmt = stmt.where(AstIncomingAssetUnit.registered_asset_id.is_(None))
        elif filters.registration_status == IncomingRegistrationStatus.REGISTERED.value:
            stmt = stmt.where(AstIncomingAssetUnit.registered_asset_id.is_not(None))
        if filters.search:
            term = f"%{filters.search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstIncomingAssetLine.grn_document_number.ilike(term),
                    AstIncomingAssetLine.po_document_number.ilike(term),
                    AstIncomingAssetLine.product_name.ilike(term),
                    AstIncomingAssetLine.product_code.ilike(term),
                    AstIncomingAssetUnit.serial_number.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstIncomingAssetLine, ctx, branch_scoped=True)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        rows = list(
            self.db.scalars(
                stmt.order_by(
                    AstIncomingAssetLine.document_date.desc().nullslast(),
                    AstIncomingAssetUnit.unit_index.asc(),
                )
                .offset(offset)
                .limit(limit)
            ).all()
        )
        return rows, total

    def registration_summary(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID | None = None,
    ) -> dict[str, int]:
        base = (
            select(AstIncomingAssetUnit)
            .join(
                AstIncomingAssetLine,
                AstIncomingAssetUnit.incoming_line_id == AstIncomingAssetLine.id,
            )
            .where(
                AstIncomingAssetUnit.is_deleted.is_(False),
                AstIncomingAssetLine.is_deleted.is_(False),
                AstIncomingAssetLine.company_id == company_id,
                AstIncomingAssetUnit.qc_status == IncomingAssetUnitQcStatus.ACCEPTED.value,
            )
        )
        if branch_id is not None:
            base = base.where(AstIncomingAssetLine.branch_id == branch_id)
        base = self.apply_ast_filter(base, AstIncomingAssetLine, ctx, branch_scoped=True)
        accepted = int(
            self.db.scalar(select(func.count()).select_from(base.subquery())) or 0
        )
        registered_stmt = base.where(AstIncomingAssetUnit.registered_asset_id.is_not(None))
        registered = int(
            self.db.scalar(select(func.count()).select_from(registered_stmt.subquery())) or 0
        )
        return {
            "accepted": accepted,
            "registered": registered,
            "pending_registration": max(accepted - registered, 0),
        }


def compute_line_registration_status(*, accepted: int, registered: int) -> str:
    if accepted <= 0:
        return IncomingRegistrationStatus.PENDING_REGISTRATION.value
    if registered <= 0:
        return IncomingRegistrationStatus.PENDING_REGISTRATION.value
    if registered >= accepted:
        return IncomingRegistrationStatus.REGISTERED.value
    return IncomingRegistrationStatus.PARTIALLY_REGISTERED.value
