"""Marketing reports service."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.marketing.models import MktCampaign, MktChannel, MktContentItem, MktPublication
from modules.marketing.schemas import ReportSummary, ReportSummaryItem
from modules.marketing.service.marketing_scope_validator import MarketingScopeValidator


class ReportService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._scope = MarketingScopeValidator(db)

    def get_summary(self, ctx: TenantContext, company_id: UUID | None = None) -> ReportSummary:
        cid = self._scope.resolve_company_id(ctx, company_id)

        by_status = self._group_count(
            MktContentItem,
            MktContentItem.status,
            MktContentItem.company_id == cid,
            MktContentItem.is_deleted.is_(False),
        )

        by_content_type = self._group_count(
            MktContentItem,
            MktContentItem.content_type,
            MktContentItem.company_id == cid,
            MktContentItem.is_deleted.is_(False),
        )

        by_channel_rows = self.db.execute(
            select(MktChannel.name, func.count(MktPublication.id))
            .join(MktPublication, MktPublication.channel_id == MktChannel.id, isouter=True)
            .where(MktChannel.company_id == cid, MktChannel.is_deleted.is_(False))
            .group_by(MktChannel.name)
            .order_by(func.count(MktPublication.id).desc())
        ).all()
        by_channel = [
            ReportSummaryItem(key=row[0], label=row[0], count=int(row[1] or 0)) for row in by_channel_rows
        ]

        by_campaign_rows = self.db.execute(
            select(MktCampaign.name, func.count(MktContentItem.id))
            .join(MktContentItem, MktContentItem.campaign_id == MktCampaign.id, isouter=True)
            .where(MktCampaign.company_id == cid, MktCampaign.is_deleted.is_(False))
            .group_by(MktCampaign.name)
            .order_by(func.count(MktContentItem.id).desc())
        ).all()
        by_campaign = [
            ReportSummaryItem(key=row[0], label=row[0], count=int(row[1] or 0)) for row in by_campaign_rows
        ]

        return ReportSummary(
            by_status=by_status,
            by_channel=by_channel,
            by_campaign=by_campaign,
            by_content_type=by_content_type,
        )

    def _group_count(self, model, column, *filters) -> list[ReportSummaryItem]:
        rows = self.db.execute(
            select(column, func.count()).where(*filters).group_by(column).order_by(func.count().desc())
        ).all()
        return [ReportSummaryItem(key=str(row[0]), label=str(row[0]), count=int(row[1])) for row in rows]
