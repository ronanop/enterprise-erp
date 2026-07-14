"""Quality audit repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models import QmQualityAudit
from modules.quality.repository.base import QmScopedRepository, utcnow


class QualityAuditRepository(QmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, audit_id: UUID) -> QmQualityAudit | None:
        stmt = select(QmQualityAudit).where(
            QmQualityAudit.id == audit_id,
            QmQualityAudit.is_deleted.is_(False),
        )
        stmt = self.apply_qm_filter(stmt, QmQualityAudit, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_audits(self, ctx: TenantContext, company_id: UUID):
        stmt = select(QmQualityAudit).where(
            QmQualityAudit.company_id == company_id,
            QmQualityAudit.is_deleted.is_(False),
        )
        stmt = self.apply_qm_filter(stmt, QmQualityAudit, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> QmQualityAudit:
        row = QmQualityAudit(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, audit_id: UUID, **fields) -> QmQualityAudit | None:
        row = self.get(ctx, audit_id)
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
