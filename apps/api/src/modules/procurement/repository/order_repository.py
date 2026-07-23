"""Procurement purchase order repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.models.order import ProcOrderHeader, ProcOrderLine
from modules.procurement.repository.base import ProcScopedRepository, utcnow


class OrderRepository(ProcScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_orders(self, ctx: TenantContext, company_id: UUID) -> list[ProcOrderHeader]:
        stmt = select(ProcOrderHeader).where(
            ProcOrderHeader.company_id == company_id,
            ProcOrderHeader.is_deleted.is_(False),
        )
        stmt = self.apply_proc_filter(stmt, ProcOrderHeader, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt.order_by(ProcOrderHeader.document_date.desc())).all())

    def list_orders_with_lines(self, ctx: TenantContext, company_id: UUID) -> list[ProcOrderHeader]:
        stmt = (
            select(ProcOrderHeader)
            .options(selectinload(ProcOrderHeader.lines))
            .where(
                ProcOrderHeader.company_id == company_id,
                ProcOrderHeader.is_deleted.is_(False),
            )
        )
        stmt = self.apply_proc_filter(stmt, ProcOrderHeader, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt.order_by(ProcOrderHeader.document_date.desc())).all())

    def find_by_source(
        self,
        ctx: TenantContext,
        *,
        source_module: str,
        source_document_type: str,
        source_document_id: UUID,
    ) -> ProcOrderHeader | None:
        stmt = (
            select(ProcOrderHeader)
            .options(selectinload(ProcOrderHeader.lines))
            .where(
                ProcOrderHeader.tenant_id == ctx.tenant_id,
                ProcOrderHeader.is_deleted.is_(False),
                ProcOrderHeader.source_module == source_module,
                ProcOrderHeader.source_document_type == source_document_type,
                ProcOrderHeader.source_document_id == source_document_id,
            )
        )
        return self.db.scalar(stmt)

    def get_order(self, ctx: TenantContext, order_id: UUID) -> ProcOrderHeader | None:
        stmt = (
            select(ProcOrderHeader)
            .options(selectinload(ProcOrderHeader.lines))
            .where(
                ProcOrderHeader.id == order_id,
                ProcOrderHeader.tenant_id == ctx.tenant_id,
                ProcOrderHeader.is_deleted.is_(False),
            )
        )
        return self.db.scalar(stmt)

    def get_order_for_update(self, ctx: TenantContext, order_id: UUID) -> ProcOrderHeader | None:
        stmt = (
            select(ProcOrderHeader)
            .options(selectinload(ProcOrderHeader.lines))
            .where(
                ProcOrderHeader.id == order_id,
                ProcOrderHeader.tenant_id == ctx.tenant_id,
                ProcOrderHeader.is_deleted.is_(False),
            )
            .with_for_update()
        )
        return self.db.scalar(stmt)

    def create_order(
        self, ctx: TenantContext, *, company_id: UUID, branch_id: UUID, **fields: object
    ) -> ProcOrderHeader:
        row = ProcOrderHeader(
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

    def update_order(
        self, ctx: TenantContext, order_id: UUID, **fields: object
    ) -> ProcOrderHeader | None:
        row = self.get_order_for_update(ctx, order_id)
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

    def soft_delete_order(self, ctx: TenantContext, order_id: UUID) -> bool:
        row = self.get_order(ctx, order_id)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        self.db.flush()
        return True

    def add_line(
        self, ctx: TenantContext, order: ProcOrderHeader, **fields: object
    ) -> ProcOrderLine:
        row = ProcOrderLine(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=order.company_id,
            branch_id=order.branch_id,
            order_header_id=order.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def get_line(self, ctx: TenantContext, line_id: UUID) -> ProcOrderLine | None:
        stmt = select(ProcOrderLine).where(
            ProcOrderLine.id == line_id,
            ProcOrderLine.tenant_id == ctx.tenant_id,
            ProcOrderLine.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)
