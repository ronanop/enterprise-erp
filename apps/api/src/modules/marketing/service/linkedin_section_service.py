"""Content-based LinkedIn section approval — no verification checklist."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.marketing.domain.enums import (
    ContentStatus,
    ContentType,
    PostingReportStatus,
    VerifierRole,
    VerificationOverallStatus,
    WorkflowStage,
)
from modules.marketing.domain.exceptions import InvalidMarketingState
from modules.marketing.models.content_item import MktContentItem
from modules.marketing.models.content_verification import MktContentVerification
from modules.marketing.models.content_asset_link import MktContentAssetLink
from modules.marketing.service.activity_log_service import ActivityLogService
from modules.marketing.service.engines.content_engine import ContentItemEngine

LINKEDIN_SECTION_IDS = ("post",)
LINKEDIN_SECTION_ALIASES = {"content": "post", "theme": "post", "fonts": "post"}
LEGACY_SECTION_IDS = frozenset({"content", "theme", "fonts"})
LINKEDIN_FINAL_POSTER_ROLE = "linkedin_final_poster"

FINAL_DRAFT_STATUS_DRAFT = "draft"
FINAL_DRAFT_STATUS_AWAITING_HEAD = "awaiting_head"
FINAL_DRAFT_STATUS_APPROVED = "approved"
FINAL_DRAFT_STATUS_CHANGES_REQUESTED = "changes_requested"
FINAL_DRAFT_STATUS_REJECTED = "rejected"

BO_STATUS_AWAITING = "awaiting_business_owner"
BO_STATUS_APPROVED = "approved"
BO_STATUS_CHANGES_REQUESTED = "changes_requested"
BO_STATUS_REJECTED = "rejected"

# UI / API status values stored per section
SECTION_STATUS_PENDING = "pending"
SECTION_STATUS_AWAITING_HEAD = "awaiting_head"
SECTION_STATUS_APPROVED = "approved"
SECTION_STATUS_CHANGES_REQUESTED = "changes_requested"
SECTION_STATUS_REJECTED = "rejected"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _empty_section() -> dict[str, Any]:
    return {
        "status": SECTION_STATUS_PENDING,
        "comments": None,
        "reviewed_at": None,
        "reviewed_by_user_id": None,
    }


def _post_section_data_ready(row: MktContentItem) -> bool:
    """Topic + company are required; theme and media are optional."""
    body = (row.body or "").strip()
    if not body:
        return False
    if (row.summary or "").strip():
        return True
    return bool((row.hashtags or "").strip())


def _section_data_ready(row: MktContentItem, section_id: str) -> bool:
    canonical = LINKEDIN_SECTION_ALIASES.get(section_id, section_id)
    if canonical == "post":
        return _post_section_data_ready(row)
    return False


def _resolve_section_id(section_id: str) -> str:
    return LINKEDIN_SECTION_ALIASES.get(section_id, section_id)


def _merge_legacy_status(sections: dict[str, Any], row: MktContentItem) -> str:
    content = sections.get("content") or {}
    theme = sections.get("theme") or {}
    post = sections.get("post") or {}
    statuses = [
        s
        for s in (content.get("status"), theme.get("status"), post.get("status"))
        if s
    ]
    if SECTION_STATUS_REJECTED in statuses:
        return SECTION_STATUS_REJECTED
    if SECTION_STATUS_CHANGES_REQUESTED in statuses:
        return SECTION_STATUS_CHANGES_REQUESTED
    content_approved = content.get("status") == SECTION_STATUS_APPROVED
    theme_approved = theme.get("status") == SECTION_STATUS_APPROVED
    post_approved = post.get("status") == SECTION_STATUS_APPROVED
    if post_approved or (content_approved and (theme_approved or not (row.theme or "").strip())):
        return SECTION_STATUS_APPROVED
    if content_approved and (row.theme or "").strip() and not theme_approved:
        return SECTION_STATUS_AWAITING_HEAD
    if SECTION_STATUS_AWAITING_HEAD in statuses:
        return SECTION_STATUS_AWAITING_HEAD
    if _post_section_data_ready(row):
        return SECTION_STATUS_AWAITING_HEAD
    return SECTION_STATUS_PENDING


def _merge_legacy_comments(sections: dict[str, Any]) -> str | None:
    parts: list[str] = []
    for key, label in (("content", "Content"), ("theme", "Theme"), ("post", "Post")):
        comments = (sections.get(key) or {}).get("comments")
        if comments and str(comments).strip():
            parts.append(f"{label}: {comments}")
    return "\n\n".join(parts) if parts else None


def _normalize_sections(sections: dict[str, Any], row: MktContentItem) -> tuple[dict[str, Any], bool]:
    if not sections:
        return {}, False

    has_legacy = any(key in sections for key in LEGACY_SECTION_IDS)
    post = dict(sections.get("post") or _empty_section())

    if not has_legacy:
        cleaned = {"post": post}
        return cleaned, set(sections.keys()) != {"post"}

    post["status"] = _merge_legacy_status(sections, row)
    merged_comments = _merge_legacy_comments(sections)
    if merged_comments:
        post["comments"] = merged_comments

    for key in ("content", "theme", "post"):
        reviewed_at = (sections.get(key) or {}).get("reviewed_at")
        if reviewed_at:
            post["reviewed_at"] = reviewed_at
            post["reviewed_by_user_id"] = (sections.get(key) or {}).get("reviewed_by_user_id")
            break

    return {"post": post}, True


def _resync_linkedin_sections(row: MktContentItem) -> bool:
    """Normalize legacy multi-section state and promote ready posts to awaiting_head."""
    if not row.linkedin_head_sections:
        return False

    sections, changed = _normalize_sections(dict(row.linkedin_head_sections), row)
    post = dict(sections.get("post") or _empty_section())
    status = post.get("status")
    if status == SECTION_STATUS_PENDING and _post_section_data_ready(row):
        post["status"] = SECTION_STATUS_AWAITING_HEAD
        changed = True
    sections["post"] = post

    if changed:
        row.linkedin_head_sections = sections
    return changed


class LinkedInSectionService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._activity = ActivityLogService(db)
        self._engine = ContentItemEngine()

    def _assert_editable(self, row: MktContentItem) -> None:
        self._engine.assert_editable(row)

    @staticmethod
    def is_linkedin_section_workflow(row: MktContentItem) -> bool:
        return row.content_type == ContentType.SOCIAL_POST.value

    @staticmethod
    def uses_linkedin_sections(row: MktContentItem) -> bool:
        return row.linkedin_head_sections is not None

    @staticmethod
    def needs_section_backfill(row: MktContentItem) -> bool:
        if not LinkedInSectionService.is_linkedin_section_workflow(row):
            return False
        if row.linkedin_head_sections is not None:
            return False
        return row.status in {
            ContentStatus.IN_REVIEW.value,
            ContentStatus.CHANGES_REQUIRED.value,
            ContentStatus.APPROVED.value,
        }

    def ensure_sections_initialized(self, ctx: TenantContext, row: MktContentItem) -> bool:
        """Backfill or refresh section state for social posts in head review."""
        if not self.is_linkedin_section_workflow(row):
            return False
        if row.linkedin_head_sections is None:
            if not self.needs_section_backfill(row):
                return False
            self.initialize_on_submit(ctx, row)
            return True
        return _resync_linkedin_sections(row)

    def initialize_on_submit(self, ctx: TenantContext, row: MktContentItem) -> None:
        post = _empty_section()
        if _post_section_data_ready(row):
            post["status"] = SECTION_STATUS_AWAITING_HEAD
        row.linkedin_head_sections = {"post": post}
        row.workflow_stage = WorkflowStage.HEAD_FINAL_REVIEW.value
        row.updated_by = ctx.user_id
        self._activity.log(
            ctx,
            entity_type="content",
            entity_id=row.id,
            action="linkedin_submitted_to_head",
            company_id=row.company_id,
        )

    def reset_on_resubmit(self, ctx: TenantContext, row: MktContentItem) -> None:
        self.initialize_on_submit(ctx, row)

    def get_sections(self, row: MktContentItem) -> dict[str, dict[str, Any]]:
        if not row.linkedin_head_sections:
            return {}
        sections, _ = _normalize_sections(dict(row.linkedin_head_sections), row)
        return sections

    def pending_head_count(self, row: MktContentItem) -> int:
        if not row.linkedin_head_sections:
            return 0
        sections, _ = _normalize_sections(dict(row.linkedin_head_sections), row)
        return sum(
            1
            for s in sections.values()
            if s.get("status") == SECTION_STATUS_AWAITING_HEAD
        )

    def head_review_section(
        self,
        ctx: TenantContext,
        content_id: UUID,
        *,
        section_id: str,
        status: str,
        comments: str | None = None,
    ) -> MktContentItem:
        section_id = _resolve_section_id(section_id)
        if section_id not in LINKEDIN_SECTION_IDS:
            raise InvalidMarketingState(f"Unknown section: {section_id}")
        if status not in {
            SECTION_STATUS_APPROVED,
            SECTION_STATUS_CHANGES_REQUESTED,
            SECTION_STATUS_REJECTED,
        }:
            raise InvalidMarketingState("Invalid review status")

        row = self._db.get(MktContentItem, content_id)
        if row is None or row.is_deleted:
            raise NotFoundException("Content not found")
        self._assert_editable(row)
        if not self.is_linkedin_section_workflow(row):
            raise InvalidMarketingState("This post does not use LinkedIn section approval")
        if not row.linkedin_head_sections:
            self.ensure_sections_initialized(ctx, row)
        if not row.linkedin_head_sections:
            raise InvalidMarketingState("This post does not use LinkedIn section approval")

        if _resync_linkedin_sections(row):
            row.updated_by = ctx.user_id
            self._db.flush()

        sections = dict(row.linkedin_head_sections)
        section = dict(sections.get(section_id, _empty_section()))

        if section.get("status") == SECTION_STATUS_APPROVED and status == SECTION_STATUS_APPROVED:
            return row

        current_status = section.get("status")
        if current_status not in {SECTION_STATUS_AWAITING_HEAD, SECTION_STATUS_PENDING}:
            raise InvalidMarketingState("This section is not awaiting head review")

        if not _section_data_ready(row, section_id):
            raise InvalidMarketingState(
                "Add topic and company before this post can be reviewed"
            )

        if current_status == SECTION_STATUS_PENDING:
            section["status"] = SECTION_STATUS_AWAITING_HEAD

        section["status"] = status
        section["comments"] = comments
        section["reviewed_at"] = _utcnow().isoformat()
        section["reviewed_by_user_id"] = str(ctx.user_id)
        sections[section_id] = section
        row.linkedin_head_sections = sections
        row.updated_by = ctx.user_id

        if status in {SECTION_STATUS_CHANGES_REQUESTED, SECTION_STATUS_REJECTED}:
            row.status = ContentStatus.CHANGES_REQUIRED.value
            row.workflow_stage = WorkflowStage.CHANGES_REQUIRED.value
            row.rejection_reason = comments
        elif self._all_sections_approved(row, sections):
            self._finalize_all_approved(ctx, row)
        else:
            row.status = ContentStatus.IN_REVIEW.value
            row.workflow_stage = WorkflowStage.HEAD_FINAL_REVIEW.value

        self._activity.log(
            ctx,
            entity_type="content",
            entity_id=content_id,
            action=f"linkedin_head_{status}_{section_id}",
            details=comments,
            company_id=row.company_id,
        )
        self._db.flush()
        return row

    def _all_sections_approved(self, row: MktContentItem, sections: dict[str, dict[str, Any]]) -> bool:
        normalized, _ = _normalize_sections(sections, row)
        for section_id in LINKEDIN_SECTION_IDS:
            if not _section_data_ready(row, section_id):
                continue
            if normalized.get(section_id, {}).get("status") != SECTION_STATUS_APPROVED:
                return False
        return True

    def _finalize_all_approved(self, ctx: TenantContext, row: MktContentItem) -> None:
        """After marketing head approves source draft → Business Owner review (not LinkedIn yet)."""
        now = _utcnow()
        row.final_head_approved_at = now
        row.workflow_stage = WorkflowStage.BUSINESS_OWNER_REVIEW.value
        row.status = ContentStatus.IN_REVIEW.value
        row.posting_report_status = None
        row.rejection_reason = None
        row.linkedin_final_draft = None
        row.business_owner_review = {
            "status": BO_STATUS_AWAITING,
            "comments": None,
            "reviewed_at": None,
            "reviewed_by_user_id": None,
            "feedback_to_head": None,
        }

        verification = self._db.scalar(
            select(MktContentVerification).where(
                MktContentVerification.content_item_id == row.id,
                MktContentVerification.verifier_role == VerifierRole.LINKEDIN_HANDLER.value,
                MktContentVerification.is_deleted.is_(False),
            )
        )
        if verification is None:
            verification = MktContentVerification(
                id=uuid4(),
                tenant_id=ctx.tenant_id,
                company_id=row.company_id,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
                content_item_id=row.id,
                verifier_role=VerifierRole.LINKEDIN_HANDLER.value,
                overall_status=VerificationOverallStatus.SUBMITTED_TO_HEAD.value,
            )
            self._db.add(verification)
        else:
            verification.overall_status = VerificationOverallStatus.SUBMITTED_TO_HEAD.value
            verification.sent_to_publisher_at = None
            verification.publisher_upload_status = None
            verification.updated_by = ctx.user_id

        self._activity.log(
            ctx,
            entity_type="content",
            entity_id=row.id,
            action="linkedin_head_approved_awaiting_business_owner",
            details="Post approved by marketing head — awaiting business owner review",
            company_id=row.company_id,
        )

    def can_business_owner_review(self, row: MktContentItem) -> bool:
        if not self.is_linkedin_section_workflow(row):
            return False
        if row.workflow_stage != WorkflowStage.BUSINESS_OWNER_REVIEW.value:
            return False
        bo = dict(row.business_owner_review or {})
        return bo.get("status") in {BO_STATUS_AWAITING, None, ""}

    def _release_to_linkedin_handler(self, ctx: TenantContext, row: MktContentItem) -> None:
        """Business owner approved → LinkedIn handler builds final draft."""
        row.workflow_stage = WorkflowStage.LINKEDIN_HANDLER_REVIEW.value
        row.status = ContentStatus.APPROVED.value
        row.rejection_reason = None
        row.linkedin_final_draft = {
            "content_text": None,
            "poster_media_asset_id": None,
            "status": FINAL_DRAFT_STATUS_DRAFT,
            "submitted_at": None,
            "submitted_by_user_id": None,
            "reviewed_at": None,
            "reviewed_by_user_id": None,
            "comments": None,
        }

        verification = self._db.scalar(
            select(MktContentVerification).where(
                MktContentVerification.content_item_id == row.id,
                MktContentVerification.verifier_role == VerifierRole.LINKEDIN_HANDLER.value,
                MktContentVerification.is_deleted.is_(False),
            )
        )
        if verification is None:
            verification = MktContentVerification(
                id=uuid4(),
                tenant_id=ctx.tenant_id,
                company_id=row.company_id,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
                content_item_id=row.id,
                verifier_role=VerifierRole.LINKEDIN_HANDLER.value,
                overall_status=VerificationOverallStatus.APPROVED.value,
            )
            self._db.add(verification)
        else:
            verification.overall_status = VerificationOverallStatus.APPROVED.value
            verification.sent_to_publisher_at = None
            verification.publisher_upload_status = None
            verification.updated_by = ctx.user_id

    def business_owner_review(
        self,
        ctx: TenantContext,
        content_id: UUID,
        *,
        status: str,
        comments: str | None = None,
    ) -> MktContentItem:
        if status not in {BO_STATUS_APPROVED, BO_STATUS_CHANGES_REQUESTED, BO_STATUS_REJECTED}:
            raise InvalidMarketingState(
                "Business owner status must be approved, changes_requested, or rejected"
            )

        row = self._db.get(MktContentItem, content_id)
        if row is None or row.is_deleted:
            raise NotFoundException("Content not found")
        self._assert_editable(row)
        if not self.can_business_owner_review(row):
            raise InvalidMarketingState("This draft is not awaiting business owner review")

        now = _utcnow()
        feedback = (comments or "").strip() or None
        row.business_owner_review = {
            "status": status,
            "comments": feedback,
            "reviewed_at": now.isoformat(),
            "reviewed_by_user_id": str(ctx.user_id),
            "feedback_to_head": feedback if status == BO_STATUS_CHANGES_REQUESTED else None,
        }
        row.updated_by = ctx.user_id

        if status == BO_STATUS_APPROVED:
            self._release_to_linkedin_handler(ctx, row)
            action = "business_owner_approved"
            details = feedback or "Business owner approved — LinkedIn handler can build final draft"
        elif status == BO_STATUS_CHANGES_REQUESTED:
            # Send feedback to marketing head to re-review the source draft
            sections = dict(row.linkedin_head_sections or {})
            post = dict(sections.get("post") or _empty_section())
            post["status"] = SECTION_STATUS_CHANGES_REQUESTED
            post["comments"] = feedback
            post["reviewed_at"] = now.isoformat()
            post["reviewed_by_user_id"] = str(ctx.user_id)
            sections["post"] = post
            row.linkedin_head_sections = sections
            row.status = ContentStatus.CHANGES_REQUIRED.value
            row.workflow_stage = WorkflowStage.CHANGES_REQUIRED.value
            row.rejection_reason = feedback
            action = "business_owner_feedback_to_head"
            details = feedback or "Business owner requested changes — sent back to marketing head"
        else:
            row.status = ContentStatus.REJECTED.value
            row.workflow_stage = WorkflowStage.REJECTED.value
            row.rejection_reason = feedback
            action = "business_owner_rejected"
            details = feedback or "Business owner rejected the draft"

        self._activity.log(
            ctx,
            entity_type="content",
            entity_id=content_id,
            action=action,
            details=details,
            company_id=row.company_id,
        )
        self._db.flush()
        return row

    def all_sections_approved(self, row: MktContentItem) -> bool:
        if not row.linkedin_head_sections:
            return False
        return self._all_sections_approved(row, dict(row.linkedin_head_sections))

    def _final_draft(self, row: MktContentItem) -> dict[str, Any]:
        if not row.linkedin_final_draft:
            return {}
        return dict(row.linkedin_final_draft)

    def _assert_handler_owner(self, ctx: TenantContext, row: MktContentItem) -> None:
        if row.created_by_id != ctx.user_id and row.assigned_to_id != ctx.user_id:
            raise ForbiddenException("Only the LinkedIn handler who owns this post can perform this action")

    def can_handler_submit_final_draft_to_head(self, row: MktContentItem) -> bool:
        if not self.is_linkedin_section_workflow(row):
            return False
        if row.workflow_stage != WorkflowStage.LINKEDIN_HANDLER_REVIEW.value:
            return False
        if row.status != ContentStatus.APPROVED.value:
            return False
        if not self.all_sections_approved(row):
            return False
        draft = self._final_draft(row)
        status = draft.get("status")
        return status in {FINAL_DRAFT_STATUS_DRAFT, FINAL_DRAFT_STATUS_CHANGES_REQUESTED, None, ""}

    def submit_final_draft_to_head(
        self,
        ctx: TenantContext,
        content_id: UUID,
        *,
        content_text: str | None = None,
        poster_media_asset_id: UUID | None = None,
    ) -> MktContentItem:
        row = self._db.get(MktContentItem, content_id)
        if row is None or row.is_deleted:
            raise NotFoundException("Content not found")
        self._assert_editable(row)
        if not self.can_handler_submit_final_draft_to_head(row):
            raise InvalidMarketingState(
                "Complete section approval and prepare your final draft before sending it to marketing head"
            )
        self._assert_handler_owner(ctx, row)

        text = (content_text or "").strip() or "NA"

        if poster_media_asset_id is not None:
            link = self._db.scalar(
                select(MktContentAssetLink).where(
                    MktContentAssetLink.content_item_id == row.id,
                    MktContentAssetLink.media_asset_id == poster_media_asset_id,
                    MktContentAssetLink.is_deleted.is_(False),
                )
            )
            if link is None:
                raise InvalidMarketingState("Upload the final poster image and link it to this post first")
            if link.asset_role != LINKEDIN_FINAL_POSTER_ROLE:
                link.asset_role = LINKEDIN_FINAL_POSTER_ROLE
                link.updated_by = ctx.user_id

        now = _utcnow()
        row.linkedin_final_draft = {
            "content_text": text,
            "poster_media_asset_id": str(poster_media_asset_id) if poster_media_asset_id else None,
            "status": FINAL_DRAFT_STATUS_AWAITING_HEAD,
            "submitted_at": now.isoformat(),
            "submitted_by_user_id": str(ctx.user_id),
            "reviewed_at": None,
            "reviewed_by_user_id": None,
            "comments": None,
        }
        row.workflow_stage = WorkflowStage.LINKEDIN_FINAL_DRAFT_HEAD_REVIEW.value
        row.status = ContentStatus.IN_REVIEW.value
        row.updated_by = ctx.user_id

        self._activity.log(
            ctx,
            entity_type="content",
            entity_id=content_id,
            action="linkedin_final_draft_submitted_to_head",
            details=text if text.lower() != "na" else "No copy — NA",
            company_id=row.company_id,
        )
        self._db.flush()
        return row

    def can_head_review_final_draft(self, row: MktContentItem) -> bool:
        if not self.is_linkedin_section_workflow(row):
            return False
        draft = self._final_draft(row)
        return (
            row.workflow_stage == WorkflowStage.LINKEDIN_FINAL_DRAFT_HEAD_REVIEW.value
            and draft.get("status") == FINAL_DRAFT_STATUS_AWAITING_HEAD
        )

    def head_review_final_draft(
        self,
        ctx: TenantContext,
        content_id: UUID,
        *,
        status: str,
        comments: str | None = None,
    ) -> MktContentItem:
        if status not in {
            FINAL_DRAFT_STATUS_APPROVED,
            FINAL_DRAFT_STATUS_CHANGES_REQUESTED,
            FINAL_DRAFT_STATUS_REJECTED,
        }:
            raise InvalidMarketingState("Invalid review status")

        row = self._db.get(MktContentItem, content_id)
        if row is None or row.is_deleted:
            raise NotFoundException("Content not found")
        self._assert_editable(row)
        if not self.can_head_review_final_draft(row):
            raise InvalidMarketingState("This final draft is not awaiting head review")

        draft = dict(self._final_draft(row))
        now = _utcnow()
        draft["status"] = status
        draft["comments"] = comments
        draft["reviewed_at"] = now.isoformat()
        draft["reviewed_by_user_id"] = str(ctx.user_id)
        row.linkedin_final_draft = draft
        row.updated_by = ctx.user_id

        if status == FINAL_DRAFT_STATUS_APPROVED:
            row.workflow_stage = WorkflowStage.LINKEDIN_HANDLER_REVIEW.value
            row.status = ContentStatus.APPROVED.value
            row.rejection_reason = None
        else:
            row.status = ContentStatus.CHANGES_REQUIRED.value
            row.workflow_stage = WorkflowStage.CHANGES_REQUIRED.value
            row.rejection_reason = comments

        self._activity.log(
            ctx,
            entity_type="content",
            entity_id=content_id,
            action=f"linkedin_head_final_draft_{status}",
            details=comments,
            company_id=row.company_id,
        )
        self._db.flush()
        return row

    def can_handler_send_to_publisher(self, row: MktContentItem) -> bool:
        if not self.is_linkedin_section_workflow(row):
            return False
        if row.workflow_stage != WorkflowStage.LINKEDIN_HANDLER_REVIEW.value:
            return False
        if row.status != ContentStatus.APPROVED.value:
            return False
        if not self.all_sections_approved(row):
            return False
        draft = self._final_draft(row)
        return draft.get("status") == FINAL_DRAFT_STATUS_APPROVED

    def send_final_draft_to_publisher(self, ctx: TenantContext, content_id: UUID) -> MktContentItem:
        row = self._db.get(MktContentItem, content_id)
        if row is None or row.is_deleted:
            raise NotFoundException("Content not found")
        self._assert_editable(row)
        if not self.can_handler_send_to_publisher(row):
            raise InvalidMarketingState(
                "Marketing head must approve your final draft (poster and content) before sending to the publisher"
            )
        self._assert_handler_owner(ctx, row)

        now = _utcnow()
        row.workflow_stage = WorkflowStage.PUBLISHER_REVIEW.value
        row.posting_report_status = PostingReportStatus.NOT_POSTED.value
        row.updated_by = ctx.user_id

        verification = self._db.scalar(
            select(MktContentVerification).where(
                MktContentVerification.content_item_id == row.id,
                MktContentVerification.verifier_role == VerifierRole.LINKEDIN_HANDLER.value,
                MktContentVerification.is_deleted.is_(False),
            )
        )
        if verification is None:
            verification = MktContentVerification(
                id=uuid4(),
                tenant_id=ctx.tenant_id,
                company_id=row.company_id,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
                content_item_id=row.id,
                verifier_role=VerifierRole.LINKEDIN_HANDLER.value,
                overall_status=VerificationOverallStatus.SENT_TO_PUBLISHER.value,
                sent_to_publisher_at=now,
            )
            self._db.add(verification)
        else:
            verification.overall_status = VerificationOverallStatus.SENT_TO_PUBLISHER.value
            verification.sent_to_publisher_at = now
            verification.publisher_upload_status = None
            verification.updated_by = ctx.user_id

        self._activity.log(
            ctx,
            entity_type="content",
            entity_id=content_id,
            action="linkedin_sent_final_draft_to_publisher",
            company_id=row.company_id,
        )
        self._db.flush()
        return row

    def list_pending_final_draft_for_head(self, rows: list[MktContentItem]) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for row in rows:
            if not self.can_head_review_final_draft(row):
                continue
            draft = self._final_draft(row)
            results.append(
                {
                    "content_id": str(row.id),
                    "content_number": row.content_number,
                    "title": row.title,
                    "workflow_stage": row.workflow_stage,
                    "status": row.status,
                    "pending_head_items": 1,
                    "verifier_role": VerifierRole.LINKEDIN_HANDLER.value,
                    "linkedin_head_sections": row.linkedin_head_sections,
                    "linkedin_final_draft": draft,
                }
            )
        return results

    def list_pending_for_head(self, rows: list[MktContentItem]) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for row in rows:
            if not row.linkedin_head_sections:
                continue
            pending = self.pending_head_count(row)
            if pending <= 0 and row.status != ContentStatus.IN_REVIEW.value:
                continue
            if pending <= 0:
                continue
            results.append(
                {
                    "content_id": str(row.id),
                    "content_number": row.content_number,
                    "title": row.title,
                    "workflow_stage": row.workflow_stage,
                    "status": row.status,
                    "pending_head_items": pending,
                    "verifier_role": VerifierRole.LINKEDIN_HANDLER.value,
                    "linkedin_head_sections": row.linkedin_head_sections,
                }
            )
        return results
