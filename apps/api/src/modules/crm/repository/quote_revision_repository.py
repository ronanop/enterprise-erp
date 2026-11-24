"""CRM quote revision snapshot repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models.quote import CrmQuoteRevisionSnapshot
from modules.crm.repository.base import CrmScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class QuoteRevisionRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_for_quote(self, ctx: TenantContext, quote_id: UUID) -> list[CrmQuoteRevisionSnapshot]:
        stmt = (
            select(CrmQuoteRevisionSnapshot)
            .where(
                CrmQuoteRevisionSnapshot.quote_id == quote_id,
                CrmQuoteRevisionSnapshot.is_deleted.is_(False),
            )
            .order_by(CrmQuoteRevisionSnapshot.revision_no.asc())
        )
        stmt = self.apply_crm_filter(stmt, CrmQuoteRevisionSnapshot, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def get_for_revision(
        self,
        ctx: TenantContext,
        quote_id: UUID,
        revision_no: int,
        *,
        include_deleted: bool = False,
    ) -> CrmQuoteRevisionSnapshot | None:
        stmt = select(CrmQuoteRevisionSnapshot).where(
            CrmQuoteRevisionSnapshot.quote_id == quote_id,
            CrmQuoteRevisionSnapshot.revision_no == revision_no,
        )
        if not include_deleted:
            stmt = stmt.where(CrmQuoteRevisionSnapshot.is_deleted.is_(False))
        stmt = self.apply_crm_filter(stmt, CrmQuoteRevisionSnapshot, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def soft_delete_revision(
        self, ctx: TenantContext, quote_id: UUID, revision_no: int
    ) -> bool:
        row = self.get_for_revision(ctx, quote_id, revision_no)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return True

    def create(self, ctx: TenantContext, **fields) -> CrmQuoteRevisionSnapshot:
        row = CrmQuoteRevisionSnapshot(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def upsert_snapshot(
        self,
        ctx: TenantContext,
        *,
        quote_id: UUID,
        company_id: UUID,
        branch_id: UUID,
        revision_no: int,
        avg_margin_pct,
        grand_total,
        total_margin_amount,
        remark: str | None = None,
        payload_json: dict | None = None,
    ) -> CrmQuoteRevisionSnapshot:
        existing = self.get_for_revision(ctx, quote_id, revision_no, include_deleted=True)
        if existing is not None:
            existing.is_deleted = False
            existing.deleted_at = None
            existing.deleted_by = None
            existing.avg_margin_pct = avg_margin_pct
            existing.grand_total = grand_total
            existing.total_margin_amount = total_margin_amount
            if remark is not None:
                existing.remark = remark
            if payload_json is not None:
                existing.payload_json = payload_json
            existing.updated_at = utcnow()
            existing.updated_by = ctx.user_id
            existing.version = int(existing.version or 1) + 1
            self.db.flush()
            return existing
        return self.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            quote_id=quote_id,
            revision_no=revision_no,
            avg_margin_pct=avg_margin_pct,
            grand_total=grand_total,
            total_margin_amount=total_margin_amount,
            remark=remark,
            payload_json=payload_json,
        )
