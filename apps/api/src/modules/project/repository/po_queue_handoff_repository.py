"""PO queue handoff repository."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select

from modules.foundation.domain.value_objects import TenantContext
from modules.project.models.po_queue_handoff import PrjPoQueueHandoff
from modules.project.repository.base import PrjScopedRepository, utcnow


class PoQueueHandoffRepository(PrjScopedRepository):
    def list_active(self, ctx: TenantContext, company_id: UUID) -> list[PrjPoQueueHandoff]:
        stmt = (
            select(PrjPoQueueHandoff)
            .where(
                PrjPoQueueHandoff.company_id == company_id,
                PrjPoQueueHandoff.is_deleted.is_(False),
            )
            .order_by(PrjPoQueueHandoff.shared_at.desc())
        )
        return list(
            self.db.scalars(
                self.apply_prj_filter(stmt, PrjPoQueueHandoff, ctx, branch_scoped=True)
            ).all()
        )

    def get_by_order_id(
        self, ctx: TenantContext, proc_order_id: UUID
    ) -> PrjPoQueueHandoff | None:
        stmt = select(PrjPoQueueHandoff).where(
            PrjPoQueueHandoff.proc_order_id == proc_order_id,
            PrjPoQueueHandoff.is_deleted.is_(False),
        )
        return self.db.scalar(
            self.apply_prj_filter(stmt, PrjPoQueueHandoff, ctx, branch_scoped=True)
        )

    def upsert(self, ctx: TenantContext, **fields) -> PrjPoQueueHandoff:
        proc_order_id = fields["proc_order_id"]
        existing = self.get_by_order_id(ctx, proc_order_id)
        if existing is not None:
            for key, value in fields.items():
                if key != "proc_order_id":
                    setattr(existing, key, value)
            existing.updated_at = utcnow()
            existing.updated_by = ctx.user_id
            existing.version = int(existing.version or 1) + 1
            self.db.flush()
            return existing

        row = PrjPoQueueHandoff(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def soft_delete_by_order_id(self, ctx: TenantContext, proc_order_id: UUID) -> None:
        row = self.get_by_order_id(ctx, proc_order_id)
        if row is None:
            return
        row.is_deleted = True
        row.deleted_at = datetime.now(timezone.utc)
        row.deleted_by = ctx.user_id
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        self.db.flush()
