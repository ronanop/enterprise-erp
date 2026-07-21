"""General ledger repository — read and post only."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from modules.finance.models.coa import FinChartOfAccount
from modules.finance.models.fiscal import FinFiscalYear, FinPeriod
from modules.finance.models.journal import FinJournalHeader
from modules.finance.models.ledger import FinGlEntry
from modules.finance.repository.base import FinanceScopedRepository
from modules.foundation.domain.value_objects import TenantContext

_SORTABLE = {
    "entry_date": FinGlEntry.entry_date,
    "entry_number": FinGlEntry.entry_number,
    "account_code": FinGlEntry.account_code,
    "debit_amount": FinGlEntry.base_debit_amount,
    "credit_amount": FinGlEntry.base_credit_amount,
    "posted_at": FinGlEntry.posted_at,
}


class GLRepository(FinanceScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_entries(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        account_id: UUID | None = None,
        period_id: UUID | None = None,
        fiscal_year_id: UUID | None = None,
        branch_id: UUID | None = None,
        cost_center_id: UUID | None = None,
        currency_code: str | None = None,
        journal_status: str | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        search: str | None = None,
        sort_by: str = "entry_date",
        sort_dir: str = "asc",
    ) -> list[FinGlEntry]:
        stmt = select(FinGlEntry).where(FinGlEntry.company_id == company_id)
        stmt = self.apply_finance_filter(stmt, FinGlEntry, ctx, branch_scoped=True)
        if account_id:
            stmt = stmt.where(FinGlEntry.account_id == account_id)
        if period_id:
            stmt = stmt.where(FinGlEntry.period_id == period_id)
        if fiscal_year_id:
            stmt = stmt.where(FinGlEntry.fiscal_year_id == fiscal_year_id)
        if branch_id:
            stmt = stmt.where(FinGlEntry.branch_id == branch_id)
        if cost_center_id:
            stmt = stmt.where(FinGlEntry.cost_center_id == cost_center_id)
        if currency_code:
            stmt = stmt.where(FinGlEntry.currency_code == currency_code)
        if from_date:
            stmt = stmt.where(FinGlEntry.entry_date >= from_date)
        if to_date:
            stmt = stmt.where(FinGlEntry.entry_date <= to_date)
        if journal_status:
            stmt = stmt.join(
                FinJournalHeader, FinJournalHeader.id == FinGlEntry.journal_header_id
            ).where(FinJournalHeader.status == journal_status)
        if search:
            q = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    FinGlEntry.entry_number.ilike(q),
                    FinGlEntry.account_code.ilike(q),
                    FinGlEntry.description.ilike(q),
                )
            )
        col = _SORTABLE.get(sort_by, FinGlEntry.entry_date)
        order = col.desc() if sort_dir.lower() == "desc" else col.asc()
        stmt = stmt.order_by(order, FinGlEntry.entry_number.asc())
        return list(self.db.scalars(stmt).all())

    def get_entry(self, ctx: TenantContext, entry_id: UUID) -> FinGlEntry | None:
        stmt = select(FinGlEntry).where(
            FinGlEntry.id == entry_id,
            FinGlEntry.tenant_id == ctx.tenant_id,
        )
        return self.db.scalar(stmt)

    def exists_for_journal(self, journal_header_id: UUID) -> bool:
        stmt = select(FinGlEntry.id).where(FinGlEntry.journal_header_id == journal_header_id).limit(1)
        return self.db.scalar(stmt) is not None

    def list_entries_for_journal(self, ctx: TenantContext, journal_header_id: UUID) -> list[FinGlEntry]:
        stmt = select(FinGlEntry).where(
            FinGlEntry.journal_header_id == journal_header_id,
            FinGlEntry.tenant_id == ctx.tenant_id,
        )
        return list(self.db.scalars(stmt.order_by(FinGlEntry.entry_number)).all())

    def create_entry(self, ctx: TenantContext, **fields: object) -> FinGlEntry:
        row = FinGlEntry(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def trial_balance(
        self,
        ctx: TenantContext,
        company_id: UUID,
        period_id: UUID,
    ) -> list[tuple[UUID, str, float, float]]:
        stmt = (
            select(
                FinGlEntry.account_id,
                FinGlEntry.account_code,
                func.coalesce(func.sum(FinGlEntry.base_debit_amount), 0),
                func.coalesce(func.sum(FinGlEntry.base_credit_amount), 0),
            )
            .where(
                FinGlEntry.company_id == company_id,
                FinGlEntry.tenant_id == ctx.tenant_id,
                FinGlEntry.period_id == period_id,
            )
            .group_by(FinGlEntry.account_id, FinGlEntry.account_code)
        )
        if ctx.branch_id and ctx.user_type not in {"super_admin", "tenant_admin"}:
            stmt = stmt.where(FinGlEntry.branch_id == ctx.branch_id)
        return list(self.db.execute(stmt).all())  # type: ignore[arg-type]

    def aggregate_totals(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
        period_id: UUID | None = None,
        fiscal_year_id: UUID | None = None,
    ) -> tuple[float, float, int]:
        stmt = select(
            func.coalesce(func.sum(FinGlEntry.base_debit_amount), 0),
            func.coalesce(func.sum(FinGlEntry.base_credit_amount), 0),
            func.count(FinGlEntry.id),
        ).where(
            FinGlEntry.company_id == company_id,
            FinGlEntry.tenant_id == ctx.tenant_id,
        )
        if ctx.branch_id and ctx.user_type not in {"super_admin", "tenant_admin"}:
            stmt = stmt.where(FinGlEntry.branch_id == ctx.branch_id)
        if from_date:
            stmt = stmt.where(FinGlEntry.entry_date >= from_date)
        if to_date:
            stmt = stmt.where(FinGlEntry.entry_date <= to_date)
        if period_id:
            stmt = stmt.where(FinGlEntry.period_id == period_id)
        if fiscal_year_id:
            stmt = stmt.where(FinGlEntry.fiscal_year_id == fiscal_year_id)
        row = self.db.execute(stmt).one()
        return float(row[0]), float(row[1]), int(row[2])

    def distinct_account_count(self, ctx: TenantContext, company_id: UUID) -> int:
        stmt = select(func.count(func.distinct(FinGlEntry.account_id))).where(
            FinGlEntry.company_id == company_id,
            FinGlEntry.tenant_id == ctx.tenant_id,
        )
        if ctx.branch_id and ctx.user_type not in {"super_admin", "tenant_admin"}:
            stmt = stmt.where(FinGlEntry.branch_id == ctx.branch_id)
        return int(self.db.scalar(stmt) or 0)

    def get_journal(self, ctx: TenantContext, journal_id: UUID) -> FinJournalHeader | None:
        stmt = select(FinJournalHeader).where(
            FinJournalHeader.id == journal_id,
            FinJournalHeader.tenant_id == ctx.tenant_id,
            FinJournalHeader.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def get_account(self, ctx: TenantContext, account_id: UUID) -> FinChartOfAccount | None:
        stmt = select(FinChartOfAccount).where(
            FinChartOfAccount.id == account_id,
            FinChartOfAccount.tenant_id == ctx.tenant_id,
            FinChartOfAccount.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def get_period(self, ctx: TenantContext, period_id: UUID) -> FinPeriod | None:
        stmt = select(FinPeriod).where(
            FinPeriod.id == period_id,
            FinPeriod.tenant_id == ctx.tenant_id,
            FinPeriod.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def get_fiscal_year(self, ctx: TenantContext, fiscal_year_id: UUID) -> FinFiscalYear | None:
        stmt = select(FinFiscalYear).where(
            FinFiscalYear.id == fiscal_year_id,
            FinFiscalYear.tenant_id == ctx.tenant_id,
            FinFiscalYear.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def account_balance_before(
        self, ctx: TenantContext, company_id: UUID, account_id: UUID, before_date: date
    ) -> tuple[float, float]:
        stmt = select(
            func.coalesce(func.sum(FinGlEntry.base_debit_amount), 0),
            func.coalesce(func.sum(FinGlEntry.base_credit_amount), 0),
        ).where(
            FinGlEntry.company_id == company_id,
            FinGlEntry.tenant_id == ctx.tenant_id,
            FinGlEntry.account_id == account_id,
            FinGlEntry.entry_date < before_date,
        )
        if ctx.branch_id and ctx.user_type not in {"super_admin", "tenant_admin"}:
            stmt = stmt.where(FinGlEntry.branch_id == ctx.branch_id)
        row = self.db.execute(stmt).one()
        return float(row[0]), float(row[1])
