"""Marketing masters + research/calendar/analytics services."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.marketing.domain.enums import BrandVoiceStatus, PublishJobStatus
from modules.marketing.domain.exceptions import NotFoundException
from modules.marketing.models import (
    MktBrandVoice,
    MktBrandVoiceSource,
    MktCalendarEntry,
    MktCampaign,
    MktCompetitor,
    MktContentPillar,
    MktContentRequest,
    MktGeneratedContent,
    MktPlatform,
    MktPublishJob,
    MktResearchReport,
    MktSocialAccount,
    MktTrendReport,
)
from modules.marketing.repository.base import MktScopedRepository, utcnow
from modules.marketing.service.number_service import MarketingNumberService


class PlatformService:
    def __init__(self, db: Session) -> None:
        self._repo = MktScopedRepository(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        rows = self._repo.list_by_company(MktPlatform, ctx, cid)
        if not rows:
            rows = self.ensure_defaults(ctx, cid)
        return rows

    def ensure_defaults(self, ctx: TenantContext, company_id: UUID):
        defaults = [
            ("linkedin", "LinkedIn", "social"),
            ("instagram", "Instagram", "social"),
            ("x", "X (Twitter)", "social"),
            ("facebook", "Facebook", "social"),
            ("tiktok", "TikTok", "social"),
            ("youtube", "YouTube", "social"),
            ("newsletter", "Newsletter", "email"),
            ("blog", "Blog / Web", "web"),
        ]
        created = []
        for code, name, channel in defaults:
            created.append(
                self._repo.create_row(
                    MktPlatform,
                    ctx,
                    company_id=company_id,
                    platform_code=code,
                    platform_name=name,
                    channel_type=channel,
                    is_active=True,
                    status="active",
                )
            )
        return created

    def create(self, ctx: TenantContext, **fields) -> MktPlatform:
        company_id = self._repo.resolve_company_id(ctx, fields.pop("company_id", None))
        return self._repo.create_row(MktPlatform, ctx, company_id=company_id, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> MktPlatform:
        row = self._repo.update_row(MktPlatform, ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Platform not found")
        return row


class PillarService:
    def __init__(self, db: Session) -> None:
        self._repo = MktScopedRepository(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.list_by_company(MktContentPillar, ctx, cid)

    def create(self, ctx: TenantContext, **fields) -> MktContentPillar:
        company_id = self._repo.resolve_company_id(ctx, fields.pop("company_id", None))
        return self._repo.create_row(MktContentPillar, ctx, company_id=company_id, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> MktContentPillar:
        row = self._repo.update_row(MktContentPillar, ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Content pillar not found")
        return row


class BrandVoiceService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.list_by_company(MktBrandVoice, ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> MktBrandVoice:
        row = self._repo.get_by_id(MktBrandVoice, ctx, row_id)
        if row is None:
            raise NotFoundException("Brand voice not found")
        return row

    def create(self, ctx: TenantContext, **fields) -> MktBrandVoice:
        company_id = self._repo.resolve_company_id(ctx, fields.pop("company_id", None))
        fields.setdefault("status", BrandVoiceStatus.DRAFT.value)
        return self._repo.create_row(MktBrandVoice, ctx, company_id=company_id, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> MktBrandVoice:
        row = self._repo.update_row(MktBrandVoice, ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Brand voice not found")
        return row

    def add_source(self, ctx: TenantContext, brand_voice_id: UUID, **fields) -> MktBrandVoiceSource:
        voice = self.get(ctx, brand_voice_id)
        return self._repo.create_row(
            MktBrandVoiceSource,
            ctx,
            company_id=voice.company_id,
            brand_voice_id=brand_voice_id,
            status="pending",
            **fields,
        )

    def list_sources(self, ctx: TenantContext, brand_voice_id: UUID):
        voice = self.get(ctx, brand_voice_id)
        rows = self._repo.list_by_company(MktBrandVoiceSource, ctx, voice.company_id)
        return [r for r in rows if r.brand_voice_id == brand_voice_id]

    def activate(self, ctx: TenantContext, row_id: UUID) -> MktBrandVoice:
        return self.update(ctx, row_id, status=BrandVoiceStatus.ACTIVE.value)


class SocialAccountService:
    def __init__(self, db: Session) -> None:
        self._repo = MktScopedRepository(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.list_by_company(MktSocialAccount, ctx, cid)

    def create(self, ctx: TenantContext, **fields) -> MktSocialAccount:
        company_id = self._repo.resolve_company_id(ctx, fields.pop("company_id", None))
        return self._repo.create_row(MktSocialAccount, ctx, company_id=company_id, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> MktSocialAccount:
        row = self._repo.update_row(MktSocialAccount, ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Social account not found")
        return row


class ResearchService:
    def __init__(self, db: Session) -> None:
        self._repo = MktScopedRepository(db)
        self._numbers = MarketingNumberService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.list_by_company(MktResearchReport, ctx, cid, branch_scoped=True)

    def create(self, ctx: TenantContext, **fields) -> MktResearchReport:
        company_id = self._repo.resolve_company_id(ctx, fields.pop("company_id", None))
        code = self._numbers.next_code(MktResearchReport, company_id, "report_code", "RSH")
        topic = fields["topic"]
        findings = {
            "executiveSummary": f"Research brief for '{topic}'.",
            "keyInsights": [
                f"Audience interest around {topic} is rising in B2B channels.",
                "Competitor content clusters around thought-leadership formats.",
            ],
            "opportunities": [
                "Publish a pillar post with supporting social snippets.",
                "Repurpose into LinkedIn carousel + newsletter excerpt.",
            ],
        }
        return self._repo.create_row(
            MktResearchReport,
            ctx,
            company_id=company_id,
            report_code=code,
            summary=findings["executiveSummary"],
            findings=findings,
            status="completed",
            **fields,
        )


class TrendService:
    def __init__(self, db: Session) -> None:
        self._repo = MktScopedRepository(db)
        self._numbers = MarketingNumberService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.list_by_company(MktTrendReport, ctx, cid, branch_scoped=True)

    def create(self, ctx: TenantContext, **fields) -> MktTrendReport:
        company_id = self._repo.resolve_company_id(ctx, fields.pop("company_id", None))
        code = self._numbers.next_code(MktTrendReport, company_id, "report_code", "TRD")
        topic = fields["topic"]
        opportunities = {
            "relatedKeywords": [topic, f"{topic} tips", f"{topic} trends"],
            "channels": ["linkedin", "x", "newsletter"],
        }
        return self._repo.create_row(
            MktTrendReport,
            ctx,
            company_id=company_id,
            report_code=code,
            virality_score=72.5,
            summary=f"Trend signal detected for '{topic}'.",
            opportunities=opportunities,
            status="completed",
            **fields,
        )


class CompetitorService:
    def __init__(self, db: Session) -> None:
        self._repo = MktScopedRepository(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.list_by_company(MktCompetitor, ctx, cid)

    def create(self, ctx: TenantContext, **fields) -> MktCompetitor:
        company_id = self._repo.resolve_company_id(ctx, fields.pop("company_id", None))
        return self._repo.create_row(MktCompetitor, ctx, company_id=company_id, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> MktCompetitor:
        row = self._repo.update_row(MktCompetitor, ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Competitor not found")
        return row


class CalendarService:
    def __init__(self, db: Session) -> None:
        self._repo = MktScopedRepository(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.list_by_company(MktCalendarEntry, ctx, cid, branch_scoped=True)

    def create(self, ctx: TenantContext, **fields) -> MktCalendarEntry:
        company_id = self._repo.resolve_company_id(ctx, fields.pop("company_id", None))
        return self._repo.create_row(MktCalendarEntry, ctx, company_id=company_id, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> MktCalendarEntry:
        row = self._repo.update_row(MktCalendarEntry, ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Calendar entry not found")
        return row


class PublishService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.list_by_company(MktPublishJob, ctx, cid, branch_scoped=True)

    def create(self, ctx: TenantContext, **fields) -> MktPublishJob:
        company_id = self._repo.resolve_company_id(ctx, fields.pop("company_id", None))
        return self._repo.create_row(
            MktPublishJob,
            ctx,
            company_id=company_id,
            status=PublishJobStatus.PENDING.value,
            **fields,
        )

    def queue(self, ctx: TenantContext, row_id: UUID) -> MktPublishJob:
        row = self._repo.get_by_id(MktPublishJob, ctx, row_id, branch_scoped=True)
        if row is None:
            raise NotFoundException("Publish job not found")
        from modules.marketing.domain.enums import ContentStatus, PublishJobStatus
        from modules.marketing.models import MktGeneratedContent

        row.status = PublishJobStatus.RUNNING.value
        row.started_at = utcnow()
        row.result_payload = {
            "provider": "stub",
            "message": "Publish simulated successfully",
            "external_post_id": f"stub-{str(row.id)[:8]}",
        }
        row.status = PublishJobStatus.SUCCEEDED.value
        row.completed_at = utcnow()
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        content = self.db.get(MktGeneratedContent, row.content_id)
        if content is not None:
            content.status = ContentStatus.PUBLISHED.value
            content.updated_at = utcnow()
        self.db.flush()
        return row


class AnalyticsService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)

    def overview(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._repo.resolve_company_id(ctx, company_id)
        now = datetime.now(timezone.utc)

        def _count(model, **extra):
            stmt = select(model).where(model.company_id == cid, model.is_deleted.is_(False))
            stmt = self._repo.apply_mkt_filter(stmt, model, ctx)
            rows = list(self.db.scalars(stmt).all())
            if not extra:
                return len(rows)
            return len([r for r in rows if all(getattr(r, k) == v for k, v in extra.items())])

        calendar_rows = self._repo.list_by_company(MktCalendarEntry, ctx, cid, branch_scoped=True)
        upcoming = len([r for r in calendar_rows if r.scheduled_at >= now and r.status != "cancelled"])

        return {
            "campaigns_total": _count(MktCampaign),
            "campaigns_active": _count(MktCampaign, status="active"),
            "content_requests_total": _count(MktContentRequest),
            "content_drafts": _count(MktGeneratedContent, status="draft"),
            "content_approved": _count(MktGeneratedContent, status="approved"),
            "calendar_upcoming": upcoming,
            "publish_pending": _count(MktPublishJob, status="pending")
            + _count(MktPublishJob, status="queued"),
            "brand_voices": _count(MktBrandVoice),
            "competitors": _count(MktCompetitor),
            "research_reports": _count(MktResearchReport),
        }
