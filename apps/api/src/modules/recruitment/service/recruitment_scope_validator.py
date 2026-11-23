"""Recruitment scope validator."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.domain.org_data_scope import (
    has_module_wide_data_access,
    is_platform_admin,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.recruitment.repository.base import RECRUITMENT_MODULE_KEY, RecScopedRepository


class RecruitmentScopeValidator(RecScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def validate_company_access(self, ctx: TenantContext, company_id: UUID) -> None:
        """Allow any org-assigned company for ATS writes.

        Session ``company_id`` alone must not block creating a job for another
        assigned entity (e.g. Digitech session + Technologies hiring manager).
        """
        if has_module_wide_data_access(ctx, RECRUITMENT_MODULE_KEY):
            return
        if is_platform_admin(ctx):
            return
        scoped = list(ctx.scoped_company_ids) if ctx.scoped_company_ids else []
        if scoped:
            if company_id in scoped:
                return
            raise ForbiddenException("Company scope mismatch")
        self.ensure_company_access(ctx, company_id, module_key=RECRUITMENT_MODULE_KEY)

    def validate_branch_access(self, ctx: TenantContext, branch_id: UUID) -> None:
        self.ensure_branch_access(ctx, branch_id, module_key=RECRUITMENT_MODULE_KEY)
