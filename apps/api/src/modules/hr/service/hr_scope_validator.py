"""HR scope validator."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException, ValidationException
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.repository.base import HR_MODULE_KEY, HrScopedRepository
from modules.organization.models.branch import OrgBranch


class HrScopeValidator(HrScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def validate_company_access(self, ctx: TenantContext, company_id: UUID) -> None:
        self.ensure_company_access(ctx, company_id, module_key=HR_MODULE_KEY)

    def validate_branch_access(self, ctx: TenantContext, branch_id: UUID) -> None:
        self.ensure_branch_access(ctx, branch_id, module_key=HR_MODULE_KEY)

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
