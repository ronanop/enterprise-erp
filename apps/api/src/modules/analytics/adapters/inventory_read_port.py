"""Inventory read adapter — analytical consumption only."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.inventory.models.balance import InvStockBalance


def _dec(value: object) -> Decimal:
    return Decimal(str(value or 0))


class AnalyticsInventoryReadAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def on_hand_qty(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[Decimal, list[dict[str, str | Decimal]]]:
        rows = self._db.execute(
            select(
                InvStockBalance.quality_status,
                func.coalesce(func.sum(InvStockBalance.on_hand_qty), 0),
            )
            .where(
                InvStockBalance.tenant_id == ctx.tenant_id,
                InvStockBalance.company_id == company_id,
                InvStockBalance.is_deleted.is_(False),
                InvStockBalance.status == "active",
            )
            .group_by(InvStockBalance.quality_status)
        ).all()
        breakdown = [{"dimension_label": status, "value": _dec(qty)} for status, qty in rows]
        total = sum((item["value"] for item in breakdown), Decimal("0"))
        return total, breakdown

    def available_qty(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[Decimal, list[dict[str, str | Decimal]]]:
        rows = self._db.execute(
            select(
                InvStockBalance.quality_status,
                func.coalesce(func.sum(InvStockBalance.available_qty), 0),
            )
            .where(
                InvStockBalance.tenant_id == ctx.tenant_id,
                InvStockBalance.company_id == company_id,
                InvStockBalance.is_deleted.is_(False),
                InvStockBalance.status == "active",
            )
            .group_by(InvStockBalance.quality_status)
        ).all()
        breakdown = [{"dimension_label": status, "value": _dec(qty)} for status, qty in rows]
        total = sum((item["value"] for item in breakdown), Decimal("0"))
        return total, breakdown

    def balance_row_count(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[int, list[dict[str, str | int]]]:
        rows = self._db.execute(
            select(InvStockBalance.quality_status, func.count())
            .where(
                InvStockBalance.tenant_id == ctx.tenant_id,
                InvStockBalance.company_id == company_id,
                InvStockBalance.is_deleted.is_(False),
                InvStockBalance.status == "active",
            )
            .group_by(InvStockBalance.quality_status)
        ).all()
        breakdown = [{"dimension_label": status, "value": int(count)} for status, count in rows]
        return sum(item["value"] for item in breakdown), breakdown
