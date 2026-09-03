"""Procurement return repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.models.return_doc import ProcReturnHeader, ProcReturnLine
from modules.procurement.repository.base import ProcScopedRepository, utcnow


class ReturnRepository(ProcScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_returns(self, ctx: TenantContext, company_id: UUID | None) -> list[ProcReturnHeader]:
        stmt = select(ProcReturnHeader).where(ProcReturnHeader.is_deleted.is_(False))
        stmt = self.apply_optional_company_filter(stmt, ProcReturnHeader, company_id)
        stmt = self.apply_proc_filter(stmt, ProcReturnHeader, ctx, branch_scoped=True)
        return list(
            self.db.scalars(stmt.order_by(ProcReturnHeader.document_date.desc())).all()
        )

    def get_return(self, ctx: TenantContext, return_id: UUID) -> ProcReturnHeader | None:
        stmt = (
            select(ProcReturnHeader)
            .options(selectinload(ProcReturnHeader.lines))
            .where(
                ProcReturnHeader.id == return_id,
                ProcReturnHeader.tenant_id == ctx.tenant_id,
                ProcReturnHeader.is_deleted.is_(False),
            )
        )
        return self.db.scalar(stmt)

    def get_return_for_update(
        self, ctx: TenantContext, return_id: UUID
    ) -> ProcReturnHeader | None:
        stmt = (
            select(ProcReturnHeader)
            .options(selectinload(ProcReturnHeader.lines))
            .where(
                ProcReturnHeader.id == return_id,
                ProcReturnHeader.tenant_id == ctx.tenant_id,
                ProcReturnHeader.is_deleted.is_(False),
            )
            .with_for_update()
        )
        return self.db.scalar(stmt)

    def create_return(
        self, ctx: TenantContext, *, company_id: UUID, branch_id: UUID, **fields: object
    ) -> ProcReturnHeader:
        row = ProcReturnHeader(
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

    def update_return(
        self, ctx: TenantContext, return_id: UUID, **fields: object
    ) -> ProcReturnHeader | None:
        row = self.get_return_for_update(ctx, return_id)
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
        self, ctx: TenantContext, return_header: ProcReturnHeader, **fields: object
    ) -> ProcReturnLine:
        row = ProcReturnLine(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=return_header.company_id,
            branch_id=return_header.branch_id,
            return_header_id=return_header.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row
