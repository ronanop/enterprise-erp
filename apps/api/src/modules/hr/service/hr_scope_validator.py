"""HR scope validator."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException, ValidationException
from modules.foundation.domain.org_data_scope import effective_company_ids
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.repository.base import HR_MODULE_KEY, HrScopedRepository
from modules.organization.models.branch import OrgBranch
from modules.organization.models.company import OrgCompany


class HrScopeValidator(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def validate_company_access(self, ctx: TenantContext, company_id: UUID) -> None:
        self.ensure_company_access(ctx, company_id, module_key=HR_MODULE_KEY)

    def validate_branch_access(self, ctx: TenantContext, branch_id: UUID) -> None:
        self.ensure_branch_access(ctx, branch_id, module_key=HR_MODULE_KEY)

    def resolve_write_company_id(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        *,
        branch_id: UUID | None = None,
    ) -> UUID:
        """Always return a concrete company_id for create/update writes."""
        if company_id is not None:
            self.validate_company_access(ctx, company_id)
            return company_id
        if branch_id is not None:
            return self.resolve_create_company_id(ctx, branch_id=branch_id, company_id=None)
        if ctx.company_id is not None:
            return ctx.company_id
        allowed = effective_company_ids(ctx, module_key=HR_MODULE_KEY)
        if allowed and len(allowed) >= 1:
            return allowed[0]
        # Platform / module-wide admin with no session company: use first live company.
        row = self.db.scalar(
            select(OrgCompany).where(
                OrgCompany.tenant_id == ctx.tenant_id,
                OrgCompany.is_deleted.is_(False),
            ).limit(1)
        )
        if row is not None:
            return row.id
        raise ValidationException(
            "Company is required. Select a company (or a branch that belongs to one) and try again."
        )

    def resolve_create_company_id(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        company_id: UUID | None = None,
    ) -> UUID:
        """Creates need a concrete company_id. Prefer explicit, else branch.company_id."""
        cid = self.resolve_company_id(ctx, company_id)
        if cid is not None:
            return cid
        branch = self.db.get(OrgBranch, branch_id)
        if branch is None or getattr(branch, "is_deleted", False):
            raise NotFoundException("Branch not found")
        cid = branch.company_id
        if cid is None:
            raise ValidationException("Branch has no company; cannot create record")
        self.validate_company_access(ctx, cid)
        return cid
