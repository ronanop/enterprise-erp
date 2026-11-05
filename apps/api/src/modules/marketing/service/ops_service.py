"""Marketing operations, tasks, campaign workspace, approvals, and workload services."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.marketing.domain.exceptions import NotFoundException, ValidationException
from modules.marketing.models import (
    MktApproval,
    MktCampaign,
    MktContentRequest,
    MktGeneratedContent,
    MktM365File,
    MktM365Meeting,
    MktM365Workspace,
    MktOpsEvent,
    MktTask,
    MktTimeEntry,
)
from modules.marketing.repository.base import MktScopedRepository, utcnow
from modules.marketing.service.number_service import MarketingNumberService
from shared.text_safety import assert_safe_plain_text
from shared.upload_safety import UnsafeUploadError, validate_upload

OPEN_TASK_STATUSES = {"draft", "assigned", "in_progress", "in_review", "blocked"}

CAMPAIGN_FOLDERS = [
    "Content",
    "Designs",
    "Videos",
    "Presentations",
    "Approvals",
    "Reports",
    "Final Assets",
]


class OpsEventService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)
        self._audit = PlatformAuditFacade(db)

    def record(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        action: str,
        entity_type: str,
        entity_id: UUID | None = None,
        campaign_id: UUID | None = None,
        old_value: dict | None = None,
        new_value: dict | None = None,
        comment: str | None = None,
        branch_id: UUID | None = None,
    ) -> MktOpsEvent:
        row = self._repo.create_row(
            MktOpsEvent,
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            campaign_id=campaign_id,
            entity_type=entity_type,
            entity_id=entity_id,
            actor_user_id=ctx.user_id,
            action=action,
            old_value=old_value,
            new_value=new_value,
            comment=comment,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=entity_type,
            entity_id=entity_id or row.id,
            operation=action,
            performed_by=ctx.user_id,
            old_value=old_value,
            new_value=new_value,
        )
        return row

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_list_company_id(ctx, company_id)
        return self._repo.list_by_company(MktOpsEvent, ctx, cid)


class TaskService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)
        self._numbers = MarketingNumberService(db)
        self._ops = OpsEventService(db)

    @staticmethod
    def _involved_user_ids(row: MktTask) -> set[UUID]:
        """Users who should see a task in My Work (columns + deliverable metadata)."""
        ids: set[UUID | None] = {
            row.owner_user_id,
            row.assignee_user_id,
            row.reviewer_user_id,
            row.delegated_by_user_id,
        }
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        for key in ("content_provider_user_id", "editor_user_id", "approval_head_user_id"):
            raw = meta.get(key)
            if raw:
                try:
                    ids.add(UUID(str(raw)))
                except (TypeError, ValueError):
                    pass
        for raw in meta.get("approval_head_user_ids") or []:
            if not raw:
                continue
            try:
                ids.add(UUID(str(raw)))
            except (TypeError, ValueError):
                pass
        return {uid for uid in ids if uid is not None}

    def list(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        mine: bool = False,
        campaign_id: UUID | None = None,
        deliverables_only: bool = False,
    ):
        cid = self._repo.resolve_list_company_id(ctx, company_id)
        # Deliverables often have null branch_id; strict session-branch equality hides
        # assigned work from providers/editors/approval heads. Scope by company only.
        rows = self._repo.list_by_company(MktTask, ctx, cid, branch_scoped=False)
        if campaign_id is not None:
            rows = [r for r in rows if r.campaign_id == campaign_id]
        if deliverables_only:
            rows = [
                r
                for r in rows
                if isinstance(r.metadata_json, dict) and r.metadata_json.get("is_deliverable") is True
            ]
        if mine and ctx.user_id:
            rows = [r for r in rows if ctx.user_id in self._involved_user_ids(r)]
        return rows

    def get(self, ctx: TenantContext, row_id: UUID) -> MktTask:
        row = self._repo.get_by_id(MktTask, ctx, row_id, branch_scoped=False)
        if row is None:
            raise NotFoundException("Task not found")
        return row

    def create(self, ctx: TenantContext, **fields) -> MktTask:
        company_id = self._repo.resolve_company_id(ctx, fields.pop("company_id", None))
        code = self._numbers.next_code(MktTask, company_id, "task_code", "TSK")
        fields.setdefault("owner_user_id", ctx.user_id)
        fields.setdefault("assignee_user_id", ctx.user_id)
        fields.setdefault("status", "assigned" if fields.get("assignee_user_id") else "draft")
        row = self._repo.create_row(MktTask, ctx, company_id=company_id, task_code=code, **fields)
        self._ops.record(
            ctx,
            company_id=company_id,
            action="task.create",
            entity_type="mkt_task",
            entity_id=row.id,
            campaign_id=row.campaign_id,
            new_value={"title": row.title, "execution_mode": row.execution_mode},
            branch_id=row.branch_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> MktTask:
        row = self.get(ctx, row_id)
        old = {"status": row.status, "assignee_user_id": str(row.assignee_user_id) if row.assignee_user_id else None}
        updated = self._repo.update_row(MktTask, ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Task not found")
        self._ops.record(
            ctx,
            company_id=updated.company_id,
            action="task.update",
            entity_type="mkt_task",
            entity_id=updated.id,
            campaign_id=updated.campaign_id,
            old_value=old,
            new_value={k: str(v) if v is not None else None for k, v in fields.items()},
            branch_id=updated.branch_id,
        )
        return updated

    def execute(self, ctx: TenantContext, row_id: UUID) -> MktTask:
        return self.update(ctx, row_id, execution_mode="execute", assignee_user_id=ctx.user_id, status="in_progress")

    def submit_content(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        content_url: str | None = None,
        document_name: str | None = None,
        notes: str | None = None,
        content_base64: str | None = None,
        content_type: str | None = None,
        file_name: str | None = None,
        self_checked: bool = False,
        approval_head_user_ids: list[UUID] | None = None,
    ) -> MktTask:
        """Maker (provider/editor) attaches link/file for approval after self-check."""
        import base64
        import uuid as uuid_lib
        from pathlib import Path

        from core.config import settings
        from modules.foundation.domain.erp_modules import MARKETING_ROLE_HEAD
        from modules.marketing.domain.enums import ContentRequestStatus, ContentStatus
        from modules.marketing.models import MktContentRequest, MktGeneratedContent
        from modules.marketing.service.role_access import (
            is_marketing_module_admin,
            marketing_module_role,
        )

        row = self.get(ctx, row_id)
        meta = dict(row.metadata_json) if isinstance(row.metadata_json, dict) else {}
        if meta.get("is_deliverable") is not True:
            raise ValidationException("Only campaign deliverables can submit content this way")

        if not self_checked:
            raise ValidationException("Self-check is required before submitting for approval")

        provider_id = meta.get("content_provider_user_id")
        editor_id = meta.get("editor_user_id")
        is_maker = (
            (provider_id and ctx.user_id and str(ctx.user_id) == str(provider_id))
            or (editor_id and ctx.user_id and str(ctx.user_id) == str(editor_id))
            or (ctx.user_id is not None and row.owner_user_id == ctx.user_id)
            or (ctx.user_id is not None and row.assignee_user_id == ctx.user_id)
        )
        role = marketing_module_role(self.db, ctx)
        if (
            not is_maker
            and not is_marketing_module_admin(self.db, ctx)
            and role != MARKETING_ROLE_HEAD
        ):
            raise ValidationException(
                "Only the assigned content provider or editor can submit content"
            )

        if row.status in {"completed", "cancelled"}:
            raise ValidationException("This deliverable is closed and cannot accept new content")
        if meta.get("submission_status") == "approved":
            raise ValidationException("This deliverable is already approved")

        # Maker may attach / refresh approval heads at submit time.
        if approval_head_user_ids:
            from modules.marketing.service.campaign_service import CampaignService

            heads: list[dict] = []
            seen: set[str] = set()
            svc = CampaignService(self.db)
            for hid in approval_head_user_ids:
                if not hid or str(hid) in seen:
                    continue
                seen.add(str(hid))
                resolved = svc._resolve_assignee(ctx, hid, label="Approval head")  # noqa: SLF001
                if resolved:
                    heads.append(resolved)
            if heads:
                meta["approval_head_user_ids"] = [str(h["user_id"]) for h in heads]
                meta["approval_head_names"] = [h["display_name"] for h in heads]
                meta["approval_head_user_id"] = str(heads[0]["user_id"])
                meta["approval_head_name"] = heads[0]["display_name"]
                meta["_reviewer_user_id"] = str(heads[0]["user_id"])

        url = (content_url or "").strip()
        try:
            doc_name = assert_safe_plain_text(document_name or "", field="document_name") if document_name else ""
            note_text = assert_safe_plain_text(notes or "", field="notes") if notes else ""
        except ValueError as exc:
            raise ValidationException(str(exc)) from exc
        raw_b64 = (content_base64 or "").strip()
        upload_name = (file_name or "").strip() or doc_name

        stored_rel: str | None = None
        stored_name: str | None = None
        stored_ctype: str | None = None
        if raw_b64:
            if not upload_name:
                raise ValidationException("File name is required when uploading a file")
            try:
                raw = base64.b64decode(raw_b64, validate=False)
            except Exception as exc:  # noqa: BLE001
                raise ValidationException("Invalid file upload payload") from exc
            try:
                safe, media = validate_upload(
                    file_name=upload_name,
                    content_type=content_type,
                    raw=raw,
                    max_bytes=25 * 1024 * 1024,
                )
            except UnsafeUploadError as exc:
                raise ValidationException(str(exc)) from exc
            root = Path(settings.resolved_crm_upload_root).parent / "marketing-deliverables"
            folder = root / str(ctx.tenant_id) / str(row.id)
            folder.mkdir(parents=True, exist_ok=True)
            stored_name = f"{uuid_lib.uuid4().hex[:12]}_{safe}"
            path = folder / stored_name
            path.write_bytes(raw)
            stored_rel = str(path.relative_to(root)).replace("\\", "/")
            stored_ctype = media or (content_type or "").strip() or "application/octet-stream"
            if not doc_name:
                doc_name = safe

        if not url and not stored_rel and not doc_name and not note_text:
            raise ValidationException("Provide a content link, upload a file, or add notes")

        # Prefer a stable in-app download URL for uploaded files.
        display_url = url
        if stored_rel:
            display_url = f"/marketing/tasks/{row.id}/submission-file"

        if row.content_request_id:
            req = self._repo.get_by_id(MktContentRequest, ctx, row.content_request_id, branch_scoped=True)
        else:
            req = None

        submission = {
            "workflow": "deliverable_submission",
            "deliverable_task_id": str(row.id),
            "content_url": display_url or None,
            "external_link": url or None,
            "document_name": doc_name or None,
            "submission_notes": note_text or None,
            "submission_kind": "file" if stored_rel else "link",
            "file_storage_path": stored_rel,
            "file_content_type": stored_ctype,
            "file_stored_name": stored_name,
            "content_provider_user_id": meta.get("content_provider_user_id"),
            "approval_head_user_id": meta.get("approval_head_user_id"),
            "approval_head_user_ids": meta.get("approval_head_user_ids") or (
                [meta["approval_head_user_id"]] if meta.get("approval_head_user_id") else []
            ),
            "editor_user_id": meta.get("editor_user_id"),
            "deliverable_type": meta.get("deliverable_type") or row.task_kind,
            "self_checked": True,
        }

        if req is None:
            code = self._numbers.next_code(MktContentRequest, row.company_id, "request_code", "CRQ")
            req = self._repo.create_row(
                MktContentRequest,
                ctx,
                company_id=row.company_id,
                branch_id=row.branch_id,
                campaign_id=row.campaign_id,
                request_code=code,
                topic=row.title,
                content_type="other",
                reference_notes=note_text or None,
                assigned_to_user_id=row.reviewer_user_id,
                due_at=row.due_at,
                inputs=submission,
                status=ContentRequestStatus.COMPLETED.value,
            )
        else:
            req.inputs = {**(req.inputs or {}), **submission}
            req.reference_notes = note_text or req.reference_notes
            req.assigned_to_user_id = row.reviewer_user_id or req.assigned_to_user_id
            req.status = ContentRequestStatus.COMPLETED.value
            req.updated_at = utcnow()
            req.updated_by = ctx.user_id
            self.db.flush()

        existing_content = self.db.scalar(
            select(MktGeneratedContent).where(
                MktGeneratedContent.content_request_id == req.id,
                MktGeneratedContent.is_deleted.is_(False),
            )
        )
        body = display_url or note_text or doc_name or row.title
        headline = doc_name or row.title
        if existing_content is None:
            self._repo.create_row(
                MktGeneratedContent,
                ctx,
                company_id=row.company_id,
                branch_id=row.branch_id,
                content_request_id=req.id,
                campaign_id=row.campaign_id,
                headline=headline,
                body=body,
                status=ContentStatus.IN_REVIEW.value,
                pipeline_result={"submission": submission},
                content_version=1,
                ai_model="manual.deliverable_submission",
            )
        else:
            existing_content.headline = headline
            existing_content.body = body
            existing_content.status = ContentStatus.IN_REVIEW.value
            existing_content.pipeline_result = {"submission": submission}
            existing_content.updated_at = utcnow()
            existing_content.updated_by = ctx.user_id
            self.db.flush()

        meta.update(
            {
                "content_url": display_url or None,
                "external_link": url or None,
                "document_name": doc_name or None,
                "submission_notes": note_text or None,
                "submission_kind": submission["submission_kind"],
                "file_storage_path": stored_rel,
                "file_content_type": stored_ctype,
                "submission_status": "in_review",
                "improvement_comment": None,
                "self_checked": True,
            }
        )
        reviewer = None
        if meta.pop("_reviewer_user_id", None):
            try:
                reviewer = UUID(str(meta.get("approval_head_user_id")))
            except (TypeError, ValueError):
                reviewer = row.reviewer_user_id
        update_fields: dict = {
            "content_request_id": req.id,
            "metadata_json": meta,
            "status": "in_review",
        }
        if reviewer is not None:
            update_fields["reviewer_user_id"] = reviewer
        updated = self.update(ctx, row_id, **update_fields)
        self._ops.record(
            ctx,
            company_id=row.company_id,
            action="deliverable.submit_content",
            entity_type="mkt_task",
            entity_id=row.id,
            campaign_id=row.campaign_id,
            new_value={
                "submission_kind": submission["submission_kind"],
                "document_name": doc_name,
                "has_file": bool(stored_rel),
                "has_link": bool(url),
            },
            branch_id=row.branch_id,
        )
        return updated

    def review_deliverable(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        action: str,
        comment: str | None = None,
    ) -> MktTask:
        """Approve / reject a submitted deliverable (approval heads on My Work)."""
        from modules.marketing.service.content_service import ContentService

        row = self.get(ctx, row_id)
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        if meta.get("is_deliverable") is not True:
            raise ValidationException("Only campaign deliverables support this review action")
        if not row.content_request_id:
            raise ValidationException("Content must be submitted before it can be reviewed")
        submission = (meta.get("submission_status") or "").strip().lower()
        if row.status != "in_review" and submission != "in_review":
            raise ValidationException("This deliverable is not waiting for approval")

        ContentService(self.db).review_submission(
            ctx,
            row.content_request_id,
            action=action,
            comment=comment,
        )
        return self.get(ctx, row_id)

    def resolve_submission_file(self, ctx: TenantContext, row_id: UUID):
        """Return (path, download_name, content_type) for a deliverable upload."""
        from pathlib import Path

        from core.config import settings

        row = self.get(ctx, row_id)
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        rel = meta.get("file_storage_path")
        if not rel:
            raise NotFoundException("No uploaded file on this deliverable")
        root = Path(settings.resolved_crm_upload_root).parent / "marketing-deliverables"
        path = (root / str(rel)).resolve()
        if not str(path).startswith(str(root.resolve())) or not path.is_file():
            raise NotFoundException("Uploaded file is missing on disk")
        download_name = meta.get("document_name") or path.name
        content_type = (meta.get("file_content_type") or "").strip() or "application/octet-stream"
        if content_type == "application/octet-stream":
            suffix = path.suffix.lower()
            by_ext = {
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".gif": "image/gif",
                ".webp": "image/webp",
                ".svg": "image/svg+xml",
                ".mp4": "video/mp4",
                ".webm": "video/webm",
                ".mov": "video/quicktime",
                ".pdf": "application/pdf",
            }
            # Also sniff from display name when storage file has a hashed extension-less prefix.
            name_l = str(download_name).lower()
            for ext, mime in by_ext.items():
                if suffix == ext or name_l.endswith(ext):
                    content_type = mime
                    break
        return path, str(download_name), str(content_type)

    def delegate(self, ctx: TenantContext, row_id: UUID, assignee_user_id: UUID) -> MktTask:
        return self.update(
            ctx,
            row_id,
            execution_mode="delegate",
            assignee_user_id=assignee_user_id,
            delegated_by_user_id=ctx.user_id,
            status="assigned",
        )

    def hybrid(self, ctx: TenantContext, row_id: UUID, assignee_user_id: UUID) -> MktTask:
        return self.update(
            ctx,
            row_id,
            execution_mode="hybrid",
            assignee_user_id=assignee_user_id,
            owner_user_id=ctx.user_id,
            delegated_by_user_id=ctx.user_id,
            status="in_progress",
        )

    def log_time(self, ctx: TenantContext, task_id: UUID, *, hours: Decimal, entry_type: str = "work", notes: str | None = None):
        task = self.get(ctx, task_id)
        entry = self._repo.create_row(
            MktTimeEntry,
            ctx,
            company_id=task.company_id,
            branch_id=task.branch_id,
            task_id=task.id,
            user_id=ctx.user_id,
            hours=hours,
            entry_type=entry_type,
            notes=notes,
        )
        actual = Decimal(str(task.actual_hours or 0)) + Decimal(str(hours))
        self.update(ctx, task_id, actual_hours=actual)
        return entry

    def add_annotation(
        self,
        ctx: TenantContext,
        task_id: UUID,
        *,
        kind: str,
        body: str,
        x: float | None = None,
        y: float | None = None,
        at_seconds: float | None = None,
    ) -> MktTask:
        """Reviewer annotation on image (x/y) or video (timestamp) until final approval."""
        kind_key = (kind or "").strip().lower()
        if kind_key not in {"image_mark", "video_timestamp", "text"}:
            raise ValidationException("Annotation kind must be image_mark, video_timestamp, or text")
        note = (body or "").strip()
        if not note:
            raise ValidationException("Annotation comment is required")
        if kind_key == "video_timestamp" and at_seconds is None:
            raise ValidationException("Video annotations need at_seconds")
        if kind_key == "image_mark" and (x is None or y is None):
            raise ValidationException("Image marks need x and y (0–100)")

        row = self.get(ctx, task_id)
        meta = dict(row.metadata_json) if isinstance(row.metadata_json, dict) else {}
        if meta.get("is_deliverable") is not True:
            raise ValidationException("Annotations are only for campaign deliverables")
        if row.status in {"completed", "cancelled"}:
            raise ValidationException("Closed deliverables cannot take new annotations")

        import uuid as uuid_lib

        annotations = list(meta.get("review_annotations") or [])
        if not isinstance(annotations, list):
            annotations = []
        entry = {
            "id": uuid_lib.uuid4().hex,
            "kind": kind_key,
            "body": note[:2000],
            "x": float(x) if x is not None else None,
            "y": float(y) if y is not None else None,
            "at_seconds": float(at_seconds) if at_seconds is not None else None,
            "created_by": str(ctx.user_id) if ctx.user_id else None,
            "created_at": utcnow().isoformat(),
        }
        annotations.append(entry)
        meta["review_annotations"] = annotations[-200:]
        meta["submission_status"] = meta.get("submission_status") or "in_review"
        if row.status not in {"in_review", "assigned", "in_progress"}:
            status = "in_review"
        else:
            status = row.status
        updated = self.update(ctx, task_id, metadata_json=meta, status=status)
        self._ops.record(
            ctx,
            company_id=row.company_id,
            action="deliverable.annotate",
            entity_type="mkt_task",
            entity_id=row.id,
            campaign_id=row.campaign_id,
            new_value={"kind": kind_key, "body": note[:200]},
            branch_id=row.branch_id,
        )
        return updated


class ApprovalService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)
        self._ops = OpsEventService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_list_company_id(ctx, company_id)
        return self._repo.list_by_company(MktApproval, ctx, cid)

    def act(
        self,
        ctx: TenantContext,
        *,
        entity_type: str,
        entity_id: UUID,
        approval_level: int,
        action: str,
        comment: str | None = None,
        campaign_id: UUID | None = None,
        company_id: UUID | None = None,
    ) -> MktApproval:
        if action not in {"approve", "reject", "comment", "escalate", "request_revision"}:
            raise ValidationException("Invalid approval action")
        cid = self._repo.resolve_company_id(ctx, company_id)
        row = self._repo.create_row(
            MktApproval,
            ctx,
            company_id=cid,
            campaign_id=campaign_id,
            entity_type=entity_type,
            entity_id=entity_id,
            approval_level=approval_level,
            actor_user_id=ctx.user_id,
            action=action,
            comment=comment,
        )
        self._ops.record(
            ctx,
            company_id=cid,
            action=f"approval.{action}",
            entity_type=entity_type,
            entity_id=entity_id,
            campaign_id=campaign_id,
            new_value={"level": approval_level, "comment": comment},
        )
        if entity_type == "mkt_generated_content":
            content = self._repo.get_by_id(MktGeneratedContent, ctx, entity_id, branch_scoped=True)
            if content is not None:
                if action == "approve" and approval_level >= 4:
                    content.status = "approved"
                elif action == "reject":
                    content.status = "rejected"
                elif action == "request_revision":
                    content.status = "draft"
                elif action == "approve":
                    content.status = "in_review"
                content.updated_at = utcnow()
                content.updated_by = ctx.user_id
                self.db.flush()
        return row


class M365Service:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)
        self._ops = OpsEventService(db)

    def list_workspaces(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_list_company_id(ctx, company_id)
        return self._repo.list_by_company(MktM365Workspace, ctx, cid)

    def list_files(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_list_company_id(ctx, company_id)
        return self._repo.list_by_company(MktM365File, ctx, cid)

    def list_meetings(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_list_company_id(ctx, company_id)
        return self._repo.list_by_company(MktM365Meeting, ctx, cid)

    def provision_for_campaign(self, ctx: TenantContext, campaign: MktCampaign) -> MktM365Workspace:
        existing = self.db.scalar(
            select(MktM365Workspace).where(
                MktM365Workspace.campaign_id == campaign.id,
                MktM365Workspace.is_deleted.is_(False),
            )
        )
        if existing is not None:
            return existing
        row = self._repo.create_row(
            MktM365Workspace,
            ctx,
            company_id=campaign.company_id,
            branch_id=campaign.branch_id,
            campaign_id=campaign.id,
            display_name=f"Marketing - {campaign.campaign_name}",
            folder_structure={"folders": CAMPAIGN_FOLDERS},
            provision_status="provisioned",
        )
        self._ops.record(
            ctx,
            company_id=campaign.company_id,
            action="m365.provision",
            entity_type="mkt_m365_workspace",
            entity_id=row.id,
            campaign_id=campaign.id,
            new_value={"provision_status": row.provision_status, "display_name": row.display_name},
            branch_id=campaign.branch_id,
        )
        return row

    def register_file(self, ctx: TenantContext, **fields) -> MktM365File:
        company_id = self._repo.resolve_company_id(ctx, fields.pop("company_id", None))
        fields.setdefault("owner_user_id", ctx.user_id)
        fields.setdefault("folder_path", "/Content")
        row = self._repo.create_row(MktM365File, ctx, company_id=company_id, **fields)
        self._ops.record(
            ctx,
            company_id=company_id,
            action="m365.file.register",
            entity_type="mkt_m365_file",
            entity_id=row.id,
            campaign_id=row.campaign_id,
            new_value={"file_name": row.file_name, "storage_tier": row.storage_tier},
        )
        return row

    def promote_to_sharepoint(self, ctx: TenantContext, file_id: UUID) -> MktM365File:
        row = self._repo.get_by_id(MktM365File, ctx, file_id)
        if row is None:
            raise NotFoundException("File not found")
        if row.status != "approved":
            raise ValidationException("Only approved files can be promoted to Final Assets")
        old = {"storage_tier": row.storage_tier, "folder_path": row.folder_path}
        row.storage_tier = "sharepoint"
        row.folder_path = "/Final Assets"
        row.version_label = "1.0"
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        self._ops.record(
            ctx,
            company_id=row.company_id,
            action="m365.file.promote",
            entity_type="mkt_m365_file",
            entity_id=row.id,
            campaign_id=row.campaign_id,
            old_value=old,
            new_value={"storage_tier": row.storage_tier, "folder_path": row.folder_path},
        )
        return row

    def schedule_meeting(self, ctx: TenantContext, **fields) -> MktM365Meeting:
        company_id = self._repo.resolve_company_id(ctx, fields.pop("company_id", None))
        attendees = fields.pop("attendee_emails", None) or []
        if isinstance(attendees, dict):
            emails = list(attendees.get("emails") or [])
        else:
            emails = list(attendees)
        fields.setdefault("status", "scheduled")
        row = self._repo.create_row(
            MktM365Meeting,
            ctx,
            company_id=company_id,
            organizer_user_id=ctx.user_id,
            attendee_emails={"emails": emails},
            **fields,
        )
        self._ops.record(
            ctx,
            company_id=company_id,
            action="m365.meeting.schedule",
            entity_type="mkt_m365_meeting",
            entity_id=row.id,
            campaign_id=row.campaign_id,
            new_value={"subject": row.subject, "status": row.status},
        )
        return row

    def search(self, ctx: TenantContext, query: str, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        q = f"%{query.lower()}%"
        campaigns = list(
            self.db.scalars(
                self._repo.apply_mkt_filter(
                    select(MktCampaign).where(
                        MktCampaign.company_id == cid,
                        MktCampaign.is_deleted.is_(False),
                        MktCampaign.campaign_name.ilike(q),
                    ),
                    MktCampaign,
                    ctx,
                )
            ).all()
        )
        tasks = list(
            self.db.scalars(
                self._repo.apply_mkt_filter(
                    select(MktTask).where(
                        MktTask.company_id == cid,
                        MktTask.is_deleted.is_(False),
                        or_(MktTask.title.ilike(q), MktTask.task_code.ilike(q)),
                    ),
                    MktTask,
                    ctx,
                    branch_scoped=True,
                )
            ).all()
        )
        files = list(
            self.db.scalars(
                self._repo.apply_mkt_filter(
                    select(MktM365File).where(
                        MktM365File.company_id == cid,
                        MktM365File.is_deleted.is_(False),
                        MktM365File.file_name.ilike(q),
                    ),
                    MktM365File,
                    ctx,
                )
            ).all()
        )
        return {
            "query": query,
            "campaigns": [{"id": str(c.id), "campaign_name": c.campaign_name, "status": c.status} for c in campaigns[:20]],
            "tasks": [{"id": str(t.id), "title": t.title, "status": t.status} for t in tasks[:20]],
            "files": [
                {
                    "id": str(f.id),
                    "file_name": f.file_name,
                    "storage_tier": f.storage_tier,
                    "folder_path": f.folder_path,
                }
                for f in files[:20]
            ],
            "sharepoint_folders": CAMPAIGN_FOLDERS,
        }


class WorkloadService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)

    def _score(self, tasks: list[MktTask]) -> dict:
        open_tasks = [t for t in tasks if t.status in OPEN_TASK_STATUSES]
        reviews = [t for t in open_tasks if t.status == "in_review"]
        urgent = [t for t in open_tasks if t.is_urgent]
        est = sum(float(t.estimated_hours or 0) for t in open_tasks)
        actual = sum(float(t.actual_hours or 0) for t in tasks)
        complexity = sum(int(t.complexity or 1) for t in open_tasks)
        score = (
            len(open_tasks) * 10
            + len(reviews) * 8
            + complexity * 4
            + est * 2
            + len(urgent) * 15
        )
        capacity = 40.0
        utilization = round((est / capacity) * 100, 1) if capacity else 0
        completed = [t for t in tasks if t.status == "completed"]
        delayed = [
            t
            for t in open_tasks
            if t.due_at is not None and t.due_at < datetime.now(timezone.utc)
        ]
        return {
            "active_tasks": len(open_tasks),
            "pending_reviews": len(reviews),
            "urgent_tasks": len(urgent),
            "estimated_hours": round(est, 2),
            "actual_hours": round(actual, 2),
            "workload_score": round(score, 1),
            "capacity_hours": capacity,
            "utilization_pct": utilization,
            "completed_tasks": len(completed),
            "delayed_tasks": len(delayed),
            "reassignment": "overload" if score > 80 or utilization > 100 else "underutilized" if score < 20 else "balanced",
        }

    def overview(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._repo.resolve_company_id(ctx, company_id)
        tasks = self._repo.list_by_company(MktTask, ctx, cid, branch_scoped=False)
        by_user: dict[str, list[MktTask]] = defaultdict(list)
        for task in tasks:
            key = str(task.assignee_user_id or task.owner_user_id or "unassigned")
            by_user[key].append(task)
        from modules.foundation.models.security import SecUser

        user_ids = [UUID(uid) for uid in by_user.keys() if uid != "unassigned"]
        name_map: dict[str, str] = {}
        if user_ids:
            for u in self.db.scalars(
                select(SecUser).where(
                    SecUser.tenant_id == ctx.tenant_id,
                    SecUser.id.in_(user_ids),
                    SecUser.is_deleted.is_(False),
                )
            ).all():
                name_map[str(u.id)] = u.display_name or u.email or str(u.id)

        people = []
        for user_id, user_tasks in by_user.items():
            metrics = self._score(user_tasks)
            total = len(user_tasks) or 1
            done = metrics.get("completed_tasks") or 0
            people.append(
                {
                    "user_id": user_id,
                    "display_name": name_map.get(user_id) or ("Unassigned" if user_id == "unassigned" else user_id[:8]),
                    "checklist_pct": round((done / total) * 100, 1),
                    "duration_hours": metrics.get("actual_hours") or 0,
                    **metrics,
                }
            )
        people.sort(key=lambda r: r["workload_score"], reverse=True)
        company = self._score(tasks)
        mine = [t for t in tasks if ctx.user_id and ctx.user_id in {t.assignee_user_id, t.owner_user_id}]
        return {
            "company": company,
            "people": people,
            "me": {
                **self._score(mine),
                "display_name": "Me",
                "checklist_pct": round(
                    ((self._score(mine).get("completed_tasks") or 0) / (len(mine) or 1)) * 100,
                    1,
                ),
                "duration_hours": self._score(mine).get("actual_hours") or 0,
            },
            "overloaded": [p for p in people if p["reassignment"] == "overload"],
            "underutilized": [p for p in people if p["reassignment"] == "underutilized"],
            "campaign_health": self._campaign_health(ctx, cid, tasks),
            "team_checklist": [
                {
                    "user_id": p["user_id"],
                    "display_name": p["display_name"],
                    "completed": p.get("completed_tasks") or 0,
                    "active": p.get("active_tasks") or 0,
                    "checklist_pct": p.get("checklist_pct") or 0,
                    "duration_hours": p.get("duration_hours") or 0,
                    "delayed": p.get("delayed_tasks") or 0,
                }
                for p in people
                if p["user_id"] != "unassigned"
            ],
        }

    def _campaign_health(self, ctx: TenantContext, company_id: UUID, tasks: list[MktTask]) -> list[dict]:
        campaigns = self._repo.list_by_company(MktCampaign, ctx, company_id)
        out = []
        now = datetime.now(timezone.utc)
        for camp in campaigns:
            ct = [t for t in tasks if t.campaign_id == camp.id]
            delayed = [t for t in ct if t.due_at and t.due_at < now and t.status in OPEN_TASK_STATUSES]
            done = [t for t in ct if t.status == "completed"]
            out.append(
                {
                    "campaign_id": str(camp.id),
                    "campaign_name": camp.campaign_name,
                    "status": camp.status,
                    "priority": getattr(camp, "priority", "medium"),
                    "task_count": len(ct),
                    "completed": len(done),
                    "delayed": len(delayed),
                    "budget_amount": str(camp.budget_amount) if camp.budget_amount is not None else None,
                }
            )
        return out


class AiOpsService:
    """Extends the existing agent pipeline - does not replace generation."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def improve(self, text: str, mode: str) -> dict:
        mode = (mode or "simplify").lower()
        if mode == "grammar":
            body = text.strip()
            hint = "Grammar pass applied (deterministic preview)."
        elif mode == "expand":
            body = f"{text.strip()}\n\nExpansion: add proof, a customer outcome, and a single CTA."
            hint = "Expanded structure."
        elif mode == "summarize":
            body = text.strip()[:280]
            hint = "Summarized to a short brief."
        elif mode == "localize":
            body = f"{text.strip()}\n\nLocalization notes: adapt examples and date formats for the target market."
            hint = "Localization notes appended."
        elif mode == "tone":
            body = f"Tone-adjusted (professional):\n{text.strip()}"
            hint = "Tone adjusted."
        else:
            body = " ".join(text.split())
            hint = "Simplified whitespace and sentence flow."
        return {"mode": mode, "body": body, "hint": hint}

    def review(self, text: str) -> dict:
        missing = []
        if "cta" not in text.lower() and "call to action" not in text.lower():
            missing.append("CTA")
        if len(text) < 80:
            missing.append("sufficient body length")
        brand = []
        if "guaranteed" in text.lower() or "best in the world" in text.lower():
            brand.append("Absolute claim may violate brand/compliance guidelines.")
        return {
            "missing_information": missing,
            "brand_violations": brand,
            "compliance_issues": brand,
            "recommendation": "Submit to Level 2 reviewer after addressing flags.",
        }

    def creative_brief(self, topic: str) -> dict:
        return {
            "topic": topic,
            "design_brief": f"Visual system for '{topic}': restrained slate UI, one gold accent, high-contrast type.",
            "campaign_concepts": [
                f"{topic} as an operating system, not a campaign burst.",
                f"Proof-led narrative: one metric, one customer, one next step.",
            ],
            "visual_recommendations": ["Document grids", "Product stills", "Short kinetic type bumpers"],
        }

    def video_assist(self, topic: str) -> dict:
        return {
            "topic": topic,
            "script": f"Open on the problem around {topic}. Cut to one proof. End on a single CTA.",
            "storyboard": ["0-5s problem", "5-20s proof", "20-30s CTA"],
            "scene_suggestions": ["Desk-side operator", "Dashboard close-up", "Customer quote card"],
            "voiceover_draft": f"If {topic} still lives in slides and inboxes, this is the operating layer.",
        }

    def knowledge(self, ctx: TenantContext, query: str, company_id: UUID | None = None) -> dict:
        return M365Service(self.db).search(ctx, query, company_id)
