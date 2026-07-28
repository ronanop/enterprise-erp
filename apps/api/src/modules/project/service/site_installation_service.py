"""SiteInstallationService — workflow + WBS seeding for site delivery projects."""

from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.project.domain.enums import (
    PrjEntityType,
    ProjectPhaseStatus,
    ProjectStatus,
    SiteDeliveryType,
    SiteInstallationStatus,
    SiteWorkflowStage,
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

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> PrjSiteInstallation:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Site installation not found")
        return row

    def get_by_project(self, ctx: TenantContext, project_id: UUID) -> PrjSiteInstallation:
        project = self._projects.get(ctx, project_id)
        if project is None:
            raise NotFoundException("Project not found")
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
        existing = self._repo.get_by_project(ctx, project_id)
        if existing is not None:
            return existing
        return self._create_for_project(ctx, project, **fields)

    def create_for_project(
        self, ctx: TenantContext, project_id: UUID, **fields
    ) -> PrjSiteInstallation:
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

        When Intake fields from create satisfy gates, auto-advance to Survey
        so the UI can open Step 2 immediately.
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

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> PrjSiteInstallation:
        row = self.get(ctx, row_id)
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
        if row.status == SiteInstallationStatus.CANCELLED.value:
            raise InvalidSiteInstallationState("Cancelled site installation cannot advance")

        engine.assert_advance_gates(row, action)
        new_stage = engine.transition(row.workflow_stage, action, row.delivery_type)

        updates: dict = {"workflow_stage": new_stage}
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
