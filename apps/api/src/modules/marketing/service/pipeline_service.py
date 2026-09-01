"""Marketing role-based work pipeline service."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.service.rbac_service import RBACService
from modules.marketing.domain.enums import CampaignStatus, ContentStatus, PostingReportStatus, WorkflowStage
from modules.marketing.models import MktCampaign, MktContentItem
from modules.marketing.repository.marketing_repository import CampaignRepository, ContentItemRepository
from modules.marketing.schemas import (
    ContentItemResponse,
    PipelineFunnelStage,
    PipelineHeadReviewGroup,
    PipelineHeadReviewResponse,
    PipelineWorkResponse,
    PipelineWorkStage,
)
from modules.marketing.service.linkedin_section_service import LinkedInSectionService
from modules.marketing.service.video_section_service import VideoSectionService
from modules.marketing.service.marketing_scope_validator import MarketingScopeValidator


def _is_linkedin_section_row(row: MktContentItem) -> bool:
    return LinkedInSectionService.is_linkedin_section_workflow(row) and bool(row.linkedin_head_sections)


def _is_video_section_row(row: MktContentItem) -> bool:
    return VideoSectionService.is_video_section_workflow(row) and bool(row.video_head_sections)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PipelineService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._content = ContentItemRepository(db)
        self._campaigns = CampaignRepository(db)
        self._scope = MarketingScopeValidator(db)
        self._rbac = RBACService(db)

    def _perms(self, ctx: TenantContext) -> set[str]:
        return self._rbac.get_user_permissions(ctx.user_id, ctx.tenant_id)

    def _has(self, ctx: TenantContext, code: str) -> bool:
        return code in self._perms(ctx)

    def _to_items(self, rows) -> list[ContentItemResponse]:
        return [ContentItemResponse.model_validate(r) for r in rows]

    def _user_map(self, user_ids: set[UUID]) -> dict[UUID, SecUser]:
        if not user_ids:
            return {}
        rows = self._db.scalars(
            select(SecUser).where(SecUser.id.in_(user_ids), SecUser.is_deleted.is_(False))
        ).all()
        return {u.id: u for u in rows}

    def _campaign_dict(self, row: MktCampaign) -> dict:
        return {
            "id": str(row.id),
            "campaign_number": row.campaign_number,
            "name": row.name,
            "description": row.description,
            "goals": row.goals,
            "target_audience_summary": row.target_audience_summary,
            "status": row.status,
            "rejection_reason": row.rejection_reason,
            "submitted_at": row.submitted_at.isoformat() if row.submitted_at else None,
            "created_by": str(row.created_by) if row.created_by else None,
        }

    def _pending_posting_report_items(self, ctx: TenantContext, company_id: UUID, statuses: list[str]):
        seen: dict[UUID, MktContentItem] = {}
        if self._has(ctx, "marketing.content:submit"):
            for row in self._content.list_rows(
                ctx,
                company_id,
                statuses=statuses,
                posting_report_status="pending",
                mine=True,
            ):
                seen[row.id] = row
        if self._has(ctx, "marketing.content:publish") and not self._has(ctx, "marketing.content:approve"):
            for row in self._content.list_rows(
                ctx,
                company_id,
                statuses=statuses,
                posting_report_status="pending",
                mine=False,
            ):
                if row.created_by_id != ctx.user_id:
                    seen.setdefault(row.id, row)
        return [r for r in seen.values() if not _is_linkedin_section_row(r) and not _is_video_section_row(r)]

    def get_funnel(self, ctx: TenantContext, company_id: UUID | None = None) -> list[PipelineFunnelStage]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        perms = self._perms(ctx)
        stages: list[PipelineFunnelStage] = []

        def count_status(*statuses: str) -> int:
            rows = self._content.list_rows(ctx, cid, statuses=list(statuses))
            return len(rows)

        funnel_defs = [
            ("draft", "Draft", [ContentStatus.DRAFT.value], "marketing.content:read"),
            ("in_review", "In review", [ContentStatus.IN_REVIEW.value], "marketing.content:read"),
            ("changes_required", "Changes required", [ContentStatus.CHANGES_REQUIRED.value], "marketing.content:read"),
            ("media_approved", "Media approved", [ContentStatus.MEDIA_APPROVED.value], "marketing.content:read"),
            ("approved", "Approved", [ContentStatus.APPROVED.value, ContentStatus.SCHEDULED.value], "marketing.content:read"),
            ("published", "Published", [ContentStatus.PUBLISHED.value], "marketing.content:read"),
            ("archived", "Published", [ContentStatus.ARCHIVED.value], "marketing.content:read"),
        ]
        for key, label, statuses, perm in funnel_defs:
            if perm not in perms and "marketing.report:read" not in perms:
                continue
            stages.append(PipelineFunnelStage(key=key, label=label, count=count_status(*statuses)))
        return stages

    def get_my_work(self, ctx: TenantContext, company_id: UUID | None = None) -> PipelineWorkResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        perms = self._perms(ctx)
        stages: list[PipelineWorkStage] = []
        role_hints: list[str] = []

        stage_defs: list[tuple[str, str, str, list[str], str | None, bool, str]] = [
            (
                "my_drafts",
                "My drafts",
                "Create and edit before submitting for review.",
                [ContentStatus.DRAFT.value],
                "marketing.content:create",
                True,
                "creator",
            ),
            (
                "needs_fixes",
                "Changes required",
                "Feedback from reviewers — update text and resubmit.",
                [ContentStatus.CHANGES_REQUIRED.value],
                "marketing.content:submit",
                True,
                "creator",
            ),
            (
                "my_in_review",
                "Submitted — in pipeline",
                "Waiting for media or head approval.",
                [ContentStatus.IN_REVIEW.value, ContentStatus.MEDIA_APPROVED.value],
                "marketing.content:submit",
                True,
                "creator",
            ),
            (
                "media_queue",
                "Media / banner review — approve or send feedback",
                "Verify images, banners, and creative. Approve or use the feedback box to send back to creator.",
                [ContentStatus.IN_REVIEW.value],
                "marketing.content:approve_media",
                False,
                "media",
            ),
            (
                "head_queue",
                "Head approval",
                "Final sign-off after media is approved.",
                [ContentStatus.MEDIA_APPROVED.value],
                "marketing.content:approve",
                False,
                "head",
            ),
        ]

        for key, label, description, statuses, perm, mine, hint in stage_defs:
            if perm and perm not in perms:
                continue
            rows = self._content.list_rows(ctx, cid, statuses=statuses, mine=mine)
            if key == "my_in_review":
                rows = [r for r in rows if not _is_linkedin_section_row(r) and not _is_video_section_row(r)]
                if not rows:
                    continue
            elif not rows and perm not in perms:
                continue
            if rows or perm in perms:
                stages.append(
                    PipelineWorkStage(
                        key=key,
                        label=label,
                        description=description,
                        count=len(rows),
                        items=self._to_items(rows),
                    )
                )
                if hint not in role_hints:
                    role_hints.append(hint)

        linkedin_svc = LinkedInSectionService(self._db)
        video_svc = VideoSectionService(self._db)

        if self._has(ctx, "marketing.content:approve_business"):
            bo_rows = [
                r
                for r in self._content.list_rows(
                    ctx,
                    cid,
                    statuses=[ContentStatus.IN_REVIEW.value, ContentStatus.APPROVED.value],
                )
                if linkedin_svc.can_business_owner_review(r)
            ]
            if bo_rows or self._has(ctx, "marketing.content:approve_business"):
                stages.append(
                    PipelineWorkStage(
                        key="business_owner_queue",
                        label="Business owner review",
                        description="Marketing head approved the draft. Approve, reject, or send feedback to marketing head.",
                        count=len(bo_rows),
                        items=self._to_items(bo_rows),
                    )
                )
                if "business_owner" not in role_hints:
                    role_hints.append("business_owner")

        if self._has(ctx, "marketing.content:submit"):
            handler_send_draft = [
                r
                for r in self._content.list_rows(ctx, cid, statuses=[ContentStatus.APPROVED.value], mine=True)
                if linkedin_svc.can_handler_submit_final_draft_to_head(r)
            ]
            if handler_send_draft:
                stages.append(
                    PipelineWorkStage(
                        key="linkedin_send_final_draft_to_head",
                        label="Send final draft to marketing head",
                        description="Upload the final poster image and content (or NA), then send to marketing head for approval.",
                        count=len(handler_send_draft),
                        items=self._to_items(handler_send_draft),
                    )
                )
                if "creator" not in role_hints:
                    role_hints.append("creator")

            video_send_draft = [
                r
                for r in self._content.list_rows(ctx, cid, statuses=[ContentStatus.APPROVED.value], mine=True)
                if video_svc.can_editor_submit_final_draft_to_head(r)
            ]
            if video_send_draft:
                stages.append(
                    PipelineWorkStage(
                        key="video_send_final_draft_to_head",
                        label="Send final video draft to marketing head",
                        description="Upload the final rendered video and caption (or NA), then send to marketing head for approval.",
                        count=len(video_send_draft),
                        items=self._to_items(video_send_draft),
                    )
                )
                if "creator" not in role_hints:
                    role_hints.append("creator")

            handler_send = [
                r
                for r in self._content.list_rows(ctx, cid, statuses=[ContentStatus.APPROVED.value], mine=True)
                if linkedin_svc.can_handler_send_to_publisher(r)
            ]
            if handler_send:
                stages.append(
                    PipelineWorkStage(
                        key="linkedin_send_to_publisher",
                        label="Send final draft to publisher",
                        description="Marketing head approved your fields. Review the final draft and send it to the publisher.",
                        count=len(handler_send),
                        items=self._to_items(handler_send),
                    )
                )
                if "creator" not in role_hints:
                    role_hints.append("creator")

            video_send = [
                r
                for r in self._content.list_rows(ctx, cid, statuses=[ContentStatus.APPROVED.value], mine=True)
                if video_svc.can_editor_send_to_publisher(r)
            ]
            if video_send:
                stages.append(
                    PipelineWorkStage(
                        key="video_send_to_publisher",
                        label="Send final video to publisher",
                        description="Marketing head approved your final draft. Send it to the publisher.",
                        count=len(video_send),
                        items=self._to_items(video_send),
                    )
                )
                if "creator" not in role_hints:
                    role_hints.append("creator")

        is_publisher_only = self._has(ctx, "marketing.content:publish") and not self._has(
            ctx, "marketing.content:approve"
        ) and not self._has(ctx, "marketing.content:submit") and not self._has(
            ctx, "marketing.channel:update"
        ) and not self._has(ctx, "marketing.asset:create")
        if is_publisher_only:
            publisher_queue = [
                r
                for r in self._content.list_rows(ctx, cid, statuses=[ContentStatus.APPROVED.value])
                if (
                    _is_linkedin_section_row(r) or _is_video_section_row(r)
                )
                and r.workflow_stage == WorkflowStage.PUBLISHER_REVIEW.value
                and r.status != ContentStatus.PUBLISHED.value
            ]
            if publisher_queue:
                stages.append(
                    PipelineWorkStage(
                        key="linkedin_publisher_queue",
                        label="Mark as published",
                        description="Final drafts sent to you — mark each as published when live.",
                        count=len(publisher_queue),
                        items=self._to_items(publisher_queue),
                    )
                )
                if "publisher" not in role_hints:
                    role_hints.append("publisher")

        post_ready = [
            ContentStatus.APPROVED.value,
            ContentStatus.SCHEDULED.value,
            ContentStatus.PUBLISHED.value,
        ]
        pending_report = self._pending_posting_report_items(ctx, cid, post_ready)
        can_report = self._has(ctx, "marketing.content:submit") or (
            self._has(ctx, "marketing.content:publish") and not self._has(ctx, "marketing.content:approve")
        )
        if pending_report and can_report:
            is_publisher = self._has(ctx, "marketing.content:publish") and not self._has(ctx, "marketing.content:approve")
            stages.append(
                PipelineWorkStage(
                    key="report_posting_to_head",
                    label="Tell marketing head — posted or not?",
                    description=(
                        "Head approved this content. After you post (or if not yet), open each item and choose "
                        "“Yes — I posted it” or “Not posted yet”."
                        if is_publisher
                        else "Head approved your content. Open each item and tap “Yes — I posted it” or “Not posted yet”."
                    ),
                    count=len(pending_report),
                    items=self._to_items(pending_report),
                )
            )
            if is_publisher and "publisher" not in role_hints:
                role_hints.append("publisher")
            elif "creator" not in role_hints:
                role_hints.append("creator")

        if self._has(ctx, "marketing.content:approve"):
            linkedin_awaiting = [
                r
                for r in self._content.list_rows(ctx, cid, statuses=[ContentStatus.IN_REVIEW.value])
                if _is_linkedin_section_row(r)
                and r.workflow_stage == WorkflowStage.LINKEDIN_FINAL_DRAFT_HEAD_REVIEW.value
            ]
            video_awaiting = [
                r
                for r in self._content.list_rows(ctx, cid, statuses=[ContentStatus.IN_REVIEW.value])
                if _is_video_section_row(r)
                and r.workflow_stage == WorkflowStage.VIDEO_FINAL_DRAFT_HEAD_REVIEW.value
            ]
            final_draft_items = linkedin_awaiting + video_awaiting
            if final_draft_items:
                stages.append(
                    PipelineWorkStage(
                        key="head_final_draft_review",
                        label="Final draft approval — poster & content",
                        description="Handler sent the final creative and copy. Approve before they send to publisher.",
                        count=len(final_draft_items),
                        items=self._to_items(final_draft_items),
                    )
                )

            linkedin_awaiting_pub = [
                r
                for r in self._content.list_rows(ctx, cid, statuses=[ContentStatus.APPROVED.value])
                if (_is_linkedin_section_row(r) or _is_video_section_row(r))
                and r.workflow_stage == WorkflowStage.PUBLISHER_REVIEW.value
                and r.posting_report_status == PostingReportStatus.NOT_POSTED.value
            ]
            if linkedin_awaiting_pub:
                stages.append(
                    PipelineWorkStage(
                        key="head_awaiting_publisher",
                        label="Awaiting publisher — not marked published yet",
                        description="Final draft was sent to publisher. Follow up if still not marked published.",
                        count=len(linkedin_awaiting_pub),
                        items=self._to_items(linkedin_awaiting_pub),
                    )
                )

            reported = [
                r
                for r in self._content.list_rows(ctx, cid, statuses=post_ready)
                if r.posting_report_status in {"posted", "not_posted", "pending"}
                and not _is_linkedin_section_row(r)
                and not _is_video_section_row(r)
            ]
            section_published = [
                r
                for r in self._content.list_rows(ctx, cid, statuses=post_ready)
                if (_is_linkedin_section_row(r) or _is_video_section_row(r))
                and r.posting_report_status in {PostingReportStatus.POSTED.value, PostingReportStatus.NOT_POSTED.value}
            ]
            all_reported = reported + section_published
            stages.append(
                PipelineWorkStage(
                    key="team_posting_reports",
                    label="Posting confirmations from team",
                    description="Publisher status — posted or not published yet.",
                    count=len(all_reported),
                    items=self._to_items(all_reported),
                )
            )
            if "head" not in role_hints:
                role_hints.append("head")

        if self._has(ctx, "marketing.campaign:create") or self._has(ctx, "marketing.campaign:update"):
            all_campaigns = self._campaigns.list_rows(ctx, cid)
            mine = [c for c in all_campaigns if c.created_by == ctx.user_id]

            draft_rows = [c for c in mine if c.status in {CampaignStatus.DRAFT.value, CampaignStatus.CHANGES_REQUIRED.value}]
            stages.append(
                PipelineWorkStage(
                    key="campaign_drafts",
                    label="Campaign drafts",
                    description="Write campaign details, then submit for marketing head approval.",
                    count=len(draft_rows),
                    items=[],
                    campaigns=[self._campaign_dict(c) for c in draft_rows],
                )
            )
            in_review_mine = [c for c in mine if c.status == CampaignStatus.IN_REVIEW.value]
            if in_review_mine:
                stages.append(
                    PipelineWorkStage(
                        key="campaign_submitted",
                        label="Campaigns — waiting for head",
                        description="Submitted for approval. Head will verify or send feedback.",
                        count=len(in_review_mine),
                        items=[],
                        campaigns=[self._campaign_dict(c) for c in in_review_mine],
                    )
                )
            approved_mine = [c for c in mine if c.status == CampaignStatus.APPROVED.value]
            if approved_mine:
                stages.append(
                    PipelineWorkStage(
                        key="campaign_approved",
                        label="Campaigns — approved, ready to activate",
                        description="Head approved — activate when ready to go live.",
                        count=len(approved_mine),
                        items=[],
                        campaigns=[self._campaign_dict(c) for c in approved_mine],
                    )
                )
            if "campaign" not in role_hints:
                role_hints.append("campaign")

        if self._has(ctx, "marketing.content:approve"):
            head_campaigns = [
                c for c in self._campaigns.list_rows(ctx, cid) if c.status == CampaignStatus.IN_REVIEW.value
            ]
            stages.append(
                PipelineWorkStage(
                    key="campaign_head_review",
                    label="Campaign approval (head)",
                    description="Review campaign write-up — approve or send feedback to submitter.",
                    count=len(head_campaigns),
                    items=[],
                    campaigns=[self._campaign_dict(c) for c in head_campaigns],
                )
            )

        return PipelineWorkResponse(
            role_hints=role_hints,
            stages=stages,
            funnel=self.get_funnel(ctx, company_id),
            refreshed_at=_utcnow(),
        )

    def get_head_review_board(self, ctx: TenantContext, company_id: UUID | None = None) -> PipelineHeadReviewResponse:
        if not self._has(ctx, "marketing.content:approve"):
            return PipelineHeadReviewResponse(groups=[], refreshed_at=_utcnow())

        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._content.list_rows(ctx, cid, statuses=[ContentStatus.MEDIA_APPROVED.value, ContentStatus.IN_REVIEW.value])
        user_ids = {r.created_by_id for r in rows if r.created_by_id}
        users = self._user_map(user_ids)

        grouped: dict[UUID | None, list[MktContentItem]] = {}
        for row in rows:
            grouped.setdefault(row.created_by_id, []).append(row)

        groups: list[PipelineHeadReviewGroup] = []
        for uid, items in grouped.items():
            user = users.get(uid) if uid else None
            groups.append(
                PipelineHeadReviewGroup(
                    user_id=uid,
                    display_name=user.display_name if user else "Unknown",
                    email=user.email if user else None,
                    items=self._to_items(items),
                )
            )
        groups.sort(key=lambda g: g.display_name.lower())

        return PipelineHeadReviewResponse(groups=groups, refreshed_at=_utcnow())
