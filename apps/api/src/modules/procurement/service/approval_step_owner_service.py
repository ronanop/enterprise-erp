"""Service for configurable Procurement PO approval step owners."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import ConflictException, ForbiddenException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.procurement.domain.approval_step_owners import (
    APPROVAL_STEP_CATALOG,
    APPROVAL_STEP_KEYS,
    STAGE_TO_STEP_KEY,
)
from modules.procurement.repository.approval_step_owner_repository import (
    ProcApprovalStepOwnerRepository,
)
from modules.procurement.service.procurement_module_admin import ProcurementModuleAdminService


class ProcApprovalStepOwnerService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ProcApprovalStepOwnerRepository(db)
        self._admin = ProcurementModuleAdminService(db)

    def _ensure_admin(self, ctx: TenantContext) -> None:
        if not self._admin.is_admin(ctx):
            raise ForbiddenException("Only Procurement module admins can manage PO approvers")

    def list_grouped(self, ctx: TenantContext) -> list[dict]:
        rows = self._repo.list_for_tenant(ctx)
        by_step: dict[str, list[UUID]] = {key: [] for key in APPROVAL_STEP_CATALOG}
        for row in rows:
            if row.step_key in by_step:
                by_step[row.step_key].append(row.user_id)

        user_ids = {uid for ids in by_step.values() for uid in ids}
        users = self._user_map(ctx.tenant_id, user_ids)

        result: list[dict] = []
        for step_key, (label, team_role) in APPROVAL_STEP_CATALOG.items():
            owners = []
            for uid in by_step[step_key]:
                user = users.get(uid)
                owners.append(
                    {
                        "user_id": uid,
                        "display_name": (user.display_name if user else None)
                        or (user.email if user else str(uid)),
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

    def capabilities(self, ctx: TenantContext) -> dict:
        is_module_admin = self._admin.is_admin(ctx)
        steps: list[str] = []
        if ctx.user_id is not None:
            steps = [
                key
                for key in self._repo.list_step_keys_for_user(ctx, ctx.user_id)
                if key in APPROVAL_STEP_KEYS
            ]
        if is_module_admin:
            # Admins decide the PO stages. Hold and freight follow the saved owners
            # when someone is assigned; otherwise the module admin can still decide.
            named = {"hold_decision", "freight_finance"}
            steps = [key for key in APPROVAL_STEP_KEYS if key not in named]
            for key in named:
                owners = self._repo.list_user_ids_for_step(ctx, key)
                if not owners or ctx.user_id in set(owners):
                    steps.append(key)
        po_decision_steps = {
            step_key for step_key in STAGE_TO_STEP_KEY.values() if step_key in APPROVAL_STEP_KEYS
        }
        inbox_steps = po_decision_steps | {"hold_decision", "freight_finance"}
        can_decide = is_module_admin or any(step in inbox_steps for step in steps)
        return {
            "is_module_admin": is_module_admin,
            "steps": steps,
            "can_decide_approvals": can_decide,
        }

    def can_decide_step(self, ctx: TenantContext, step_key: str) -> bool:
        """Hold and freight: assigned owners decide. With nobody assigned, a module admin does."""
        if step_key not in APPROVAL_STEP_KEYS or ctx.user_id is None:
            return False
        owners = set(self._repo.list_user_ids_for_step(ctx, step_key))
        if owners:
            return ctx.user_id in owners
        return self._admin.is_admin(ctx)

    def can_decide_stage(self, ctx: TenantContext, stage: str | None) -> bool:
        if self._admin.is_admin(ctx):
            return True
        if not stage or ctx.user_id is None:
            return False
        step_key = STAGE_TO_STEP_KEY.get(stage)
        if not step_key:
            return False
        return ctx.user_id in set(self._repo.list_user_ids_for_step(ctx, step_key))

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

        self._validate_owner_candidates(ctx, unique_ids)
        self._repo.replace_step_owners(ctx, step_key, unique_ids)
        grouped = self.list_grouped(ctx)
        return next(row for row in grouped if row["step_key"] == step_key)["owners"]

    def _validate_owner_candidates(self, ctx: TenantContext, user_ids: list[UUID]) -> None:
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
