"""KPI + OKR repositories."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.kpi import HrKpi
from modules.hr.models.okr import HrOkr, HrOkrKeyResult
from modules.hr.repository.base import HrScopedRepository, utcnow


class KpiRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrKpi | None:
        stmt = select(HrKpi).where(HrKpi.id == row_id, HrKpi.is_deleted.is_(False))
        stmt = self.apply_hr_filter(stmt, HrKpi, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select(HrKpi).where(HrKpi.company_id == company_id, HrKpi.is_deleted.is_(False))
        stmt = self.apply_hr_filter(stmt, HrKpi, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrKpi:
        row = HrKpi(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrKpi | None:
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

    def soft_delete(self, ctx: TenantContext, row_id: UUID) -> bool:
        row = self.get(ctx, row_id)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        self.db.flush()
        return True


class OkrRepository(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> HrOkr | None:
        stmt = (
            select(HrOkr)
            .options(selectinload(HrOkr.key_results))
            .where(HrOkr.id == row_id, HrOkr.is_deleted.is_(False))
        )
        stmt = self.apply_hr_filter(stmt, HrOkr, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = (
            select(HrOkr)
            .options(selectinload(HrOkr.key_results))
            .where(HrOkr.company_id == company_id, HrOkr.is_deleted.is_(False))
        )
        stmt = self.apply_hr_filter(stmt, HrOkr, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> HrOkr:
        row = HrOkr(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> HrOkr | None:
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

    def soft_delete(self, ctx: TenantContext, row_id: UUID) -> bool:
        row = self.get(ctx, row_id)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        for kr in list(row.key_results or []):
            kr.is_deleted = True
            kr.deleted_at = utcnow()
            kr.deleted_by = ctx.user_id
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        self.db.flush()
        return True

    def add_key_result(self, ctx: TenantContext, okr: HrOkr, **fields) -> HrOkrKeyResult:
        kr = HrOkrKeyResult(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=okr.company_id,
            branch_id=okr.branch_id,
            okr_id=okr.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(kr)
        self.db.flush()
        return kr

    def get_key_result(self, ctx: TenantContext, kr_id: UUID) -> HrOkrKeyResult | None:
        stmt = select(HrOkrKeyResult).where(
            HrOkrKeyResult.id == kr_id,
            HrOkrKeyResult.is_deleted.is_(False),
        )
        stmt = self.apply_hr_filter(stmt, HrOkrKeyResult, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def update_key_result(self, ctx: TenantContext, kr_id: UUID, **fields) -> HrOkrKeyResult | None:
        kr = self.get_key_result(ctx, kr_id)
        if kr is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(kr, k, v)
        kr.updated_at = utcnow()
        kr.updated_by = ctx.user_id
        kr.version = int(kr.version or 1) + 1
        self.db.flush()
        return kr

    def soft_delete_key_result(self, ctx: TenantContext, kr_id: UUID) -> bool:
        kr = self.get_key_result(ctx, kr_id)
        if kr is None:
            return False
        kr.is_deleted = True
        kr.deleted_at = utcnow()
        kr.deleted_by = ctx.user_id
        self.db.flush()
        return True
