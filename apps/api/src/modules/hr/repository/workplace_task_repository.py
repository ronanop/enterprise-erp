"""HR workplace task repositories."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.workplace_task import (
    HrWorkplaceTask,
    HrWorkplaceTaskAssignee,
    HrWorkplaceTaskEvent,
    HrWorkplaceTaskProof,
)
from modules.hr.repository.base import HrScopedRepository, utcnow


class WorkplaceTaskRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrWorkplaceTask | None:
        stmt = select(HrWorkplaceTask).where(
            HrWorkplaceTask.id == row_id,
            HrWorkplaceTask.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrWorkplaceTask, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_for_employee(
        self,
        ctx: TenantContext,
        *,
        employee_id: UUID,
        scope: str = "all",
        limit: int = 50,
    ) -> list[HrWorkplaceTask]:
        """scope: all | assigned | created"""
        limit = max(1, min(limit, 100))
        created_ids: set[UUID] = set()
        assigned_ids: set[UUID] = set()

        if scope in {"all", "created"}:
            stmt = select(HrWorkplaceTask.id).where(
                HrWorkplaceTask.is_deleted.is_(False),
                HrWorkplaceTask.creator_employee_id == employee_id,
            )
            stmt = self.apply_hr_filter(stmt, HrWorkplaceTask, ctx, branch_scoped=False)
            created_ids = set(self.db.scalars(stmt).all())

        if scope in {"all", "assigned"}:
            stmt = (
                select(HrWorkplaceTaskAssignee.task_id)
                .join(
                    HrWorkplaceTask,
                    HrWorkplaceTask.id == HrWorkplaceTaskAssignee.task_id,
                )
                .where(
                    HrWorkplaceTaskAssignee.employee_id == employee_id,
                    HrWorkplaceTaskAssignee.is_deleted.is_(False),
                    HrWorkplaceTask.is_deleted.is_(False),
                )
            )
            stmt = self.apply_hr_filter(
                stmt, HrWorkplaceTaskAssignee, ctx, branch_scoped=False
            )
            assigned_ids = set(self.db.scalars(stmt).all())

        ids = created_ids | assigned_ids
        if not ids:
            return []
        stmt = (
            select(HrWorkplaceTask)
            .where(
                HrWorkplaceTask.id.in_(ids),
                HrWorkplaceTask.is_deleted.is_(False),
            )
            .order_by(
                HrWorkplaceTask.created_at.desc(),
                HrWorkplaceTask.id.desc(),
            )
            .limit(limit)
        )
        stmt = self.apply_hr_filter(stmt, HrWorkplaceTask, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrWorkplaceTask:
        row = HrWorkplaceTask(
            id=fields.pop("id", None) or uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row


class WorkplaceTaskAssigneeRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrWorkplaceTaskAssignee | None:
        stmt = select(HrWorkplaceTaskAssignee).where(
            HrWorkplaceTaskAssignee.id == row_id,
            HrWorkplaceTaskAssignee.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(
            stmt, HrWorkplaceTaskAssignee, ctx, branch_scoped=False
        )
        return self.db.scalar(stmt)

    def get_for_employee(
        self, ctx: TenantContext, task_id: UUID, employee_id: UUID
    ) -> HrWorkplaceTaskAssignee | None:
        stmt = select(HrWorkplaceTaskAssignee).where(
            HrWorkplaceTaskAssignee.task_id == task_id,
            HrWorkplaceTaskAssignee.employee_id == employee_id,
            HrWorkplaceTaskAssignee.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(
            stmt, HrWorkplaceTaskAssignee, ctx, branch_scoped=False
        )
        return self.db.scalar(stmt)

    def list_for_tasks(
        self, ctx: TenantContext, task_ids: list[UUID]
    ) -> dict[UUID, list[HrWorkplaceTaskAssignee]]:
        if not task_ids:
            return {}
        stmt = (
            select(HrWorkplaceTaskAssignee)
            .where(
                HrWorkplaceTaskAssignee.task_id.in_(task_ids),
                HrWorkplaceTaskAssignee.is_deleted.is_(False),
            )
            .order_by(
                HrWorkplaceTaskAssignee.created_at.asc(),
                HrWorkplaceTaskAssignee.id.asc(),
            )
        )
        stmt = self.apply_hr_filter(
            stmt, HrWorkplaceTaskAssignee, ctx, branch_scoped=False
        )
        out: dict[UUID, list[HrWorkplaceTaskAssignee]] = {}
        for row in self.db.scalars(stmt).all():
            out.setdefault(row.task_id, []).append(row)
        return out

    def create(self, ctx: TenantContext, **fields) -> HrWorkplaceTaskAssignee:
        row = HrWorkplaceTaskAssignee(
            id=fields.pop("id", None) or uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def soft_delete(self, ctx: TenantContext, row_id: UUID) -> bool:
        row = self.get(ctx, row_id)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return True


class WorkplaceTaskEventRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_for_task(
        self, ctx: TenantContext, task_id: UUID
    ) -> list[HrWorkplaceTaskEvent]:
        stmt = (
            select(HrWorkplaceTaskEvent)
            .where(
                HrWorkplaceTaskEvent.task_id == task_id,
                HrWorkplaceTaskEvent.is_deleted.is_(False),
            )
            .order_by(
                HrWorkplaceTaskEvent.created_at.asc(),
                HrWorkplaceTaskEvent.id.asc(),
            )
        )
        stmt = self.apply_hr_filter(
            stmt, HrWorkplaceTaskEvent, ctx, branch_scoped=False
        )
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrWorkplaceTaskEvent:
        row = HrWorkplaceTaskEvent(
            id=fields.pop("id", None) or uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row


class WorkplaceTaskProofRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrWorkplaceTaskProof | None:
        stmt = select(HrWorkplaceTaskProof).where(
            HrWorkplaceTaskProof.id == row_id,
            HrWorkplaceTaskProof.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(
            stmt, HrWorkplaceTaskProof, ctx, branch_scoped=False
        )
        return self.db.scalar(stmt)

    def list_for_tasks(
        self, ctx: TenantContext, task_ids: list[UUID]
    ) -> dict[UUID, list[HrWorkplaceTaskProof]]:
        if not task_ids:
            return {}
        stmt = (
            select(HrWorkplaceTaskProof)
            .where(
                HrWorkplaceTaskProof.task_id.in_(task_ids),
                HrWorkplaceTaskProof.is_deleted.is_(False),
            )
            .order_by(
                HrWorkplaceTaskProof.created_at.asc(),
                HrWorkplaceTaskProof.id.asc(),
            )
        )
        stmt = self.apply_hr_filter(
            stmt, HrWorkplaceTaskProof, ctx, branch_scoped=False
        )
        out: dict[UUID, list[HrWorkplaceTaskProof]] = {}
        for row in self.db.scalars(stmt).all():
            out.setdefault(row.task_id, []).append(row)
        return out

    def list_for_assignee(
        self, ctx: TenantContext, assignee_id: UUID
    ) -> list[HrWorkplaceTaskProof]:
        stmt = (
            select(HrWorkplaceTaskProof)
            .where(
                HrWorkplaceTaskProof.assignee_id == assignee_id,
                HrWorkplaceTaskProof.is_deleted.is_(False),
            )
            .order_by(
                HrWorkplaceTaskProof.created_at.asc(),
                HrWorkplaceTaskProof.id.asc(),
            )
        )
        stmt = self.apply_hr_filter(
            stmt, HrWorkplaceTaskProof, ctx, branch_scoped=False
        )
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrWorkplaceTaskProof:
        row = HrWorkplaceTaskProof(
            id=fields.pop("id", None) or uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def soft_delete_for_assignee(self, ctx: TenantContext, assignee_id: UUID) -> int:
        rows = self.list_for_assignee(ctx, assignee_id)
        now = utcnow()
        for row in rows:
            row.is_deleted = True
            row.deleted_at = now
            row.updated_at = now
            row.updated_by = ctx.user_id
            if hasattr(row, "version"):
                row.version = int(row.version or 1) + 1
        if rows:
            self.db.flush()
        return len(rows)
