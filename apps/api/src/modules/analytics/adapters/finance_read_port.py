"""Finance read port — analytical consumption ONLY.

NEVER uses PostingService. NEVER writes fin_* tables.
UUID / context resolution stubs only.
"""

from __future__ import annotations

import re
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.finance.models.coa import FinChartOfAccount
from modules.finance.models.ledger import FinCustomerLedger, FinGlEntry
from modules.finance.repository.subledger_repository import SubLedgerRepository
from modules.foundation.domain.value_objects import TenantContext

_CASH_RE = re.compile(r"cash|bank|petty|treasury", re.I)


def _dec(value: object) -> Decimal:
    return Decimal(str(value or 0))


class AnalyticsFinanceReadAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._subledger = SubLedgerRepository(db)

    def resolve_ledger_ref(self, ctx: TenantContext, ledger_ref_id: UUID | None) -> UUID | None:
        """Read-only UUID passthrough for analytical ledger context."""
        _ = (ctx, self._db)
        return ledger_ref_id

    def get_total_revenue(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[Decimal, list[dict[str, str | Decimal]]]:
        """Revenue from posted GL on revenue accounts; if none, billed AR invoices."""
        gl_rows = self._db.execute(
            select(
                FinChartOfAccount.account_name,
                func.coalesce(func.sum(FinGlEntry.credit_amount - FinGlEntry.debit_amount), 0),
            )
            .join(FinChartOfAccount, FinChartOfAccount.id == FinGlEntry.account_id)
            .where(
                FinGlEntry.tenant_id == ctx.tenant_id,
                FinGlEntry.company_id == company_id,
                FinChartOfAccount.tenant_id == ctx.tenant_id,
                FinChartOfAccount.company_id == company_id,
                FinChartOfAccount.account_type == "revenue",
                FinChartOfAccount.is_deleted.is_(False),
            )
            .group_by(FinChartOfAccount.account_name)
        ).all()
        breakdown = [
            {"dimension_label": name, "value": _dec(total)}
            for name, total in gl_rows
            if _dec(total) != 0
        ]
        gl_total = sum((item["value"] for item in breakdown), Decimal("0"))
        if gl_total != 0 or breakdown:
            return gl_total, breakdown

        invoice_total = self._db.scalar(
            select(func.coalesce(func.sum(FinCustomerLedger.debit_amount), 0)).where(
                FinCustomerLedger.tenant_id == ctx.tenant_id,
                FinCustomerLedger.company_id == company_id,
                FinCustomerLedger.is_deleted.is_(False),
                FinCustomerLedger.document_type == "invoice",
                FinCustomerLedger.status != "cancelled",
            )
        )
        return _dec(invoice_total), []

    def get_cash_position(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[Decimal, list[dict[str, str | Decimal]]]:
        accounts = self._db.scalars(
            select(FinChartOfAccount).where(
                FinChartOfAccount.tenant_id == ctx.tenant_id,
                FinChartOfAccount.company_id == company_id,
                FinChartOfAccount.is_deleted.is_(False),
                FinChartOfAccount.account_type == "asset",
            )
        ).all()
        cash_ids = [
            acct.id
            for acct in accounts
            if _CASH_RE.search(f"{acct.account_code} {acct.account_name}")
        ]
        if not cash_ids:
            return Decimal("0"), []
        rows = self._db.execute(
            select(
                FinChartOfAccount.account_name,
                func.coalesce(func.sum(FinGlEntry.debit_amount - FinGlEntry.credit_amount), 0),
            )
            .join(FinChartOfAccount, FinChartOfAccount.id == FinGlEntry.account_id)
            .where(
                FinGlEntry.tenant_id == ctx.tenant_id,
                FinGlEntry.company_id == company_id,
                FinGlEntry.account_id.in_(cash_ids),
            )
            .group_by(FinChartOfAccount.account_name)
        ).all()
        breakdown = [{"dimension_label": name, "value": _dec(total)} for name, total in rows]
        total = sum((item["value"] for item in breakdown), Decimal("0"))
        return total, breakdown

    def get_ar_aging(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[Decimal, list[dict[str, str | Decimal]]]:
        entries = self._subledger.list_open_ar_for_aging(ctx, company_id)
        buckets: dict[str, Decimal] = {}
        total = Decimal("0")
        for entry in entries:
            amount = _dec(entry.balance_amount)
            total += amount
            label = entry.aging_bucket or "Unbucketed"
            buckets[label] = buckets.get(label, Decimal("0")) + amount
        breakdown = [{"dimension_label": key, "value": value} for key, value in buckets.items()]
        return total, breakdown

    def get_ap_aging(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[Decimal, list[dict[str, str | Decimal]]]:
        entries = self._subledger.list_open_ap_for_aging(ctx, company_id)
        buckets: dict[str, Decimal] = {}
        total = Decimal("0")
        for entry in entries:
            amount = _dec(entry.balance_amount)
            total += amount
            label = entry.aging_bucket or "Unbucketed"
            buckets[label] = buckets.get(label, Decimal("0")) + amount
        breakdown = [{"dimension_label": key, "value": value} for key, value in buckets.items()]
        return total, breakdown
