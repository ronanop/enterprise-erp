"""Sales read adapter — analytical consumption only; never writes sales_* tables."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.sales.models.invoice import SalesInvoiceHeader
from modules.sales.models.order import SalesOrderHeader


def _dec(value: object) -> Decimal:
    return Decimal(str(value or 0))


class AnalyticsSalesReadAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def invoice_count(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[int, list[dict[str, str | int]]]:
        rows = self._db.execute(
            select(SalesInvoiceHeader.status, func.count())
            .where(
                SalesInvoiceHeader.tenant_id == ctx.tenant_id,
                SalesInvoiceHeader.company_id == company_id,
                SalesInvoiceHeader.is_deleted.is_(False),
                SalesInvoiceHeader.status != "cancelled",
            )
            .group_by(SalesInvoiceHeader.status)
        ).all()
        breakdown = [{"dimension_label": status, "value": int(count)} for status, count in rows]
        return sum(item["value"] for item in breakdown), breakdown

    def order_count(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[int, list[dict[str, str | int]]]:
        rows = self._db.execute(
            select(SalesOrderHeader.status, func.count())
            .where(
                SalesOrderHeader.tenant_id == ctx.tenant_id,
                SalesOrderHeader.company_id == company_id,
                SalesOrderHeader.is_deleted.is_(False),
                SalesOrderHeader.status != "cancelled",
            )
            .group_by(SalesOrderHeader.status)
        ).all()
        breakdown = [{"dimension_label": status, "value": int(count)} for status, count in rows]
        return sum(item["value"] for item in breakdown), breakdown

    def invoiced_total(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[Decimal, list[dict[str, str | Decimal]]]:
        rows = self._db.execute(
            select(
                SalesInvoiceHeader.status,
                func.coalesce(func.sum(SalesInvoiceHeader.total_amount), 0),
            )
            .where(
                SalesInvoiceHeader.tenant_id == ctx.tenant_id,
                SalesInvoiceHeader.company_id == company_id,
                SalesInvoiceHeader.is_deleted.is_(False),
                SalesInvoiceHeader.status.notin_(("cancelled", "draft")),
            )
            .group_by(SalesInvoiceHeader.status)
        ).all()
        breakdown = [{"dimension_label": status, "value": _dec(total)} for status, total in rows]
        total = sum((item["value"] for item in breakdown), Decimal("0"))
        return total, breakdown
