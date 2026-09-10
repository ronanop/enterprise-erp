"""Quality SPC reading repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models import QmSpcReading
from modules.quality.repository.base import QmScopedRepository, utcnow
from modules.quality.service.engines.spc_engine import SPC_WINDOW


class SpcReadingRepository(QmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, reading_id: UUID) -> QmSpcReading | None:
        stmt = select(QmSpcReading).where(
            QmSpcReading.id == reading_id,
            QmSpcReading.is_deleted.is_(False),
        )
        stmt = self.apply_qm_filter(stmt, QmSpcReading, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_readings(
        self,
        ctx: TenantContext,
        company_id: UUID,
        characteristic_id: UUID | None = None,
    ):
        stmt = select(QmSpcReading).where(
            QmSpcReading.company_id == company_id,
            QmSpcReading.is_deleted.is_(False),
        )
        if characteristic_id is not None:
            stmt = stmt.where(QmSpcReading.characteristic_id == characteristic_id)
        stmt = stmt.order_by(QmSpcReading.recorded_at.desc())
        stmt = self.apply_qm_filter(stmt, QmSpcReading, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def list_window(self, ctx: TenantContext, company_id: UUID, characteristic_id: UUID):
        stmt = (
            select(QmSpcReading)
            .where(
                QmSpcReading.company_id == company_id,
                QmSpcReading.characteristic_id == characteristic_id,
                QmSpcReading.is_deleted.is_(False),
            )
            .order_by(QmSpcReading.recorded_at.desc())
            .limit(SPC_WINDOW)
        )
        stmt = self.apply_qm_filter(stmt, QmSpcReading, ctx, branch_scoped=True)
        rows = list(self.db.scalars(stmt).all())
        rows.reverse()
        return rows

    def create(self, ctx: TenantContext, **fields) -> QmSpcReading:
        row = QmSpcReading(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, reading_id: UUID, **fields) -> QmSpcReading | None:
        row = self.get(ctx, reading_id)
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
