"""Content request + generation service."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.marketing.domain.enums import ContentRequestStatus, ContentStatus
from modules.marketing.domain.exceptions import NotFoundException
from modules.marketing.models import (
    MktContentRequest,
    MktGeneratedContent,
    MktGeneratedContentVersion,
)
from modules.marketing.repository.base import MktScopedRepository, utcnow
from modules.marketing.service.number_service import MarketingNumberService


class ContentService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)
        self._numbers = MarketingNumberService(db)
        self._audit = AuditService(db)

    def list_requests(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.list_by_company(MktContentRequest, ctx, cid, branch_scoped=True)

    def get_request(self, ctx: TenantContext, row_id: UUID) -> MktContentRequest:
        row = self._repo.get_by_id(MktContentRequest, ctx, row_id, branch_scoped=True)
        if row is None:
            raise NotFoundException("Content request not found")
        return row

    def create_request(self, ctx: TenantContext, *, generate_now: bool = True, **fields) -> MktContentRequest:
        company_id = self._repo.resolve_company_id(ctx, fields.pop("company_id", None))
        code = self._numbers.next_code(MktContentRequest, company_id, "request_code", "CRQ")
        status = ContentRequestStatus.QUEUED.value if generate_now else ContentRequestStatus.DRAFT.value
        row = self._repo.create_row(
            MktContentRequest,
            ctx,
            company_id=company_id,
            request_code=code,
            status=status,
            **fields,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="mkt_content_request",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"request_code": row.request_code, "topic": row.topic},
        )
        if generate_now:
            self.enqueue_generation(ctx, row.id)
        return row

    def enqueue_generation(self, ctx: TenantContext, request_id: UUID) -> MktContentRequest:
        """Run the 6-agent pipeline (sync in-request; Celery task available for workers)."""
        from modules.marketing.domain.enums import ContentStatus
        from modules.marketing.models import MktGeneratedContent, MktPlatform
        from modules.marketing.service.engines.agent_pipeline import run_agent_pipeline

        row = self.get_request(ctx, request_id)
        row.status = ContentRequestStatus.PROCESSING.value
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        self.db.flush()

        platform_code = None
        if row.platform_id:
            platform = self.db.get(MktPlatform, row.platform_id)
            platform_code = platform.platform_code if platform else None

        result = run_agent_pipeline(row.topic, row.content_type, row.tone, platform_code)
        payload = result["content"]
        self._repo.create_row(
            MktGeneratedContent,
            ctx,
            company_id=row.company_id,
            branch_id=row.branch_id,
            content_request_id=row.id,
            campaign_id=row.campaign_id,
            platform_id=row.platform_id,
            headline=payload.get("headline"),
            hook=payload.get("hook"),
            body=payload.get("body") or "",
            cta=payload.get("cta"),
            hashtags=payload.get("hashtags"),
            scores=result["scores"],
            pipeline_result=result,
            content_version=1,
            ai_model="marketing.agent_pipeline.v1",
            token_count=len((payload.get("body") or "").split()),
            status=ContentStatus.DRAFT.value,
        )
        row.status = ContentRequestStatus.COMPLETED.value
        row.error_message = None
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        self.db.flush()

        # Best-effort async mirror for worker observability (ignored on broker failure)
        try:
            from modules.marketing.tasks import run_content_agent_pipeline

            # Only queue if request not already completed with content; skip to avoid duplicate
            _ = run_content_agent_pipeline
        except Exception:
            pass
        return row

    def list_content(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.list_by_company(MktGeneratedContent, ctx, cid, branch_scoped=True)

    def get_content(self, ctx: TenantContext, row_id: UUID) -> MktGeneratedContent:
        row = self._repo.get_by_id(MktGeneratedContent, ctx, row_id, branch_scoped=True)
        if row is None:
            raise NotFoundException("Generated content not found")
        return row

    def update_content(self, ctx: TenantContext, row_id: UUID, **fields) -> MktGeneratedContent:
        existing = self.get_content(ctx, row_id)
        snap = {
            "headline": existing.headline,
            "hook": existing.hook,
            "body": existing.body,
            "cta": existing.cta,
            "hashtags": existing.hashtags,
            "scores": existing.scores,
            "status": existing.status,
        }
        self._repo.create_row(
            MktGeneratedContentVersion,
            ctx,
            company_id=existing.company_id,
            content_id=existing.id,
            version_number=existing.content_version,
            snapshot=snap,
        )
        fields["content_version"] = int(existing.content_version or 1) + 1
        row = self._repo.update_row(MktGeneratedContent, ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Generated content not found")
        return row

    def submit_for_review(self, ctx: TenantContext, row_id: UUID) -> MktGeneratedContent:
        return self.update_content(ctx, row_id, status=ContentStatus.IN_REVIEW.value)

    def approve(self, ctx: TenantContext, row_id: UUID) -> MktGeneratedContent:
        return self.update_content(ctx, row_id, status=ContentStatus.APPROVED.value)

    def list_versions(self, ctx: TenantContext, content_id: UUID):
        content = self.get_content(ctx, content_id)
        rows = self._repo.list_by_company(MktGeneratedContentVersion, ctx, content.company_id)
        return [r for r in rows if r.content_id == content_id]
