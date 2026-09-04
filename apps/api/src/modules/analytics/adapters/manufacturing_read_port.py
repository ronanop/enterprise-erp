"""Manufacturing read adapter — analytical consumption only."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.manufacturing.models.production_order import MfgProductionOrder
from modules.manufacturing.models.scrap import MfgScrap


def _dec(value: object) -> Decimal:
    return Decimal(str(value or 0))


class AnalyticsManufacturingReadAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def production_order_count(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[int, list[dict[str, str | int]]]:
        rows = self._db.execute(
            select(MfgProductionOrder.status, func.count())
            .where(
                MfgProductionOrder.tenant_id == ctx.tenant_id,
                MfgProductionOrder.company_id == company_id,
                MfgProductionOrder.is_deleted.is_(False),
                MfgProductionOrder.status != "cancelled",
            )
            .group_by(MfgProductionOrder.status)
        ).all()
        breakdown = [{"dimension_label": status, "value": int(count)} for status, count in rows]
        return sum(item["value"] for item in breakdown), breakdown

    def planned_qty(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[Decimal, list[dict[str, str | Decimal]]]:
        rows = self._db.execute(
            select(
                MfgProductionOrder.status,
                func.coalesce(func.sum(MfgProductionOrder.planned_qty), 0),
            )
            .where(
                MfgProductionOrder.tenant_id == ctx.tenant_id,
                MfgProductionOrder.company_id == company_id,
                MfgProductionOrder.is_deleted.is_(False),
                MfgProductionOrder.status != "cancelled",
            )
            .group_by(MfgProductionOrder.status)
        ).all()
        breakdown = [{"dimension_label": status, "value": _dec(qty)} for status, qty in rows]
        total = sum((item["value"] for item in breakdown), Decimal("0"))
        return total, breakdown

    def scrap_count(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[int, list[dict[str, str | int]]]:
        rows = self._db.execute(
            select(MfgScrap.scrap_type, func.count())
            .where(
                MfgScrap.tenant_id == ctx.tenant_id,
                MfgScrap.company_id == company_id,
                MfgScrap.is_deleted.is_(False),
                MfgScrap.status != "cancelled",
            )
            .group_by(MfgScrap.scrap_type)
        ).all()
        breakdown = [{"dimension_label": scrap_type, "value": int(count)} for scrap_type, count in rows]
        return sum(item["value"] for item in breakdown), breakdown
