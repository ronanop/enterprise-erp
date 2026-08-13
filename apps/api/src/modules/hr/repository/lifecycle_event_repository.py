"""HR HrLifecycleEvent repository."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.lifecycle_event import HrLifecycleEvent
from modules.hr.repository.base import HrScopedRepository, utcnow


class LifecycleEventRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_for_employee(self, ctx: TenantContext, employee_id: UUID):
        stmt = (
            select(HrLifecycleEvent)
            .where(
                HrLifecycleEvent.employee_id == employee_id,
                HrLifecycleEvent.is_deleted.is_(False),
            )
            .order_by(HrLifecycleEvent.event_at.desc())
        )
        stmt = self.apply_hr_filter(stmt, HrLifecycleEvent, ctx, branch_scoped=False)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrLifecycleEvent:
        row = HrLifecycleEvent(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            event_at=fields.pop("event_at", datetime.now(timezone.utc)),
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row
