"""HR exit agreement repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models import HrExitAgreement
from modules.hr.repository.base import HrScopedRepository, utcnow


class ExitAgreementRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrExitAgreement | None:
        stmt = select(HrExitAgreement).where(
            HrExitAgreement.id == row_id,
            HrExitAgreement.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrExitAgreement, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_for_separation(
        self, ctx: TenantContext, separation_id: UUID
    ) -> list[HrExitAgreement]:
        stmt = (
            select(HrExitAgreement)
            .where(
                HrExitAgreement.separation_id == separation_id,
                HrExitAgreement.is_deleted.is_(False),
            )
            .order_by(HrExitAgreement.created_at)
        )
        stmt = self.apply_hr_filter(stmt, HrExitAgreement, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def get_by_type(
        self, ctx: TenantContext, separation_id: UUID, agreement_type: str
    ) -> HrExitAgreement | None:
        stmt = select(HrExitAgreement).where(
            HrExitAgreement.separation_id == separation_id,
            HrExitAgreement.agreement_type == agreement_type,
            HrExitAgreement.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrExitAgreement, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def create(self, ctx: TenantContext, **fields) -> HrExitAgreement:
        row = HrExitAgreement(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrExitAgreement | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for key, value in fields.items():
            if value is not None:
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
