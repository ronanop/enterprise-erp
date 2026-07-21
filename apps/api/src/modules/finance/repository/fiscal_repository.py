"""Fiscal year and period repository."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from modules.finance.models.fiscal import FinFiscalYear, FinPeriod
from modules.finance.models.journal import FinJournalHeader
from modules.finance.repository.base import FinanceScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext

_FY_SORTABLE = {
    "fiscal_year_code": FinFiscalYear.fiscal_year_code,
    "fiscal_year_name": FinFiscalYear.fiscal_year_name,
    "start_date": FinFiscalYear.start_date,
    "end_date": FinFiscalYear.end_date,
    "status": FinFiscalYear.status,
    "created_at": FinFiscalYear.created_at,
}

_PERIOD_SORTABLE = {
    "period_number": FinPeriod.period_number,
    "period_name": FinPeriod.period_name,
    "start_date": FinPeriod.start_date,
    "end_date": FinPeriod.end_date,
    "status": FinPeriod.status,
}


class FiscalRepository(FinanceScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_fiscal_years(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        status: str | None = None,
        search: str | None = None,
        sort_by: str = "start_date",
        sort_dir: str = "desc",
    ) -> list[FinFiscalYear]:
        stmt = select(FinFiscalYear).where(FinFiscalYear.company_id == company_id)
        stmt = self.apply_finance_filter(stmt, FinFiscalYear, ctx)
        if status:
            stmt = stmt.where(FinFiscalYear.status == status)
        if search:
            q = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    FinFiscalYear.fiscal_year_code.ilike(q),
                    FinFiscalYear.fiscal_year_name.ilike(q),
                    FinFiscalYear.description.ilike(q),
                )
            )
        col = _FY_SORTABLE.get(sort_by, FinFiscalYear.start_date)
        stmt = stmt.order_by(col.desc() if sort_dir.lower() == "desc" else col.asc())
        return list(self.db.scalars(stmt).all())

    def get_fiscal_year(self, ctx: TenantContext, fiscal_year_id: UUID) -> FinFiscalYear | None:
        stmt = select(FinFiscalYear).where(
            FinFiscalYear.id == fiscal_year_id,
            FinFiscalYear.tenant_id == ctx.tenant_id,
            FinFiscalYear.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def get_open_fiscal_year(self, ctx: TenantContext, company_id: UUID) -> FinFiscalYear | None:
        stmt = select(FinFiscalYear).where(
            FinFiscalYear.company_id == company_id,
            FinFiscalYear.tenant_id == ctx.tenant_id,
            FinFiscalYear.status == "open",
            FinFiscalYear.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def get_default_fiscal_year(self, ctx: TenantContext, company_id: UUID) -> FinFiscalYear | None:
        stmt = select(FinFiscalYear).where(
            FinFiscalYear.company_id == company_id,
            FinFiscalYear.tenant_id == ctx.tenant_id,
            FinFiscalYear.is_default.is_(True),
            FinFiscalYear.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def overlapping_fiscal_year(
        self,
        ctx: TenantContext,
        company_id: UUID,
        start_date: date,
        end_date: date,
        exclude_id: UUID | None = None,
    ) -> FinFiscalYear | None:
        stmt = select(FinFiscalYear).where(
            FinFiscalYear.company_id == company_id,
            FinFiscalYear.tenant_id == ctx.tenant_id,
            FinFiscalYear.is_deleted.is_(False),
            FinFiscalYear.start_date <= end_date,
            FinFiscalYear.end_date >= start_date,
        )
        if exclude_id:
            stmt = stmt.where(FinFiscalYear.id != exclude_id)
        return self.db.scalar(stmt.limit(1))

    def create_fiscal_year(
        self, ctx: TenantContext, *, company_id: UUID, **fields: object
    ) -> FinFiscalYear:
        row = FinFiscalYear(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update_fiscal_year(
        self, ctx: TenantContext, fiscal_year_id: UUID, **fields: object
    ) -> FinFiscalYear | None:
        row = self.get_fiscal_year(ctx, fiscal_year_id)
        if row is None:
            return None
        for key, value in fields.items():
            if hasattr(row, key):
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version += 1
        self.db.flush()
        return row

    def soft_delete_fiscal_year(self, ctx: TenantContext, fiscal_year_id: UUID) -> bool:
        row = self.get_fiscal_year(ctx, fiscal_year_id)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        self.db.flush()
        return True

    def clear_default_flag(self, ctx: TenantContext, company_id: UUID, exclude_id: UUID | None = None) -> None:
        stmt = select(FinFiscalYear).where(
            FinFiscalYear.company_id == company_id,
            FinFiscalYear.tenant_id == ctx.tenant_id,
            FinFiscalYear.is_default.is_(True),
            FinFiscalYear.is_deleted.is_(False),
        )
        if exclude_id:
            stmt = stmt.where(FinFiscalYear.id != exclude_id)
        for row in self.db.scalars(stmt).all():
            row.is_default = False
        self.db.flush()

    def list_periods(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fiscal_year_id: UUID | None = None,
        status: str | None = None,
        search: str | None = None,
        sort_by: str = "period_number",
        sort_dir: str = "asc",
    ) -> list[FinPeriod]:
        stmt = select(FinPeriod).where(FinPeriod.company_id == company_id)
        stmt = self.apply_finance_filter(stmt, FinPeriod, ctx)
        if fiscal_year_id:
            stmt = stmt.where(FinPeriod.fiscal_year_id == fiscal_year_id)
        if status:
            stmt = stmt.where(FinPeriod.status == status)
        if search:
            q = f"%{search.strip()}%"
            stmt = stmt.where(or_(FinPeriod.period_name.ilike(q)))
        col = _PERIOD_SORTABLE.get(sort_by, FinPeriod.period_number)
        stmt = stmt.order_by(col.desc() if sort_dir.lower() == "desc" else col.asc())
        return list(self.db.scalars(stmt).all())

    def get_period(self, ctx: TenantContext, period_id: UUID) -> FinPeriod | None:
        stmt = select(FinPeriod).where(
            FinPeriod.id == period_id,
            FinPeriod.tenant_id == ctx.tenant_id,
            FinPeriod.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def get_period_for_update(self, ctx: TenantContext, period_id: UUID) -> FinPeriod | None:
        stmt = (
            select(FinPeriod)
            .where(
                FinPeriod.id == period_id,
                FinPeriod.tenant_id == ctx.tenant_id,
                FinPeriod.is_deleted.is_(False),
            )
            .with_for_update()
        )
        return self.db.scalar(stmt)

    def get_period_for_date(
        self, ctx: TenantContext, company_id: UUID, journal_date: date
    ) -> FinPeriod | None:
        stmt = select(FinPeriod).where(
            FinPeriod.company_id == company_id,
            FinPeriod.tenant_id == ctx.tenant_id,
            FinPeriod.start_date <= journal_date,
            FinPeriod.end_date >= journal_date,
            FinPeriod.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def get_current_period(self, ctx: TenantContext, company_id: UUID, today: date) -> FinPeriod | None:
        stmt = (
            select(FinPeriod)
            .where(
                FinPeriod.company_id == company_id,
                FinPeriod.tenant_id == ctx.tenant_id,
                FinPeriod.start_date <= today,
                FinPeriod.end_date >= today,
                FinPeriod.is_deleted.is_(False),
            )
            .order_by(FinPeriod.period_number.desc())
            .limit(1)
        )
        return self.db.scalar(stmt)

    def create_period(self, ctx: TenantContext, *, company_id: UUID, **fields: object) -> FinPeriod:
        row = FinPeriod(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update_period(self, ctx: TenantContext, period_id: UUID, **fields: object) -> FinPeriod | None:
        row = self.get_period(ctx, period_id)
        if row is None:
            return None
        for key, value in fields.items():
            if hasattr(row, key):
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version += 1
        self.db.flush()
        return row

    def count_journals_in_period(self, ctx: TenantContext, period_id: UUID) -> int:
        stmt = select(func.count()).select_from(FinJournalHeader).where(
            FinJournalHeader.period_id == period_id,
            FinJournalHeader.tenant_id == ctx.tenant_id,
            FinJournalHeader.is_deleted.is_(False),
        )
        return int(self.db.scalar(stmt) or 0)

    def count_journals_for_fiscal_year(self, ctx: TenantContext, fiscal_year_id: UUID) -> int:
        stmt = select(func.count()).select_from(FinJournalHeader).where(
            FinJournalHeader.fiscal_year_id == fiscal_year_id,
            FinJournalHeader.tenant_id == ctx.tenant_id,
            FinJournalHeader.is_deleted.is_(False),
        )
        return int(self.db.scalar(stmt) or 0)
