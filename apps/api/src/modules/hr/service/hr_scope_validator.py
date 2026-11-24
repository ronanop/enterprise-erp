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

    def resolve_write_company_id(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
    ) -> UUID:
        """Concrete company_id for HR writes (never None — DB company_id is NOT NULL).

        Module-wide HR admins get ``None`` from list-style ``resolve_company_id``;
        creates must instead use an explicit company, the branch's company, or
        the session/single-scoped company. When the session is "All companies",
        fall back to the session branch's company, then a deterministic first
        accessible company so master creates (leave types, attendance policy)
        still succeed without a company field in the form.
        """
        if company_id is not None:
            self.validate_company_access(ctx, company_id)
            return company_id
        effective_branch = branch_id or ctx.branch_id
        if effective_branch is not None:
            self.validate_branch_access(ctx, effective_branch)
            return self.resolve_create_company_id(
                ctx, branch_id=effective_branch, company_id=None
            )
        # Prefer session pin, then a single scoped company — never return None.
        if ctx.company_id is not None:
            self.validate_company_access(ctx, ctx.company_id)
            return ctx.company_id
        from modules.foundation.domain.org_data_scope import (
            effective_company_ids,
            has_module_wide_data_access,
        )
        from modules.organization.models.company import OrgCompany
        from sqlalchemy import select

        allowed = effective_company_ids(ctx, module_key=HR_MODULE_KEY)
        if allowed and len(allowed) == 1:
            return allowed[0]
        if allowed and len(allowed) > 1:
            return sorted(allowed)[0]
        if has_module_wide_data_access(ctx, HR_MODULE_KEY) or getattr(
            ctx, "all_companies", False
        ):
            first = self.db.scalar(
                select(OrgCompany.id)
                .where(
                    OrgCompany.tenant_id == ctx.tenant_id,
                    OrgCompany.is_deleted.is_(False),
                )
                .order_by(OrgCompany.company_code.asc(), OrgCompany.id.asc())
                .limit(1)
            )
            if first is not None:
                return first
        raise ValidationException(
            "Company is required. Select a company in the header and try again."
        )
