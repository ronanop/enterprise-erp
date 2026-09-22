"""Social reply inbox tied to published content."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.marketing.adapters.social_inbox_adapter import SocialInboxAdapter
from modules.marketing.domain.exceptions import NotFoundException
from modules.marketing.models import MktGeneratedContent, MktPublishJob, MktSocialInbox
from modules.marketing.repository.base import MktScopedRepository, utcnow
from modules.marketing.service.publish_truth import external_post_id, is_live_post_id


class InboxService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)
        self._adapter = SocialInboxAdapter()

    def list(self, ctx: TenantContext, company_id: UUID | None = None, campaign_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        rows = self._repo.list_by_company(MktSocialInbox, ctx, cid, branch_scoped=True)
        if campaign_id is not None:
            rows = [row for row in rows if row.campaign_id == campaign_id]
        return rows

    def sync(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._repo.resolve_company_id(ctx, company_id)
        jobs = self._repo.list_by_company(MktPublishJob, ctx, cid, branch_scoped=True)
        existing = {
            row.external_thread_id
            for row in self._repo.list_by_company(MktSocialInbox, ctx, cid, branch_scoped=True)
        }
        created = 0
        for job in jobs:
            post_id = external_post_id(job.result_payload)
            if not is_live_post_id(post_id):
                continue
            content = self.db.get(MktGeneratedContent, job.content_id)
            platform_code = None
            if isinstance(job.result_payload, dict):
                platform_code = job.result_payload.get("platform")
            pulled = self._adapter.pull(platform_code=platform_code, external_post_id=post_id)
            for item in pulled:
                thread_id = str(item.get("external_thread_id") or "").strip()
                if not thread_id or thread_id in existing:
                    continue
                self._repo.create_row(
                    MktSocialInbox,
                    ctx,
                    company_id=cid,
                    campaign_id=content.campaign_id if content else None,
                    content_id=job.content_id,
                    publish_job_id=job.id,
                    social_account_id=job.social_account_id,
                    platform_code=str(item.get("platform_code") or platform_code or "linkedin"),
                    external_thread_id=thread_id,
                    author_name=str(item.get("author_name") or "Unknown")[:255],
                    body=str(item.get("body") or ""),
                    kind=item.get("kind") if item.get("kind") in {"comment", "mention"} else "comment",
                    received_at=utcnow(),
                    status="open",
                )
                existing.add(thread_id)
                created += 1
        return {"created": created, "live_posts": sum(1 for job in jobs if is_live_post_id(external_post_id(job.result_payload)))}

    def assign(self, ctx: TenantContext, row_id: UUID, assignee_user_id: UUID) -> MktSocialInbox:
        row = self._repo.get_by_id(MktSocialInbox, ctx, row_id, branch_scoped=True)
        if row is None:
            raise NotFoundException("Inbox item not found")
        row.assignee_user_id = assignee_user_id
        row.status = "assigned"
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        self.db.flush()
        return row

    def complete(self, ctx: TenantContext, row_id: UUID) -> MktSocialInbox:
        row = self._repo.get_by_id(MktSocialInbox, ctx, row_id, branch_scoped=True)
        if row is None:
            raise NotFoundException("Inbox item not found")
        if row.assignee_user_id is None and ctx.user_id:
            row.assignee_user_id = ctx.user_id
        row.status = "done"
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        self.db.flush()
        return row
