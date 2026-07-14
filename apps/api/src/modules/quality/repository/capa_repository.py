"""Quality CAPA repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models import (
    QmCapa,
    QmCorrectiveAction,
    QmPreventiveAction,
    QmRootCause,
)
from modules.quality.repository.base import QmScopedRepository, utcnow


class CapaRepository(QmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, capa_id: UUID) -> QmCapa | None:
        stmt = (
            select(QmCapa)
            .options(
                selectinload(QmCapa.root_causes),
                selectinload(QmCapa.corrective_actions),
                selectinload(QmCapa.preventive_actions),
            )
            .where(QmCapa.id == capa_id, QmCapa.is_deleted.is_(False))
        )
        stmt = self.apply_qm_filter(stmt, QmCapa, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_capas(self, ctx: TenantContext, company_id: UUID):
        stmt = (
            select(QmCapa)
            .options(
                selectinload(QmCapa.root_causes),
                selectinload(QmCapa.corrective_actions),
                selectinload(QmCapa.preventive_actions),
            )
            .where(QmCapa.company_id == company_id, QmCapa.is_deleted.is_(False))
        )
        stmt = self.apply_qm_filter(stmt, QmCapa, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> QmCapa:
        row = QmCapa(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def add_root_cause(self, ctx: TenantContext, capa: QmCapa, **fields) -> QmRootCause:
        row = QmRootCause(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=capa.company_id,
            branch_id=capa.branch_id,
            capa_id=capa.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def add_corrective(self, ctx: TenantContext, capa: QmCapa, **fields) -> QmCorrectiveAction:
        row = QmCorrectiveAction(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=capa.company_id,
            branch_id=capa.branch_id,
            capa_id=capa.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def add_preventive(self, ctx: TenantContext, capa: QmCapa, **fields) -> QmPreventiveAction:
        row = QmPreventiveAction(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=capa.company_id,
            branch_id=capa.branch_id,
            capa_id=capa.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, capa_id: UUID, **fields) -> QmCapa | None:
        row = self.get(ctx, capa_id)
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
