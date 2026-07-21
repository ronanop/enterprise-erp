"""CRM CrmAttachment repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models import CrmAttachment
from modules.crm.repository.base import CrmScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class AttachmentRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmAttachment | None:
        stmt = select(CrmAttachment).where(CrmAttachment.id == row_id, CrmAttachment.is_deleted.is_(False))
        stmt = self.apply_crm_filter(stmt, CrmAttachment, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_for_entity(self, ctx: TenantContext, entity_type: str, entity_id: UUID):
        stmt = select(CrmAttachment).where(
            CrmAttachment.entity_type == entity_type,
            CrmAttachment.entity_id == entity_id,
            CrmAttachment.is_deleted.is_(False),
        )
        stmt = self.apply_crm_filter(stmt, CrmAttachment, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> CrmAttachment:
        row = CrmAttachment(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def delete(self, ctx: TenantContext, row_id: UUID) -> bool:
        row = self.get(ctx, row_id)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        self.db.flush()
        return True
