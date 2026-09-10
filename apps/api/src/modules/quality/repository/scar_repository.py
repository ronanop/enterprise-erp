"""Quality SCAR repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models import QmScar
from modules.quality.repository.base import QmScopedRepository, utcnow


class ScarRepository(QmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, scar_id: UUID) -> QmScar | None:
        stmt = select(QmScar).where(QmScar.id == scar_id, QmScar.is_deleted.is_(False))
        stmt = self.apply_qm_filter(stmt, QmScar, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_scars(self, ctx: TenantContext, company_id: UUID, vendor_id: UUID | None = None):
        stmt = select(QmScar).where(
            QmScar.company_id == company_id,
            QmScar.is_deleted.is_(False),
        )
        if vendor_id is not None:
            stmt = stmt.where(QmScar.vendor_id == vendor_id)
        stmt = self.apply_qm_filter(stmt, QmScar, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> QmScar:
        row = QmScar(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, scar_id: UUID, **fields) -> QmScar | None:
        row = self.get(ctx, scar_id)
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
