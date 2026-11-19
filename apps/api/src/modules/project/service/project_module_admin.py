"""Project Management module admin — platform admin emails only (e.g. techbank)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import settings
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser


class ProjectModuleAdminService:
    def __init__(self, db: Session) -> None:
        self._db = db

    @staticmethod
    def is_admin_email(email: str | None) -> bool:
        if not email:
            return False
        return email.strip().lower() in settings.microsoft_platform_admin_email_set()

    def is_admin(self, ctx: TenantContext) -> bool:
        if ctx.user_id is None:
            return False
        user = self._db.scalar(
            select(SecUser).where(
                SecUser.id == ctx.user_id,
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.is_deleted.is_(False),
            )
        )
        if user is None:
            return False
        return self.is_admin_email(user.email)

    def ensure_admin(self, ctx: TenantContext) -> None:
        from core.exceptions import ForbiddenException

        if not self.is_admin(ctx):
            raise ForbiddenException(
                "Only the Project Management module admin can perform this action"
            )
