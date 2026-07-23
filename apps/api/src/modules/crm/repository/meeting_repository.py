"""CRM CrmMeeting repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models import CrmMeeting
from modules.crm.repository.base import CrmScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class MeetingRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmMeeting | None:
        stmt = select(CrmMeeting).where(CrmMeeting.id == row_id, CrmMeeting.is_deleted.is_(False))
        stmt = self.apply_crm_filter(stmt, CrmMeeting, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_meetings(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        company_account_id: UUID | None = None,
    ):
        stmt = select(CrmMeeting).where(
            CrmMeeting.company_id == company_id,
            CrmMeeting.is_deleted.is_(False),
        )
        if company_account_id is not None:
            stmt = stmt.where(CrmMeeting.company_account_id == company_account_id)
        stmt = self.apply_crm_filter(stmt, CrmMeeting, ctx, branch_scoped=True)
        stmt = stmt.order_by(CrmMeeting.meeting_date.desc(), CrmMeeting.start_time.desc())
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> CrmMeeting:
        row = CrmMeeting(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> CrmMeeting | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
