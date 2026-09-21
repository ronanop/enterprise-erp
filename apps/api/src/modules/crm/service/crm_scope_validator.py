"""CRM scope validator."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.crm.repository.base import CRM_MODULE_KEY, CrmScopedRepository
from modules.foundation.domain.value_objects import TenantContext


class CrmScopeValidator(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def validate_company_access(self, ctx: TenantContext, company_id: UUID) -> None:
        self.ensure_company_access(ctx, company_id, module_key=CRM_MODULE_KEY)

    def validate_branch_access(self, ctx: TenantContext, branch_id: UUID) -> None:
        # Pass module_key so CRM module admins are tenant-wide (same as
        # finance/procurement). Without it, admins hit "Branch scope mismatch"
        # when creating/updating records outside their session branch.
        self.ensure_branch_access(ctx, branch_id, module_key=CRM_MODULE_KEY)
