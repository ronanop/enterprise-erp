"""AR/AP sub-ledger repository."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from modules.finance.models.ledger import FinCustomerLedger, FinVendorLedger
from modules.finance.repository.base import FinanceScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.models.party import MasterCustomer, MasterVendor


class SubLedgerRepository(FinanceScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_customer_ledger(
        self,
        ctx: TenantContext,
        company_id: UUID,
        customer_id: UUID | None = None,
        *,
        document_type: str | None = None,
        status: str | None = None,
        workflow_status: str | None = None,
        currency_code: str | None = None,
        search: str | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        due_from: date | None = None,
        due_to: date | None = None,
        overdue_only: bool = False,
        as_of: date | None = None,
        sort_by: str = "document_date",
        sort_dir: str = "desc",
    ) -> list[FinCustomerLedger]:
        stmt = select(FinCustomerLedger).where(FinCustomerLedger.company_id == company_id)
        stmt = self.apply_finance_filter(stmt, FinCustomerLedger, ctx, branch_scoped=True)
        if customer_id:
            stmt = stmt.where(FinCustomerLedger.customer_id == customer_id)
        if document_type:
            stmt = stmt.where(FinCustomerLedger.document_type == document_type)
        if status:
            stmt = stmt.where(FinCustomerLedger.status == status)
        if workflow_status:
            stmt = stmt.where(FinCustomerLedger.workflow_status == workflow_status)
        if currency_code:
            stmt = stmt.where(FinCustomerLedger.currency_code == currency_code)
        if from_date:
            stmt = stmt.where(FinCustomerLedger.document_date >= from_date)
        if to_date:
            stmt = stmt.where(FinCustomerLedger.document_date <= to_date)
        if due_from:
            stmt = stmt.where(FinCustomerLedger.due_date >= due_from)
        if due_to:
            stmt = stmt.where(FinCustomerLedger.due_date <= due_to)
        if overdue_only:
            cutoff = as_of or date.today()
            stmt = stmt.where(
                FinCustomerLedger.status.in_(("open", "partial")),
                FinCustomerLedger.due_date < cutoff,
                FinCustomerLedger.balance_amount > 0,
            )
        if search:
            q = f"%{search.strip()}%"
            customer_ids = select(MasterCustomer.id).where(
                MasterCustomer.tenant_id == ctx.tenant_id,
                MasterCustomer.is_deleted.is_(False),
                or_(
                    MasterCustomer.customer_code.ilike(q),
                    MasterCustomer.customer_name.ilike(q),
                ),
            )
            stmt = stmt.where(
                or_(
                    FinCustomerLedger.document_number.ilike(q),
                    FinCustomerLedger.document_type.ilike(q),
                    FinCustomerLedger.customer_id.in_(customer_ids),
                )
            )

        sort_map = {
            "document_date": FinCustomerLedger.document_date,
            "due_date": FinCustomerLedger.due_date,
            "document_number": FinCustomerLedger.document_number,
            "balance_amount": FinCustomerLedger.balance_amount,
            "debit_amount": FinCustomerLedger.debit_amount,
            "credit_amount": FinCustomerLedger.credit_amount,
            "status": FinCustomerLedger.status,
            "created_at": FinCustomerLedger.created_at,
        }
        col = sort_map.get(sort_by, FinCustomerLedger.document_date)
        stmt = stmt.order_by(col.asc() if sort_dir.lower() == "asc" else col.desc())
        return list(self.db.scalars(stmt).all())

    def get_customer_entry(self, ctx: TenantContext, entry_id: UUID) -> FinCustomerLedger | None:
        stmt = select(FinCustomerLedger).where(
            FinCustomerLedger.id == entry_id,
            FinCustomerLedger.tenant_id == ctx.tenant_id,
            FinCustomerLedger.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def get_customer_map(self, ctx: TenantContext, customer_ids: list[UUID]) -> dict[UUID, MasterCustomer]:
        if not customer_ids:
            return {}
        stmt = select(MasterCustomer).where(
            MasterCustomer.tenant_id == ctx.tenant_id,
            MasterCustomer.id.in_(customer_ids),
            MasterCustomer.is_deleted.is_(False),
        )
        rows = list(self.db.scalars(stmt).all())
        return {r.id: r for r in rows}

    def create_customer_entry(
        self, ctx: TenantContext, *, company_id: UUID, branch_id: UUID, **fields: object
    ) -> FinCustomerLedger:
        row = FinCustomerLedger(
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

    def update_customer_entry(
        self, ctx: TenantContext, entry_id: UUID, **fields: object
    ) -> FinCustomerLedger | None:
        row = self.get_customer_entry(ctx, entry_id)
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

    def list_payments_for_invoice(self, ctx: TenantContext, invoice_id: UUID) -> list[FinCustomerLedger]:
        stmt = select(FinCustomerLedger).where(
            FinCustomerLedger.tenant_id == ctx.tenant_id,
            FinCustomerLedger.is_deleted.is_(False),
            FinCustomerLedger.source_document_id == invoice_id,
            FinCustomerLedger.document_type.in_(("payment", "allocation", "receipt")),
        )
        stmt = stmt.order_by(FinCustomerLedger.document_date.asc(), FinCustomerLedger.created_at.asc())
        return list(self.db.scalars(stmt).all())

    def list_vendor_ledger(
        self,
        ctx: TenantContext,
        company_id: UUID,
        vendor_id: UUID | None = None,
        *,
        document_type: str | None = None,
        status: str | None = None,
        workflow_status: str | None = None,
        currency_code: str | None = None,
        search: str | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        due_from: date | None = None,
        due_to: date | None = None,
        overdue_only: bool = False,
        as_of: date | None = None,
        sort_by: str = "document_date",
        sort_dir: str = "desc",
    ) -> list[FinVendorLedger]:
        stmt = select(FinVendorLedger).where(FinVendorLedger.company_id == company_id)
        stmt = self.apply_finance_filter(stmt, FinVendorLedger, ctx, branch_scoped=True)
        if vendor_id:
            stmt = stmt.where(FinVendorLedger.vendor_id == vendor_id)
        if document_type:
            stmt = stmt.where(FinVendorLedger.document_type == document_type)
        if status:
            stmt = stmt.where(FinVendorLedger.status == status)
        if workflow_status:
            stmt = stmt.where(FinVendorLedger.workflow_status == workflow_status)
        if currency_code:
            stmt = stmt.where(FinVendorLedger.currency_code == currency_code)
        if from_date:
            stmt = stmt.where(FinVendorLedger.document_date >= from_date)
        if to_date:
            stmt = stmt.where(FinVendorLedger.document_date <= to_date)
        if due_from:
            stmt = stmt.where(FinVendorLedger.due_date >= due_from)
        if due_to:
            stmt = stmt.where(FinVendorLedger.due_date <= due_to)
        if overdue_only:
            cutoff = as_of or date.today()
            stmt = stmt.where(
                FinVendorLedger.status.in_(("open", "partial")),
                FinVendorLedger.due_date < cutoff,
                FinVendorLedger.balance_amount > 0,
            )
        if search:
            q = f"%{search.strip()}%"
            vendor_ids = select(MasterVendor.id).where(
                MasterVendor.tenant_id == ctx.tenant_id,
                MasterVendor.is_deleted.is_(False),
                or_(
                    MasterVendor.vendor_code.ilike(q),
                    MasterVendor.vendor_name.ilike(q),
                ),
            )
            stmt = stmt.where(
                or_(
                    FinVendorLedger.document_number.ilike(q),
                    FinVendorLedger.document_type.ilike(q),
                    FinVendorLedger.vendor_id.in_(vendor_ids),
                )
            )

        sort_map = {
            "document_date": FinVendorLedger.document_date,
            "due_date": FinVendorLedger.due_date,
            "document_number": FinVendorLedger.document_number,
            "balance_amount": FinVendorLedger.balance_amount,
            "debit_amount": FinVendorLedger.debit_amount,
            "credit_amount": FinVendorLedger.credit_amount,
            "status": FinVendorLedger.status,
            "created_at": FinVendorLedger.created_at,
        }
        col = sort_map.get(sort_by, FinVendorLedger.document_date)
        stmt = stmt.order_by(col.asc() if sort_dir.lower() == "asc" else col.desc())
        return list(self.db.scalars(stmt).all())

    def get_vendor_entry(self, ctx: TenantContext, entry_id: UUID) -> FinVendorLedger | None:
        stmt = select(FinVendorLedger).where(
            FinVendorLedger.id == entry_id,
            FinVendorLedger.tenant_id == ctx.tenant_id,
            FinVendorLedger.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def get_vendor_map(self, ctx: TenantContext, vendor_ids: list[UUID]) -> dict[UUID, MasterVendor]:
        if not vendor_ids:
            return {}
        stmt = select(MasterVendor).where(
            MasterVendor.tenant_id == ctx.tenant_id,
            MasterVendor.id.in_(vendor_ids),
            MasterVendor.is_deleted.is_(False),
        )
        rows = list(self.db.scalars(stmt).all())
        return {r.id: r for r in rows}

    def create_vendor_entry(
        self, ctx: TenantContext, *, company_id: UUID, branch_id: UUID, **fields: object
    ) -> FinVendorLedger:
        row = FinVendorLedger(
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

    def update_vendor_entry(
        self, ctx: TenantContext, entry_id: UUID, **fields: object
    ) -> FinVendorLedger | None:
        row = self.get_vendor_entry(ctx, entry_id)
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

    def list_payments_for_ap_invoice(self, ctx: TenantContext, invoice_id: UUID) -> list[FinVendorLedger]:
        stmt = select(FinVendorLedger).where(
            FinVendorLedger.tenant_id == ctx.tenant_id,
            FinVendorLedger.is_deleted.is_(False),
            FinVendorLedger.source_document_id == invoice_id,
            FinVendorLedger.document_type.in_(("payment", "allocation")),
        )
        stmt = stmt.order_by(FinVendorLedger.document_date.asc(), FinVendorLedger.created_at.asc())
        return list(self.db.scalars(stmt).all())

    def list_open_ar_for_aging(self, ctx: TenantContext, company_id: UUID) -> list[FinCustomerLedger]:
        stmt = select(FinCustomerLedger).where(
            FinCustomerLedger.company_id == company_id,
            FinCustomerLedger.tenant_id == ctx.tenant_id,
            FinCustomerLedger.status.in_(("open", "partial")),
            FinCustomerLedger.is_deleted.is_(False),
            FinCustomerLedger.balance_amount > 0,
            or_(
                FinCustomerLedger.document_type.in_(("invoice", "debit_note")),
                and_(
                    FinCustomerLedger.document_type.notin_(("payment", "receipt", "allocation")),
                    FinCustomerLedger.debit_amount > 0,
                ),
            ),
        )
        return list(self.db.scalars(stmt).all())

    def list_open_ap_for_aging(self, ctx: TenantContext, company_id: UUID) -> list[FinVendorLedger]:
        stmt = select(FinVendorLedger).where(
            FinVendorLedger.company_id == company_id,
            FinVendorLedger.tenant_id == ctx.tenant_id,
            FinVendorLedger.status.in_(("open", "partial")),
            FinVendorLedger.is_deleted.is_(False),
            FinVendorLedger.balance_amount > 0,
            or_(
                FinVendorLedger.document_type.in_(("invoice", "credit_note")),
                and_(
                    FinVendorLedger.document_type.notin_(("payment", "allocation")),
                    FinVendorLedger.credit_amount > 0,
                ),
            ),
        )
        return list(self.db.scalars(stmt).all())

    def ar_aggregate_stats(self, ctx: TenantContext, company_id: UUID) -> dict:
        today = date.today()
        month_start = today.replace(day=1)

        base = and_(
            FinCustomerLedger.company_id == company_id,
            FinCustomerLedger.tenant_id == ctx.tenant_id,
            FinCustomerLedger.is_deleted.is_(False),
        )

        outstanding = self.db.scalar(
            select(func.coalesce(func.sum(FinCustomerLedger.balance_amount), 0)).where(
                base,
                FinCustomerLedger.status.in_(("open", "partial")),
                FinCustomerLedger.balance_amount > 0,
                FinCustomerLedger.document_type.in_(("invoice", "debit_note")),
            )
        ) or 0

        collected_today = self.db.scalar(
            select(func.coalesce(func.sum(FinCustomerLedger.credit_amount), 0)).where(
                base,
                FinCustomerLedger.document_type.in_(("payment", "receipt", "allocation")),
                FinCustomerLedger.document_date == today,
                FinCustomerLedger.status != "cancelled",
            )
        ) or 0

        month_collections = self.db.scalar(
            select(func.coalesce(func.sum(FinCustomerLedger.credit_amount), 0)).where(
                base,
                FinCustomerLedger.document_type.in_(("payment", "receipt", "allocation")),
                FinCustomerLedger.document_date >= month_start,
                FinCustomerLedger.document_date <= today,
                FinCustomerLedger.status != "cancelled",
            )
        ) or 0

        overdue_count = self.db.scalar(
            select(func.count()).where(
                base,
                FinCustomerLedger.status.in_(("open", "partial")),
                FinCustomerLedger.due_date < today,
                FinCustomerLedger.balance_amount > 0,
                FinCustomerLedger.document_type.in_(("invoice", "debit_note")),
            )
        ) or 0

        overdue_amount = self.db.scalar(
            select(func.coalesce(func.sum(FinCustomerLedger.balance_amount), 0)).where(
                base,
                FinCustomerLedger.status.in_(("open", "partial")),
                FinCustomerLedger.due_date < today,
                FinCustomerLedger.balance_amount > 0,
                FinCustomerLedger.document_type.in_(("invoice", "debit_note")),
            )
        ) or 0

        customer_count = self.db.scalar(
            select(func.count(func.distinct(FinCustomerLedger.customer_id))).where(base)
        ) or 0

        invoice_total = self.db.scalar(
            select(func.coalesce(func.sum(FinCustomerLedger.debit_amount), 0)).where(
                base,
                FinCustomerLedger.document_type.in_(("invoice", "debit_note")),
                FinCustomerLedger.status != "cancelled",
            )
        ) or 0

        open_invoice_count = self.db.scalar(
            select(func.count()).where(
                base,
                FinCustomerLedger.document_type.in_(("invoice", "debit_note")),
                FinCustomerLedger.status.in_(("open", "partial")),
            )
        ) or 0

        receipt_count = self.db.scalar(
            select(func.count()).where(
                base,
                FinCustomerLedger.document_type.in_(("payment", "receipt")),
                FinCustomerLedger.status != "cancelled",
            )
        ) or 0

        return {
            "outstanding": float(outstanding),
            "collected_today": float(collected_today),
            "month_collections": float(month_collections),
            "overdue_count": int(overdue_count),
            "overdue_amount": float(overdue_amount),
            "customer_count": int(customer_count),
            "invoice_total": float(invoice_total),
            "open_invoice_count": int(open_invoice_count),
            "receipt_count": int(receipt_count),
        }

    def ap_aggregate_stats(self, ctx: TenantContext, company_id: UUID) -> dict:
        today = date.today()
        month_start = today.replace(day=1)

        base = and_(
            FinVendorLedger.company_id == company_id,
            FinVendorLedger.tenant_id == ctx.tenant_id,
            FinVendorLedger.is_deleted.is_(False),
        )

        outstanding = self.db.scalar(
            select(func.coalesce(func.sum(FinVendorLedger.balance_amount), 0)).where(
                base,
                FinVendorLedger.status.in_(("open", "partial")),
                FinVendorLedger.balance_amount > 0,
                FinVendorLedger.document_type.in_(("invoice", "credit_note")),
            )
        ) or 0

        due_today_amount = self.db.scalar(
            select(func.coalesce(func.sum(FinVendorLedger.balance_amount), 0)).where(
                base,
                FinVendorLedger.status.in_(("open", "partial")),
                FinVendorLedger.due_date == today,
                FinVendorLedger.balance_amount > 0,
                FinVendorLedger.document_type.in_(("invoice", "credit_note")),
            )
        ) or 0

        due_today_count = self.db.scalar(
            select(func.count()).where(
                base,
                FinVendorLedger.status.in_(("open", "partial")),
                FinVendorLedger.due_date == today,
                FinVendorLedger.balance_amount > 0,
                FinVendorLedger.document_type.in_(("invoice", "credit_note")),
            )
        ) or 0

        month_payments = self.db.scalar(
            select(func.coalesce(func.sum(FinVendorLedger.debit_amount), 0)).where(
                base,
                FinVendorLedger.document_type.in_(("payment", "allocation")),
                FinVendorLedger.document_date >= month_start,
                FinVendorLedger.document_date <= today,
                FinVendorLedger.status != "cancelled",
            )
        ) or 0

        overdue_count = self.db.scalar(
            select(func.count()).where(
                base,
                FinVendorLedger.status.in_(("open", "partial")),
                FinVendorLedger.due_date < today,
                FinVendorLedger.balance_amount > 0,
                FinVendorLedger.document_type.in_(("invoice", "credit_note")),
            )
        ) or 0

        overdue_amount = self.db.scalar(
            select(func.coalesce(func.sum(FinVendorLedger.balance_amount), 0)).where(
                base,
                FinVendorLedger.status.in_(("open", "partial")),
                FinVendorLedger.due_date < today,
                FinVendorLedger.balance_amount > 0,
                FinVendorLedger.document_type.in_(("invoice", "credit_note")),
            )
        ) or 0

        vendor_count = self.db.scalar(
            select(func.count(func.distinct(FinVendorLedger.vendor_id))).where(base)
        ) or 0

        invoice_total = self.db.scalar(
            select(func.coalesce(func.sum(FinVendorLedger.credit_amount), 0)).where(
                base,
                FinVendorLedger.document_type.in_(("invoice", "credit_note")),
                FinVendorLedger.status != "cancelled",
            )
        ) or 0

        open_invoice_count = self.db.scalar(
            select(func.count()).where(
                base,
                FinVendorLedger.document_type.in_(("invoice", "credit_note")),
                FinVendorLedger.status.in_(("open", "partial")),
            )
        ) or 0

        payment_count = self.db.scalar(
            select(func.count()).where(
                base,
                FinVendorLedger.document_type == "payment",
                FinVendorLedger.status != "cancelled",
            )
        ) or 0

        return {
            "outstanding": float(outstanding),
            "due_today_amount": float(due_today_amount),
            "due_today_count": int(due_today_count),
            "month_payments": float(month_payments),
            "overdue_count": int(overdue_count),
            "overdue_amount": float(overdue_amount),
            "vendor_count": int(vendor_count),
            "invoice_total": float(invoice_total),
            "open_invoice_count": int(open_invoice_count),
            "payment_count": int(payment_count),
        }

    @staticmethod
    def compute_aging_bucket(due_date: date, as_of: date) -> str:
        days = (as_of - due_date).days
        if days <= 30:
            return "0-30"
        if days <= 60:
            return "31-60"
        if days <= 90:
            return "61-90"
        return "90+"
