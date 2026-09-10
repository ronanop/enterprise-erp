"""Quality VIN trace repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models import QmVinTrace, QmVinTraceComponent
from modules.quality.repository.base import QmScopedRepository, utcnow


class VinTraceRepository(QmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, trace_id: UUID) -> QmVinTrace | None:
        stmt = (
            select(QmVinTrace)
            .options(selectinload(QmVinTrace.components))
            .where(QmVinTrace.id == trace_id, QmVinTrace.is_deleted.is_(False))
        )
        stmt = self.apply_qm_filter(stmt, QmVinTrace, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def get_by_vin(self, ctx: TenantContext, company_id: UUID, vin: str) -> QmVinTrace | None:
        stmt = select(QmVinTrace).where(
            QmVinTrace.company_id == company_id,
            QmVinTrace.vin == vin,
            QmVinTrace.is_deleted.is_(False),
        )
        stmt = self.apply_qm_filter(stmt, QmVinTrace, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_traces(self, ctx: TenantContext, company_id: UUID, product_id: UUID | None = None):
        stmt = (
            select(QmVinTrace)
            .options(selectinload(QmVinTrace.components))
            .where(
                QmVinTrace.company_id == company_id,
                QmVinTrace.is_deleted.is_(False),
            )
        )
        if product_id is not None:
            stmt = stmt.where(QmVinTrace.product_id == product_id)
        stmt = self.apply_qm_filter(stmt, QmVinTrace, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> QmVinTrace:
        row = QmVinTrace(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def add_component(self, ctx: TenantContext, trace: QmVinTrace, **fields) -> QmVinTraceComponent:
        line = QmVinTraceComponent(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=trace.company_id,
            branch_id=trace.branch_id,
            vin_trace_id=trace.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(line)
        self.db.flush()
        return line

    def update(self, ctx: TenantContext, trace_id: UUID, **fields) -> QmVinTrace | None:
        row = self.get(ctx, trace_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
