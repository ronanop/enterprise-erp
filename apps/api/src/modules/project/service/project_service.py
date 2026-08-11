"""ProjectService."""

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.project.adapters.master_data_port import ProjectMasterDataAdapter
from modules.project.domain.enums import PrjEntityType
from modules.project.models import PrjProject
from modules.project.repository.project_repository import ProjectRepository
from modules.project.service.document_number_service import DocumentNumberService
from modules.project.service.engines import ProjectEngine
from modules.project.service.project_assignment_scope import ProjectAssignmentScope
from modules.project.service.project_module_admin import ProjectModuleAdminService
from modules.project.service.project_scope_validator import ProjectScopeValidator


class ProjectService:
    def __init__(self, db: Session) -> None:
        self._repo = ProjectRepository(db)
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

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        self._module_admin.ensure_admin(ctx)

        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        # Site workflow payload (optional) — stripped before project insert
        site_fields = fields.pop("site_installation", None)
        self._apply_intake_create_defaults(ctx, cid, branch_id, fields, site_fields)
        doc = self._numbers.generate(PrjEntityType.PROJECT, cid, PrjProject, "project_code")
        project = self._repo.create(
            ctx, company_id=cid, branch_id=branch_id, project_code=doc, **fields
        )
        # Attach site installation workflow + seed WBS for every new project
        from modules.project.service.site_installation_service import SiteInstallationService

        site_kwargs = site_fields if isinstance(site_fields, dict) else {}
        SiteInstallationService(self._db).ensure_for_new_project(ctx, project, **site_kwargs)
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

    def close(self, ctx: TenantContext, row_id: UUID):
        self._module_admin.ensure_admin(ctx)
        row = self.get(ctx, row_id)
        self._engine.close(row)
        return self._repo.update(ctx, row_id, status=row.status)
