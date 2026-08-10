"""Marketing dashboard / reports service."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.marketing.domain.enums import CampaignStatus, ContentStatus
from modules.marketing.models import MktCampaign, MktChannel, MktContentApproval, MktContentItem, MktPublication
from modules.marketing.repository.base import MktScopedRepository
from modules.marketing.schemas import DashboardStats
from modules.marketing.service.marketing_scope_validator import MarketingScopeValidator


class DashboardService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._scope = MarketingScopeValidator(db)

    def get_stats(self, ctx: TenantContext, company_id: UUID | None = None) -> DashboardStats:
        cid = self._scope.resolve_company_id(ctx, company_id)
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        def count(stmt):
            stmt = MktScopedRepository.apply_mkt_filter(stmt, stmt.column_descriptions[0]["entity"], ctx)
            return self.db.scalar(stmt) or 0

        active_campaigns = self.db.scalar(
            select(func.count())
            .select_from(MktCampaign)
            .where(
                MktCampaign.company_id == cid,
                MktCampaign.is_deleted.is_(False),
                MktCampaign.status == CampaignStatus.ACTIVE.value,
            )
        ) or 0

        draft_content = self.db.scalar(
            select(func.count())
            .select_from(MktContentItem)
            .where(
                MktContentItem.company_id == cid,
                MktContentItem.is_deleted.is_(False),
                MktContentItem.status == ContentStatus.DRAFT.value,
            )
        ) or 0

        in_review = self.db.scalar(
            select(func.count())
            .select_from(MktContentItem)
            .where(
                MktContentItem.company_id == cid,
                MktContentItem.is_deleted.is_(False),
                MktContentItem.status == ContentStatus.IN_REVIEW.value,
            )
        ) or 0

        scheduled = self.db.scalar(
            select(func.count())
            .select_from(MktContentItem)
            .where(
                MktContentItem.company_id == cid,
                MktContentItem.is_deleted.is_(False),
                MktContentItem.status == ContentStatus.SCHEDULED.value,
            )
        ) or 0

        published_month = self.db.scalar(
            select(func.count())
            .select_from(MktPublication)
            .where(
                MktPublication.company_id == cid,
                MktPublication.is_deleted.is_(False),
                MktPublication.published_at >= month_start,
            )
        ) or 0

        pending_approvals = self.db.scalar(
            select(func.count())
            .select_from(MktContentApproval)
            .where(
                MktContentApproval.company_id == cid,
                MktContentApproval.is_deleted.is_(False),
                MktContentApproval.status == "pending",
            )
        ) or 0

        active_channels = self.db.scalar(
            select(func.count())
            .select_from(MktChannel)
            .where(
                MktChannel.company_id == cid,
                MktChannel.is_deleted.is_(False),
                MktChannel.is_active.is_(True),
            )
        ) or 0

        return DashboardStats(
            active_campaigns=active_campaigns,
            draft_content=draft_content,
            in_review_content=in_review,
            scheduled_content=scheduled,
            published_this_month=published_month,
            pending_approvals=pending_approvals,
            active_channels=active_channels,
        )
