"""CRM scope validator."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.crm.repository.base import CRM_MODULE_KEY, CrmScopedRepository
from modules.foundation.domain.org_data_scope import (
    effective_company_ids,
    has_module_wide_data_access,
    is_platform_admin,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.models.branch import OrgBranch


class CrmScopeValidator(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def validate_company_access(self, ctx: TenantContext, company_id: UUID) -> None:
        self.ensure_company_access(ctx, company_id, module_key=CRM_MODULE_KEY)

    def validate_branch_access(self, ctx: TenantContext, branch_id: UUID) -> None:
        """CRM admins are tenant-wide; members may use any branch under their companies.

        Session branch must not block CRM work on another branch of an allowed
        company (common when creating leads from a company account).
        """
        if has_module_wide_data_access(ctx, CRM_MODULE_KEY) or is_platform_admin(ctx):
            return

        allowed = effective_company_ids(ctx, module_key=CRM_MODULE_KEY)
        if allowed is None:
            return
        if not allowed:
            raise ForbiddenException("Branch scope mismatch")

        branch = self.db.scalar(
            select(OrgBranch).where(
                OrgBranch.id == branch_id,
                OrgBranch.tenant_id == ctx.tenant_id,
                OrgBranch.is_deleted.is_(False),
            )
        )
        if branch is not None and branch.company_id in allowed:
            return

        # Fallback: same session branch still allowed even if org row is missing.
        if ctx.branch_id and ctx.branch_id == branch_id:
            return

        raise ForbiddenException("Branch scope mismatch")
