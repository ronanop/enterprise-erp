"""Procurement invoice repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.models.invoice import ProcInvoiceHeader, ProcInvoiceLine
from modules.procurement.repository.base import ProcScopedRepository, utcnow


class InvoiceRepository(ProcScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_invoices(self, ctx: TenantContext, company_id: UUID | None) -> list[ProcInvoiceHeader]:
        stmt = select(ProcInvoiceHeader).where(ProcInvoiceHeader.is_deleted.is_(False))
        stmt = self.apply_optional_company_filter(stmt, ProcInvoiceHeader, company_id)
        stmt = self.apply_proc_filter(stmt, ProcInvoiceHeader, ctx, branch_scoped=True)
        return list(
            self.db.scalars(stmt.order_by(ProcInvoiceHeader.document_date.desc())).all()
        )

    def get_invoice(self, ctx: TenantContext, invoice_id: UUID) -> ProcInvoiceHeader | None:
        stmt = (
            select(ProcInvoiceHeader)
            .options(selectinload(ProcInvoiceHeader.lines))
            .where(
                ProcInvoiceHeader.id == invoice_id,
                ProcInvoiceHeader.tenant_id == ctx.tenant_id,
                ProcInvoiceHeader.is_deleted.is_(False),
            )
        )
        return self.db.scalar(stmt)

    def get_invoice_for_update(
        self, ctx: TenantContext, invoice_id: UUID
    ) -> ProcInvoiceHeader | None:
        stmt = (
            select(ProcInvoiceHeader)
            .options(selectinload(ProcInvoiceHeader.lines))
            .where(
                ProcInvoiceHeader.id == invoice_id,
                ProcInvoiceHeader.tenant_id == ctx.tenant_id,
                ProcInvoiceHeader.is_deleted.is_(False),
            )
            .with_for_update()
        )
        return self.db.scalar(stmt)

    def create_invoice(
        self, ctx: TenantContext, *, company_id: UUID, branch_id: UUID, **fields: object
    ) -> ProcInvoiceHeader:
        row = ProcInvoiceHeader(
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

    def update_invoice(
        self, ctx: TenantContext, invoice_id: UUID, **fields: object
    ) -> ProcInvoiceHeader | None:
        row = self.get_invoice_for_update(ctx, invoice_id)
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
        self, ctx: TenantContext, invoice: ProcInvoiceHeader, **fields: object
    ) -> ProcInvoiceLine:
        row = ProcInvoiceLine(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=invoice.company_id,
            branch_id=invoice.branch_id,
            invoice_header_id=invoice.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def get_line(self, ctx: TenantContext, line_id: UUID) -> ProcInvoiceLine | None:
        stmt = select(ProcInvoiceLine).where(
            ProcInvoiceLine.id == line_id,
            ProcInvoiceLine.tenant_id == ctx.tenant_id,
            ProcInvoiceLine.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)
