"""CRM CrmApprovalTask (My Jobs) repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models import CrmApprovalTask
from modules.crm.repository.base import CrmScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class ApprovalTaskRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmApprovalTask | None:
        stmt = select(CrmApprovalTask).where(
            CrmApprovalTask.id == row_id, CrmApprovalTask.is_deleted.is_(False)
        )
        stmt = self.apply_crm_filter(stmt, CrmApprovalTask, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_tasks(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        team_role: str | None = None,
        status: str | None = None,
        assigned_user_id: UUID | None = None,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
    ):
        stmt = select(CrmApprovalTask).where(
            CrmApprovalTask.company_id == company_id,
            CrmApprovalTask.is_deleted.is_(False),
        )
        if team_role is not None:
            stmt = stmt.where(CrmApprovalTask.team_role == team_role)
        if status is not None:
            stmt = stmt.where(CrmApprovalTask.status == status)
        if assigned_user_id is not None:
            stmt = stmt.where(CrmApprovalTask.assigned_user_id == assigned_user_id)
        if entity_type is not None:
            stmt = stmt.where(CrmApprovalTask.entity_type == entity_type)
        if entity_id is not None:
            stmt = stmt.where(CrmApprovalTask.entity_id == entity_id)
        stmt = stmt.order_by(CrmApprovalTask.created_at.desc())
        stmt = self.apply_crm_filter(stmt, CrmApprovalTask, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def find_open_for_entity(self, ctx: TenantContext, entity_type: str, entity_id: UUID) -> CrmApprovalTask | None:
        stmt = select(CrmApprovalTask).where(
            CrmApprovalTask.entity_type == entity_type,
            CrmApprovalTask.entity_id == entity_id,
            CrmApprovalTask.status == "pending",
            CrmApprovalTask.is_deleted.is_(False),
        )
        stmt = self.apply_crm_filter(stmt, CrmApprovalTask, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_for_entity_ids(self, ctx: TenantContext, company_id: UUID, entity_ids: list[UUID]):
        if not entity_ids:
            return []
        stmt = (
            select(CrmApprovalTask)
            .where(
                CrmApprovalTask.company_id == company_id,
                CrmApprovalTask.entity_id.in_(entity_ids),
                CrmApprovalTask.is_deleted.is_(False),
            )
            .order_by(CrmApprovalTask.created_at)
        )
        stmt = self.apply_crm_filter(stmt, CrmApprovalTask, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> CrmApprovalTask:
        row = CrmApprovalTask(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> CrmApprovalTask | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        self.db.flush()
        return row
