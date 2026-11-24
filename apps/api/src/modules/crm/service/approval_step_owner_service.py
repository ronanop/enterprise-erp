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


class ApprovalStepOwnerService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ApprovalStepOwnerRepository(db)
        self._crm_admin = CrmModuleAdminService(db)

    def _ensure_admin(self, ctx: TenantContext) -> None:
        if not self._crm_admin.is_admin(ctx):
            raise ForbiddenException("Only CRM module admins can manage default task owners")

    def _effective_steps(self, ctx: TenantContext) -> list[dict]:
        from modules.crm.service.crm_settings_service import CrmSettingsService

        effective = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
        steps = CrmSettingsService.effective_approval_steps(effective)
        if steps:
            return steps
        return [
            {
                "key": key,
                "label": label,
                "team_role": role,
                "enabled": True,
                "source": "stock",
            }
            for key, (label, role, _) in APPROVAL_STEP_CATALOG.items()
        ]

    def _known_step_keys(self, ctx: TenantContext) -> set[str]:
        return {str(s["key"]) for s in self._effective_steps(ctx)}

    def list_grouped(self, ctx: TenantContext) -> list[dict]:
        steps = self._effective_steps(ctx)
        step_keys = [str(s["key"]) for s in steps]
        rows = self._repo.list_for_tenant(ctx)
        by_step: dict[str, list[UUID]] = {key: [] for key in step_keys}
        for row in rows:
            if row.step_key in by_step:
                by_step[row.step_key].append(row.user_id)

        user_ids = {uid for ids in by_step.values() for uid in ids}
        users = self._user_map(ctx.tenant_id, user_ids)

        result: list[dict] = []
        for step in steps:
            step_key = str(step["key"])
            owners = []
            for uid in by_step.get(step_key, []):
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
                    "label": step.get("label") or step_key,
                    "team_role": step.get("team_role") or "management",
                    "owners": owners,
                }
            )
        return result

    def list_user_ids(self, ctx: TenantContext, step_key: str) -> list[UUID]:
        if step_key not in self._known_step_keys(ctx) and step_key not in APPROVAL_STEP_KEYS:
            raise ConflictException(f"Unknown approval step '{step_key}'")
        return self._repo.list_user_ids_for_step(ctx, step_key)

    def replace(self, ctx: TenantContext, step_key: str, user_ids: list[UUID]) -> list[dict]:
        self._ensure_admin(ctx)
        if step_key not in self._known_step_keys(ctx) and step_key not in APPROVAL_STEP_KEYS:
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

    def _validate_owner_candidates(self, ctx: TenantContext, _step_key: str, user_ids: list[UUID]) -> None:
        """Owners must be active users in the tenant (CRM / Procurement / admin alike)."""
        if not user_ids:
            return
        users = self._user_map(ctx.tenant_id, set(user_ids))
        missing = [uid for uid in user_ids if uid not in users]
        inactive = [
            uid for uid in user_ids if uid in users and (users[uid].status or "").lower() != "active"
        ]
        if missing or inactive:
            raise ConflictException("Step owners must be active users in this tenant")

    def _user_map(self, tenant_id: UUID, user_ids: set[UUID]) -> dict[UUID, SecUser]:
        if not user_ids:
            return {}
        stmt = select(SecUser).where(
            SecUser.tenant_id == tenant_id,
            SecUser.id.in_(user_ids),
            SecUser.is_deleted.is_(False),
        )
        return {row.id: row for row in self._db.scalars(stmt).all()}
