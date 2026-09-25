"""Service for configurable CRM My Jobs step owners."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException, ForbiddenException
from modules.crm.domain.approval_step_owners import APPROVAL_STEP_CATALOG, APPROVAL_STEP_KEYS
from modules.crm.repository.approval_step_owner_repository import ApprovalStepOwnerRepository
from modules.crm.service.crm_module_admin import CrmModuleAdminService
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.repository.user_module_repository import UserModuleRepository


class ApprovalStepOwnerService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ApprovalStepOwnerRepository(db)
        self._crm_admin = CrmModuleAdminService(db)

    def _ensure_admin(self, ctx: TenantContext) -> None:
        if not self._crm_admin.is_admin(ctx):
            raise ForbiddenException("Only CRM module admins can manage default task owners")

    def list_grouped(self, ctx: TenantContext) -> list[dict]:
        rows = self._repo.list_for_tenant(ctx)
        by_step: dict[str, list[UUID]] = {key: [] for key in APPROVAL_STEP_CATALOG}
        for row in rows:
            if row.step_key in by_step:
                by_step[row.step_key].append(row.user_id)

        user_ids = {uid for ids in by_step.values() for uid in ids}
        users = self._user_map(ctx.tenant_id, user_ids)

        result: list[dict] = []
        for step_key, (label, team_role, _) in APPROVAL_STEP_CATALOG.items():
            owners = []
            for uid in by_step[step_key]:
                user = users.get(uid)
                owners.append(
                    {
                        "user_id": uid,
                        "display_name": (user.display_name if user else None) or (user.email if user else str(uid)),
                        "email": user.email if user else "",
                    }
                )
            result.append(
                {
                    "step_key": step_key,
                    "label": label,
                    "team_role": team_role,
                    "owners": owners,
                }
            )
        return result

    def list_user_ids(self, ctx: TenantContext, step_key: str) -> list[UUID]:
        if step_key not in APPROVAL_STEP_KEYS:
            raise ConflictException(f"Unknown approval step '{step_key}'")
        return self._repo.list_user_ids_for_step(ctx, step_key)

    def replace(self, ctx: TenantContext, step_key: str, user_ids: list[UUID]) -> list[dict]:
        self._ensure_admin(ctx)
        if step_key not in APPROVAL_STEP_KEYS:
            raise ConflictException(f"Unknown approval step '{step_key}'")

        unique_ids: list[UUID] = []
        seen: set[UUID] = set()
        for uid in user_ids:
            if uid in seen:
                continue
            seen.add(uid)
            unique_ids.append(uid)

        self._validate_owner_candidates(ctx, step_key, unique_ids)
        self._repo.replace_step_owners(ctx, step_key, unique_ids)
        grouped = self.list_grouped(ctx)
        return next(row for row in grouped if row["step_key"] == step_key)["owners"]

    def _validate_owner_candidates(self, ctx: TenantContext, step_key: str, user_ids: list[UUID]) -> None:
        if not user_ids:
            return
        modules = UserModuleRepository(self._db)
        crm_ids = set(modules.list_user_ids_for_module(ctx.tenant_id, "crm"))
        allowed = set(crm_ids)
        if step_key == "ovf_provide_freight":
            allowed |= set(modules.list_user_ids_for_module(ctx.tenant_id, "procurement"))
        missing = [uid for uid in user_ids if uid not in allowed]
        if missing:
            raise ConflictException(
                "Step owners must be CRM module members"
                + (" or Procurement members for freight" if step_key == "ovf_provide_freight" else "")
            )

    def _user_map(self, tenant_id: UUID, user_ids: set[UUID]) -> dict[UUID, SecUser]:
        if not user_ids:
            return {}
        stmt = select(SecUser).where(
            SecUser.tenant_id == tenant_id,
            SecUser.id.in_(user_ids),
            SecUser.is_deleted.is_(False),
        )
        return {row.id: row for row in self._db.scalars(stmt).all()}
