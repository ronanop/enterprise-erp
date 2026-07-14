"""Quality defect type repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models import QmDefectType
from modules.quality.repository.base import QmScopedRepository, utcnow


class DefectTypeRepository(QmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, defect_type_id: UUID) -> QmDefectType | None:
        stmt = select(QmDefectType).where(
            QmDefectType.id == defect_type_id, QmDefectType.is_deleted.is_(False)
        )
        stmt = self.apply_qm_filter(stmt, QmDefectType, ctx)
        return self.db.scalar(stmt)

    def list_types(self, ctx: TenantContext, company_id: UUID):
        stmt = select(QmDefectType).where(
            QmDefectType.company_id == company_id,
            QmDefectType.is_deleted.is_(False),
        )
        stmt = self.apply_qm_filter(stmt, QmDefectType, ctx)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> QmDefectType:
        row = QmDefectType(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, defect_type_id: UUID, **fields) -> QmDefectType | None:
        row = self.get(ctx, defect_type_id)
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
