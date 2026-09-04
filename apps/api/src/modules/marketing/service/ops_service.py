"""Marketing operations, tasks, M365, approvals, and workload services."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.marketing.adapters.graph_adapter import CAMPAIGN_FOLDERS, MicrosoftGraphAdapter
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

OPEN_TASK_STATUSES = {"draft", "assigned", "in_progress", "in_review", "blocked"}


class OpsEventService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)
        self._audit = AuditService(db)

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
        cid = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.list_by_company(MktOpsEvent, ctx, cid)


class TaskService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)
        self._numbers = MarketingNumberService(db)
        self._ops = OpsEventService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None, mine: bool = False):
        cid = self._repo.resolve_company_id(ctx, company_id)
        rows = self._repo.list_by_company(MktTask, ctx, cid, branch_scoped=True)
        if mine and ctx.user_id:
            rows = [
                r
                for r in rows
                if ctx.user_id in {r.owner_user_id, r.assignee_user_id, r.reviewer_user_id, r.delegated_by_user_id}
            ]
        return rows

    def get(self, ctx: TenantContext, row_id: UUID) -> MktTask:
        row = self._repo.get_by_id(MktTask, ctx, row_id, branch_scoped=True)
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


class ApprovalService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)
        self._ops = OpsEventService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
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
        self._graph = MicrosoftGraphAdapter()
        self._ops = OpsEventService(db)

    def list_workspaces(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.list_by_company(MktM365Workspace, ctx, cid)

    def list_files(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.list_by_company(MktM365File, ctx, cid)

    def list_meetings(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
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
        result = self._graph.provision_campaign_workspace(campaign.campaign_name)
        row = self._repo.create_row(
            MktM365Workspace,
            ctx,
            company_id=campaign.company_id,
            branch_id=campaign.branch_id,
            campaign_id=campaign.id,
            display_name=result["display_name"],
            teams_group_id=result.get("teams_group_id"),
            teams_web_url=result.get("teams_web_url"),
            folder_structure=result.get("folder_structure"),
            graph_payload=result.get("graph_payload"),
            last_error=result.get("last_error"),
            provision_status=result["provision_status"],
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
            raise ValidationException("Only approved files promote to SharePoint")
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
        starts = fields["starts_at"]
        ends = fields["ends_at"]
        graph = self._graph.create_online_meeting(
            subject=fields["subject"],
            starts_at=starts.isoformat() if hasattr(starts, "isoformat") else str(starts),
            ends_at=ends.isoformat() if hasattr(ends, "isoformat") else str(ends),
            attendees=emails,
        )
        row = self._repo.create_row(
            MktM365Meeting,
            ctx,
            company_id=company_id,
            organizer_user_id=ctx.user_id,
            attendee_emails={"emails": emails},
            graph_event_id=graph.get("event_id"),
            join_url=graph.get("join_url"),
            last_error=graph.get("last_error"),
            status=graph.get("status") or "scheduled",
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
        tasks = self._repo.list_by_company(MktTask, ctx, cid, branch_scoped=True)
        by_user: dict[str, list[MktTask]] = defaultdict(list)
        for task in tasks:
            key = str(task.assignee_user_id or task.owner_user_id or "unassigned")
            by_user[key].append(task)
        people = []
        for user_id, user_tasks in by_user.items():
            metrics = self._score(user_tasks)
            people.append({"user_id": user_id, **metrics})
        people.sort(key=lambda r: r["workload_score"], reverse=True)
        company = self._score(tasks)
        mine = [t for t in tasks if ctx.user_id and ctx.user_id in {t.assignee_user_id, t.owner_user_id}]
        return {
            "company": company,
            "people": people,
            "me": self._score(mine),
            "overloaded": [p for p in people if p["reassignment"] == "overload"],
            "underutilized": [p for p in people if p["reassignment"] == "underutilized"],
            "campaign_health": self._campaign_health(ctx, cid, tasks),
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
    """Extends the existing agent pipeline — does not replace generation."""

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
