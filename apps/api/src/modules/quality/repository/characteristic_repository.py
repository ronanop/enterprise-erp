"""Quality characteristic repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models import QmQualityCharacteristic
from modules.quality.repository.base import QmScopedRepository, utcnow


class CharacteristicRepository(QmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, characteristic_id: UUID) -> QmQualityCharacteristic | None:
        stmt = select(QmQualityCharacteristic).where(
            QmQualityCharacteristic.id == characteristic_id,
            QmQualityCharacteristic.is_deleted.is_(False),
        )
        stmt = self.apply_qm_filter(stmt, QmQualityCharacteristic, ctx)
        return self.db.scalar(stmt)

    def list_characteristics(
        self, ctx: TenantContext, company_id: UUID, inspection_plan_id: UUID | None = None
    ):
        stmt = select(QmQualityCharacteristic).where(
            QmQualityCharacteristic.company_id == company_id,
            QmQualityCharacteristic.is_deleted.is_(False),
        )
        if inspection_plan_id is not None:
            stmt = stmt.where(QmQualityCharacteristic.inspection_plan_id == inspection_plan_id)
        stmt = self.apply_qm_filter(stmt, QmQualityCharacteristic, ctx)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> QmQualityCharacteristic:
        row = QmQualityCharacteristic(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(
        self, ctx: TenantContext, characteristic_id: UUID, **fields
    ) -> QmQualityCharacteristic | None:
        row = self.get(ctx, characteristic_id)
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
