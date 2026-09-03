"""Procurement RFQ repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.models.rfq import ProcRfqHeader, ProcRfqLine, ProcRfqVendor
from modules.procurement.repository.base import ProcScopedRepository, utcnow


class RfqRepository(ProcScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_rfqs(self, ctx: TenantContext, company_id: UUID | None) -> list[ProcRfqHeader]:
        stmt = select(ProcRfqHeader).where(ProcRfqHeader.is_deleted.is_(False))
        stmt = self.apply_optional_company_filter(stmt, ProcRfqHeader, company_id)
        stmt = self.apply_proc_filter(stmt, ProcRfqHeader, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt.order_by(ProcRfqHeader.document_date.desc())).all())

    def get_rfq(self, ctx: TenantContext, rfq_id: UUID) -> ProcRfqHeader | None:
        stmt = (
            select(ProcRfqHeader)
            .options(
                selectinload(ProcRfqHeader.lines),
                selectinload(ProcRfqHeader.vendors),
            )
            .where(
                ProcRfqHeader.id == rfq_id,
                ProcRfqHeader.tenant_id == ctx.tenant_id,
                ProcRfqHeader.is_deleted.is_(False),
            )
        )
        return self.db.scalar(stmt)

    def get_rfq_for_update(self, ctx: TenantContext, rfq_id: UUID) -> ProcRfqHeader | None:
        stmt = (
            select(ProcRfqHeader)
            .options(
                selectinload(ProcRfqHeader.lines),
                selectinload(ProcRfqHeader.vendors),
            )
            .where(
                ProcRfqHeader.id == rfq_id,
                ProcRfqHeader.tenant_id == ctx.tenant_id,
                ProcRfqHeader.is_deleted.is_(False),
            )
            .with_for_update()
        )
        return self.db.scalar(stmt)

    def create_rfq(
        self, ctx: TenantContext, *, company_id: UUID, branch_id: UUID, **fields: object
    ) -> ProcRfqHeader:
        row = ProcRfqHeader(
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

    def update_rfq(
        self, ctx: TenantContext, rfq_id: UUID, **fields: object
    ) -> ProcRfqHeader | None:
        row = self.get_rfq_for_update(ctx, rfq_id)
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

    def soft_delete_rfq(self, ctx: TenantContext, rfq_id: UUID) -> bool:
        row = self.get_rfq(ctx, rfq_id)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        self.db.flush()
        return True

    def add_line(self, ctx: TenantContext, rfq: ProcRfqHeader, **fields: object) -> ProcRfqLine:
        row = ProcRfqLine(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=rfq.company_id,
            branch_id=rfq.branch_id,
            rfq_header_id=rfq.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def add_vendor(self, ctx: TenantContext, rfq: ProcRfqHeader, **fields: object) -> ProcRfqVendor:
        row = ProcRfqVendor(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=rfq.company_id,
            branch_id=rfq.branch_id,
            rfq_header_id=rfq.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row
