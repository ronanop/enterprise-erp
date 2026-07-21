"""Procurement vendor quotation repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.models.vendor_quotation import (
    ProcVendorComparison,
    ProcVendorQuotationHeader,
    ProcVendorQuotationLine,
)
from modules.procurement.repository.base import ProcScopedRepository, utcnow


class VendorQuotationRepository(ProcScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_quotations(
        self, ctx: TenantContext, company_id: UUID
    ) -> list[ProcVendorQuotationHeader]:
        stmt = select(ProcVendorQuotationHeader).where(
            ProcVendorQuotationHeader.company_id == company_id,
            ProcVendorQuotationHeader.is_deleted.is_(False),
        )
        stmt = self.apply_proc_filter(stmt, ProcVendorQuotationHeader, ctx, branch_scoped=True)
        return list(
            self.db.scalars(
                stmt.order_by(ProcVendorQuotationHeader.document_date.desc())
            ).all()
        )

    def get_quotation(
        self, ctx: TenantContext, quotation_id: UUID
    ) -> ProcVendorQuotationHeader | None:
        stmt = (
            select(ProcVendorQuotationHeader)
            .options(selectinload(ProcVendorQuotationHeader.lines))
            .where(
                ProcVendorQuotationHeader.id == quotation_id,
                ProcVendorQuotationHeader.tenant_id == ctx.tenant_id,
                ProcVendorQuotationHeader.is_deleted.is_(False),
            )
        )
        return self.db.scalar(stmt)

    def get_quotation_for_update(
        self, ctx: TenantContext, quotation_id: UUID
    ) -> ProcVendorQuotationHeader | None:
        stmt = (
            select(ProcVendorQuotationHeader)
            .options(selectinload(ProcVendorQuotationHeader.lines))
            .where(
                ProcVendorQuotationHeader.id == quotation_id,
                ProcVendorQuotationHeader.tenant_id == ctx.tenant_id,
                ProcVendorQuotationHeader.is_deleted.is_(False),
            )
            .with_for_update()
        )
        return self.db.scalar(stmt)

    def create_quotation(
        self, ctx: TenantContext, *, company_id: UUID, branch_id: UUID, **fields: object
    ) -> ProcVendorQuotationHeader:
        row = ProcVendorQuotationHeader(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update_quotation(
        self, ctx: TenantContext, quotation_id: UUID, **fields: object
    ) -> ProcVendorQuotationHeader | None:
        row = self.get_quotation_for_update(ctx, quotation_id)
        if row is None:
            return None
        for key, value in fields.items():
            if hasattr(row, key):
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version += 1
        self.db.flush()
        return row

    def add_line(
        self, ctx: TenantContext, quotation: ProcVendorQuotationHeader, **fields: object
    ) -> ProcVendorQuotationLine:
        row = ProcVendorQuotationLine(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=quotation.company_id,
            branch_id=quotation.branch_id,
            vendor_quotation_header_id=quotation.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def get_comparison_by_rfq(
        self, ctx: TenantContext, rfq_header_id: UUID
    ) -> ProcVendorComparison | None:
        stmt = select(ProcVendorComparison).where(
            ProcVendorComparison.rfq_header_id == rfq_header_id,
            ProcVendorComparison.tenant_id == ctx.tenant_id,
            ProcVendorComparison.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def list_comparisons(self, ctx: TenantContext, company_id: UUID) -> list[ProcVendorComparison]:
        stmt = (
            select(ProcVendorComparison)
            .where(
                ProcVendorComparison.company_id == company_id,
                ProcVendorComparison.tenant_id == ctx.tenant_id,
                ProcVendorComparison.is_deleted.is_(False),
            )
            .order_by(ProcVendorComparison.document_number)
        )
        return list(self.db.scalars(stmt).all())

    def create_comparison(
        self, ctx: TenantContext, *, company_id: UUID, branch_id: UUID, **fields: object
    ) -> ProcVendorComparison:
        row = ProcVendorComparison(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update_comparison(
        self, ctx: TenantContext, comparison_id: UUID, **fields: object
    ) -> ProcVendorComparison | None:
        stmt = select(ProcVendorComparison).where(
            ProcVendorComparison.id == comparison_id,
            ProcVendorComparison.tenant_id == ctx.tenant_id,
            ProcVendorComparison.is_deleted.is_(False),
        )
        row = self.db.scalar(stmt)
        if row is None:
            return None
        for key, value in fields.items():
            if hasattr(row, key):
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version += 1
        self.db.flush()
        return row
