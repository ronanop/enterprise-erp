"""Organization context switching service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from core.redis import SessionStore
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.organization.repository.company_repository import CompanyRepository
from modules.organization.repository.org_scope_repository import OrgScopeRepository
from modules.organization.service.org_scope_validator import OrgScopeValidator


class OrgContextService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._scopes = OrgScopeRepository(db)
        self._companies = CompanyRepository(db)
        self._validator = OrgScopeValidator(db)
        self._audit = AuditService(db)
        self._store = SessionStore()

    def get_context(self, ctx: TenantContext) -> dict:
        return {
            "tenant_id": str(ctx.tenant_id),
            "user_id": str(ctx.user_id),
            "company_id": str(ctx.company_id) if ctx.company_id else None,
            "branch_id": str(ctx.branch_id) if ctx.branch_id else None,
            "user_type": ctx.user_type,
        }

    def list_accessible_companies(self, ctx: TenantContext):
        if ctx.user_type in {"super_admin", "tenant_admin"}:
            return self._companies.list_companies(ctx)

        scopes = self._scopes.list_user_scopes(ctx.user_id, ctx.tenant_id)
        company_ids = {s.company_id for s in scopes}
        if not company_ids:
            return self._companies.list_companies(ctx)

        companies = []
        seen: set[UUID] = set()
        for company_id in company_ids:
            if company_id in seen:
                continue
            company = self._companies.get_by_id(ctx, company_id)
            if company is not None:
                companies.append(company)
                seen.add(company_id)
        return companies

    def list_accessible_branches(self, ctx: TenantContext, company_id: UUID):
        from modules.organization.repository.branch_repository import BranchRepository

        self._validator.validate_company_access(ctx, company_id)
        return BranchRepository(self._db).list_branches(ctx, company_id=company_id)

    def switch_context(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID | None = None,
    ) -> dict:
        company = self._companies.get_by_id(ctx, company_id)
        if company is None:
            raise NotFoundException("Company not found")
        self._validator.validate_company_access(ctx, company_id)
        if branch_id:
            self._validator.validate_branch_access(ctx, branch_id)

        if ctx.session_id:
            self._store.set_session(
                ctx.session_id,
                {
                    "user_id": str(ctx.user_id),
                    "tenant_id": str(ctx.tenant_id),
                    "company_id": str(company_id),
                    "branch_id": str(branch_id) if branch_id else None,
                },
            )
        self._audit.log_security_event(
            tenant_id=ctx.tenant_id,
            event_type="auth.context_switch",
            user_id=ctx.user_id,
            details_json={
                "company_id": str(company_id),
                "branch_id": str(branch_id) if branch_id else None,
            },
        )
        return {
            "company_id": str(company_id),
            "branch_id": str(branch_id) if branch_id else None,
        }
