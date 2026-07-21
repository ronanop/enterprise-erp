"""Chart of accounts repository."""

from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from modules.finance.models.coa import FinAccountGroup, FinChartOfAccount
from modules.finance.models.journal import FinJournalHeader, FinJournalLine
from modules.finance.models.ledger import FinGlEntry
from modules.finance.repository.base import FinanceScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext

_SORTABLE = {
    "account_code": FinChartOfAccount.account_code,
    "account_name": FinChartOfAccount.account_name,
    "account_type": FinChartOfAccount.account_type,
    "status": FinChartOfAccount.status,
    "created_at": FinChartOfAccount.created_at,
    "currency_code": FinChartOfAccount.currency_code,
}


class COARepository(FinanceScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_account_groups(self, ctx: TenantContext, company_id: UUID) -> list[FinAccountGroup]:
        stmt = select(FinAccountGroup).where(FinAccountGroup.company_id == company_id)
        stmt = self.apply_finance_filter(stmt, FinAccountGroup, ctx)
        return list(self.db.scalars(stmt.order_by(FinAccountGroup.display_order, FinAccountGroup.group_code)).all())

    def get_account_group(self, ctx: TenantContext, group_id: UUID) -> FinAccountGroup | None:
        stmt = select(FinAccountGroup).where(
            FinAccountGroup.id == group_id,
            FinAccountGroup.tenant_id == ctx.tenant_id,
            FinAccountGroup.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def get_account_group_by_code(
        self, ctx: TenantContext, company_id: UUID, group_code: str
    ) -> FinAccountGroup | None:
        stmt = select(FinAccountGroup).where(
            FinAccountGroup.company_id == company_id,
            FinAccountGroup.group_code == group_code,
            FinAccountGroup.tenant_id == ctx.tenant_id,
            FinAccountGroup.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def create_account_group(
        self, ctx: TenantContext, *, company_id: UUID, **fields: object
    ) -> FinAccountGroup:
        row = FinAccountGroup(
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

    def list_accounts(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        status: str | None = None,
        account_type: str | None = None,
        account_group_id: UUID | None = None,
        parent_account_id: UUID | None = None,
        is_posting_account: bool | None = None,
        search: str | None = None,
        sort_by: str = "account_code",
        sort_dir: str = "asc",
    ) -> list[FinChartOfAccount]:
        stmt = select(FinChartOfAccount).where(FinChartOfAccount.company_id == company_id)
        stmt = self.apply_finance_filter(stmt, FinChartOfAccount, ctx)
        if status:
            stmt = stmt.where(FinChartOfAccount.status == status)
        if account_type:
            stmt = stmt.where(FinChartOfAccount.account_type == account_type)
        if account_group_id:
            stmt = stmt.where(FinChartOfAccount.account_group_id == account_group_id)
        if parent_account_id is not None:
            stmt = stmt.where(FinChartOfAccount.parent_account_id == parent_account_id)
        if is_posting_account is not None:
            stmt = stmt.where(FinChartOfAccount.is_posting_account.is_(is_posting_account))
        if search:
            q = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    FinChartOfAccount.account_code.ilike(q),
                    FinChartOfAccount.account_name.ilike(q),
                    FinChartOfAccount.description.ilike(q),
                )
            )
        col = _SORTABLE.get(sort_by, FinChartOfAccount.account_code)
        stmt = stmt.order_by(col.desc() if sort_dir.lower() == "desc" else col.asc())
        return list(self.db.scalars(stmt).all())

    def get_account(self, ctx: TenantContext, account_id: UUID) -> FinChartOfAccount | None:
        stmt = select(FinChartOfAccount).where(
            FinChartOfAccount.id == account_id,
            FinChartOfAccount.tenant_id == ctx.tenant_id,
            FinChartOfAccount.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def get_account_by_code(
        self, ctx: TenantContext, company_id: UUID, account_code: str
    ) -> FinChartOfAccount | None:
        stmt = select(FinChartOfAccount).where(
            FinChartOfAccount.company_id == company_id,
            FinChartOfAccount.account_code == account_code,
            FinChartOfAccount.tenant_id == ctx.tenant_id,
            FinChartOfAccount.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def get_account_for_update(self, ctx: TenantContext, account_id: UUID) -> FinChartOfAccount | None:
        stmt = (
            select(FinChartOfAccount)
            .where(
                FinChartOfAccount.id == account_id,
                FinChartOfAccount.tenant_id == ctx.tenant_id,
                FinChartOfAccount.is_deleted.is_(False),
            )
            .with_for_update()
        )
        return self.db.scalar(stmt)

    def list_children(self, ctx: TenantContext, parent_account_id: UUID) -> list[FinChartOfAccount]:
        stmt = select(FinChartOfAccount).where(
            FinChartOfAccount.parent_account_id == parent_account_id,
            FinChartOfAccount.tenant_id == ctx.tenant_id,
            FinChartOfAccount.is_deleted.is_(False),
        )
        return list(self.db.scalars(stmt.order_by(FinChartOfAccount.account_code)).all())

    def count_children(self, ctx: TenantContext, parent_account_id: UUID) -> int:
        stmt = select(func.count()).select_from(FinChartOfAccount).where(
            FinChartOfAccount.parent_account_id == parent_account_id,
            FinChartOfAccount.tenant_id == ctx.tenant_id,
            FinChartOfAccount.is_deleted.is_(False),
        )
        return int(self.db.scalar(stmt) or 0)

    def create_account(
        self, ctx: TenantContext, *, company_id: UUID, **fields: object
    ) -> FinChartOfAccount:
        row = FinChartOfAccount(
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

    def update_account(
        self, ctx: TenantContext, account_id: UUID, **fields: object
    ) -> FinChartOfAccount | None:
        row = self.get_account(ctx, account_id)
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

    def soft_delete_account(self, ctx: TenantContext, account_id: UUID) -> bool:
        row = self.get_account(ctx, account_id)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        self.db.flush()
        return True

    def account_balances(self, ctx: TenantContext, company_id: UUID) -> dict[UUID, tuple[float, float]]:
        stmt = (
            select(
                FinGlEntry.account_id,
                func.coalesce(func.sum(FinGlEntry.base_debit_amount), 0),
                func.coalesce(func.sum(FinGlEntry.base_credit_amount), 0),
            )
            .where(
                FinGlEntry.company_id == company_id,
                FinGlEntry.tenant_id == ctx.tenant_id,
            )
            .group_by(FinGlEntry.account_id)
        )
        if ctx.branch_id and ctx.user_type not in {"super_admin", "tenant_admin"}:
            stmt = stmt.where(FinGlEntry.branch_id == ctx.branch_id)
        rows = self.db.execute(stmt).all()
        return {row[0]: (float(row[1]), float(row[2])) for row in rows}

    def account_balance(self, ctx: TenantContext, company_id: UUID, account_id: UUID) -> tuple[float, float]:
        balances = self.account_balances(ctx, company_id)
        return balances.get(account_id, (0.0, 0.0))

    def related_journals(
        self, ctx: TenantContext, account_id: UUID, *, limit: int = 25
    ) -> list[FinJournalHeader]:
        stmt = (
            select(FinJournalHeader)
            .join(FinJournalLine, FinJournalLine.journal_header_id == FinJournalHeader.id)
            .where(
                FinJournalLine.account_id == account_id,
                FinJournalLine.is_deleted.is_(False),
                FinJournalHeader.tenant_id == ctx.tenant_id,
                FinJournalHeader.is_deleted.is_(False),
            )
            .order_by(FinJournalHeader.journal_date.desc(), FinJournalHeader.journal_number.desc())
            .limit(limit)
            .distinct()
        )
        return list(self.db.scalars(stmt).all())
