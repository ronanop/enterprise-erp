"""CRM CrmStateHistory repository — append-only blueprint transition log."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models import CrmStateHistory
from modules.crm.repository.base import CrmScopedRepository
from modules.foundation.domain.value_objects import TenantContext


class StateHistoryRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_for_entity(self, ctx: TenantContext, entity_type: str, entity_id: UUID):
        stmt = select(CrmStateHistory).where(
            CrmStateHistory.entity_type == entity_type,
            CrmStateHistory.entity_id == entity_id,
            CrmStateHistory.is_deleted.is_(False),
        ).order_by(CrmStateHistory.performed_at)
        stmt = self.apply_crm_filter(stmt, CrmStateHistory, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def list_for_entities(self, ctx: TenantContext, entity_ids: list[UUID]):
        """All state-history rows for any of the given entity ids (any type)."""
        if not entity_ids:
            return []
        stmt = (
            select(CrmStateHistory)
            .where(
                CrmStateHistory.entity_id.in_(entity_ids),
                CrmStateHistory.is_deleted.is_(False),
            )
            .order_by(CrmStateHistory.performed_at)
        )
        stmt = self.apply_crm_filter(stmt, CrmStateHistory, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> CrmStateHistory:
        row = CrmStateHistory(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row
