"""Journal repository."""

from uuid import UUID, uuid4

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from modules.finance.models.journal import FinJournalHeader, FinJournalLine
from modules.finance.repository.base import FinanceScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class JournalRepository(FinanceScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_journals(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        status: str | None = None,
        journal_type: str | None = None,
        period_id: UUID | None = None,
        search: str | None = None,
        sort_by: str = "journal_date",
        sort_dir: str = "desc",
    ) -> list[FinJournalHeader]:
        stmt = select(FinJournalHeader).where(FinJournalHeader.company_id == company_id)
        stmt = self.apply_finance_filter(stmt, FinJournalHeader, ctx, branch_scoped=True)
        if status:
            stmt = stmt.where(FinJournalHeader.status == status)
        if journal_type:
            stmt = stmt.where(FinJournalHeader.journal_type == journal_type)
        if period_id:
            stmt = stmt.where(FinJournalHeader.period_id == period_id)
        if search:
            q = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    FinJournalHeader.journal_number.ilike(q),
                    FinJournalHeader.description.ilike(q),
                )
            )

        sort_map = {
            "journal_date": FinJournalHeader.journal_date,
            "journal_number": FinJournalHeader.journal_number,
            "status": FinJournalHeader.status,
            "journal_type": FinJournalHeader.journal_type,
            "total_debit": FinJournalHeader.total_debit,
            "total_credit": FinJournalHeader.total_credit,
            "created_at": FinJournalHeader.created_at,
            "posted_at": FinJournalHeader.posted_at,
        }
        sort_col = sort_map.get(sort_by, FinJournalHeader.journal_date)
        order = sort_col.asc() if sort_dir.lower() == "asc" else sort_col.desc()
        return list(self.db.scalars(stmt.order_by(order)).all())

    def get_journal(self, ctx: TenantContext, journal_id: UUID) -> FinJournalHeader | None:
        stmt = (
            select(FinJournalHeader)
            .options(selectinload(FinJournalHeader.lines))
            .where(
                FinJournalHeader.id == journal_id,
                FinJournalHeader.tenant_id == ctx.tenant_id,
                FinJournalHeader.is_deleted.is_(False),
            )
        )
        return self.db.scalar(stmt)

    def get_journal_for_update(self, ctx: TenantContext, journal_id: UUID) -> FinJournalHeader | None:
        stmt = (
            select(FinJournalHeader)
            .options(selectinload(FinJournalHeader.lines))
            .where(
                FinJournalHeader.id == journal_id,
                FinJournalHeader.tenant_id == ctx.tenant_id,
                FinJournalHeader.is_deleted.is_(False),
            )
            .with_for_update()
        )
        return self.db.scalar(stmt)

    def create_journal(
        self, ctx: TenantContext, *, company_id: UUID, branch_id: UUID, **fields: object
    ) -> FinJournalHeader:
        row = FinJournalHeader(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update_journal(
        self, ctx: TenantContext, journal_id: UUID, **fields: object
    ) -> FinJournalHeader | None:
        row = self.get_journal_for_update(ctx, journal_id)
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

    def add_line(
        self, ctx: TenantContext, journal: FinJournalHeader, **fields: object
    ) -> FinJournalLine:
        row = FinJournalLine(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=journal.company_id,
            branch_id=journal.branch_id,
            journal_header_id=journal.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def get_line(self, ctx: TenantContext, line_id: UUID) -> FinJournalLine | None:
        stmt = select(FinJournalLine).where(
            FinJournalLine.id == line_id,
            FinJournalLine.tenant_id == ctx.tenant_id,
            FinJournalLine.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def update_line(self, ctx: TenantContext, line_id: UUID, **fields: object) -> FinJournalLine | None:
        row = self.get_line(ctx, line_id)
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

    def soft_delete_line(self, ctx: TenantContext, line_id: UUID) -> bool:
        row = self.get_line(ctx, line_id)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        self.db.flush()
        return True

    def count_open_journals_in_period(self, ctx: TenantContext, period_id: UUID) -> int:
        stmt = select(FinJournalHeader).where(
            FinJournalHeader.period_id == period_id,
            FinJournalHeader.tenant_id == ctx.tenant_id,
            FinJournalHeader.status.in_(("draft", "submitted", "approved")),
            FinJournalHeader.is_deleted.is_(False),
        )
        return len(list(self.db.scalars(stmt).all()))
