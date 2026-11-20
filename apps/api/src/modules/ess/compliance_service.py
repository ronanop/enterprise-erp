"""ESS Phase 6 - policies, acknowledgments, password change."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from core.exceptions import AppException, ForbiddenException, NotFoundException
from modules.ess.schemas import (
    EssChangePasswordBody,
    EssPolicyAckResponse,
    EssPolicyItem,
    EssPolicyStep,
    EssPolicyWalkthrough,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.hr.service.ess_policy_ack_service import EssPolicyAckService
from modules.platform.compat.audit_facade import PlatformAuditFacade
from security.password import PasswordHasher


def _split_policy_steps(content: str) -> list[EssPolicyStep]:
    """Split markdown into walkthrough steps.

    Preferred markers: lines starting with ``## `` (or ``# `` / ``### ``).
    Falls back to a single Policy step when no headings exist.
    """
    raw = (content or "").strip()
    if not raw:
        return [EssPolicyStep(order=0, title="Policy", body="")]

    lines = raw.replace("\r\n", "\n").splitlines()
    steps: list[EssPolicyStep] = []
    current_title = "Overview"
    current_body: list[str] = []
    order = 0
    saw_heading = False

    def flush() -> None:
        nonlocal order, current_body
        body = "\n".join(current_body).strip()
        # Skip empty Overview before the first heading.
        if not body and not saw_heading and order == 0:
            current_body = []
            return
        if not body:
            current_body = []
            return
        steps.append(
            EssPolicyStep(
                order=order,
                title=current_title.strip() or f"Step {order + 1}",
                body=body,
            )
        )
        order += 1
        current_body = []

    for line in lines:
        heading = None
        if line.startswith("### "):
            heading = line[4:].strip()
        elif line.startswith("## "):
            heading = line[3:].strip()
        elif line.startswith("# "):
            heading = line[2:].strip()
        if heading is not None:
            flush()
            current_title = heading or f"Step {order + 1}"
            saw_heading = True
            continue
        current_body.append(line)

    flush()
    if not steps:
        steps.append(EssPolicyStep(order=0, title="Policy", body=raw))
    return steps


class EssComplianceService:
    def __init__(self, db, ess) -> None:
        self._db = db
        self._ess = ess
        self._audit = PlatformAuditFacade(db)
        self._policies = EssPolicyAckService(db)

    def user_must_change_password(self, ctx: TenantContext) -> bool:
        user = self._db.get(SecUser, ctx.user_id)
        return bool(user and getattr(user, "must_change_password", False))

    def pending_policy_count(self, ctx: TenantContext) -> int:
        return len(self._pending_policies(ctx))

    def list_policies(self, ctx: TenantContext) -> list[EssPolicyItem]:
        emp = self._ess.resolve_employee(ctx)
        acked = self._policies.acknowledged_versions(ctx, emp.id)
        out: list[EssPolicyItem] = []
        for row in self._policies.list_published(ctx, emp.company_id):
            if not row.is_mandatory:
                continue
            out.append(self._to_item(row, acked.get(row.id)))
        return out

    def get_policy(self, ctx: TenantContext, policy_id: UUID) -> EssPolicyItem:
        emp = self._ess.resolve_employee(ctx)
        row = self._policies.get_published(ctx, emp.company_id, policy_id)
        acked = self._policies.acknowledged_versions(ctx, emp.id)
        return self._to_item(row, acked.get(row.id))

    def get_policy_walkthrough(self, ctx: TenantContext, policy_id: UUID) -> EssPolicyWalkthrough:
        emp = self._ess.resolve_employee(ctx)
        row = self._policies.get_published(ctx, emp.company_id, policy_id)
        ack_ver = self._policies.acknowledged_versions(ctx, emp.id).get(row.id)
        return EssPolicyWalkthrough(
            id=row.id,
            policy_code=row.policy_code,
            title=row.title,
            policy_version=row.policy_version,
            is_mandatory=row.is_mandatory,
            acknowledged=ack_ver is not None and ack_ver >= row.policy_version,
            steps=_split_policy_steps(row.content_markdown),
        )

    def acknowledge_policy(self, ctx: TenantContext, policy_id: UUID) -> EssPolicyAckResponse:
        emp = self._ess.resolve_employee(ctx)
        row = self._policies.get_published(ctx, emp.company_id, policy_id)
        ack_id, acknowledged_at, created = self._policies.acknowledge(
            ctx, company_id=emp.company_id, employee_id=emp.id, policy=row
        )
        if created:
            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name="hr_ess_policy_ack",
                entity_id=ack_id,
                operation="create",
                performed_by=ctx.user_id,
                new_value={"policy_code": row.policy_code, "version": row.policy_version},
            )
        return EssPolicyAckResponse(
            policy_id=row.id,
            policy_version=row.policy_version,
            acknowledged_at=acknowledged_at,
        )

    def change_password(self, ctx: TenantContext, body: EssChangePasswordBody) -> None:
        user = self._db.get(SecUser, ctx.user_id)
        if user is None or user.tenant_id != ctx.tenant_id:
            raise NotFoundException("User not found")
        if not PasswordHasher.verify_password(body.current_password, user.password_hash):
            raise ForbiddenException("Current password is incorrect")
        new_pw = body.new_password.strip()
        if len(new_pw) < 8:
            raise AppException("New password must be at least 8 characters")
        if new_pw == body.current_password:
            raise AppException("New password must be different from the current password")
        user.password_hash = PasswordHasher.hash_password(new_pw)
        user.must_change_password = False
        user.updated_by = ctx.user_id
        self._audit.log_security_event(
            tenant_id=ctx.tenant_id,
            event_type="auth.password_change",
            user_id=ctx.user_id,
        )

    def _pending_policies(self, ctx: TenantContext) -> list[Any]:
        emp = self._ess.resolve_employee(ctx)
        acked = self._policies.acknowledged_versions(ctx, emp.id)
        return [
            row
            for row in self._policies.list_published(ctx, emp.company_id, mandatory_only=True)
            if acked.get(row.id) is None or acked[row.id] < row.policy_version
        ]

    @staticmethod
    def _to_item(row: Any, ack_ver: int | None) -> EssPolicyItem:
        return EssPolicyItem(
            id=row.id,
            policy_code=row.policy_code,
            title=row.title,
            policy_version=row.policy_version,
            is_mandatory=row.is_mandatory,
            acknowledged=ack_ver is not None and ack_ver >= row.policy_version,
            step_count=len(_split_policy_steps(row.content_markdown)),
        )
