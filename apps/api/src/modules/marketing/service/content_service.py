"""Marketing content item service."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.rbac_service import RBACService
from modules.marketing.domain.enums import ContentStatus, ContentType, MktEntityType, PostingReportStatus, VerifierRole
from modules.marketing.domain.exceptions import InvalidMarketingState
from modules.marketing.models.content_item import MktContentItem
from modules.marketing.repository.base import utcnow
from modules.marketing.repository.marketing_repository import (
    ActivityLogRepository,
    ApprovalRepository,
    ContentAssignmentRepository,
    ContentItemRepository,
    PublicationRepository,
)
from modules.marketing.schemas import (
    ActivityLogResponse,
    ApprovalResponse,
    CalendarItem,
    ContentAssignmentResponse,
    ContentItemResponse,
    PublicationResponse,
)
from modules.marketing.service.activity_log_service import ActivityLogService
from modules.marketing.service.engines.content_engine import ContentItemEngine
from modules.marketing.service.marketing_number_service import MarketingNumberService
from modules.marketing.service.marketing_scope_validator import MarketingScopeValidator
from modules.marketing.service.verification_service import VerificationService


class ContentItemService:
    def __init__(self, db: Session) -> None:
        self._repo = ContentItemRepository(db)
        self._pub = PublicationRepository(db)
        self._approval = ApprovalRepository(db)
        self._assignments = ContentAssignmentRepository(db)
        self._activity_repo = ActivityLogRepository(db)
        self._scope = MarketingScopeValidator(db)
        self._numbers = MarketingNumberService(db)
        self._engine = ContentItemEngine()
        self._activity = ActivityLogService(db)

    def list_content(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        status: str | None = None,
        campaign_id: UUID | None = None,
        channel_id: UUID | None = None,
        q: str | None = None,
        mine: bool = False,
        statuses: list[str] | None = None,
        created_by_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._repo.list_rows(
            ctx,
            cid,
            status=status,
            statuses=statuses,
            campaign_id=campaign_id,
            channel_id=channel_id,
            q=q,
            mine=mine,
            created_by_id=created_by_id,
        )
        return [ContentItemResponse.model_validate(r) for r in rows]

    def get_content(self, ctx: TenantContext, row_id: UUID) -> ContentItemResponse:
        row = self._get(ctx, row_id)
        from modules.marketing.service.linkedin_section_service import LinkedInSectionService

        linkedin_svc = LinkedInSectionService(self._repo.db)
        if linkedin_svc.ensure_sections_initialized(ctx, row):
            row = self._repo.update(
                ctx,
                row_id,
                linkedin_head_sections=row.linkedin_head_sections,
                linkedin_final_draft=row.linkedin_final_draft,
                workflow_stage=row.workflow_stage,
            )
        return ContentItemResponse.model_validate(row)

    def create_content(self, ctx: TenantContext, branch_id: UUID, company_id: UUID | None = None, **fields) -> ContentItemResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(MktEntityType.CONTENT, cid, MktContentItem, "content_number")
        row = self._repo.create(ctx, company_id=cid, branch_id=branch_id, content_number=doc, **fields)
        self._activity.log(ctx, entity_type="content", entity_id=row.id, action="created", details=f"Content {doc} created", company_id=cid)
        return ContentItemResponse.model_validate(row)

    def update_content(self, ctx: TenantContext, row_id: UUID, **fields) -> ContentItemResponse:
        row = self._get(ctx, row_id)
        self._engine.assert_editable(row)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Content not found")
        return ContentItemResponse.model_validate(row)

    def submit_content(self, ctx: TenantContext, row_id: UUID) -> ContentItemResponse:
        row = self._get(ctx, row_id)
        was_changes = row.status == ContentStatus.CHANGES_REQUIRED.value
        self._engine.submit(row)
        row = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            submitted_at=row.submitted_at,
            rejection_reason=row.rejection_reason,
        )
        verification = VerificationService(self._repo.db)
        role = verification.role_for_user(ctx)
        if was_changes:
            uses_linkedin = (
                role == VerifierRole.LINKEDIN_HANDLER.value
                or row.content_type == ContentType.SOCIAL_POST.value
            )
            if uses_linkedin:
                from modules.marketing.service.linkedin_section_service import LinkedInSectionService

                LinkedInSectionService(self._repo.db).reset_on_resubmit(ctx, row)
            else:
                verification.reset_verifications(ctx, row_id)
        uses_linkedin_sections = (
            role == VerifierRole.LINKEDIN_HANDLER.value
            or row.content_type == ContentType.SOCIAL_POST.value
        )
        if uses_linkedin_sections:
            from modules.marketing.service.linkedin_section_service import LinkedInSectionService

            LinkedInSectionService(self._repo.db).initialize_on_submit(ctx, row)
            self._repo.update(
                ctx,
                row_id,
                linkedin_head_sections=row.linkedin_head_sections,
                linkedin_final_draft=row.linkedin_final_draft,
                workflow_stage=row.workflow_stage,
            )
        else:
            verification.initialize_verifications(ctx, row_id)
        self._approval.create(
            ctx,
            company_id=row.company_id,
            content_item_id=row.id,
            approver_id=ctx.user_id,
            status="pending",
        )
        self._activity.log(ctx, entity_type="content", entity_id=row.id, action="submitted", company_id=row.company_id)
        return ContentItemResponse.model_validate(self._get(ctx, row_id))

    def approve_media(self, ctx: TenantContext, row_id: UUID, comments: str | None = None) -> ContentItemResponse:
        row = self._get(ctx, row_id)
        self._engine.approve_media(row, ctx.user_id)
        row = self._repo.update(ctx, row_id, status=row.status, rejection_reason=None)
        self._activity.log(
            ctx,
            entity_type="content",
            entity_id=row.id,
            action="media_approved",
            details=comments,
            company_id=row.company_id,
        )
        return ContentItemResponse.model_validate(row)

    def approve_content(self, ctx: TenantContext, row_id: UUID, comments: str | None = None) -> ContentItemResponse:
        row = self._get(ctx, row_id)
        self._engine.approve(row, ctx.user_id)
        row = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            approved_at=row.approved_at,
            approved_by_id=row.approved_by_id,
            rejection_reason=None,
            posting_report_status=PostingReportStatus.PENDING.value,
            posting_report_notes=None,
            posting_reported_at=None,
            posting_reported_by_id=None,
        )
        pending = self._approval.list_pending(ctx, row.company_id)
        for appr in pending:
            if appr.content_item_id == row.id:
                self._approval.update(ctx, appr.id, status="approved", decision_at=utcnow(), comments=comments)
        self._activity.log(ctx, entity_type="content", entity_id=row.id, action="approved", company_id=row.company_id)
        return ContentItemResponse.model_validate(row)

    def reject_content(self, ctx: TenantContext, row_id: UUID, reason: str | None = None) -> ContentItemResponse:
        row = self._get(ctx, row_id)
        self._engine.reject(row, reason)
        row = self._repo.update(ctx, row_id, status=row.status, rejection_reason=row.rejection_reason)
        pending = self._approval.list_pending(ctx, row.company_id)
        for appr in pending:
            if appr.content_item_id == row.id:
                self._approval.update(ctx, appr.id, status="rejected", decision_at=utcnow(), comments=reason)
        self._activity.log(ctx, entity_type="content", entity_id=row.id, action="rejected", details=reason, company_id=row.company_id)
        return ContentItemResponse.model_validate(row)

    def request_changes(self, ctx: TenantContext, row_id: UUID, reason: str | None = None) -> ContentItemResponse:
        row = self._get(ctx, row_id)
        rbac = RBACService(self._repo.db)
        perms = rbac.get_user_permissions(ctx.user_id, ctx.tenant_id)
        if row.status == "in_review":
            if "marketing.content:approve_media" not in perms and "marketing.content:approve" not in perms:
                raise ForbiddenException("Missing permission for media review")
        elif row.status == "media_approved":
            if "marketing.content:approve" not in perms:
                raise ForbiddenException("Missing permission for head review")
        else:
            raise InvalidMarketingState("Changes can only be requested while content is in review")
        self._engine.request_changes(row, reason)
        row = self._repo.update(ctx, row_id, status=row.status, rejection_reason=row.rejection_reason)
        self._activity.log(
            ctx,
            entity_type="content",
            entity_id=row.id,
            action="changes_requested",
            details=reason,
            company_id=row.company_id,
        )
        return ContentItemResponse.model_validate(row)

    def report_posting(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        posted: bool,
        notes: str | None = None,
        published_url: str | None = None,
    ) -> ContentItemResponse:
        row = self._get(ctx, row_id)
        allowed_statuses = {
            ContentStatus.APPROVED.value,
            ContentStatus.SCHEDULED.value,
            ContentStatus.PUBLISHED.value,
            ContentStatus.IN_REVIEW.value,
        }
        if row.status not in allowed_statuses:
            from modules.marketing.domain.exceptions import InvalidMarketingState

            raise InvalidMarketingState("Posting can only be reported after head approval")
        if row.status == ContentStatus.IN_REVIEW.value and row.posting_report_status not in {
            PostingReportStatus.PENDING.value,
            None,
        }:
            from modules.marketing.domain.exceptions import InvalidMarketingState

            raise InvalidMarketingState("Posting can only be reported after head approval")
        rbac = RBACService(self._repo.db)
        perms = rbac.get_user_permissions(ctx.user_id, ctx.tenant_id)
        is_submitter = row.created_by_id == ctx.user_id
        is_assignee = row.assigned_to_id == ctx.user_id
        can_as_creator = "marketing.content:submit" in perms and (is_submitter or is_assignee)
        can_as_verifier = "marketing.content:verify" in perms and "marketing.content:approve" not in perms
        can_as_publisher = "marketing.content:publish" in perms and "marketing.content:approve" not in perms
        if not can_as_creator and not can_as_verifier and not can_as_publisher:
            raise ForbiddenException("You do not have permission to report posting status for this content")
        report_status = PostingReportStatus.POSTED.value if posted else PostingReportStatus.NOT_POSTED.value
        now = utcnow()
        row = self._repo.update(
            ctx,
            row_id,
            posting_report_status=report_status,
            posting_report_notes=notes,
            posting_reported_at=now,
            posting_reported_by_id=ctx.user_id,
            target_url=published_url or row.target_url,
        )
        detail = "Posted" if posted else "Not posted yet"
        if notes:
            detail = f"{detail}: {notes}"
        self._activity.log(
            ctx,
            entity_type="content",
            entity_id=row.id,
            action="posting_reported",
            details=detail,
            company_id=row.company_id,
        )
        return ContentItemResponse.model_validate(row)

    def schedule_content(self, ctx: TenantContext, row_id: UUID, scheduled_at: datetime) -> ContentItemResponse:
        row = self._get(ctx, row_id)
        self._engine.schedule(row, scheduled_at)
        row = self._repo.update(ctx, row_id, status=row.status, scheduled_at=row.scheduled_at)
        self._activity.log(ctx, entity_type="content", entity_id=row.id, action="scheduled", company_id=row.company_id)
        return ContentItemResponse.model_validate(row)

    def publish_content(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        channel_id: UUID | None = None,
        published_url: str | None = None,
        external_post_id: str | None = None,
        published_at: datetime | None = None,
        notes: str | None = None,
        metrics_json: dict | None = None,
    ) -> ContentItemResponse:
        row = self._get(ctx, row_id)
        VerificationService(self._repo.db).assert_can_publish(row)
        self._engine.mark_published(row, ctx.user_id)
        now = utcnow()
        posting_fields: dict = {
            "status": row.status,
            "published_at": row.published_at,
            "published_by_id": row.published_by_id,
        }
        if row.posting_report_status in {
            PostingReportStatus.PENDING.value,
            PostingReportStatus.NOT_POSTED.value,
            None,
        }:
            posting_fields.update(
                {
                    "posting_report_status": PostingReportStatus.POSTED.value,
                    "posting_report_notes": notes or "Logged as posted",
                    "posting_reported_at": now,
                    "posting_reported_by_id": ctx.user_id,
                }
            )
        row = self._repo.update(ctx, row_id, **posting_fields)
        if row.workflow_stage:
            from modules.marketing.domain.enums import WorkflowStage

            row = self._repo.update(ctx, row_id, workflow_stage=WorkflowStage.PUBLISHED.value)
        pub_at = published_at or utcnow()
        auto_reported = "posting_report_status" in posting_fields and posting_fields["posting_report_status"] == PostingReportStatus.POSTED.value
        self._pub.create(
            ctx,
            company_id=row.company_id,
            content_item_id=row.id,
            channel_id=channel_id or row.channel_id,
            published_url=published_url,
            external_post_id=external_post_id,
            posted_by_id=ctx.user_id,
            published_at=pub_at,
            notes=notes,
            metrics_json=metrics_json,
        )
        self._activity.log(ctx, entity_type="content", entity_id=row.id, action="published", company_id=row.company_id)
        if auto_reported:
            self._activity.log(
                ctx,
                entity_type="content",
                entity_id=row.id,
                action="posting_reported",
                details=notes or "Logged as posted",
                company_id=row.company_id,
            )
        self._engine.archive(row)
        row = self._repo.update(ctx, row_id, status=row.status, archived_at=row.archived_at)
        self._activity.log(ctx, entity_type="content", entity_id=row.id, action="archived", company_id=row.company_id)
        return ContentItemResponse.model_validate(row)

    def archive_content(self, ctx: TenantContext, row_id: UUID) -> ContentItemResponse:
        row = self._get(ctx, row_id)
        self._engine.archive(row)
        row = self._repo.update(ctx, row_id, status=row.status, archived_at=row.archived_at)
        self._activity.log(ctx, entity_type="content", entity_id=row.id, action="archived", company_id=row.company_id)
        return ContentItemResponse.model_validate(row)

    def list_calendar(self, ctx: TenantContext, start: datetime, end: datetime, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._repo.list_calendar(ctx, cid, start, end)
        return [
            CalendarItem(
                id=r.id,
                content_number=r.content_number,
                title=r.title,
                status=r.status,
                scheduled_at=r.scheduled_at,
                channel_id=r.channel_id,
                campaign_id=r.campaign_id,
            )
            for r in rows
            if r.scheduled_at
        ]

    def list_publications(self, ctx: TenantContext, company_id: UUID | None = None, channel_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._pub.list_rows(ctx, cid, channel_id=channel_id)
        return [PublicationResponse.model_validate(r) for r in rows]

    def list_pending_approvals(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._approval.list_pending(ctx, cid)
        return [ApprovalResponse.model_validate(r) for r in rows]

    def list_activity(self, ctx: TenantContext, entity_type: str, entity_id: UUID):
        rows = self._activity_repo.list_for_entity(ctx, entity_type, entity_id)
        return [ActivityLogResponse.model_validate(r) for r in rows]

    def list_assignments(self, ctx: TenantContext, content_id: UUID):
        self._get(ctx, content_id)
        rows = self._assignments.list_for_content(ctx, content_id)
        return [ContentAssignmentResponse.model_validate(r) for r in rows]

    def add_assignment(self, ctx: TenantContext, content_id: UUID, user_id: UUID, role: str):
        row = self._get(ctx, content_id)
        assignment = self._assignments.create(
            ctx,
            company_id=row.company_id,
            content_item_id=content_id,
            user_id=user_id,
            role=role,
        )
        self._activity.log(
            ctx,
            entity_type="content",
            entity_id=row.id,
            action="assigned",
            details=f"Assigned {role} to user",
            company_id=row.company_id,
        )
        return ContentAssignmentResponse.model_validate(assignment)

    def get_timeline(self, ctx: TenantContext, content_id: UUID):
        return self.list_activity(ctx, "content", content_id)

    def link_asset(
        self,
        ctx: TenantContext,
        content_id: UUID,
        media_asset_id: UUID,
        *,
        asset_role: str | None = None,
        sort_order: int = 0,
    ) -> dict:
        from uuid import uuid4

        from sqlalchemy import select

        from modules.marketing.models import MktContentAssetLink, MktMediaAsset

        row = self._get(ctx, content_id)
        asset = self._repo.db.scalar(
            select(MktMediaAsset).where(
                MktMediaAsset.id == media_asset_id,
                MktMediaAsset.tenant_id == ctx.tenant_id,
                MktMediaAsset.is_deleted.is_(False),
            )
        )
        if asset is None:
            raise NotFoundException("Media asset not found")
        link = MktContentAssetLink(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=row.company_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            content_item_id=content_id,
            media_asset_id=media_asset_id,
            sort_order=sort_order,
            asset_role=asset_role,
        )
        self._repo.db.add(link)
        self._repo.db.flush()
        return {
            "id": str(link.id),
            "content_item_id": str(content_id),
            "media_asset_id": str(media_asset_id),
            "asset_role": asset_role,
            "sort_order": sort_order,
            "asset": {
                "id": str(asset.id),
                "name": asset.name,
                "file_url": asset.file_url,
                "mime_type": asset.mime_type,
                "asset_kind": getattr(asset, "asset_kind", None),
                "width_px": getattr(asset, "width_px", None),
                "height_px": getattr(asset, "height_px", None),
            },
        }

    def list_linked_assets(self, ctx: TenantContext, content_id: UUID) -> list[dict]:
        from sqlalchemy import select

        from modules.marketing.models import MktContentAssetLink, MktMediaAsset

        self._get(ctx, content_id)
        links = self._repo.db.scalars(
            select(MktContentAssetLink)
            .where(
                MktContentAssetLink.content_item_id == content_id,
                MktContentAssetLink.is_deleted.is_(False),
            )
            .order_by(MktContentAssetLink.sort_order)
        ).all()
        result: list[dict] = []
        for link in links:
            asset = self._repo.db.scalar(select(MktMediaAsset).where(MktMediaAsset.id == link.media_asset_id))
            if asset is None:
                continue
            result.append(
                {
                    "id": str(link.id),
                    "asset_role": link.asset_role,
                    "sort_order": link.sort_order,
                    "asset": {
                        "id": str(asset.id),
                        "name": asset.name,
                        "file_url": asset.file_url,
                        "mime_type": asset.mime_type,
                        "asset_kind": getattr(asset, "asset_kind", None),
                        "width_px": getattr(asset, "width_px", None),
                        "height_px": getattr(asset, "height_px", None),
                    },
                }
            )
        return result

    def _get(self, ctx: TenantContext, row_id: UUID) -> MktContentItem:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Content not found")
        return row
