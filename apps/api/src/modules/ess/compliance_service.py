"""ESS Phase 6 — policies, acknowledgments, password change."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select

from core.exceptions import AppException, ForbiddenException, NotFoundException
from modules.ess.schemas import (
    EssChangePasswordBody,
    EssPolicyAckResponse,
    EssPolicyItem,
    EssPolicyStep,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.service.audit_service import AuditService
from modules.hr.models.ess_policy import HrEssPolicy, HrEssPolicyAck
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
        self._audit = AuditService(db)

    def user_must_change_password(self, ctx: TenantContext) -> bool:
        user = self._db.get(SecUser, ctx.user_id)
        return bool(user and getattr(user, "must_change_password", False))

    def pending_policy_count(self, ctx: TenantContext) -> int:
        return len(self._pending_policies(ctx))

    def list_policies(self, ctx: TenantContext) -> list[EssPolicyItem]:
        emp = self._ess.resolve_employee(ctx)
        acked = self._ack_map(ctx, emp.id)
        rows = list(
            self._db.scalars(
                select(HrEssPolicy)
                .where(
                    HrEssPolicy.tenant_id == ctx.tenant_id,
                    HrEssPolicy.company_id == emp.company_id,
                    HrEssPolicy.is_deleted.is_(False),
                    HrEssPolicy.status == "published",
                )
                .order_by(HrEssPolicy.display_order, HrEssPolicy.title)
            ).all()
        )
        out: list[EssPolicyItem] = []
        for row in rows:
            if not row.is_mandatory:
                continue
            ack_ver = acked.get(row.id)
            acknowledged = ack_ver is not None and ack_ver >= row.policy_version
            out.append(
                EssPolicyItem(
                    id=row.id,
                    policy_code=row.policy_code,
                    title=row.title,
                    policy_version=row.policy_version,
                    is_mandatory=row.is_mandatory,
                    acknowledged=acknowledged,
                    step_count=len(_split_policy_steps(row.content_markdown)),
                )
            )
        return out

    def get_policy(self, ctx: TenantContext, policy_id: UUID) -> EssPolicyItem:
        emp = self._ess.resolve_employee(ctx)
        row = self._get_published_policy(ctx, emp.company_id, policy_id)
        acked = self._ack_map(ctx, emp.id)
        ack_ver = acked.get(row.id)
        acknowledged = ack_ver is not None and ack_ver >= row.policy_version
        item = EssPolicyItem(
            id=row.id,
            policy_code=row.policy_code,
            title=row.title,
            policy_version=row.policy_version,
            is_mandatory=row.is_mandatory,
            acknowledged=acknowledged,
            step_count=len(_split_policy_steps(row.content_markdown)),
        )
        return item

    def get_policy_walkthrough(self, ctx: TenantContext, policy_id: UUID):
        from modules.ess.schemas import EssPolicyWalkthrough

        emp = self._ess.resolve_employee(ctx)
        row = self._get_published_policy(ctx, emp.company_id, policy_id)
        acked = self._ack_map(ctx, emp.id)
        ack_ver = acked.get(row.id)
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
        row = self._get_published_policy(ctx, emp.company_id, policy_id)
        existing = self._db.scalar(
            select(HrEssPolicyAck).where(
                HrEssPolicyAck.employee_id == emp.id,
                HrEssPolicyAck.policy_id == row.id,
                HrEssPolicyAck.policy_version == row.policy_version,
                HrEssPolicyAck.is_deleted.is_(False),
            )
        )
        if existing:
            return EssPolicyAckResponse(
                policy_id=row.id,
                policy_version=row.policy_version,
                acknowledged_at=existing.acknowledged_at,
            )
        now = datetime.now(timezone.utc)
        ack = HrEssPolicyAck(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=emp.company_id,
            policy_id=row.id,
            employee_id=emp.id,
            policy_version=row.policy_version,
            acknowledged_at=now,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self._db.add(ack)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_ess_policy_ack",
            entity_id=ack.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"policy_code": row.policy_code, "version": row.policy_version},
        )
        return EssPolicyAckResponse(
            policy_id=row.id,
            policy_version=row.policy_version,
            acknowledged_at=now,
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

    def _pending_policies(self, ctx: TenantContext) -> list[HrEssPolicy]:
        emp = self._ess.resolve_employee(ctx)
        acked = self._ack_map(ctx, emp.id)
        rows = list(
            self._db.scalars(
                select(HrEssPolicy).where(
                    HrEssPolicy.tenant_id == ctx.tenant_id,
                    HrEssPolicy.company_id == emp.company_id,
                    HrEssPolicy.is_deleted.is_(False),
                    HrEssPolicy.status == "published",
                    HrEssPolicy.is_mandatory.is_(True),
                )
            ).all()
        )
        pending: list[HrEssPolicy] = []
        for row in rows:
            ver = acked.get(row.id)
            if ver is None or ver < row.policy_version:
                pending.append(row)
        return pending

    def _ack_map(self, ctx: TenantContext, employee_id: UUID) -> dict[UUID, int]:
        rows = self._db.scalars(
            select(HrEssPolicyAck).where(
                HrEssPolicyAck.tenant_id == ctx.tenant_id,
                HrEssPolicyAck.employee_id == employee_id,
                HrEssPolicyAck.is_deleted.is_(False),
            )
        ).all()
        best: dict[UUID, int] = {}
        for row in rows:
            cur = best.get(row.policy_id, 0)
            if row.policy_version > cur:
                best[row.policy_id] = row.policy_version
        return best

    def _get_published_policy(self, ctx: TenantContext, company_id: UUID, policy_id: UUID) -> HrEssPolicy:
        row = self._db.get(HrEssPolicy, policy_id)
        if (
            row is None
            or row.is_deleted
            or row.tenant_id != ctx.tenant_id
            or row.company_id != company_id
            or row.status != "published"
        ):
            raise NotFoundException("Policy not found")
        return row
