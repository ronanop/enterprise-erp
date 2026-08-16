"""Project Management module admin — platform admin emails only (e.g. techbank)."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.config import settings
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser


@dataclass(frozen=True)
class ProjectModuleAdminRecipient:
    user_id: UUID
    email: str
    display_name: str
    employee_id: UUID | None


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

    def list_admin_recipients(self, tenant_id: UUID) -> list[ProjectModuleAdminRecipient]:
        """Active SecUser rows whose email is in the platform admin allowlist."""
        emails = settings.microsoft_platform_admin_email_set()
        if not emails:
            return []
        rows = list(
            self._db.scalars(
                select(SecUser).where(
                    SecUser.tenant_id == tenant_id,
                    SecUser.is_deleted.is_(False),
                    SecUser.status == "active",
                    func.lower(SecUser.email).in_(sorted(emails)),
                )
            ).all()
        )
        out: list[ProjectModuleAdminRecipient] = []
        for user in rows:
            email = (user.email or "").strip().lower()
            if email not in emails:
                continue
            out.append(
                ProjectModuleAdminRecipient(
                    user_id=user.id,
                    email=email,
                    display_name=(user.display_name or email).strip() or email,
                    employee_id=user.employee_id,
                )
            )
        return out
