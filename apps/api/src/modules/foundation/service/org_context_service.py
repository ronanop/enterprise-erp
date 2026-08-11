"""Resolve organization company/branch for API tenant context."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.models.security import SecUserOrgScope
from modules.organization.models.branch import OrgBranch
from modules.organization.models.company import OrgCompany
from modules.organization.repository.base import utcnow
from modules.organization.repository.org_scope_repository import OrgScopeRepository


class OrgContextService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._scopes = OrgScopeRepository(db)

    def resolve_company_and_branch(
        self,
        *,
        user_id: UUID,
        tenant_id: UUID,
        user_type: str,
        auto_assign_default_scope: bool = True,
    ) -> tuple[UUID | None, UUID | None]:
        """Return org company_id and branch_id for the user, optionally creating default scope."""
        _ = user_type  # reserved for future role-specific rules
        scope = self._scopes.get_default_scope(user_id, tenant_id)
        if scope:
            return scope.company_id, scope.branch_id

        scopes = self._scopes.list_user_scopes(user_id, tenant_id)
        if scopes:
            first = scopes[0]
            return first.company_id, first.branch_id

        company, branch = self._get_tenant_primary_org(tenant_id)
        if company is None:
            return None, None

        if auto_assign_default_scope:
            self.ensure_default_scope(
                tenant_id=tenant_id,
                user_id=user_id,
                company_id=company.id,
                branch_id=branch.id if branch else None,
            )

        return company.id, branch.id if branch else None

    def ensure_default_scope(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        company_id: UUID,
        branch_id: UUID | None,
    ) -> None:
        existing = self._scopes.get_default_scope(user_id, tenant_id)
        if existing:
            return
        for row in self._scopes.list_user_scopes(user_id, tenant_id):
            if row.company_id == company_id:
                if not row.is_default:
                    row.is_default = True
                    self._db.commit()
                return
        self._db.add(
            SecUserOrgScope(
                id=uuid4(),
                tenant_id=tenant_id,
                user_id=user_id,
                company_id=company_id,
                branch_id=branch_id,
                is_default=True,
                assigned_at=utcnow(),
                assigned_by=None,
            )
        )
        self._db.commit()

    def get_tenant_primary_org(self, tenant_id: UUID) -> tuple[OrgCompany | None, OrgBranch | None]:
        return self._get_tenant_primary_org(tenant_id)

    def _get_tenant_primary_org(self, tenant_id: UUID) -> tuple[OrgCompany | None, OrgBranch | None]:
        company = self._db.scalar(
            select(OrgCompany)
            .where(OrgCompany.tenant_id == tenant_id, OrgCompany.is_deleted.is_(False))
            .order_by(OrgCompany.company_code)
        )
        if company is None:
            return None, None
        branch = self._db.scalar(
            select(OrgBranch)
            .where(
                OrgBranch.tenant_id == tenant_id,
                OrgBranch.company_id == company.id,
                OrgBranch.is_deleted.is_(False),
            )
            .order_by(OrgBranch.branch_code)
        )
        return company, branch
