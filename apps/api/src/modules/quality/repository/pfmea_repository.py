"""Quality PFMEA repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models import QmPfmea, QmPfmeaLine
from modules.quality.repository.base import QmScopedRepository, utcnow


class PfmeaRepository(QmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, pfmea_id: UUID) -> QmPfmea | None:
        stmt = (
            select(QmPfmea)
            .options(selectinload(QmPfmea.lines))
            .where(QmPfmea.id == pfmea_id, QmPfmea.is_deleted.is_(False))
        )
        stmt = self.apply_qm_filter(stmt, QmPfmea, ctx)
        return self.db.scalar(stmt)

    def list_pfmeas(self, ctx: TenantContext, company_id: UUID):
        stmt = (
            select(QmPfmea)
            .options(selectinload(QmPfmea.lines))
            .where(QmPfmea.company_id == company_id, QmPfmea.is_deleted.is_(False))
        )
        stmt = self.apply_qm_filter(stmt, QmPfmea, ctx)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> QmPfmea:
        row = QmPfmea(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def add_line(self, ctx: TenantContext, pfmea: QmPfmea, **fields) -> QmPfmeaLine:
        line = QmPfmeaLine(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=pfmea.company_id,
            pfmea_id=pfmea.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(line)
        self.db.flush()
        return line

    def update(self, ctx: TenantContext, pfmea_id: UUID, **fields) -> QmPfmea | None:
        row = self.get(ctx, pfmea_id)
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
