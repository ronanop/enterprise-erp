"""Quality read adapter — analytical consumption only."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models.incoming_inspection import QmIncomingInspection
from modules.quality.models.ncr import QmNcr


class AnalyticsQualityReadAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def ncr_count(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[int, list[dict[str, str | int]]]:
        rows = self._db.execute(
            select(QmNcr.status, func.count())
            .where(
                QmNcr.tenant_id == ctx.tenant_id,
                QmNcr.company_id == company_id,
                QmNcr.is_deleted.is_(False),
                QmNcr.status != "cancelled",
            )
            .group_by(QmNcr.status)
        ).all()
        breakdown = [{"dimension_label": status, "value": int(count)} for status, count in rows]
        return sum(item["value"] for item in breakdown), breakdown

    def ncr_open_count(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[int, list[dict[str, str | int]]]:
        rows = self._db.execute(
            select(QmNcr.severity, func.count())
            .where(
                QmNcr.tenant_id == ctx.tenant_id,
                QmNcr.company_id == company_id,
                QmNcr.is_deleted.is_(False),
                QmNcr.status.notin_(("closed", "cancelled")),
            )
            .group_by(QmNcr.severity)
        ).all()
        breakdown = [{"dimension_label": severity, "value": int(count)} for severity, count in rows]
        return sum(item["value"] for item in breakdown), breakdown

    def incoming_inspection_count(
        self, ctx: TenantContext, company_id: UUID
    ) -> tuple[int, list[dict[str, str | int]]]:
        rows = self._db.execute(
            select(QmIncomingInspection.status, func.count())
            .where(
                QmIncomingInspection.tenant_id == ctx.tenant_id,
                QmIncomingInspection.company_id == company_id,
                QmIncomingInspection.is_deleted.is_(False),
                QmIncomingInspection.status != "cancelled",
            )
            .group_by(QmIncomingInspection.status)
        ).all()
        breakdown = [{"dimension_label": status, "value": int(count)} for status, count in rows]
        return sum(item["value"] for item in breakdown), breakdown
