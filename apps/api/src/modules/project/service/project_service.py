"""ProjectService."""

from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.master_data.models.employee import MasterEmployee
from modules.master_data.models.party import MasterCustomer
from modules.project.adapters.master_data_port import ProjectMasterDataAdapter
from modules.project.domain.enums import PrjEntityType, SiteInstallationStatus, SiteWorkflowStage
from modules.project.models import PrjProject
from modules.project.models.site_installation import PrjSiteInstallation
from modules.project.repository.project_repository import ProjectRepository
from modules.project.repository.site_installation_repository import SiteInstallationRepository
from modules.project.schemas import ProjectResponse
from modules.project.service.document_number_service import DocumentNumberService
from modules.project.service.engines import ProjectEngine
from modules.project.service.engines import site_installation_engine as site_engine
from modules.project.service.project_assignment_scope import ProjectAssignmentScope
from modules.project.service.project_module_admin import ProjectModuleAdminService
from modules.project.service.project_scope_validator import ProjectScopeValidator


class ProjectService:
    def __init__(self, db: Session) -> None:
        self._repo = ProjectRepository(db)
        self._sites = SiteInstallationRepository(db)
        self._scope = ProjectScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = ProjectEngine()
        self._audit = AuditService(db)
        self._master = ProjectMasterDataAdapter(db)
        self._db = db
        self._assignment = ProjectAssignmentScope(db)
        self._module_admin = ProjectModuleAdminService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._repo.list_rows(ctx, cid)
        return self._assignment.filter_projects(ctx, rows)

    def get(self, ctx: TenantContext, row_id: UUID) -> PrjProject:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("ProjectService not found")
        self._assignment.ensure_project_access(ctx, row.id, row.company_id)
        return row

    def to_response(self, ctx: TenantContext, row: PrjProject) -> ProjectResponse:
        return self.to_responses(ctx, [row])[0]

    def to_responses(self, ctx: TenantContext, rows: list[PrjProject]) -> list[ProjectResponse]:
        names = self._customer_names_by_id(
            ctx,
            {row.customer_id for row in rows if row.customer_id is not None},
        )
        po_names = self._customer_names_by_proc_order(
            ctx,
            {
                row.proc_order_id
                for row in rows
                if row.proc_order_id is not None
                and (row.customer_id is None or row.customer_id not in names)
            },
        )
        sites_by_project = {
            site.project_id: site
            for site in self._sites.list_by_project_ids(ctx, [row.id for row in rows])
        }
        owner_ids: set[UUID] = set()
        for row in rows:
            site = sites_by_project.get(row.id)
            owner_id = self._current_stage_owner_id(row, site)
            if owner_id is not None:
                owner_ids.add(owner_id)
        owner_names = self._employee_names_by_id(ctx, owner_ids)

        out: list[ProjectResponse] = []
        for row in rows:
            payload = ProjectResponse.model_validate(row)
            name = None
            if row.customer_id is not None:
                name = names.get(row.customer_id)
            if not name and row.proc_order_id is not None:
                name = po_names.get(row.proc_order_id)
            site = sites_by_project.get(row.id)
            stage, stage_label, owner_id = self._current_stage_info(row, site)
            owner_name = owner_names.get(owner_id) if owner_id else None
            out.append(
                payload.model_copy(
                    update={
                        "customer_name": name,
                        "current_stage": stage,
                        "current_stage_label": stage_label,
                        "current_stage_owner_name": owner_name,
                    }
                )
            )
        return out

    def _current_stage_info(
        self,
        project: PrjProject,
        site: PrjSiteInstallation | None,
    ) -> tuple[str | None, str | None, UUID | None]:
        if project.status in {
            "completed",
            "closed",
            "cancelled",
        }:
            label = "Completed" if project.status == "completed" else project.status.title()
            return project.status, label, None
        if site is None:
            return None, None, None
        stage = (site.workflow_stage or "").strip().lower() or None
        if not stage:
            return None, None, None
        if stage == "configuration":
            stage = SiteWorkflowStage.INSTALLATION.value
        if stage == "assignment":
            stage = SiteWorkflowStage.SURVEY.value
        if stage == "onsite":
            stage = SiteWorkflowStage.ONSITE_DELIVERY.value
        label = site_engine.STAGE_LABELS.get(stage, stage.replace("_", " ").title())
        if stage == SiteWorkflowStage.INSTALLATION.value:
            delivery = getattr(site, "delivery_type", None) or ""
            if delivery == "rack_only":
                label = "Installation"
        owner_id = self._current_stage_owner_id(project, site, stage=stage)
        return stage, label, owner_id

    def _current_stage_owner_id(
        self,
        project: PrjProject,
        site: PrjSiteInstallation | None,
        *,
        stage: str | None = None,
    ) -> UUID | None:
        if site is None:
            return None
        stage_key = stage or (site.workflow_stage or "").strip().lower()
        if stage_key == "configuration":
            stage_key = SiteWorkflowStage.INSTALLATION.value
        if stage_key == "assignment":
            stage_key = SiteWorkflowStage.SURVEY.value
        if stage_key == "onsite":
            stage_key = SiteWorkflowStage.ONSITE_DELIVERY.value
        if stage_key in {SiteWorkflowStage.INTAKE.value, SiteWorkflowStage.COMPLETED.value}:
            return project.project_manager_employee_id if stage_key == SiteWorkflowStage.INTAKE.value else None
        field = site_engine.STAGE_ASSIGNEE_FIELDS.get(stage_key)
        if not field:
            return project.project_manager_employee_id
        return getattr(site, field, None) or None

    def _employee_names_by_id(
        self,
        ctx: TenantContext,
        employee_ids: set[UUID],
    ) -> dict[UUID, str]:
        if not employee_ids:
            return {}
        stmt = select(
            MasterEmployee.id,
            MasterEmployee.first_name,
            MasterEmployee.last_name,
        ).where(
            MasterEmployee.tenant_id == ctx.tenant_id,
            MasterEmployee.is_deleted.is_(False),
            MasterEmployee.id.in_(employee_ids),
        )
        out: dict[UUID, str] = {}
        for emp_id, first, last in self._db.execute(stmt).all():
            label = f"{first or ''} {last or ''}".strip()
            if label:
                out[emp_id] = label
        return out

    def _customer_names_by_id(
        self,
        ctx: TenantContext,
        customer_ids: set[UUID],
    ) -> dict[UUID, str]:
        if not customer_ids:
            return {}
        stmt = select(MasterCustomer.id, MasterCustomer.customer_name).where(
            MasterCustomer.tenant_id == ctx.tenant_id,
            MasterCustomer.is_deleted.is_(False),
            MasterCustomer.id.in_(customer_ids),
        )
        return {
            customer_id: (name or "").strip()
            for customer_id, name in self._db.execute(stmt).all()
            if (name or "").strip()
        }

    def _customer_names_by_proc_order(
        self,
        ctx: TenantContext,
        order_ids: set[UUID],
    ) -> dict[UUID, str]:
        """Fallback customer labels from linked SCM POs when master customer_id is missing."""
        if not order_ids:
            return {}
        from modules.project.adapters.procurement_port import ProjectProcurementAdapter

        procurement = ProjectProcurementAdapter(self._db)
        resolved: dict[UUID, str] = {}
        for order_id in order_ids:
            try:
                order = procurement.get_order_response(
                    ctx, order_id, enrich_commercial=True
                )
            except Exception:
                continue
            name = (getattr(order, "customer_name", None) or "").strip()
            if name:
                resolved[order_id] = name
        return resolved

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        self._module_admin.ensure_admin(ctx)

        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        # Site workflow payload (optional) — stripped before project insert
        site_fields = fields.pop("site_installation", None)
        proc_order_id = fields.get("proc_order_id")
        if proc_order_id is not None:
            from modules.project.service.project_po_queue_service import ProjectPoQueueService

            po_queue = ProjectPoQueueService(self._db)
            po_queue.ensure_linkable(ctx, proc_order_id)
            prefill = po_queue.get_prefill(ctx, proc_order_id)
            if not fields.get("budget_amount") and prefill.budget_amount is not None:
                fields["budget_amount"] = prefill.budget_amount
            if not fields.get("customer_id") and prefill.customer_id:
                fields["customer_id"] = prefill.customer_id
            if not fields.get("customer_id") and prefill.customer_name:
                matched = po_queue._match_customer_id(
                    ctx, prefill.company_id, prefill.customer_name
                )
                if matched is not None:
                    fields["customer_id"] = matched
            if not fields.get("crm_opportunity_id") and prefill.crm_opportunity_id:
                fields["crm_opportunity_id"] = prefill.crm_opportunity_id
            if not fields.get("description") and prefill.description:
                fields["description"] = prefill.description
            if not fields.get("currency_code"):
                fields["currency_code"] = prefill.currency_code
            site = site_fields if isinstance(site_fields, dict) else {}
            if not (site.get("site_name") or "").strip() and prefill.site_name:
                site["site_name"] = prefill.site_name
            if not (site.get("circle") or "").strip():
                # Prefer lead entity state (telecom circle); fall back to entity name.
                site["circle"] = (prefill.entity_state or prefill.circle_name or "").strip() or None
            site_fields = site
        self._apply_intake_create_defaults(ctx, cid, branch_id, fields, site_fields)
        doc = self._numbers.generate(PrjEntityType.PROJECT, cid, PrjProject, "project_code")
        project = self._repo.create(
            ctx, company_id=cid, branch_id=branch_id, project_code=doc, **fields
        )
        # Attach site installation workflow + seed WBS for every new project
        from modules.project.service.site_installation_service import SiteInstallationService

        site_kwargs = site_fields if isinstance(site_fields, dict) else {}
        SiteInstallationService(self._db).ensure_for_new_project(ctx, project, **site_kwargs)
        if proc_order_id is not None:
            ProjectPoQueueService(self._db).complete_handoff(ctx, proc_order_id)
        return project

    def _apply_intake_create_defaults(
        self,
        ctx: TenantContext,
        company_id: UUID,
        branch_id: UUID,
        fields: dict,
        site_fields: dict | None,
    ) -> None:
        """Fill ORM-required project columns when create is Intake-only."""
        site = site_fields if isinstance(site_fields, dict) else {}
        site_name = (site.get("site_name") or "").strip() or None
        customer_id = fields.get("customer_id")

        if not (fields.get("project_name") or "").strip():
            customer_label = None
            if customer_id:
                try:
                    customer = self._master.get_customer(ctx, customer_id)
                    customer_label = getattr(customer, "customer_name", None)
                except NotFoundException:
                    customer_label = None
            if customer_label and site_name:
                fields["project_name"] = f"{customer_label} — {site_name}"
            elif site_name:
                fields["project_name"] = site_name
            elif customer_label:
                fields["project_name"] = f"{customer_label} — Site Request"
            else:
                fields["project_name"] = "Site Installation Request"

        if not fields.get("project_type"):
            fields["project_type"] = "implementation"
        if not fields.get("currency_code"):
            fields["currency_code"] = "INR"
        if not fields.get("status"):
            fields["status"] = "draft"

        today = date.today()
        if not fields.get("planned_start_date"):
            fields["planned_start_date"] = today
        if not fields.get("planned_end_date"):
            fields["planned_end_date"] = today + timedelta(days=90)

        if not fields.get("project_manager_employee_id"):
            fields["project_manager_employee_id"] = self._resolve_default_pm(
                ctx, company_id, branch_id
            )

    def _resolve_default_pm(
        self, ctx: TenantContext, company_id: UUID, branch_id: UUID
    ) -> UUID:
        employees = self._master.list_employees(ctx, company_id=company_id, branch_id=branch_id)
        if not employees:
            employees = self._master.list_employees(ctx, company_id=company_id)
        if not employees:
            raise AppException(
                "No employee found to assign as Project Manager. "
                "Create an employee in Master Data first."
            )
        return employees[0].id

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self._module_admin.ensure_admin(ctx)
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("ProjectService not found")
        return row

    def submit(self, ctx: TenantContext, row_id: UUID):
        self._module_admin.ensure_admin(ctx)
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def approve(self, ctx: TenantContext, row_id: UUID):
        self._module_admin.ensure_admin(ctx)
        row = self.get(ctx, row_id)
        self._engine.approve(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def complete(self, ctx: TenantContext, row_id: UUID):
        """Mark project (and linked site workflow) completed."""
        self._module_admin.ensure_admin(ctx)
        row = self.get(ctx, row_id)
        self._engine.mark_completed(row)
        updates: dict = {"status": row.status}
        today = date.today()
        if not row.actual_start_date:
            updates["actual_start_date"] = today
        if not row.actual_end_date:
            updates["actual_end_date"] = today
        project = self._repo.update(ctx, row_id, **updates)
        if project is None:
            raise NotFoundException("ProjectService not found")

        site_repo = SiteInstallationRepository(self._db)
        site = site_repo.get_by_project(ctx, row_id)
        if site is not None and site.status != SiteInstallationStatus.COMPLETED.value:
            site_repo.update(
                ctx,
                site.id,
                workflow_stage=SiteWorkflowStage.COMPLETED.value,
                status=SiteInstallationStatus.COMPLETED.value,
            )
        return project

    def close(self, ctx: TenantContext, row_id: UUID):
        self._module_admin.ensure_admin(ctx)
        row = self.get(ctx, row_id)
        self._engine.close(row)
        return self._repo.update(ctx, row_id, status=row.status)
