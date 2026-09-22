"""Procurement GRN repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.models.grn import ProcGrnHeader, ProcGrnLine
from modules.procurement.repository.base import ProcScopedRepository, utcnow


class GrnRepository(ProcScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_grns(self, ctx: TenantContext, company_id: UUID | None) -> list[ProcGrnHeader]:
        stmt = select(ProcGrnHeader).where(ProcGrnHeader.is_deleted.is_(False))
        stmt = self.apply_optional_company_filter(stmt, ProcGrnHeader, company_id)
        stmt = self.apply_proc_filter(stmt, ProcGrnHeader, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt.order_by(ProcGrnHeader.document_date.desc())).all())

    def get_grn(self, ctx: TenantContext, grn_id: UUID) -> ProcGrnHeader | None:
        stmt = (
            select(ProcGrnHeader)
            .options(selectinload(ProcGrnHeader.lines))
            .where(
                ProcGrnHeader.id == grn_id,
                ProcGrnHeader.tenant_id == ctx.tenant_id,
                ProcGrnHeader.is_deleted.is_(False),
            )
        )
        return self.db.scalar(stmt)

    def get_grn_for_update(self, ctx: TenantContext, grn_id: UUID) -> ProcGrnHeader | None:
        stmt = (
            select(ProcGrnHeader)
            .options(selectinload(ProcGrnHeader.lines))
            .where(
                ProcGrnHeader.id == grn_id,
                ProcGrnHeader.tenant_id == ctx.tenant_id,
                ProcGrnHeader.is_deleted.is_(False),
            )
            .with_for_update()
        )
        return self.db.scalar(stmt)

    def create_grn(
        self, ctx: TenantContext, *, company_id: UUID, branch_id: UUID, **fields: object
    ) -> ProcGrnHeader:
        row = ProcGrnHeader(
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

    def update_grn(
        self, ctx: TenantContext, grn_id: UUID, **fields: object
    ) -> ProcGrnHeader | None:
        row = self.get_grn_for_update(ctx, grn_id)
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

    def add_line(self, ctx: TenantContext, grn: ProcGrnHeader, **fields: object) -> ProcGrnLine:
        row = ProcGrnLine(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=grn.company_id,
            branch_id=grn.branch_id,
            grn_header_id=grn.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row
