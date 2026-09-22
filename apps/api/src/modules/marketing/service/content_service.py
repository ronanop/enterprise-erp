"""Content request + generation service."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.erp_modules import MARKETING_ROLE_APPROVAL_HEAD, MARKETING_ROLE_HEAD
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.marketing.domain.enums import ContentRequestStatus, ContentStatus
from modules.marketing.domain.exceptions import NotFoundException, ValidationException
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
        """Write LinkedIn, Instagram, carousel, and story variants from brand voice."""
        from modules.marketing.service.engines.writer_pipeline import generate_variants

        row = self.get_request(ctx, request_id)
        row.status = ContentRequestStatus.PROCESSING.value
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        self.db.flush()

        generate_variants(self.db, ctx, row)
        row.status = ContentRequestStatus.COMPLETED.value
        row.error_message = None
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        self.db.flush()
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
        from modules.marketing.models import MktCampaign, MktContentRequest
        from modules.marketing.service.marketing_notify import (
            approver_ids,
            notify_users,
            start_content_workflow,
        )
        from modules.marketing.service.ops_service import ApprovalService

        existing = self.get_content(ctx, row_id)
        if not (existing.body or "").strip():
            raise ValidationException("Add a caption before sending this for review")
        pipeline = dict(existing.pipeline_result) if isinstance(existing.pipeline_result, dict) else {}
        instance_id = start_content_workflow(self.db, ctx, existing)
        if instance_id:
            pipeline["workflow_instance_id"] = instance_id
        row = self.update_content(ctx, row_id, status=ContentStatus.IN_REVIEW.value)
        row.pipeline_result = pipeline
        self.db.flush()
        ApprovalService(self.db).act(
            ctx,
            entity_type="generated_content",
            entity_id=row.id,
            approval_level=1,
            action="comment",
            comment="Submitted for caption review",
            campaign_id=row.campaign_id,
            company_id=row.company_id,
        )
        campaign = self.db.get(MktCampaign, row.campaign_id) if row.campaign_id else None
        request = self.db.get(MktContentRequest, row.content_request_id)
        notify_users(
            self.db,
            ctx,
            event_type="content_submitted",
            title="Caption waiting for review",
            body=row.headline or row.hook or "A draft is waiting on the campaign.",
            user_ids=approver_ids(campaign, request),
            href=f"/marketing/campaigns/{row.campaign_id}" if row.campaign_id else "/marketing/content",
        )
        return row

    def approve(self, ctx: TenantContext, row_id: UUID, *, comment: str | None = None) -> MktGeneratedContent:
        from modules.marketing.models import MktCampaign, MktContentRequest
        from modules.marketing.service.marketing_notify import (
            approve_content_workflow,
            approver_ids,
            notify_users,
            required_approval_level,
        )
        from modules.marketing.service.ops_service import ApprovalService

        existing = self.get_content(ctx, row_id)
        if existing.status not in {ContentStatus.IN_REVIEW.value, ContentStatus.DRAFT.value}:
            raise ValidationException("Only a draft or in-review caption can be approved")
        campaign = self.db.get(MktCampaign, existing.campaign_id) if existing.campaign_id else None
        needed = required_approval_level(campaign)
        prior = [
            row
            for row in ApprovalService(self.db).list(ctx, existing.company_id)
            if row.entity_id == existing.id and row.action == "approve"
        ]
        level = min(5, len(prior) + 1)
        ApprovalService(self.db).act(
            ctx,
            entity_type="generated_content",
            entity_id=existing.id,
            approval_level=level,
            action="approve",
            comment=comment,
            campaign_id=existing.campaign_id,
            company_id=existing.company_id,
        )
        pipeline = dict(existing.pipeline_result) if isinstance(existing.pipeline_result, dict) else {}
        if level >= needed:
            approve_content_workflow(self.db, ctx, pipeline.get("workflow_instance_id"), comment)
            row = self.update_content(ctx, row_id, status=ContentStatus.APPROVED.value)
        else:
            row = existing
            row.status = ContentStatus.IN_REVIEW.value
            row.updated_at = utcnow()
            row.updated_by = ctx.user_id
            self.db.flush()
        request = self.db.get(MktContentRequest, row.content_request_id)
        author = request.created_by if request is not None else None
        notify_users(
            self.db,
            ctx,
            event_type="content_approved" if row.status == ContentStatus.APPROVED.value else "content_submitted",
            title="Caption approved" if row.status == ContentStatus.APPROVED.value else "Caption needs another approval",
            body=row.headline or row.hook or "Review updated.",
            user_ids=approver_ids(campaign, request) + ([author] if author else []),
            href=f"/marketing/campaigns/{row.campaign_id}" if row.campaign_id else "/marketing/content",
        )
        return row

    def request_revision(self, ctx: TenantContext, row_id: UUID, *, comment: str) -> MktGeneratedContent:
        from modules.marketing.models import MktCampaign, MktContentRequest
        from modules.marketing.service.marketing_notify import approver_ids, notify_users
        from modules.marketing.service.ops_service import ApprovalService

        note = (comment or "").strip()
        if not note:
            raise ValidationException("Say what to change on the caption")
        existing = self.get_content(ctx, row_id)
        ApprovalService(self.db).act(
            ctx,
            entity_type="generated_content",
            entity_id=existing.id,
            approval_level=1,
            action="request_revision",
            comment=note,
            campaign_id=existing.campaign_id,
            company_id=existing.company_id,
        )
        pipeline = dict(existing.pipeline_result) if isinstance(existing.pipeline_result, dict) else {}
        lines = list(pipeline.get("lines_to_change") or [])
        lines.append(note)
        pipeline["lines_to_change"] = lines[-3:]
        row = self.update_content(ctx, row_id, status=ContentStatus.DRAFT.value)
        row.pipeline_result = pipeline
        scores = dict(row.scores) if isinstance(row.scores, dict) else {}
        scores["lines_to_change"] = pipeline["lines_to_change"]
        row.scores = scores
        self.db.flush()
        campaign = self.db.get(MktCampaign, row.campaign_id) if row.campaign_id else None
        request = self.db.get(MktContentRequest, row.content_request_id)
        author = request.created_by if request is not None else None
        notify_users(
            self.db,
            ctx,
            event_type="content_revision",
            title="Caption returned for revision",
            body=note,
            user_ids=([author] if author else []) + approver_ids(campaign, request),
            href=f"/marketing/campaigns/{row.campaign_id}" if row.campaign_id else "/marketing/content",
        )
        return row

    def list_versions(self, ctx: TenantContext, content_id: UUID):
        content = self.get_content(ctx, content_id)
        rows = self._repo.list_by_company(MktGeneratedContentVersion, ctx, content.company_id)
        return [r for r in rows if r.content_id == content_id]

    def list_review_queue(self, ctx: TenantContext, company_id: UUID | None = None) -> list[dict]:
        """Deliverable submissions for Requests (approval) workflow."""
        from modules.marketing.service.role_access import (
            is_marketing_module_admin,
            marketing_module_role,
        )

        cid = self._repo.resolve_company_id(ctx, company_id)
        requests = self._repo.list_by_company(MktContentRequest, ctx, cid, branch_scoped=True)
        contents = {
            c.content_request_id: c
            for c in self._repo.list_by_company(MktGeneratedContent, ctx, cid, branch_scoped=True)
        }
        role = marketing_module_role(self.db, ctx)
        is_admin = is_marketing_module_admin(self.db, ctx)

        items: list[dict] = []
        for req in requests:
            inputs = req.inputs if isinstance(req.inputs, dict) else {}
            if inputs.get("workflow") != "deliverable_submission":
                continue
            content = contents.get(req.id)
            approval_head = inputs.get("approval_head_user_id")
            provider = inputs.get("content_provider_user_id")
            if is_admin or role == MARKETING_ROLE_HEAD:
                pass
            elif role == MARKETING_ROLE_APPROVAL_HEAD:
                if approval_head and ctx.user_id and str(ctx.user_id) != str(approval_head):
                    if req.assigned_to_user_id != ctx.user_id:
                        continue
            else:
                if not (
                    (provider and ctx.user_id and str(ctx.user_id) == str(provider))
                    or (req.assigned_to_user_id == ctx.user_id)
                ):
                    continue
            items.append(self._review_item_payload(req, content, inputs))
        items.sort(key=lambda row: (row.get("content_status") != "in_review", row.get("topic") or ""))
        return items

    def review_submission(
        self,
        ctx: TenantContext,
        request_id: UUID,
        *,
        action: str,
        comment: str | None = None,
    ) -> dict:
        from modules.marketing.service.ops_service import ApprovalService, TaskService
        from modules.marketing.service.role_access import is_marketing_module_admin, marketing_module_role

        action_key = (action or "").strip().lower()
        if action_key not in {"approve", "reject", "improve"}:
            raise ValidationException("Action must be approve, reject, or improve")

        req = self.get_request(ctx, request_id)
        inputs = dict(req.inputs) if isinstance(req.inputs, dict) else {}
        if inputs.get("workflow") != "deliverable_submission":
            raise ValidationException("This request is not a deliverable submission")

        role = marketing_module_role(self.db, ctx)
        is_admin = is_marketing_module_admin(self.db, ctx)
        approval_head = inputs.get("approval_head_user_id")
        allowed = is_admin or role in {MARKETING_ROLE_APPROVAL_HEAD, MARKETING_ROLE_HEAD}
        if approval_head and ctx.user_id and str(ctx.user_id) == str(approval_head):
            allowed = True
        if req.assigned_to_user_id and ctx.user_id == req.assigned_to_user_id:
            allowed = True
        if not allowed:
            raise ValidationException("Only the assigned approval head can review this submission")

        comment_text = (comment or "").strip()
        if action_key in {"reject", "improve"} and not comment_text:
            raise ValidationException("Comment is required for reject and improve")

        content = self.db.scalar(
            select(MktGeneratedContent).where(
                MktGeneratedContent.content_request_id == req.id,
                MktGeneratedContent.is_deleted.is_(False),
            )
        )
        if content is None:
            raise NotFoundException("Submitted content not found")

        task = None
        task_id = inputs.get("deliverable_task_id")
        if task_id:
            try:
                task = TaskService(self.db).get(ctx, UUID(str(task_id)))
            except NotFoundException:
                task = None

        approval_action = {
            "approve": "approve",
            "reject": "reject",
            "improve": "request_revision",
        }[action_key]

        ApprovalService(self.db).act(
            ctx,
            entity_type="mkt_generated_content",
            entity_id=content.id,
            approval_level=4 if action_key == "approve" else 2,
            action=approval_action,
            comment=comment_text or None,
            campaign_id=req.campaign_id,
            company_id=req.company_id,
        )

        if action_key == "approve":
            content.status = ContentStatus.APPROVED.value
            req.status = ContentRequestStatus.COMPLETED.value
            inputs["review_status"] = "approved"
            inputs["improvement_comment"] = None
        elif action_key == "reject":
            content.status = ContentStatus.REJECTED.value
            req.status = ContentRequestStatus.CANCELLED.value
            inputs["review_status"] = "rejected"
            inputs["improvement_comment"] = comment_text
        else:
            content.status = ContentStatus.DRAFT.value
            req.status = ContentRequestStatus.DRAFT.value
            inputs["review_status"] = "needs_improvement"
            inputs["improvement_comment"] = comment_text

        content.updated_at = utcnow()
        content.updated_by = ctx.user_id
        req.inputs = inputs
        req.updated_at = utcnow()
        req.updated_by = ctx.user_id
        self.db.flush()

        if task is not None:
            meta = dict(task.metadata_json) if isinstance(task.metadata_json, dict) else {}
            meta["submission_status"] = inputs["review_status"]
            meta["improvement_comment"] = inputs.get("improvement_comment")
            task_status = {
                "approve": "completed",
                "reject": "cancelled",
                "improve": "assigned",
            }[action_key]
            TaskService(self.db).update(ctx, task.id, status=task_status, metadata_json=meta)

        return self._review_item_payload(req, content, inputs)

    @staticmethod
    def _review_item_payload(req: MktContentRequest, content: MktGeneratedContent | None, inputs: dict) -> dict:
        task_raw = inputs.get("deliverable_task_id")
        try:
            task_id = UUID(str(task_raw)) if task_raw else None
        except (TypeError, ValueError):
            task_id = None
        return {
            "id": req.id,
            "request_code": req.request_code,
            "topic": req.topic,
            "content_type": req.content_type,
            "status": req.status,
            "campaign_id": req.campaign_id,
            "assigned_to_user_id": req.assigned_to_user_id,
            "due_at": req.due_at,
            "inputs": inputs,
            "content_id": content.id if content else None,
            "content_status": content.status if content else None,
            "content_url": inputs.get("content_url"),
            "document_name": inputs.get("document_name"),
            "submission_notes": inputs.get("submission_notes"),
            "deliverable_task_id": task_id,
            "improvement_comment": inputs.get("improvement_comment"),
        }
