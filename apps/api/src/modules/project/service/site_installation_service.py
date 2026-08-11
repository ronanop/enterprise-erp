"""SiteInstallationService — workflow + WBS seeding for site delivery projects."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, ForbiddenException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.project.domain.enums import (
    PrjEntityType,
    ProjectPhaseStatus,
    ProjectStatus,
    SiteDeliveryType,
    SiteInstallationStatus,
    SiteWorkflowStage,
    delivery_is_rack_only,
)
from modules.project.domain.exceptions import InvalidSiteInstallationState
from modules.project.models import PrjProject, PrjProjectTask
from modules.project.models.site_installation import PrjSiteInstallation
from modules.project.repository.project_milestone_repository import ProjectMilestoneRepository
from modules.project.repository.project_phase_repository import ProjectPhaseRepository
from modules.project.repository.project_repository import ProjectRepository
from modules.project.repository.project_task_repository import ProjectTaskRepository
from modules.project.repository.site_installation_repository import SiteInstallationRepository
from modules.project.service.document_number_service import DocumentNumberService
from modules.project.service.engines import site_installation_engine as engine
from modules.project.service.engines.site_installation_template import wbs_for_delivery_type
from modules.project.service.notification_service import NotificationService
from modules.project.repository.project_notification_repository import (
    ProjectNotificationRepository,
)
from modules.project.service.project_assignment_scope import ProjectAssignmentScope
from modules.project.service.project_module_admin import ProjectModuleAdminService
from modules.project.service.project_scope_validator import ProjectScopeValidator


class SiteInstallationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = SiteInstallationRepository(db)
        self._projects = ProjectRepository(db)
        self._phases = ProjectPhaseRepository(db)
        self._milestones = ProjectMilestoneRepository(db)
        self._tasks = ProjectTaskRepository(db)
        self._scope = ProjectScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._audit = AuditService(db)
        self._assignment = ProjectAssignmentScope(db)
        self._module_admin = ProjectModuleAdminService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._repo.list_rows(ctx, cid)
        return self._assignment.filter_site_installations(ctx, rows)

    def get(self, ctx: TenantContext, row_id: UUID) -> PrjSiteInstallation:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Site installation not found")
        self._assignment.ensure_project_access(ctx, row.project_id, row.company_id)
        return row

    def get_by_project(self, ctx: TenantContext, project_id: UUID) -> PrjSiteInstallation:
        project = self._projects.get(ctx, project_id)
        if project is None:
            raise NotFoundException("Project not found")
        self._assignment.ensure_project_access(ctx, project_id, project.company_id)
        row = self._repo.get_by_project(ctx, project_id)
        if row is None:
            raise NotFoundException("Site installation not found for project")
        return row

    def get_or_bootstrap(
        self, ctx: TenantContext, project_id: UUID, **fields
    ) -> PrjSiteInstallation:
        """Return existing workflow or create + seed WBS for the project."""
        project = self._projects.get(ctx, project_id)
        if project is None:
            raise NotFoundException("Project not found")
        self._assignment.ensure_project_access(ctx, project_id, project.company_id)
        existing = self._repo.get_by_project(ctx, project_id)
        if existing is not None:
            return existing
        self._module_admin.ensure_admin(ctx)
        return self._create_for_project(ctx, project, **fields)

    def create_for_project(
        self, ctx: TenantContext, project_id: UUID, **fields
    ) -> PrjSiteInstallation:
        self._module_admin.ensure_admin(ctx)
        project = self._projects.get(ctx, project_id)
        if project is None:
            raise NotFoundException("Project not found")
        if self._repo.get_by_project(ctx, project_id) is not None:
            raise ConflictException("Site installation already exists for this project")
        return self._create_for_project(ctx, project, **fields)

    def ensure_for_new_project(
        self, ctx: TenantContext, project: PrjProject, **fields
    ) -> PrjSiteInstallation:
        """Called from ProjectService.create to attach the site workflow.

        When Intake fields from create satisfy gates, auto-advance to Assignment
        so the UI can open Step 2 (assign stage owners) immediately.
        """
        row = self._create_for_project(ctx, project, **fields)
        try:
            engine.assert_advance_gates(row, "complete_intake")
            new_stage = engine.transition(
                row.workflow_stage, "complete_intake", row.delivery_type
            )
            updated = self._repo.update(ctx, row.id, workflow_stage=new_stage)
            if updated is not None:
                self._sync_phase_status(ctx, project.id, new_stage)
                return updated
        except InvalidSiteInstallationState:
            pass
        return row

    def _create_for_project(
        self, ctx: TenantContext, project: PrjProject, **fields
    ) -> PrjSiteInstallation:
        delivery = fields.pop("delivery_type", SiteDeliveryType.SERVER_OS_RACK.value)
        if delivery not in {e.value for e in SiteDeliveryType}:
            raise InvalidSiteInstallationState(f"Invalid delivery_type '{delivery}'")

        doc = self._numbers.generate(
            PrjEntityType.SITE_INSTALLATION,
            project.company_id,
            PrjSiteInstallation,
            "document_number",
        )
        row = self._repo.create(
            ctx,
            company_id=project.company_id,
            branch_id=project.branch_id,
            project_id=project.id,
            document_number=doc,
            delivery_type=delivery,
            workflow_stage=SiteWorkflowStage.INTAKE.value,
            status=SiteInstallationStatus.ACTIVE.value,
            # Survey is the first delivery step — starts on project creation day
            survey_assigned_date=date.today(),
            **fields,
        )
        self._seed_wbs(ctx, project, delivery)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="prj_site_installation",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def _seed_wbs(self, ctx: TenantContext, project: PrjProject, delivery_type: str) -> None:
        existing_phases = [
            p
            for p in self._phases.list_rows(ctx, project.company_id)
            if p.project_id == project.id and p.phase_code.startswith("PH-")
        ]
        if existing_phases:
            return

        start = project.planned_start_date
        end = project.planned_end_date
        span_days = max((end - start).days, 1)
        phases = wbs_for_delivery_type(delivery_type)
        n = len(phases) or 1

        for idx, spec in enumerate(phases):
            phase_start = start + timedelta(days=int(span_days * idx / n))
            phase_end = start + timedelta(days=int(span_days * (idx + 1) / n))
            if phase_end < phase_start:
                phase_end = phase_start
            if phase_end > end:
                phase_end = end

            phase = self._phases.create(
                ctx,
                company_id=project.company_id,
                branch_id=project.branch_id,
                project_id=project.id,
                phase_code=spec.code,
                phase_name=spec.name,
                sequence_no=spec.sequence_no,
                planned_start_date=phase_start,
                planned_end_date=phase_end,
                status=(
                    ProjectPhaseStatus.ACTIVE.value
                    if idx == 0
                    else ProjectPhaseStatus.PLANNED.value
                ),
            )
            milestone = self._milestones.create(
                ctx,
                company_id=project.company_id,
                branch_id=project.branch_id,
                project_id=project.id,
                phase_id=phase.id,
                milestone_code=spec.milestone.code,
                milestone_name=spec.milestone.name,
                due_date=phase_end,
                status="planned",
            )
            for task_spec in spec.milestone.tasks:
                doc = self._numbers.generate(
                    PrjEntityType.PROJECT_TASK,
                    project.company_id,
                    PrjProjectTask,
                    "document_number",
                )
                self._tasks.create(
                    ctx,
                    company_id=project.company_id,
                    branch_id=project.branch_id,
                    project_id=project.id,
                    phase_id=phase.id,
                    milestone_id=milestone.id,
                    document_number=doc,
                    task_name=task_spec.task_name,
                    priority=task_spec.priority,
                    planned_start_date=phase_start,
                    due_date=phase_end,
                    status="open",
                )

    def _ensure_current_stage_editor(
        self, ctx: TenantContext, site: PrjSiteInstallation, project: PrjProject
    ) -> None:
        employee_id = self._assignment.resolve_employee_id(ctx)
        if employee_id is None:
            raise ForbiddenException("Employee profile required to edit site workflow")

        stage = site.workflow_stage
        if stage in {
            SiteWorkflowStage.INTAKE.value,
            SiteWorkflowStage.ASSIGNMENT.value,
        }:
            self._module_admin.ensure_admin(ctx)
            return

        lookup_stage = stage
        if lookup_stage == SiteWorkflowStage.CONFIGURATION.value:
            lookup_stage = SiteWorkflowStage.INSTALLATION.value

        field = engine.STAGE_ASSIGNEE_FIELDS.get(lookup_stage)
        if not field:
            raise ForbiddenException("This workflow stage cannot be edited")

        assignee_id = getattr(site, field, None)
        if assignee_id != employee_id:
            raise ForbiddenException("Only the assigned stage owner can update this workflow step")

    def _ensure_can_run_advance_action(
        self, ctx: TenantContext, site: PrjSiteInstallation, project: PrjProject, action: str
    ) -> None:
        employee_id = self._assignment.resolve_employee_id(ctx)
        if employee_id is None:
            raise ForbiddenException("Employee profile required to advance site workflow")

        if action in {"complete_intake", "complete_assignment"}:
            self._module_admin.ensure_admin(ctx)
            return

        action_stage: dict[str, str] = {
            "complete_survey": SiteWorkflowStage.SURVEY.value,
            "complete_scm": SiteWorkflowStage.SCM.value,
            "complete_installation": SiteWorkflowStage.INSTALLATION.value,
            "complete_installation_rack_only": SiteWorkflowStage.INSTALLATION.value,
            "complete_acceptance": SiteWorkflowStage.ACCEPTANCE.value,
        }
        required_stage = action_stage.get(action)
        if required_stage is None:
            return

        lookup_stage = required_stage
        field = engine.STAGE_ASSIGNEE_FIELDS.get(lookup_stage)
        if not field:
            raise ForbiddenException("Invalid workflow action")
        assignee_id = getattr(site, field, None)
        if assignee_id != employee_id:
            raise ForbiddenException("Only the assigned stage owner can complete this step")

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> PrjSiteInstallation:
        row = self.get(ctx, row_id)
        project = self._projects.get(ctx, row.project_id)
        if project is None:
            raise NotFoundException("Project not found")
        self._ensure_current_stage_editor(ctx, row, project)
        if row.status == SiteInstallationStatus.COMPLETED.value:
            raise InvalidSiteInstallationState("Completed site installation cannot be edited")
        if "workflow_stage" in fields or "status" in fields:
            raise InvalidSiteInstallationState("Use advance actions to change workflow stage")
        if "delivery_type" in fields and fields["delivery_type"] != row.delivery_type:
            if row.workflow_stage != SiteWorkflowStage.INTAKE.value:
                raise InvalidSiteInstallationState(
                    "Delivery type can only change during Intake"
                )
        self._apply_material_line_side_effects(fields)
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Site installation not found")
        return updated

    @staticmethod
    def _normalize_lines(raw: object) -> list[dict]:
        if not isinstance(raw, list):
            return []
        out: list[dict] = []
        for item in raw:
            if hasattr(item, "model_dump"):
                item = item.model_dump()
            if not isinstance(item, dict):
                continue
            typ = str(item.get("type") or "").strip()
            try:
                qty = int(item.get("quantity"))
            except (TypeError, ValueError):
                continue
            if typ and qty > 0:
                line_date = item.get("date")
                if hasattr(line_date, "isoformat"):
                    line_date = line_date.isoformat()
                elif line_date is not None:
                    line_date = str(line_date).strip() or None
                out.append({"type": typ, "quantity": qty, "date": line_date})
        return out

    def _apply_material_line_side_effects(self, fields: dict) -> None:
        if "cable_lines" in fields:
            lines = self._normalize_lines(fields["cable_lines"])
            fields["cable_lines"] = lines
            fields["cable_length"] = (
                "; ".join(f"{line['type']} × {line['quantity']}" for line in lines)
                if lines
                else None
            )
        if "lug_lines" in fields:
            lines = self._normalize_lines(fields["lug_lines"])
            fields["lug_lines"] = lines
            fields["lugs"] = bool(lines)
        if "industrial_socket_lines" in fields:
            lines = self._normalize_lines(fields["industrial_socket_lines"])
            fields["industrial_socket_lines"] = lines
            fields["industrial_socket"] = bool(lines)

    def update_by_project(
        self, ctx: TenantContext, project_id: UUID, **fields
    ) -> PrjSiteInstallation:
        row = self.get_by_project(ctx, project_id)
        return self.update(ctx, row.id, **fields)

    def blueprint(self, ctx: TenantContext, project_id: UUID) -> dict:
        row = self.get_or_bootstrap(ctx, project_id)
        return engine.blueprint_state(row)

    def advance(
        self, ctx: TenantContext, project_id: UUID, action: str
    ) -> PrjSiteInstallation:
        row = self.get_by_project(ctx, project_id)
        project = self._projects.get(ctx, project_id)
        if project is None:
            raise NotFoundException("Project not found")
        self._ensure_can_run_advance_action(ctx, row, project, action)
        if row.status == SiteInstallationStatus.CANCELLED.value:
            raise InvalidSiteInstallationState("Cancelled site installation cannot advance")

        engine.assert_advance_gates(row, action)
        new_stage = engine.transition(row.workflow_stage, action, row.delivery_type)

        updates: dict = {
            "workflow_stage": new_stage,
            **engine.stage_date_updates_for_action(action, date.today()),
        }
        # Keep survey start = creation day if somehow missing when entering survey work
        if (
            new_stage == SiteWorkflowStage.SURVEY.value
            and getattr(row, "survey_assigned_date", None) is None
        ):
            updates["survey_assigned_date"] = date.today()
        if new_stage == SiteWorkflowStage.COMPLETED.value:
            updates["status"] = SiteInstallationStatus.COMPLETED.value
            project = self._projects.get(ctx, project_id)
            if project is not None and project.status not in {
                ProjectStatus.COMPLETED.value,
                ProjectStatus.CLOSED.value,
                ProjectStatus.CANCELLED.value,
            }:
                self._projects.update(
                    ctx,
                    project_id,
                    status=ProjectStatus.COMPLETED.value,
                )

        # Activate matching phase when entering a stage
        self._sync_phase_status(ctx, project_id, new_stage)

        updated = self._repo.update(ctx, row.id, **updates)
        if updated is None:
            raise NotFoundException("Site installation not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="prj_site_installation",
            entity_id=row.id,
            operation=f"advance:{action}",
            performed_by=ctx.user_id,
        )
        return updated

    def follow_up_stage(
        self,
        ctx: TenantContext,
        project_id: UUID,
        stage: str,
        note: str | None = None,
    ) -> dict:
        """Create a project notification for the assignee of a delivery stage."""
        self._module_admin.ensure_admin(ctx)
        row = self.get_by_project(ctx, project_id)
        stage_key = stage.strip().lower()
        if stage_key == "configuration":
            stage_key = SiteWorkflowStage.INSTALLATION.value
        field = engine.STAGE_ASSIGNEE_FIELDS.get(stage_key)
        if not field:
            raise InvalidSiteInstallationState(
                f"Follow-up is not available for stage '{stage}'"
            )
        recipient_id = getattr(row, field, None)
        if recipient_id is None:
            raise InvalidSiteInstallationState(
                f"No assignee set for {engine.STAGE_LABELS.get(stage_key, stage_key)}"
            )

        stage_label = engine.STAGE_LABELS.get(stage_key, stage_key)
        if stage_key == SiteWorkflowStage.INSTALLATION.value and delivery_is_rack_only(
            row.delivery_type
        ):
            stage_label = "Installation"

        site_name = row.site_name or row.document_number
        note_text = note.strip() if note and note.strip() else None
        message = f"Follow-up requested for {stage_label} on site {site_name}."
        notification = NotificationService(self._db).create(
            ctx,
            company_id=row.company_id,
            branch_id=row.branch_id,
            project_id=project_id,
            notification_type="other",
            recipient_employee_id=recipient_id,
            payload_json={
                "kind": "site_stage_follow_up",
                "stage": stage_key,
                "stage_label": stage_label,
                "site_installation_id": str(row.id),
                "document_number": row.document_number,
                "site_name": row.site_name,
                "message": message,
                "note": note_text,
                "sender_user_id": str(ctx.user_id) if ctx.user_id else None,
            },
            delivery_status="sent",
            sent_at=datetime.now(timezone.utc),
            status="active",
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="prj_site_installation",
            entity_id=row.id,
            operation=f"follow_up:{stage_key}",
            performed_by=ctx.user_id,
        )
        return {
            "stage": stage_key,
            "stage_label": stage_label,
            "recipient_employee_id": recipient_id,
            "notification_id": notification.id,
            "message": message,
        }

    def list_follow_ups(self, ctx: TenantContext, project_id: UUID) -> list[dict]:
        """Return site-stage follow-up notifications for a project (newest first)."""
        self.get_by_project(ctx, project_id)
        rows = ProjectNotificationRepository(self._db).list_site_follow_ups(ctx, project_id)
        return [self._follow_up_item_dict(row) for row in rows]

    def list_portfolio_follow_ups(self, ctx: TenantContext) -> list[dict]:
        """Module admin: follow-ups sent. Members: follow-ups received for their employee."""
        cid = self._scope.resolve_company_id(ctx, None)
        repo = ProjectNotificationRepository(self._db)
        if self._module_admin.is_admin(ctx):
            if ctx.user_id is None:
                return []
            rows = repo.list_site_stage_follow_up_rows(
                ctx, cid, created_by_user_id=ctx.user_id
            )
        else:
            employee_id = self._assignment.resolve_employee_id(ctx)
            if employee_id is None:
                return []
            rows = repo.list_site_stage_follow_up_rows(
                ctx, cid, recipient_employee_id=employee_id
            )
            allowed = self._assignment.assigned_project_ids(ctx, cid)
            rows = [r for r in rows if r.project_id in allowed]

        out: list[dict] = []
        for row in rows:
            project = self._projects.get(ctx, row.project_id)
            if project is None:
                continue
            item = self._follow_up_item_dict(row)
            item["project_id"] = row.project_id
            item["project_name"] = project.project_name
            out.append(item)
        return out

    def reply_to_follow_up(self, ctx: TenantContext, notification_id: UUID, body: str) -> dict:
        """Stage assignee replies to an admin follow-up notification."""
        from uuid import uuid4

        repo = ProjectNotificationRepository(self._db)
        row = repo.get(ctx, notification_id)
        if row is None:
            raise NotFoundException("Follow-up not found")
        payload = row.payload_json if isinstance(row.payload_json, dict) else {}
        if payload.get("kind") != "site_stage_follow_up":
            raise NotFoundException("Follow-up not found")

        employee_id = self._assignment.resolve_employee_id(ctx)
        if employee_id is None:
            raise ForbiddenException("Employee profile required to reply")
        recipient_id = row.recipient_employee_id
        if recipient_id is None or UUID(str(recipient_id)) != UUID(str(employee_id)):
            raise ForbiddenException("Only the assigned stage owner can reply")

        text = body.strip()
        if not text:
            raise InvalidSiteInstallationState("Reply cannot be empty")

        now = datetime.now(timezone.utc)
        replies = list(payload.get("replies") or [])
        replies.append(
            {
                "id": str(uuid4()),
                "body": text,
                "created_at": now.isoformat(),
                "employee_id": str(employee_id),
            }
        )
        payload["replies"] = replies
        updated = repo.update(
            ctx,
            notification_id,
            payload_json=payload,
            delivery_status="read",
        )
        if updated is None:
            raise NotFoundException("Follow-up not found")

        project = self._projects.get(ctx, row.project_id)
        item = self._follow_up_item_dict(updated)
        item["project_id"] = row.project_id
        item["project_name"] = project.project_name if project else ""
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="prj_project_notification",
            entity_id=row.id,
            operation="follow_up_reply",
            performed_by=ctx.user_id,
        )
        return item

    @staticmethod
    def _follow_up_replies(payload: dict) -> list[dict]:
        out: list[dict] = []
        for raw in payload.get("replies") or []:
            if not isinstance(raw, dict):
                continue
            body = str(raw.get("body") or "").strip()
            if not body:
                continue
            try:
                reply_id = UUID(str(raw.get("id")))
                employee_id = UUID(str(raw.get("employee_id")))
            except (TypeError, ValueError):
                continue
            created_raw = raw.get("created_at")
            if isinstance(created_raw, datetime):
                created_at = created_raw
            elif created_raw:
                try:
                    created_at = datetime.fromisoformat(str(created_raw).replace("Z", "+00:00"))
                except ValueError:
                    created_at = datetime.now(timezone.utc)
            else:
                created_at = datetime.now(timezone.utc)
            out.append(
                {
                    "id": reply_id,
                    "body": body,
                    "created_at": created_at,
                    "employee_id": employee_id,
                }
            )
        return out

    @classmethod
    def _follow_up_item_dict(cls, row) -> dict:
        payload = row.payload_json if isinstance(row.payload_json, dict) else {}
        replies = cls._follow_up_replies(payload)
        latest = replies[-1] if replies else None
        return {
            "id": row.id,
            "stage": str(payload.get("stage") or ""),
            "stage_label": str(payload.get("stage_label") or payload.get("stage") or ""),
            "recipient_employee_id": row.recipient_employee_id,
            "message": str(payload.get("message") or ""),
            "note": payload.get("note"),
            "site_name": payload.get("site_name"),
            "document_number": payload.get("document_number"),
            "delivery_status": row.delivery_status,
            "status": row.status,
            "created_at": row.created_at,
            "sent_at": row.sent_at,
            "replies": replies,
            "has_reply": bool(replies),
            "latest_reply": latest["body"] if latest else None,
            "latest_reply_at": latest["created_at"] if latest else None,
        }

    def list_my_jobs(self, ctx: TenantContext, *, completed: bool = False) -> list[dict]:
        """Delivery steps assigned to the signed-in employee — active or completed."""
        if ctx.user_id is None:
            return []

        from sqlalchemy import select

        from modules.foundation.models.security import SecUser
        from modules.foundation.service.user_employee_link_service import UserEmployeeLinkService

        user = self._db.scalar(
            select(SecUser).where(
                SecUser.id == ctx.user_id,
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.is_deleted.is_(False),
            )
        )
        if user is None:
            return []

        linker = UserEmployeeLinkService(self._db)
        employee = linker.find_employee_for_user(ctx, user)
        if employee is None:
            employee = linker.ensure_employee_for_user(ctx, user)
        if employee is None:
            return []

        employee_id = employee.id
        cid = self._scope.resolve_company_id(ctx, None)
        sites = self.list(ctx, cid)
        jobs: list[dict] = []

        stage_form_segments = {
            SiteWorkflowStage.ASSIGNMENT.value: "assign",
            SiteWorkflowStage.SURVEY.value: "survey",
            SiteWorkflowStage.SCM.value: "scm",
            SiteWorkflowStage.INSTALLATION.value: "installation",
            SiteWorkflowStage.ACCEPTANCE.value: "acceptance",
        }

        stage_rank = {s: i for i, s in enumerate(engine.STAGE_ORDER)}

        for site in sites:
            if site.workflow_stage == SiteWorkflowStage.COMPLETED.value:
                continue
            if site.status == SiteInstallationStatus.COMPLETED.value:
                continue

            project = self._projects.get(ctx, site.project_id)
            if project is None:
                continue

            current_stage = site.workflow_stage

            if self._module_admin.is_admin(ctx) and current_stage in {
                SiteWorkflowStage.INTAKE.value,
                SiteWorkflowStage.ASSIGNMENT.value,
            }:
                assigned_stage = SiteWorkflowStage.ASSIGNMENT.value
                row = self._my_job_row(
                    site,
                    project,
                    assigned_stage,
                    current_stage,
                    stage_form_segments,
                )
                if self._my_job_matches_completed_filter(row["work_status"], completed):
                    jobs.append(row)

            for assigned_stage, field in engine.STAGE_ASSIGNEE_FIELDS.items():
                if getattr(site, field, None) != employee_id:
                    continue
                row = self._my_job_row(
                    site,
                    project,
                    assigned_stage,
                    current_stage,
                    stage_form_segments,
                )
                if self._my_job_matches_completed_filter(row["work_status"], completed):
                    jobs.append(row)

        jobs.sort(
            key=lambda row: (
                row["document_number"],
                stage_rank.get(row["assigned_stage"], 99),
            )
        )
        return jobs

    @staticmethod
    def _my_job_matches_completed_filter(work_status: str, completed: bool) -> bool:
        if completed:
            return work_status == "done"
        return work_status != "done"

    @staticmethod
    def _my_job_row(
        site: PrjSiteInstallation,
        project: PrjProject,
        assigned_stage: str,
        current_stage: str,
        stage_form_segments: dict[str, str],
    ) -> dict:
        segment = stage_form_segments.get(assigned_stage, "")
        form_path = (
            f"/projects/projects/{site.project_id}/{segment}"
            if segment
            else f"/projects/projects/{site.project_id}"
        )
        work_status = engine.stage_work_status(
            assigned_stage, current_stage, site.delivery_type
        )
        return {
            "site_installation_id": site.id,
            "project_id": site.project_id,
            "project_name": project.project_name,
            "document_number": site.document_number,
            "site_name": site.site_name,
            "assigned_stage": assigned_stage,
            "workflow_stage": current_stage,
            "stage_label": engine.STAGE_LABELS.get(assigned_stage, assigned_stage),
            "delivery_type": site.delivery_type,
            "form_path": form_path,
            "work_status": work_status,
        }

    def _sync_phase_status(
        self, ctx: TenantContext, project_id: UUID, new_stage: str
    ) -> None:
        from modules.project.service.engines.site_installation_template import (
            SITE_INSTALLATION_WBS,
        )

        code_by_stage = {p.stage: p.code for p in SITE_INSTALLATION_WBS}
        target_code = code_by_stage.get(new_stage)
        project = self._projects.get(ctx, project_id)
        if project is None:
            return
        phases = [
            p
            for p in self._phases.list_rows(ctx, project.company_id)
            if p.project_id == project_id
        ]
        for phase in phases:
            if phase.phase_code == target_code:
                self._phases.update(
                    ctx, phase.id, status=ProjectPhaseStatus.ACTIVE.value
                )
            elif (
                phase.status == ProjectPhaseStatus.ACTIVE.value
                and phase.phase_code != target_code
                and new_stage != SiteWorkflowStage.COMPLETED.value
            ):
                self._phases.update(
                    ctx, phase.id, status=ProjectPhaseStatus.COMPLETED.value
                )
            elif new_stage == SiteWorkflowStage.COMPLETED.value:
                if phase.status != ProjectPhaseStatus.CANCELLED.value:
                    self._phases.update(
                        ctx, phase.id, status=ProjectPhaseStatus.COMPLETED.value
                    )
                # mark milestones achieved
                milestones = [
                    m
                    for m in self._milestones.list_rows(ctx, project.company_id)
                    if m.project_id == project_id and m.phase_id == phase.id
                ]
                for ms in milestones:
                    if ms.status == "planned":
                        self._milestones.update(ctx, ms.id, status="achieved")
