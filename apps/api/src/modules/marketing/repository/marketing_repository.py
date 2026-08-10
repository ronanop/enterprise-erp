"""Marketing repositories."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.marketing.models import (
    MktActivityLog,
    MktCampaign,
    MktCampaignAudience,
    MktChannel,
    MktContentApproval,
    MktContentAssignment,
    MktContentAssetLink,
    MktContentItem,
    MktMediaAsset,
    MktPublication,
)
from modules.marketing.repository.base import MktScopedRepository, utcnow


class CampaignRepository(MktScopedRepository):
    def get(self, ctx: TenantContext, row_id: UUID) -> MktCampaign | None:
        stmt = select(MktCampaign).where(MktCampaign.id == row_id, MktCampaign.is_deleted.is_(False))
        stmt = self.apply_mkt_filter(stmt, MktCampaign, ctx)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID, *, status: str | None = None, q: str | None = None):
        stmt = select(MktCampaign).where(MktCampaign.company_id == company_id, MktCampaign.is_deleted.is_(False))
        if status:
            stmt = stmt.where(MktCampaign.status == status)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(MktCampaign.name.ilike(like) | MktCampaign.campaign_number.ilike(like))
        stmt = self.apply_mkt_filter(stmt, MktCampaign, ctx)
        stmt = stmt.order_by(MktCampaign.created_at.desc())
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> MktCampaign:
        row = MktCampaign(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> MktCampaign | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None or k in {"description", "goals", "target_audience_summary", "owner_id", "rejection_reason"}:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row


class ChannelRepository(MktScopedRepository):
    def get(self, ctx: TenantContext, row_id: UUID) -> MktChannel | None:
        stmt = select(MktChannel).where(MktChannel.id == row_id, MktChannel.is_deleted.is_(False))
        stmt = self.apply_mkt_filter(stmt, MktChannel, ctx)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID, *, platform: str | None = None):
        stmt = select(MktChannel).where(MktChannel.company_id == company_id, MktChannel.is_deleted.is_(False))
        if platform:
            stmt = stmt.where(MktChannel.platform == platform)
        stmt = self.apply_mkt_filter(stmt, MktChannel, ctx).order_by(MktChannel.name)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> MktChannel:
        row = MktChannel(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> MktChannel | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row


class ContentItemRepository(MktScopedRepository):
    def get(self, ctx: TenantContext, row_id: UUID) -> MktContentItem | None:
        stmt = select(MktContentItem).where(MktContentItem.id == row_id, MktContentItem.is_deleted.is_(False))
        stmt = self.apply_mkt_filter(stmt, MktContentItem, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_rows(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        status: str | None = None,
        statuses: list[str] | None = None,
        campaign_id: UUID | None = None,
        channel_id: UUID | None = None,
        q: str | None = None,
        mine: bool = False,
        created_by_id: UUID | None = None,
        posting_report_status: str | None = None,
    ):
        stmt = select(MktContentItem).where(
            MktContentItem.company_id == company_id,
            MktContentItem.is_deleted.is_(False),
        )
        if status:
            stmt = stmt.where(MktContentItem.status == status)
        if statuses:
            stmt = stmt.where(MktContentItem.status.in_(statuses))
        if created_by_id:
            stmt = stmt.where(MktContentItem.created_by_id == created_by_id)
        if posting_report_status:
            stmt = stmt.where(MktContentItem.posting_report_status == posting_report_status)
        if campaign_id:
            stmt = stmt.where(MktContentItem.campaign_id == campaign_id)
        if channel_id:
            stmt = stmt.where(MktContentItem.channel_id == channel_id)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(MktContentItem.title.ilike(like) | MktContentItem.content_number.ilike(like))
        if mine and ctx.user_id:
            stmt = stmt.where(
                (MktContentItem.created_by_id == ctx.user_id)
                | (MktContentItem.assigned_to_id == ctx.user_id)
            )
        stmt = self.apply_mkt_filter(stmt, MktContentItem, ctx, branch_scoped=True)
        stmt = stmt.order_by(MktContentItem.created_at.desc())
        return list(self.db.scalars(stmt).all())

    def list_calendar(self, ctx: TenantContext, company_id: UUID, start: datetime, end: datetime):
        stmt = select(MktContentItem).where(
            MktContentItem.company_id == company_id,
            MktContentItem.is_deleted.is_(False),
            MktContentItem.scheduled_at.isnot(None),
            MktContentItem.scheduled_at >= start,
            MktContentItem.scheduled_at <= end,
        )
        stmt = self.apply_mkt_filter(stmt, MktContentItem, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> MktContentItem:
        row = MktContentItem(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            created_by_id=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> MktContentItem | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            nullable_fields = {
                "body",
                "summary",
                "campaign_id",
                "channel_id",
                "assigned_to_id",
                "rejection_reason",
                "posting_report_status",
                "posting_report_notes",
                "posting_reported_at",
                "posting_reported_by_id",
            }
            if v is not None or k in nullable_fields:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row


class PublicationRepository(MktScopedRepository):
    def get(self, ctx: TenantContext, row_id: UUID) -> MktPublication | None:
        stmt = select(MktPublication).where(MktPublication.id == row_id, MktPublication.is_deleted.is_(False))
        stmt = self.apply_mkt_filter(stmt, MktPublication, ctx)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID, *, channel_id: UUID | None = None):
        stmt = select(MktPublication).where(
            MktPublication.company_id == company_id,
            MktPublication.is_deleted.is_(False),
        )
        if channel_id:
            stmt = stmt.where(MktPublication.channel_id == channel_id)
        stmt = self.apply_mkt_filter(stmt, MktPublication, ctx).order_by(MktPublication.published_at.desc())
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> MktPublication:
        row = MktPublication(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row


class ApprovalRepository(MktScopedRepository):
    def list_pending(self, ctx: TenantContext, company_id: UUID):
        stmt = (
            select(MktContentApproval)
            .join(MktContentItem, MktContentItem.id == MktContentApproval.content_item_id)
            .where(
                MktContentApproval.company_id == company_id,
                MktContentApproval.is_deleted.is_(False),
                MktContentApproval.status == "pending",
                MktContentItem.is_deleted.is_(False),
            )
        )
        stmt = self.apply_mkt_filter(stmt, MktContentApproval, ctx)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> MktContentApproval:
        row = MktContentApproval(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> MktContentApproval | None:
        stmt = select(MktContentApproval).where(
            MktContentApproval.id == row_id,
            MktContentApproval.is_deleted.is_(False),
        )
        stmt = self.apply_mkt_filter(stmt, MktContentApproval, ctx)
        row = self.db.scalar(stmt)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        self.db.flush()
        return row


class MediaAssetRepository(MktScopedRepository):
    def get(self, ctx: TenantContext, row_id: UUID) -> MktMediaAsset | None:
        stmt = select(MktMediaAsset).where(MktMediaAsset.id == row_id, MktMediaAsset.is_deleted.is_(False))
        stmt = self.apply_mkt_filter(stmt, MktMediaAsset, ctx)
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID, *, q: str | None = None):
        stmt = select(MktMediaAsset).where(
            MktMediaAsset.company_id == company_id,
            MktMediaAsset.is_deleted.is_(False),
        )
        if q:
            like = f"%{q}%"
            stmt = stmt.where(MktMediaAsset.name.ilike(like) | MktMediaAsset.asset_number.ilike(like))
        stmt = self.apply_mkt_filter(stmt, MktMediaAsset, ctx).order_by(MktMediaAsset.created_at.desc())
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> MktMediaAsset:
        fields.setdefault("uploaded_by_id", ctx.user_id)
        row = MktMediaAsset(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> MktMediaAsset | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row


class ActivityLogRepository(MktScopedRepository):
    def list_for_entity(self, ctx: TenantContext, entity_type: str, entity_id: UUID):
        stmt = select(MktActivityLog).where(
            MktActivityLog.entity_type == entity_type,
            MktActivityLog.entity_id == entity_id,
            MktActivityLog.is_deleted.is_(False),
        )
        stmt = self.apply_mkt_filter(stmt, MktActivityLog, ctx).order_by(MktActivityLog.created_at.desc())
        return list(self.db.scalars(stmt).all())


class CampaignAudienceRepository(MktScopedRepository):
    def list_for_campaign(self, ctx: TenantContext, campaign_id: UUID):
        stmt = select(MktCampaignAudience).where(
            MktCampaignAudience.campaign_id == campaign_id,
            MktCampaignAudience.is_deleted.is_(False),
        )
        stmt = self.apply_mkt_filter(stmt, MktCampaignAudience, ctx)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> MktCampaignAudience:
        row = MktCampaignAudience(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row


class ContentAssignmentRepository(MktScopedRepository):
    def list_for_content(self, ctx: TenantContext, content_item_id: UUID):
        stmt = select(MktContentAssignment).where(
            MktContentAssignment.content_item_id == content_item_id,
            MktContentAssignment.is_deleted.is_(False),
        )
        stmt = self.apply_mkt_filter(stmt, MktContentAssignment, ctx)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> MktContentAssignment:
        row = MktContentAssignment(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            assigned_at=utcnow(),
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row
