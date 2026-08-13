"""Restrict project visibility to assigned team members (non-platform admins)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.service.user_employee_link_service import UserEmployeeLinkService
from modules.project.models import PrjProject
from modules.project.models.site_installation import PrjSiteInstallation
from modules.project.service.project_module_admin import ProjectModuleAdminService


class ProjectAssignmentScope:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._user_employees = UserEmployeeLinkService(db)
        self._module_admin = ProjectModuleAdminService(db)

    def can_view_all_projects(self, ctx: TenantContext) -> bool:
        """Full portfolio visibility for Project Management module admin only."""
        return self._module_admin.is_admin(ctx)

    def filter_project_child_rows(
        self,
        ctx: TenantContext,
        company_id: UUID,
        rows: list,
        *,
        project_id_attr: str = "project_id",
    ) -> list:
        if self.can_view_all_projects(ctx) or not rows:
            return rows
        allowed = self.assigned_project_ids(ctx, company_id)
        filtered: list = []
        for row in rows:
            project_id = getattr(row, project_id_attr, None)
            if project_id is not None and project_id in allowed:
                filtered.append(row)
        return filtered

    def resolve_employee_id(self, ctx: TenantContext) -> UUID | None:
        if ctx.user_id is None:
            return None
        user = self._db.scalar(
            select(SecUser).where(
                SecUser.id == ctx.user_id,
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.is_deleted.is_(False),
            )
        )
        if user is None:
            return None
        employee = self._user_employees.find_employee_for_user(ctx, user)
        if employee is None:
            employee = self._user_employees.ensure_employee_for_user(ctx, user)
        return employee.id if employee else None

    def assigned_project_ids(self, ctx: TenantContext, company_id: UUID) -> set[UUID]:
        employee_id = self.resolve_employee_id(ctx)
        if employee_id is None:
            return set()

        ids: set[UUID] = set()
        pm_rows = self._db.scalars(
            select(PrjProject.id).where(
                PrjProject.tenant_id == ctx.tenant_id,
                PrjProject.company_id == company_id,
                PrjProject.is_deleted.is_(False),
                PrjProject.project_manager_employee_id == employee_id,
            )
        ).all()
        ids.update(pm_rows)

        site_rows = self._db.scalars(
            select(PrjSiteInstallation.project_id).where(
                PrjSiteInstallation.tenant_id == ctx.tenant_id,
                PrjSiteInstallation.company_id == company_id,
                PrjSiteInstallation.is_deleted.is_(False),
                or_(
                    PrjSiteInstallation.survey_assignee_employee_id == employee_id,
                    PrjSiteInstallation.scm_assignee_employee_id == employee_id,
                    PrjSiteInstallation.installation_assignee_employee_id == employee_id,
                    PrjSiteInstallation.configuration_assignee_employee_id == employee_id,
                    PrjSiteInstallation.acceptance_assignee_employee_id == employee_id,
                ),
            )
        ).all()
        ids.update(site_rows)
        return ids

    def filter_projects(
        self, ctx: TenantContext, rows: list[PrjProject]
    ) -> list[PrjProject]:
        if self.can_view_all_projects(ctx) or not rows:
            return rows
        by_company: dict[UUID, list[PrjProject]] = {}
        for row in rows:
            by_company.setdefault(row.company_id, []).append(row)
        filtered: list[PrjProject] = []
        for company_id, group in by_company.items():
            allowed = self.assigned_project_ids(ctx, company_id)
            filtered.extend(row for row in group if row.id in allowed)
        return filtered

    def filter_site_installations(
        self, ctx: TenantContext, rows: list[PrjSiteInstallation]
    ) -> list[PrjSiteInstallation]:
        if self.can_view_all_projects(ctx) or not rows:
            return rows
        by_company: dict[UUID, list[PrjSiteInstallation]] = {}
        for row in rows:
            by_company.setdefault(row.company_id, []).append(row)
        filtered: list[PrjSiteInstallation] = []
        for company_id, group in by_company.items():
            allowed = self.assigned_project_ids(ctx, company_id)
            filtered.extend(row for row in group if row.project_id in allowed)
        return filtered

    def ensure_project_access(
        self, ctx: TenantContext, project_id: UUID, company_id: UUID
    ) -> None:
        if self.can_view_all_projects(ctx):
            return
        if project_id not in self.assigned_project_ids(ctx, company_id):
            raise ForbiddenException("You do not have access to this project")
