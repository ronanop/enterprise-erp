"""Marketing masters + research/calendar/analytics services."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.marketing.domain.enums import BrandVoiceStatus, PublishJobStatus
from modules.marketing.domain.exceptions import ConflictException, NotFoundException, ValidationException
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

    def ensure_kit(self, ctx: TenantContext, company_id: UUID | None = None) -> MktBrandVoice:
        rows = self.list(ctx, company_id)
        active = next((row for row in rows if row.status == BrandVoiceStatus.ACTIVE.value), None)
        if active is not None:
            return active
        if rows:
            return rows[0]
        cid = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.create_row(
            MktBrandVoice,
            ctx,
            company_id=cid,
            voice_code="BRAND-KIT",
            voice_name="Company brand kit",
            description="Logo, colors, fonts, and voice used by marketing content.",
            tone_keywords={"keywords": ["clear", "precise"]},
            guidelines="Use the brand colors and fonts. One claim, one proof, one next step.",
            brand_kit={
                "logo_url": "",
                "logo_data_url": "",
                "wordmark": "",
                "logos": [
                    {
                        "name": "Primary",
                        "usage": "full-color",
                        "background": "light",
                        "logo_url": "",
                        "logo_data_url": "",
                        "is_primary": True,
                    }
                ],
                "colors": [
                    {"name": "Primary", "role": "primary", "hex": "#1e293b"},
                    {"name": "Accent", "role": "accent", "hex": "#a16207"},
                    {"name": "Surface", "role": "background", "hex": "#f8fafc"},
                ],
                "fonts": [
                    {"role": "heading", "family": "IBM Plex Sans", "weight": "600"},
                    {"role": "body", "family": "IBM Plex Sans", "weight": "400"},
                ],
                "usage_notes": "Keep the logo clear of other marks. Do not recolor the wordmark.",
            },
            status=BrandVoiceStatus.ACTIVE.value,
        )

    def save_kit(self, ctx: TenantContext, **fields) -> MktBrandVoice:
        row = self.ensure_kit(ctx, fields.pop("company_id", None))
        kit = fields.get("brand_kit")
        if not isinstance(kit, dict):
            raise ValidationException("Brand kit is required")
        colors = kit.get("colors") or []
        if not isinstance(colors, list) or not colors:
            raise ValidationException("Add at least one brand color")
        for color in colors:
            hex_value = str((color or {}).get("hex") or "").strip()
            if not hex_value.startswith("#") or len(hex_value) not in {4, 7}:
                raise ValidationException("Each color needs a hex value like #1e293b")
        payload = {k: v for k, v in fields.items() if v is not None}
        updated = self.update(ctx, row.id, **payload)
        if updated.status != BrandVoiceStatus.ACTIVE.value:
            updated = self.activate(ctx, updated.id)
        return updated


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
        self.db = db
        self._repo = MktScopedRepository(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None, campaign_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        rows = self._repo.list_by_company(MktCalendarEntry, ctx, cid, branch_scoped=True)
        if campaign_id is not None:
            rows = [row for row in rows if row.campaign_id == campaign_id]
        live_content = self._live_published_content_ids(ctx, cid)
        for row in rows:
            if row.status == "published" and row.content_id not in live_content:
                row.status = "scheduled"
        return rows

    def create(self, ctx: TenantContext, **fields) -> MktCalendarEntry:
        company_id = self._repo.resolve_company_id(ctx, fields.pop("company_id", None))
        self._require_approved_content(ctx, fields.get("content_id"))
        self._reject_same_hour(
            ctx,
            company_id,
            social_account_id=fields.get("social_account_id"),
            scheduled_at=fields.get("scheduled_at"),
        )
        if fields.get("status") == "published":
            raise ValidationException("A post is published only after a live post ID is stored")
        return self._repo.create_row(MktCalendarEntry, ctx, company_id=company_id, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> MktCalendarEntry:
        existing = self._repo.get_by_id(MktCalendarEntry, ctx, row_id, branch_scoped=True)
        if existing is None:
            raise NotFoundException("Calendar entry not found")
        if fields.get("status") == "published":
            raise ValidationException("A post is published only after a live post ID is stored")
        content_id = fields.get("content_id") or existing.content_id
        if "content_id" in fields or fields.get("status") in {"planned", "scheduled"}:
            self._require_approved_content(ctx, content_id)
        scheduled_at = fields.get("scheduled_at") or existing.scheduled_at
        account_id = fields.get("social_account_id") or existing.social_account_id
        if fields.get("scheduled_at") is not None or fields.get("social_account_id") is not None:
            self._reject_same_hour(
                ctx,
                existing.company_id,
                social_account_id=account_id,
                scheduled_at=scheduled_at,
                ignore_id=existing.id,
            )
        row = self._repo.update_row(MktCalendarEntry, ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Calendar entry not found")
        return row

    def week_from_brief(
        self,
        ctx: TenantContext,
        *,
        content_id: UUID,
        start_at: datetime,
        social_account_id: UUID | None = None,
        campaign_id: UUID | None = None,
        slot_count: int = 5,
    ) -> list[MktCalendarEntry]:
        content = self.db.get(MktGeneratedContent, content_id)
        if content is None or content.is_deleted:
            raise NotFoundException("Generated content not found")
        self._require_approved_content(ctx, content_id)
        created: list[MktCalendarEntry] = []
        cursor = start_at
        remaining = max(1, min(7, slot_count))
        guard = 0
        while len(created) < remaining and guard < 21:
            guard += 1
            if cursor.weekday() >= 5:
                cursor = cursor + timedelta(days=1)
                continue
            try:
                self._reject_same_hour(
                    ctx,
                    content.company_id,
                    social_account_id=social_account_id,
                    scheduled_at=cursor,
                )
            except ConflictException:
                cursor = cursor + timedelta(days=1)
                continue
            row = self._repo.create_row(
                MktCalendarEntry,
                ctx,
                company_id=content.company_id,
                branch_id=content.branch_id,
                campaign_id=campaign_id or content.campaign_id,
                content_id=content.id,
                platform_id=content.platform_id,
                social_account_id=social_account_id,
                title=(content.headline or content.hook or "Approved brief")[:255],
                notes=content.cta,
                scheduled_at=cursor,
                status="scheduled",
            )
            created.append(row)
            cursor = cursor + timedelta(days=1)
        if not created:
            raise ConflictException("No free hour on this account for the requested week")
        return created

    def _require_approved_content(self, ctx: TenantContext, content_id: UUID | None) -> None:
        if content_id is None:
            raise ValidationException("Schedule an approved caption. The calendar cannot hold an unapproved brief.")
        content = self._repo.get_by_id(MktGeneratedContent, ctx, content_id, branch_scoped=True)
        if content is None:
            raise NotFoundException("Generated content not found")
        if content.status != "approved":
            raise ValidationException("Nothing reaches the calendar until the caption is approved")

    def _reject_same_hour(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        social_account_id: UUID | None,
        scheduled_at: datetime | None,
        ignore_id: UUID | None = None,
    ) -> None:
        if social_account_id is None or scheduled_at is None:
            return
        hour = scheduled_at.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
        rows = self._repo.list_by_company(MktCalendarEntry, ctx, company_id, branch_scoped=True)
        for row in rows:
            if ignore_id and row.id == ignore_id:
                continue
            if row.status == "cancelled" or row.social_account_id != social_account_id:
                continue
            other = row.scheduled_at.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
            if other == hour:
                raise ConflictException("This account already has a post in that hour")

    def _live_published_content_ids(self, ctx: TenantContext, company_id: UUID) -> set[UUID]:
        from modules.marketing.service.publish_truth import is_live_publish

        jobs = self._repo.list_by_company(MktPublishJob, ctx, company_id, branch_scoped=True)
        return {row.content_id for row in jobs if is_live_publish(row.result_payload)}


class PublishService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        from modules.marketing.service.publish_truth import public_publish_status

        cid = self._repo.resolve_company_id(ctx, company_id)
        rows = self._repo.list_by_company(MktPublishJob, ctx, cid, branch_scoped=True)
        for row in rows:
            row.status = public_publish_status(row.status, row.result_payload)
        return rows

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

        from modules.marketing.adapters.social_publish_adapter import SocialPublishAdapter
        from modules.marketing.models import MktPlatform, MktSocialAccount
        from modules.marketing.service.publish_truth import is_live_post_id

        content = self.db.get(MktGeneratedContent, row.content_id)
        if content is None or content.status != ContentStatus.APPROVED.value:
            raise ValidationException("Only an approved caption can be queued")
        account = self.db.get(MktSocialAccount, row.social_account_id) if row.social_account_id else None
        platform = self.db.get(MktPlatform, row.platform_id) if row.platform_id else None
        result = SocialPublishAdapter().publish(
            platform_code=platform.platform_code if platform else None,
            external_account_id=account.external_account_id if account else None,
            body=content.body,
        )
        row.started_at = utcnow()
        row.result_payload = result
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if is_live_post_id(result.get("external_post_id")):
            row.status = PublishJobStatus.SUCCEEDED.value
            row.completed_at = utcnow()
            content.status = ContentStatus.PUBLISHED.value
            content.updated_at = utcnow()
        else:
            row.status = PublishJobStatus.QUEUED.value
            row.completed_at = None
            content.status = ContentStatus.SCHEDULED.value
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
