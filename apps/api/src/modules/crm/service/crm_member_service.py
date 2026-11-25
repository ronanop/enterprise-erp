"""CRM team members / owner pickers — mapped to master employees."""

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.module_member_service import ModuleMemberService

CRM_MODULE_KEY = "crm"


class CrmMemberService:
    def __init__(self, db: Session) -> None:
        self._members = ModuleMemberService(db)

    def list_approval_user_options(self, ctx: TenantContext) -> list[dict]:
        return self._members.list_user_options(ctx, CRM_MODULE_KEY)

    def list_member_options(self, ctx: TenantContext) -> list[dict]:
        """Owner / assignee pickers: every active application user with an employee row."""
        return self._members.list_all_tenant_member_options(ctx)
