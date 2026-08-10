"""Verification workflow — each role submits items independently to marketing head."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.service.rbac_service import RBACService
from modules.marketing.domain.enums import (
    IMAGE_VERIFICATION_ITEM_KEYS,
    ROLE_VERIFICATION_ITEMS,
    SUBMITTER_ROLES,
    VIDEO_VERIFICATION_ITEM_KEYS,
    ContentStatus,
    PostingReportStatus,
    VerificationItemStatus,
    VerificationOverallStatus,
    VerifierRole,
    WorkflowStage,
)
from modules.marketing.domain.exceptions import InvalidMarketingState
from modules.marketing.models import MktContentItem, MktContentVerification, MktVerificationItem
from modules.marketing.models.content_asset_link import MktContentAssetLink
from modules.marketing.repository.marketing_repository import ContentItemRepository
from modules.marketing.service.activity_log_service import ActivityLogService


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class VerificationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._content = ContentItemRepository(db)
        self._activity = ActivityLogService(db)
        self._rbac = RBACService(db)

    def _get_content(self, ctx: TenantContext, content_id: UUID) -> MktContentItem:
        row = self._content.get(ctx, content_id)
        if row is None:
            raise NotFoundException("Content not found")
        return row

    def _user_map(self, user_ids: set[UUID]) -> dict[UUID, SecUser]:
        if not user_ids:
            return {}
        rows = self._db.scalars(
            select(SecUser).where(SecUser.id.in_(user_ids), SecUser.is_deleted.is_(False))
        ).all()
        return {u.id: u for u in rows}

    def _display_name(self, user_id: UUID | None, users: dict[UUID, SecUser]) -> str | None:
        if user_id is None:
            return None
        u = users.get(user_id)
        return u.display_name if u else None

    def role_for_user(self, ctx: TenantContext) -> str | None:
        perms = self._rbac.get_user_permissions(ctx.user_id, ctx.tenant_id)
        if "marketing.content:approve" in perms:
            return None  # head is reviewer, not submitter
        if "marketing.content:publish" in perms and "marketing.content:verify" not in perms:
            return VerifierRole.PUBLISHER.value
        if "marketing.content:verify" in perms:
            if "marketing.campaign:update" in perms or "marketing.campaign:create" in perms:
                return VerifierRole.CAMPAIGN_HANDLER.value
            if "marketing.channel:update" in perms:
                return VerifierRole.LINKEDIN_HANDLER.value
            if "marketing.content:submit" in perms:
                return VerifierRole.CREATOR.value
            if "marketing.asset:create" in perms:
                return VerifierRole.VIDEO_EDITOR.value
        if "marketing.content:submit" in perms:
            return VerifierRole.CREATOR.value
        return None

    def is_head(self, ctx: TenantContext) -> bool:
        perms = self._rbac.get_user_permissions(ctx.user_id, ctx.tenant_id)
        return "marketing.content:approve" in perms

    def is_publisher(self, ctx: TenantContext) -> bool:
        perms = self._rbac.get_user_permissions(ctx.user_id, ctx.tenant_id)
        return "marketing.content:publish" in perms

    def ensure_role_verification(self, ctx: TenantContext, content_id: UUID, role: str) -> MktContentVerification:
        row = self._get_content(ctx, content_id)
        if role not in ROLE_VERIFICATION_ITEMS:
            raise ForbiddenException(f"Role {role} cannot submit verifications")
        existing = self._db.scalar(
            select(MktContentVerification).where(
                MktContentVerification.content_item_id == content_id,
                MktContentVerification.verifier_role == role,
                MktContentVerification.is_deleted.is_(False),
            )
        )
        if existing:
            existing_keys = {
                i.item_key
                for i in self._db.scalars(
                    select(MktVerificationItem).where(
                        MktVerificationItem.verification_id == existing.id,
                        MktVerificationItem.is_deleted.is_(False),
                    )
                ).all()
            }
            for key, label in ROLE_VERIFICATION_ITEMS[role]:
                if key not in existing_keys:
                    self._db.add(
                        MktVerificationItem(
                            id=uuid4(),
                            tenant_id=ctx.tenant_id,
                            company_id=row.company_id,
                            created_by=ctx.user_id,
                            updated_by=ctx.user_id,
                            verification_id=existing.id,
                            item_key=key,
                            item_label=label,
                            status=VerificationItemStatus.PENDING.value,
                        )
                    )
            self._db.flush()
            return existing
        verification = MktContentVerification(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=row.company_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            content_item_id=content_id,
            verifier_role=role,
            overall_status=VerificationOverallStatus.PENDING.value,
        )
        self._db.add(verification)
        self._db.flush()
        for key, label in ROLE_VERIFICATION_ITEMS[role]:
            self._db.add(
                MktVerificationItem(
                    id=uuid4(),
                    tenant_id=ctx.tenant_id,
                    company_id=row.company_id,
                    created_by=ctx.user_id,
                    updated_by=ctx.user_id,
                    verification_id=verification.id,
                    item_key=key,
                    item_label=label,
                    status=VerificationItemStatus.PENDING.value,
                )
            )
        self._db.flush()
        return verification

    def initialize_verifications(self, ctx: TenantContext, content_id: UUID) -> None:
        """On content submit — init verification for submitting user's role only."""
        role = self.role_for_user(ctx)
        if role:
            self.ensure_role_verification(ctx, content_id, role)
            self.auto_submit_ready_items(ctx, content_id, role=role)
        row = self._get_content(ctx, content_id)
        row.workflow_stage = WorkflowStage.HEAD_FINAL_REVIEW.value
        row.status = ContentStatus.IN_REVIEW.value
        self._db.flush()

    def _linked_asset_roles(self, content_id: UUID) -> set[str]:
        rows = self._db.scalars(
            select(MktContentAssetLink.asset_role).where(
                MktContentAssetLink.content_item_id == content_id,
                MktContentAssetLink.is_deleted.is_(False),
            )
        ).all()
        return {role for role in rows if role}

    def _item_ready_for_auto_submit(self, row: MktContentItem, item_key: str, linked_roles: set[str]) -> bool:
        if item_key in IMAGE_VERIFICATION_ITEM_KEYS or item_key in VIDEO_VERIFICATION_ITEM_KEYS:
            return item_key in linked_roles
        body = (row.body or "").strip()
        if item_key == "text_copy":
            return False
        if item_key == "content":
            return bool(body)
        if item_key == "hashtags":
            return bool((row.hashtags or "").strip())
        if item_key == "theme":
            return bool((row.theme or "").strip())
        if item_key == "font_name":
            return bool((row.font_name or "").strip())
        if item_key == "font_size":
            return bool((row.font_size or "").strip())
        if item_key == "color_codes":
            return bool((row.color_codes or "").strip())
        return False

    def _mark_item_submitted_to_head(
        self,
        ctx: TenantContext,
        content_id: UUID,
        verification: MktContentVerification,
        item: MktVerificationItem,
        *,
        log_activity: bool,
    ) -> None:
        now = _utcnow()
        item.status = VerificationItemStatus.SUBMITTED.value
        item.submitted_to_head_at = now
        item.submitted_by_user_id = ctx.user_id
        item.updated_by = ctx.user_id
        verification.requested_by_user_id = ctx.user_id
        verification.overall_status = VerificationOverallStatus.SUBMITTED_TO_HEAD.value
        verification.started_at = verification.started_at or now
        verification.updated_by = ctx.user_id
        if log_activity:
            row = self._get_content(ctx, content_id)
            self._activity.log(
                ctx,
                entity_type="content",
                entity_id=content_id,
                action="item_submitted_to_head",
                details=f"{verification.verifier_role}/{item.item_key}",
                company_id=row.company_id,
            )

    def auto_submit_ready_items(
        self, ctx: TenantContext, content_id: UUID, *, role: str | None = None
    ) -> None:
        """Push filled text/media checklist items to the head queue when content is submitted."""
        row = self._get_content(ctx, content_id)
        if row.status != ContentStatus.IN_REVIEW.value or row.submitted_at is None:
            return
        linked_roles = self._linked_asset_roles(content_id)
        stmt = select(MktContentVerification).where(
            MktContentVerification.content_item_id == content_id,
            MktContentVerification.is_deleted.is_(False),
        )
        if role:
            stmt = stmt.where(MktContentVerification.verifier_role == role)
        verifications = self._db.scalars(stmt).all()
        for verification in verifications:
            items = self._db.scalars(
                select(MktVerificationItem).where(
                    MktVerificationItem.verification_id == verification.id,
                    MktVerificationItem.is_deleted.is_(False),
                    MktVerificationItem.status == VerificationItemStatus.PENDING.value,
                )
            ).all()
            for item in items:
                if self._item_ready_for_auto_submit(row, item.item_key, linked_roles):
                    self._mark_item_submitted_to_head(
                        ctx, content_id, verification, item, log_activity=True
                    )
        self._db.flush()

    def reset_verifications(self, ctx: TenantContext, content_id: UUID) -> None:
        verifications = self._db.scalars(
            select(MktContentVerification).where(
                MktContentVerification.content_item_id == content_id,
                MktContentVerification.is_deleted.is_(False),
            )
        ).all()
        for v in verifications:
            v.is_deleted = True
            v.updated_by = ctx.user_id
            for item in self._db.scalars(
                select(MktVerificationItem).where(MktVerificationItem.verification_id == v.id)
            ).all():
                item.is_deleted = True
                item.updated_by = ctx.user_id
        self._db.flush()

    def submit_item_to_head(
        self, ctx: TenantContext, content_id: UUID, *, item_key: str, verifier_role: str | None = None
    ) -> dict:
        role = verifier_role or self.role_for_user(ctx)
        if role is None:
            raise ForbiddenException("You are not assigned to submit verifications for this content")
        verification = self.ensure_role_verification(ctx, content_id, role)
        item = self._db.scalar(
            select(MktVerificationItem).where(
                MktVerificationItem.verification_id == verification.id,
                MktVerificationItem.item_key == item_key,
                MktVerificationItem.is_deleted.is_(False),
            )
        )
        if item is None:
            raise NotFoundException("Checklist item not found")
        if item_key in IMAGE_VERIFICATION_ITEM_KEYS or item_key in VIDEO_VERIFICATION_ITEM_KEYS:
            linked = self._db.scalar(
                select(MktContentAssetLink).where(
                    MktContentAssetLink.content_item_id == content_id,
                    MktContentAssetLink.asset_role == item_key,
                    MktContentAssetLink.is_deleted.is_(False),
                )
            )
            if linked is None:
                kind = "image/banner" if item_key in IMAGE_VERIFICATION_ITEM_KEYS else "video"
                raise InvalidMarketingState(f"Upload a {kind} file for this item before submitting to head")
        self._mark_item_submitted_to_head(ctx, content_id, verification, item, log_activity=True)
        row = self._get_content(ctx, content_id)
        row.workflow_stage = WorkflowStage.HEAD_FINAL_REVIEW.value
        row.status = ContentStatus.IN_REVIEW.value
        self._db.flush()
        return self.get_workflow_dashboard(ctx, content_id)

    def head_review_item(
        self,
        ctx: TenantContext,
        content_id: UUID,
        *,
        verifier_role: str,
        item_key: str,
        status: str,
        comments: str | None = None,
    ) -> dict:
        if not self.is_head(ctx):
            raise ForbiddenException("Only marketing head can review submitted items")
        verification = self._db.scalar(
            select(MktContentVerification).where(
                MktContentVerification.content_item_id == content_id,
                MktContentVerification.verifier_role == verifier_role,
                MktContentVerification.is_deleted.is_(False),
            )
        )
        if verification is None:
            raise NotFoundException("Verification record not found")
        item = self._db.scalar(
            select(MktVerificationItem).where(
                MktVerificationItem.verification_id == verification.id,
                MktVerificationItem.item_key == item_key,
                MktVerificationItem.is_deleted.is_(False),
            )
        )
        if item is None:
            raise NotFoundException("Checklist item not found")
        if item.status != VerificationItemStatus.SUBMITTED.value:
            raise InvalidMarketingState("This item has not been submitted to head yet")
        now = _utcnow()
        item.status = status
        item.comments = comments
        item.reviewed_by_user_id = ctx.user_id
        item.reviewed_at = now
        item.updated_by = ctx.user_id
        self._sync_verification_status(verification)
        row = self._get_content(ctx, content_id)
        if status == VerificationItemStatus.CHANGES_REQUESTED.value:
            verification.overall_status = VerificationOverallStatus.CHANGES_REQUESTED.value
            verification.overall_comments = comments
            row.workflow_stage = WorkflowStage.CHANGES_REQUIRED.value
            row.status = ContentStatus.CHANGES_REQUIRED.value
            row.rejection_reason = comments
        self._activity.log(
            ctx,
            entity_type="content",
            entity_id=content_id,
            action=f"head_review_{status}",
            details=f"{verifier_role}/{item_key}: {comments or status}",
            company_id=row.company_id,
        )
        self._db.flush()
        return self.get_workflow_dashboard(ctx, content_id)

    def _notify_publisher_if_ready(self, verification: MktContentVerification) -> bool:
        items = self._db.scalars(
            select(MktVerificationItem).where(
                MktVerificationItem.verification_id == verification.id,
                MktVerificationItem.is_deleted.is_(False),
            )
        ).all()
        if not items or not all(i.status == VerificationItemStatus.APPROVED.value for i in items):
            return False
        if verification.sent_to_publisher_at is not None:
            return False
        now = _utcnow()
        verification.completed_at = verification.completed_at or now
        verification.sent_to_publisher_at = now
        verification.publisher_upload_status = "pending"
        verification.overall_status = VerificationOverallStatus.SENT_TO_PUBLISHER.value
        row = self._db.get(MktContentItem, verification.content_item_id)
        if row is not None:
            row.workflow_stage = WorkflowStage.PUBLISHER_REVIEW.value
            if row.posting_report_status is None:
                row.posting_report_status = PostingReportStatus.PENDING.value
        return True

    def _sync_verification_status(self, verification: MktContentVerification) -> None:
        items = self._db.scalars(
            select(MktVerificationItem).where(
                MktVerificationItem.verification_id == verification.id,
                MktVerificationItem.is_deleted.is_(False),
            )
        ).all()
        if not items:
            return
        if any(i.status == VerificationItemStatus.CHANGES_REQUESTED.value for i in items):
            verification.overall_status = VerificationOverallStatus.CHANGES_REQUESTED.value
            return
        if any(i.status == VerificationItemStatus.REJECTED.value for i in items):
            verification.overall_status = VerificationOverallStatus.REJECTED.value
            return
        submitted = [i for i in items if i.status == VerificationItemStatus.SUBMITTED.value]
        if submitted:
            verification.overall_status = VerificationOverallStatus.SUBMITTED_TO_HEAD.value
            return
        pending_submit = [i for i in items if i.status == VerificationItemStatus.PENDING.value]
        if pending_submit and not any(i.status == VerificationItemStatus.APPROVED.value for i in items):
            verification.overall_status = VerificationOverallStatus.PENDING.value
            return
        if all(i.status == VerificationItemStatus.APPROVED.value for i in items):
            if self._notify_publisher_if_ready(verification):
                return
            verification.overall_status = VerificationOverallStatus.AWAITING_POSTING.value
            verification.completed_at = verification.completed_at or _utcnow()
            return
        if any(i.status == VerificationItemStatus.APPROVED.value for i in items):
            verification.overall_status = VerificationOverallStatus.IN_PROGRESS.value

    def set_posting_timeline(
        self,
        ctx: TenantContext,
        content_id: UUID,
        *,
        verifier_role: str | None = None,
        planned_at: datetime | None = None,
        notes: str | None = None,
        posted: bool | None = None,
    ) -> dict:
        role = verifier_role or self.role_for_user(ctx)
        if role is None:
            raise ForbiddenException("You cannot set posting timeline for this content")
        verification = self._db.scalar(
            select(MktContentVerification).where(
                MktContentVerification.content_item_id == content_id,
                MktContentVerification.verifier_role == role,
                MktContentVerification.is_deleted.is_(False),
            )
        )
        if verification is None:
            raise NotFoundException("Verification not found")
        if verification.overall_status not in {
            VerificationOverallStatus.AWAITING_POSTING.value,
            VerificationOverallStatus.APPROVED.value,
        }:
            raise InvalidMarketingState("Head must approve all items before posting timeline")
        verification.posting_planned_at = planned_at
        verification.posting_timeline_notes = notes
        verification.posting_confirmed = posted
        verification.overall_status = VerificationOverallStatus.AWAITING_POSTING.value
        self._db.flush()
        return self.get_workflow_dashboard(ctx, content_id)

    def send_to_publisher(
        self, ctx: TenantContext, content_id: UUID, *, verifier_role: str | None = None
    ) -> dict:
        role = verifier_role or self.role_for_user(ctx)
        if role is None:
            raise ForbiddenException("You cannot send to publisher")
        verification = self._db.scalar(
            select(MktContentVerification).where(
                MktContentVerification.content_item_id == content_id,
                MktContentVerification.verifier_role == role,
                MktContentVerification.is_deleted.is_(False),
            )
        )
        if verification is None:
            raise NotFoundException("Verification not found")
        if verification.overall_status not in {
            VerificationOverallStatus.AWAITING_POSTING.value,
            VerificationOverallStatus.APPROVED.value,
        }:
            raise InvalidMarketingState("Complete head approval and posting timeline first")
        if verification.posting_planned_at is None and verification.posting_confirmed is None:
            raise InvalidMarketingState("Provide posting date/time or confirm if already posted")
        verification.sent_to_publisher_at = _utcnow()
        verification.overall_status = VerificationOverallStatus.SENT_TO_PUBLISHER.value
        verification.publisher_upload_status = "pending"
        row = self._get_content(ctx, content_id)
        row.workflow_stage = WorkflowStage.PUBLISHER_REVIEW.value
        self._activity.log(
            ctx,
            entity_type="content",
            entity_id=content_id,
            action="sent_to_publisher",
            details=role,
            company_id=row.company_id,
        )
        self._db.flush()
        return self.get_workflow_dashboard(ctx, content_id)

    def publisher_upload_report(
        self,
        ctx: TenantContext,
        content_id: UUID,
        *,
        verifier_role: str,
        uploaded: bool,
        notes: str | None = None,
    ) -> dict:
        if not self.is_publisher(ctx):
            raise ForbiddenException("Only publisher can report upload status")
        verification = self._db.scalar(
            select(MktContentVerification).where(
                MktContentVerification.content_item_id == content_id,
                MktContentVerification.verifier_role == verifier_role,
                MktContentVerification.is_deleted.is_(False),
            )
        )
        if verification is None:
            raise NotFoundException("Verification not found")
        if verification.sent_to_publisher_at is None:
            raise InvalidMarketingState("This role has not sent content to publisher yet")
        now = _utcnow()
        verification.publisher_upload_status = "uploaded" if uploaded else "not_uploaded"
        verification.publisher_upload_notes = notes
        verification.publisher_reported_at = now
        verification.overall_status = VerificationOverallStatus.PUBLISHER_REPORTED.value
        self._activity.log(
            ctx,
            entity_type="content",
            entity_id=content_id,
            action="publisher_upload_report",
            details=f"{verifier_role}: {'uploaded' if uploaded else 'not uploaded'} — {notes or ''}",
            company_id=verification.company_id,
        )
        self._db.flush()
        return self.get_workflow_dashboard(ctx, content_id)

    def list_verifications(self, ctx: TenantContext, content_id: UUID) -> list[dict]:
        self._get_content(ctx, content_id)
        rows = self._db.scalars(
            select(MktContentVerification)
            .where(
                MktContentVerification.content_item_id == content_id,
                MktContentVerification.is_deleted.is_(False),
            )
            .order_by(MktContentVerification.created_at)
        ).all()
        user_ids: set[UUID] = set()
        for v in rows:
            if v.requested_by_user_id:
                user_ids.add(v.requested_by_user_id)
            items = self._db.scalars(
                select(MktVerificationItem).where(
                    MktVerificationItem.verification_id == v.id,
                    MktVerificationItem.is_deleted.is_(False),
                )
            ).all()
            for i in items:
                if i.submitted_by_user_id:
                    user_ids.add(i.submitted_by_user_id)
                if i.reviewed_by_user_id:
                    user_ids.add(i.reviewed_by_user_id)
        users = self._user_map(user_ids)
        return [self._verification_dict(v, users) for v in rows]

    def _verification_dict(self, v: MktContentVerification, users: dict[UUID, SecUser]) -> dict:
        items = self._db.scalars(
            select(MktVerificationItem).where(
                MktVerificationItem.verification_id == v.id,
                MktVerificationItem.is_deleted.is_(False),
            )
        ).all()
        return {
            "id": str(v.id),
            "verifier_role": v.verifier_role,
            "verifier_user_id": str(v.verifier_user_id) if v.verifier_user_id else None,
            "requested_by_user_id": str(v.requested_by_user_id) if v.requested_by_user_id else None,
            "requested_by_name": self._display_name(v.requested_by_user_id, users),
            "overall_status": v.overall_status,
            "overall_comments": v.overall_comments,
            "started_at": v.started_at.isoformat() if v.started_at else None,
            "completed_at": v.completed_at.isoformat() if v.completed_at else None,
            "posting_planned_at": v.posting_planned_at.isoformat() if v.posting_planned_at else None,
            "posting_timeline_notes": v.posting_timeline_notes,
            "posting_confirmed": v.posting_confirmed,
            "sent_to_publisher_at": v.sent_to_publisher_at.isoformat() if v.sent_to_publisher_at else None,
            "publisher_upload_status": v.publisher_upload_status,
            "publisher_upload_notes": v.publisher_upload_notes,
            "publisher_reported_at": v.publisher_reported_at.isoformat() if v.publisher_reported_at else None,
            "items": [
                {
                    "id": str(i.id),
                    "item_key": i.item_key,
                    "item_label": i.item_label,
                    "status": i.status,
                    "comments": i.comments,
                    "submitted_to_head_at": i.submitted_to_head_at.isoformat() if i.submitted_to_head_at else None,
                    "submitted_by_user_id": str(i.submitted_by_user_id) if i.submitted_by_user_id else None,
                    "submitted_by_name": self._display_name(i.submitted_by_user_id, users),
                    "reviewed_at": i.reviewed_at.isoformat() if i.reviewed_at else None,
                }
                for i in items
            ],
        }

    def get_workflow_dashboard(self, ctx: TenantContext, content_id: UUID) -> dict:
        row = self._get_content(ctx, content_id)
        if row.status == ContentStatus.IN_REVIEW.value and row.submitted_at is not None:
            self.auto_submit_ready_items(ctx, content_id)
        verification_rows = self._db.scalars(
            select(MktContentVerification).where(
                MktContentVerification.content_item_id == content_id,
                MktContentVerification.is_deleted.is_(False),
            )
        ).all()
        for verification in verification_rows:
            self._notify_publisher_if_ready(verification)
        self._db.flush()
        verifications = self.list_verifications(ctx, content_id)
        my_role = self.role_for_user(ctx)
        if my_role and not any(v["verifier_role"] == my_role for v in verifications):
            self.ensure_role_verification(ctx, content_id, my_role)
            verifications = self.list_verifications(ctx, content_id)
        return {
            "content_id": str(content_id),
            "content_number": row.content_number,
            "title": row.title,
            "content_type": row.content_type,
            "workflow_stage": row.workflow_stage,
            "status": row.status,
            "final_head_approved_at": row.final_head_approved_at.isoformat() if row.final_head_approved_at else None,
            "submitter_roles": SUBMITTER_ROLES,
            "my_role": my_role,
            "is_head": self.is_head(ctx),
            "is_publisher": self.is_publisher(ctx),
            "verifications": verifications,
            "can_publish": self.can_publish(row),
        }

    def can_publish(self, row: MktContentItem) -> bool:
        verifications = self._db.scalars(
            select(MktContentVerification).where(
                MktContentVerification.content_item_id == row.id,
                MktContentVerification.is_deleted.is_(False),
                MktContentVerification.sent_to_publisher_at.isnot(None),
            )
        ).all()
        return len(verifications) > 0 and all(
            v.publisher_upload_status == "uploaded" for v in verifications if v.sent_to_publisher_at
        )

    def assert_can_publish(self, row: MktContentItem) -> None:
        sent = self._db.scalars(
            select(MktContentVerification).where(
                MktContentVerification.content_item_id == row.id,
                MktContentVerification.is_deleted.is_(False),
                MktContentVerification.sent_to_publisher_at.isnot(None),
            )
        ).all()
        if not sent:
            raise InvalidMarketingState("Nothing has been sent to publisher yet")
        pending = [v for v in sent if v.publisher_upload_status != "uploaded"]
        if pending:
            raise InvalidMarketingState("Publisher must confirm upload before final publish")

    def head_dashboard(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        from modules.marketing.service.marketing_scope_validator import MarketingScopeValidator

        cid = MarketingScopeValidator(self._db).resolve_company_id(ctx, company_id)
        rows = self._content.list_rows(
            ctx,
            cid,
            statuses=[
                ContentStatus.IN_REVIEW.value,
                ContentStatus.APPROVED.value,
                ContentStatus.CHANGES_REQUIRED.value,
                ContentStatus.SCHEDULED.value,
            ],
        )
        items: list[dict] = []
        for row in rows:
            verifications = self.list_verifications(ctx, row.id)
            if not verifications:
                continue
            pending_items = sum(
                1
                for v in verifications
                for i in v["items"]
                if i["status"] == VerificationItemStatus.SUBMITTED.value
            )
            items.append(
                {
                    "content_id": str(row.id),
                    "content_number": row.content_number,
                    "title": row.title,
                    "workflow_stage": row.workflow_stage,
                    "status": row.status,
                    "pending_head_items": pending_items,
                    "verifications": verifications,
                }
            )
        return {
            "items": items,
            "summary": {
                "total_in_pipeline": len(items),
                "pending_head_reviews": sum(1 for i in items if i["pending_head_items"] > 0),
                "awaiting_publisher": sum(
                    1
                    for i in items
                    for v in i["verifications"]
                    if v["overall_status"] == VerificationOverallStatus.SENT_TO_PUBLISHER.value
                ),
            },
        }

    # Legacy compatibility — head updates item directly
    def update_item(
        self,
        ctx: TenantContext,
        content_id: UUID,
        *,
        item_key: str,
        status: str,
        comments: str | None = None,
        verifier_role: str | None = None,
    ) -> dict:
        role = verifier_role or self.role_for_user(ctx)
        if self.is_head(ctx) and role:
            return self.head_review_item(
                ctx, content_id, verifier_role=role, item_key=item_key, status=status, comments=comments
            )
        raise ForbiddenException("Use submit_item_to_head to send items for head review")

    def complete_verification(
        self,
        ctx: TenantContext,
        content_id: UUID,
        *,
        overall_status: str,
        overall_comments: str | None = None,
        verifier_role: str | None = None,
    ) -> dict:
        raise ForbiddenException("Approve each item separately or use head review endpoints")
