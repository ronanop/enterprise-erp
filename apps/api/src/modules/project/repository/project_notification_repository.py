"""Project PrjProjectNotification repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from modules.foundation.domain.value_objects import TenantContext
from modules.project.models import PrjProjectNotification
from modules.project.repository.base import PrjScopedRepository, utcnow


class ProjectNotificationRepository(PrjScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> PrjProjectNotification | None:
        stmt = select(PrjProjectNotification).where(PrjProjectNotification.id == row_id, PrjProjectNotification.is_deleted.is_(False))
        stmt = self.apply_prj_filter(stmt, PrjProjectNotification, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(PrjProjectNotification).where(
            PrjProjectNotification.company_id == company_id,
            PrjProjectNotification.is_deleted.is_(False),
        )
        stmt = self.apply_prj_filter(stmt, PrjProjectNotification, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def list_site_stage_follow_up_rows(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        created_by_user_id: UUID | None = None,
        recipient_employee_id: UUID | None = None,
    ) -> list[PrjProjectNotification]:
        stmt = (
            select(PrjProjectNotification)
            .where(
                PrjProjectNotification.company_id == company_id,
                PrjProjectNotification.is_deleted.is_(False),
                PrjProjectNotification.notification_type == "other",
            )
            .order_by(PrjProjectNotification.created_at.desc())
        )
        if created_by_user_id is not None:
            stmt = stmt.where(PrjProjectNotification.created_by == created_by_user_id)
        if recipient_employee_id is not None:
            stmt = stmt.where(
                PrjProjectNotification.recipient_employee_id == recipient_employee_id
            )
        stmt = self.apply_prj_filter(stmt, PrjProjectNotification, ctx, branch_scoped=False)
        rows = list(self.db.scalars(stmt).all())
        return [
            row
            for row in rows
            if isinstance(row.payload_json, dict)
            and row.payload_json.get("kind") == "site_stage_follow_up"
        ]

    def list_site_stage_save_alert_rows(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        recipient_user_id: UUID,
        limit: int = 50,
    ) -> list[PrjProjectNotification]:
        stmt = (
            select(PrjProjectNotification)
            .where(
                PrjProjectNotification.company_id == company_id,
                PrjProjectNotification.is_deleted.is_(False),
                PrjProjectNotification.notification_type == "other",
                PrjProjectNotification.recipient_user_id == recipient_user_id,
            )
            .order_by(PrjProjectNotification.created_at.desc())
            .limit(max(1, min(limit, 200)))
        )
        stmt = self.apply_prj_filter(stmt, PrjProjectNotification, ctx, branch_scoped=False)
        rows = list(self.db.scalars(stmt).all())
        return [
            row
            for row in rows
            if isinstance(row.payload_json, dict)
            and row.payload_json.get("kind") == "site_stage_saved"
        ]

    def list_site_follow_ups(self, ctx: TenantContext, project_id: UUID):
        stmt = (
            select(PrjProjectNotification)
            .where(
                PrjProjectNotification.project_id == project_id,
                PrjProjectNotification.is_deleted.is_(False),
                PrjProjectNotification.notification_type == "other",
            )
            .order_by(PrjProjectNotification.created_at.desc())
        )
        stmt = self.apply_prj_filter(stmt, PrjProjectNotification, ctx, branch_scoped=False)
        rows = list(self.db.scalars(stmt).all())
        return [
            row
            for row in rows
            if isinstance(row.payload_json, dict)
            and row.payload_json.get("kind") == "site_stage_follow_up"
        ]

    def create(self, ctx: TenantContext, **fields) -> PrjProjectNotification:
        row = PrjProjectNotification(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> PrjProjectNotification | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
                if k == "payload_json":
                    flag_modified(row, "payload_json")
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
