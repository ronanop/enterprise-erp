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
    lines = content.strip().splitlines()
    steps: list[EssPolicyStep] = []
    current_title = "Overview"
    current_body: list[str] = []
    order = 0

    def flush() -> None:
        nonlocal order
        body = "\n".join(current_body).strip()
        if body or order == 0:
            steps.append(
                EssPolicyStep(
                    order=order,
                    title=current_title,
                    body=body or content.strip(),
                )
            )
            order += 1

    for line in lines:
        if line.startswith("## "):
            if current_body or order > 0:
                flush()
                current_body = []
            current_title = line[3:].strip()
        else:
            current_body.append(line)
    flush()
    if not steps:
        steps.append(EssPolicyStep(order=0, title="Policy", body=content.strip()))
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
        current_ok = PasswordHasher.verify_password(body.current_password, user.password_hash)
        # First-login path: allow default ESS password (employee code + DOB) as "current".
        if not current_ok and bool(getattr(user, "must_change_password", False)):
            emp = self._ess.resolve_employee(ctx)
            from modules.hr.models import HrEmployeeProfile
            from security.ess_default_password import verify_ess_dob_password
            from sqlalchemy import select

            profile = self._db.scalar(
                select(HrEmployeeProfile).where(
                    HrEmployeeProfile.employee_id == emp.id,
                    HrEmployeeProfile.is_deleted.is_(False),
                )
            )
            if profile and profile.date_of_birth:
                current_ok = verify_ess_dob_password(
                    body.current_password, emp.employee_code, profile.date_of_birth
                )
        if not current_ok:
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
