"""Create organization members (ERP user + employee profile) outside recruitment."""

from __future__ import annotations

import secrets
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import AppException, ConflictException, ValidationException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.schemas import UserResponse
from modules.foundation.service.organization_assignment_service import OrganizationAssignmentService
from modules.foundation.service.org_context_service import OrgContextService
from modules.foundation.service.user_employee_link_service import UserEmployeeLinkService
from modules.foundation.service.user_service import UserService


class OrganizationMemberService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._users = UserService(db)
        self._org = OrgContextService(db)
        self._user_employee = UserEmployeeLinkService(db)

    @staticmethod
    def _domain() -> str:
        return settings.microsoft_user_email_domain.strip().lower().lstrip("@")

    @staticmethod
    def _sso_placeholder_password() -> str:
        return f"Ms0!{secrets.token_urlsafe(18)}"

    def create_member(
        self,
        *,
        tenant_id: UUID,
        actor_user_id: UUID | None,
        actor_user_type: str,
        email: str,
        display_name: str,
    ) -> UserResponse:
        domain = self._domain()
        normalized_email = email.strip().lower()
        name = display_name.strip()
        if not name:
            raise ValidationException("Display name is required")
        if domain and not normalized_email.endswith(f"@{domain}"):
            raise ValidationException(f"Organization members must use @{domain} email addresses")

        existing = self._db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == tenant_id,
                SecUser.email == normalized_email,
                SecUser.is_deleted.is_(False),
            )
        )
        if existing is not None:
            raise ConflictException(f"User already exists for {normalized_email}")

        user_entity = self._users.create_user(
            tenant_id=tenant_id,
            email=normalized_email,
            password=self._sso_placeholder_password(),
            display_name=name,
            user_type="employee",
            created_by=actor_user_id,
        )
        user = self._db.scalar(select(SecUser).where(SecUser.id == user_entity.id))
        if user is None:
            raise AppException("Failed to create organization member user")

        primary_company, primary_branch = self._org.get_tenant_primary_org(tenant_id)
        if primary_company is not None:
            self._org.ensure_default_scope(
                tenant_id=tenant_id,
                user_id=user.id,
                company_id=primary_company.id,
                branch_id=primary_branch.id if primary_branch else None,
            )

        link_ctx = TenantContext(
            tenant_id=tenant_id,
            user_id=actor_user_id or user.id,
            user_type=actor_user_type or user.user_type,
            company_id=primary_company.id if primary_company else None,
            branch_id=primary_branch.id if primary_branch else None,
        )
        employee = self._user_employee.ensure_employee_for_user(link_ctx, user)
        if employee is None:
            raise AppException(
                "User was created but employee profile could not be provisioned. "
                "Confirm company, branch, and department masters exist."
            )

        refreshed = self._users.get_user(tenant_id, user.id)
        return OrganizationAssignmentService(self._db).enrich_responses(tenant_id, [refreshed])[0]
