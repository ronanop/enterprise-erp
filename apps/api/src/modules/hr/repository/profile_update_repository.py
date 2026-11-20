"""Profile detail-update request repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.profile_update_request import HrProfileUpdateRequest
from modules.hr.repository.base import HrScopedRepository, utcnow


class ProfileUpdateRequestRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrProfileUpdateRequest | None:
        stmt = select(HrProfileUpdateRequest).where(
            HrProfileUpdateRequest.id == row_id,
            HrProfileUpdateRequest.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrProfileUpdateRequest, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID | None):
        stmt = select(HrProfileUpdateRequest).where(
            HrProfileUpdateRequest.is_deleted.is_(False)
        )
        if company_id is not None:
            stmt = stmt.where(HrProfileUpdateRequest.company_id == company_id)
        stmt = self.apply_hr_filter(stmt, HrProfileUpdateRequest, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def list_for_employee(
        self, ctx: TenantContext, *, company_id: UUID, employee_id: UUID
    ) -> list[HrProfileUpdateRequest]:
        stmt = select(HrProfileUpdateRequest).where(
            HrProfileUpdateRequest.is_deleted.is_(False),
            HrProfileUpdateRequest.company_id == company_id,
            HrProfileUpdateRequest.employee_id == employee_id,
        )
        stmt = self.apply_hr_filter(stmt, HrProfileUpdateRequest, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def find_pending_for_employee(
        self, ctx: TenantContext, *, company_id: UUID, employee_id: UUID
    ) -> HrProfileUpdateRequest | None:
        stmt = select(HrProfileUpdateRequest).where(
            HrProfileUpdateRequest.is_deleted.is_(False),
            HrProfileUpdateRequest.company_id == company_id,
            HrProfileUpdateRequest.employee_id == employee_id,
            HrProfileUpdateRequest.status == "submitted",
        )
        stmt = self.apply_hr_filter(stmt, HrProfileUpdateRequest, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def create(self, ctx: TenantContext, **fields) -> HrProfileUpdateRequest:
        row = HrProfileUpdateRequest(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(
        self, ctx: TenantContext, row_id: UUID, **fields
    ) -> HrProfileUpdateRequest | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
