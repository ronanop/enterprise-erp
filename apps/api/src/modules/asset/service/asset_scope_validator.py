"""Asset scope validator."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.repository.base import ASSET_MODULE_KEY, AstScopedRepository
from modules.foundation.domain.value_objects import TenantContext


class AssetScopeValidator(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def validate_company_access(self, ctx: TenantContext, company_id: UUID) -> None:
        self.ensure_company_access(ctx, company_id, module_key=ASSET_MODULE_KEY)

    def validate_branch_access(self, ctx: TenantContext, branch_id: UUID) -> None:
        self.ensure_branch_access(ctx, branch_id, module_key=ASSET_MODULE_KEY)
