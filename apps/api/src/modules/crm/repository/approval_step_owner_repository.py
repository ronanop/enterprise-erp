"""Repository for crm.crm_approval_step_owner."""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models.approval_step_owner import CrmApprovalStepOwner
from modules.crm.repository.base import utcnow
from modules.foundation.domain.value_objects import TenantContext


class ApprovalStepOwnerRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_for_tenant(self, ctx: TenantContext) -> list[CrmApprovalStepOwner]:
        stmt = (
            select(CrmApprovalStepOwner)
            .where(
                CrmApprovalStepOwner.tenant_id == ctx.tenant_id,
                CrmApprovalStepOwner.is_deleted.is_(False),
            )
            .order_by(CrmApprovalStepOwner.step_key, CrmApprovalStepOwner.created_at)
        )
        return list(self._db.scalars(stmt).all())

    def list_user_ids_for_step(self, ctx: TenantContext, step_key: str) -> list[UUID]:
        stmt = select(CrmApprovalStepOwner.user_id).where(
            CrmApprovalStepOwner.tenant_id == ctx.tenant_id,
            CrmApprovalStepOwner.step_key == step_key,
            CrmApprovalStepOwner.is_deleted.is_(False),
        )
        return list(self._db.scalars(stmt).all())

    def replace_step_owners(
        self,
        ctx: TenantContext,
        step_key: str,
        user_ids: list[UUID],
    ) -> list[CrmApprovalStepOwner]:
        all_rows = list(
            self._db.scalars(
                select(CrmApprovalStepOwner).where(
                    CrmApprovalStepOwner.tenant_id == ctx.tenant_id,
                    CrmApprovalStepOwner.step_key == step_key,
                )
            ).all()
        )
        now = utcnow()
        wanted = set(user_ids)
        by_user = {row.user_id: row for row in all_rows}
        keep: dict[UUID, CrmApprovalStepOwner] = {}

        for uid, row in by_user.items():
            if uid in wanted:
                if row.is_deleted:
                    row.is_deleted = False
                    row.deleted_at = None
                    row.deleted_by = None
                    row.updated_at = now
                    row.updated_by = ctx.user_id
                keep[uid] = row
            elif not row.is_deleted:
                row.is_deleted = True
                row.deleted_at = now
                row.deleted_by = ctx.user_id
                row.updated_at = now
                row.updated_by = ctx.user_id

        created: list[CrmApprovalStepOwner] = []
        for uid in user_ids:
            if uid in keep:
                continue
            row = CrmApprovalStepOwner(
                id=uuid4(),
                tenant_id=ctx.tenant_id,
                step_key=step_key,
                user_id=uid,
                created_by=ctx.user_id,
            )
            self._db.add(row)
            created.append(row)
            keep[uid] = row

        self._db.flush()
        return [keep[uid] for uid in user_ids if uid in keep]
