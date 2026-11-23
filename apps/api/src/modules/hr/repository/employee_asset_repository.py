"""HR issued-asset repository."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.hr_employee_asset import HrEmployeeAsset
from modules.hr.repository.base import HrScopedRepository, utcnow

_ACTIVE_STATUSES = ("active", "approved", "assigned")
_REASSIGNABLE_STATUSES = ("available", "returned")


class EmployeeAssetRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, asset_id: UUID) -> HrEmployeeAsset | None:
        row = self.db.get(HrEmployeeAsset, asset_id)
        if row is None or row.is_deleted:
            return None
        return row

    def list_for_employee(
        self,
        tenant_id: UUID,
        employee_id: UUID,
        *,
        active_only: bool = False,
    ) -> list[HrEmployeeAsset]:
        stmt = select(HrEmployeeAsset).where(
            HrEmployeeAsset.tenant_id == tenant_id,
            HrEmployeeAsset.employee_id == employee_id,
            HrEmployeeAsset.is_deleted.is_(False),
        )
        if active_only:
            stmt = stmt.where(HrEmployeeAsset.status.in_(_ACTIVE_STATUSES))
        stmt = stmt.order_by(HrEmployeeAsset.assigned_at.desc().nullslast())
        return list(self.db.scalars(stmt).all())

    def list_active_for_employee(self, employee_id: UUID) -> list[HrEmployeeAsset]:
        stmt = (
            select(HrEmployeeAsset)
            .where(
                HrEmployeeAsset.employee_id == employee_id,
                HrEmployeeAsset.is_deleted.is_(False),
                HrEmployeeAsset.status.in_(_ACTIVE_STATUSES),
            )
            .order_by(HrEmployeeAsset.assigned_at.desc().nullslast())
        )
        return list(self.db.scalars(stmt).all())

    def lookup_by_code(
        self, tenant_id: UUID, company_id: UUID, code: str
    ) -> HrEmployeeAsset | None:
        raw = code.strip()
        if not raw:
            return None
        return self.db.scalar(
            select(HrEmployeeAsset).where(
                HrEmployeeAsset.tenant_id == tenant_id,
                HrEmployeeAsset.company_id == company_id,
                HrEmployeeAsset.is_deleted.is_(False),
                HrEmployeeAsset.asset_code == raw,
            )
        )

    def list_reassignable(
        self, tenant_id: UUID, branch_id: UUID | None
    ) -> list[HrEmployeeAsset]:
        stmt = select(HrEmployeeAsset).where(
            HrEmployeeAsset.tenant_id == tenant_id,
            HrEmployeeAsset.is_deleted.is_(False),
            or_(
                HrEmployeeAsset.status.in_(_REASSIGNABLE_STATUSES),
                and_(HrEmployeeAsset.status == "active", HrEmployeeAsset.employee_id.is_(None)),
            ),
        )
        if branch_id is not None:
            stmt = stmt.where(HrEmployeeAsset.branch_id == branch_id)
        return list(self.db.scalars(stmt.order_by(HrEmployeeAsset.asset_code)).all())

    def create(self, ctx: TenantContext, **fields) -> HrEmployeeAsset:
        row = HrEmployeeAsset(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def issue(
        self,
        ctx: TenantContext,
        row: HrEmployeeAsset,
        *,
        employee_id: UUID,
        branch_id: UUID,
        assigned_at: datetime,
        expected_return_at: date | None,
    ) -> HrEmployeeAsset:
        row.employee_id = employee_id
        row.branch_id = branch_id
        row.status = "active"
        row.assigned_at = assigned_at
        row.expected_return_at = expected_return_at
        row.returned_at = None
        self._touch(ctx, row)
        return row

    def mark_returned(
        self, ctx: TenantContext, row: HrEmployeeAsset, *, returned_at: datetime
    ) -> HrEmployeeAsset:
        row.status = "returned"
        row.returned_at = returned_at
        row.employee_id = None
        self._touch(ctx, row)
        return row

    def _touch(self, ctx: TenantContext, row: HrEmployeeAsset) -> None:
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
