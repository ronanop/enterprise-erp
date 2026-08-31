"""Promote / revoke HR Admins from the HRMS Superadmin Panel."""

from __future__ import annotations

import secrets
import string
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.audit import AuditEvent, AuditLog
from modules.foundation.models.security import SecRole, SecUser, SecUserOrgScope, SecUserRole
from modules.foundation.service.audit_service import AuditService
from modules.foundation.service.user_service import UserService
from modules.hr.schemas import (
    HrActivityLogRecord,
    HrAdminEntityOption,
    HrAdminPasswordResponse,
    HrAdminRecord,
)
from modules.master_data.models.employee import MasterEmployee
from modules.organization.models.company import OrgCompany
from modules.organization.repository.org_scope_repository import OrgScopeRepository
from security.password import PasswordHasher

HR_ADMIN_ROLE_CODE = "HR_ADMIN"
_PASSWORD_SPECIAL = "!@#$%&*"
_SENSITIVE_KEYS = {"password", "password_hash", "token", "secret", "otp"}


def generate_hr_login_password(length: int = 12) -> str:
    """Random password that meets foundation policy (upper, lower, digit, special, 8+)."""
    if length < 8:
        length = 8
    required = [
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
        secrets.choice(_PASSWORD_SPECIAL),
    ]
    pool = string.ascii_letters + string.digits + _PASSWORD_SPECIAL
    required.extend(secrets.choice(pool) for _ in range(length - len(required)))
    secrets.SystemRandom().shuffle(required)
    return "".join(required)


def _brief_payload(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        parts: list[str] = []
        for key, raw in list(value.items())[:8]:
            if str(key).lower() in _SENSITIVE_KEYS:
                continue
            if isinstance(raw, (dict, list)):
                parts.append(str(key))
            else:
                parts.append(f"{key}={raw}")
        return ", ".join(parts)[:200]
    return str(value)[:200]


class HrSuperadminService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._users = UserService(db)
        self._audit = AuditService(db)
        self._scopes = OrgScopeRepository(db)

    def _role(self, tenant_id: UUID, code: str) -> SecRole:
        role = self._db.scalar(
            select(SecRole).where(
                SecRole.tenant_id == tenant_id,
                SecRole.role_code == code,
                SecRole.is_deleted.is_(False),
            )
        )
        if role is None:
            raise AppException(f"Role {code} is not configured")
        return role

    def _employee(self, ctx: TenantContext, employee_id: UUID) -> MasterEmployee:
        emp = self._db.scalar(
            select(MasterEmployee).where(
                MasterEmployee.id == employee_id,
                MasterEmployee.tenant_id == ctx.tenant_id,
                MasterEmployee.is_deleted.is_(False),
            )
        )
        if emp is None:
            raise NotFoundException("Employee not found")
        return emp

    def _to_record(
        self,
        emp: MasterEmployee,
        user: SecUser,
        *,
        login_created: bool,
        temporary_password: str | None = None,
        company_ids: list[UUID] | None = None,
    ) -> HrAdminRecord:
        return HrAdminRecord(
            employee_id=emp.id,
            employee_code=emp.employee_code,
            display_name=f"{emp.first_name} {emp.last_name}".strip(),
            email=user.email,
            designation=emp.designation or "",
            user_id=user.id,
            login_created=login_created,
            temporary_password=temporary_password,
            company_ids=company_ids if company_ids is not None else self._company_ids_for_user(user.id),
        )

    def _company_ids_for_user(self, user_id: UUID) -> list[UUID]:
        rows = self._db.scalars(
            select(SecUserOrgScope.company_id).where(SecUserOrgScope.user_id == user_id)
        ).all()
        unique: list[UUID] = []
        seen: set[UUID] = set()
        for company_id in rows:
            if company_id in seen:
                continue
            seen.add(company_id)
            unique.append(company_id)
        return unique

    def _resolve_company_ids(
        self,
        ctx: TenantContext,
        emp: MasterEmployee,
        company_ids: list[UUID] | None,
        *,
        require_nonempty: bool = False,
    ) -> list[UUID]:
        requested = list(company_ids or [])
        if not requested and emp.company_id:
            requested = [emp.company_id]
        unique: list[UUID] = []
        seen: set[UUID] = set()
        for company_id in requested:
            if company_id in seen:
                continue
            seen.add(company_id)
            unique.append(company_id)
        if require_nonempty and not unique:
            raise AppException("Assign at least one entity")
        for company_id in unique:
            company = self._db.scalar(
                select(OrgCompany).where(
                    OrgCompany.id == company_id,
                    OrgCompany.tenant_id == ctx.tenant_id,
                    OrgCompany.is_deleted.is_(False),
                )
            )
            if company is None:
                raise AppException("Entity not found")
        return unique

    def _apply_entity_scopes(
        self,
        ctx: TenantContext,
        user_id: UUID,
        company_ids: list[UUID],
        *,
        default_company_id: UUID | None,
    ) -> list[UUID]:
        applied = self._scopes.replace_company_scopes(
            ctx,
            user_id=user_id,
            company_ids=company_ids,
            default_company_id=default_company_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="sec_user_org_scope",
            entity_id=user_id,
            operation="update",
            performed_by=ctx.user_id,
            new_value={"company_ids": [str(cid) for cid in applied]},
        )
        return applied

    def list_entities(self, ctx: TenantContext) -> list[HrAdminEntityOption]:
        rows = self._db.scalars(
            select(OrgCompany)
            .where(
                OrgCompany.tenant_id == ctx.tenant_id,
                OrgCompany.is_deleted.is_(False),
            )
            .order_by(OrgCompany.company_name)
        ).all()
        return [
            HrAdminEntityOption(
                id=row.id,
                company_code=row.company_code,
                company_name=row.company_name,
                legal_name=row.legal_name or "",
                status=row.status,
            )
            for row in rows
        ]

    def list_admins(self, ctx: TenantContext) -> list[HrAdminRecord]:
        role = self._role(ctx.tenant_id, HR_ADMIN_ROLE_CODE)
        rows = self._db.execute(
            select(MasterEmployee, SecUser)
            .join(SecUser, SecUser.id == MasterEmployee.user_id)
            .join(SecUserRole, SecUserRole.user_id == SecUser.id)
            .where(
                MasterEmployee.tenant_id == ctx.tenant_id,
                MasterEmployee.is_deleted.is_(False),
                SecUser.is_deleted.is_(False),
                SecUserRole.role_id == role.id,
            )
            .order_by(MasterEmployee.first_name, MasterEmployee.last_name)
        ).all()
        return [self._to_record(emp, user, login_created=False) for emp, user in rows]

    def _assert_not_superadmin(self, ctx: TenantContext, user: SecUser) -> None:
        if user.user_type == "super_admin":
            raise AppException("Cannot assign HR Admin to a Superadmin account")
        super_role = self._db.scalar(
            select(SecRole).where(
                SecRole.tenant_id == ctx.tenant_id,
                SecRole.role_code == "SUPER_ADMIN",
                SecRole.is_deleted.is_(False),
            )
        )
        if super_role:
            super_link = self._db.scalar(
                select(SecUserRole).where(
                    SecUserRole.user_id == user.id,
                    SecUserRole.role_id == super_role.id,
                )
            )
            if super_link:
                raise AppException("Cannot assign HR Admin to a Superadmin account")

    def _require_hr_admin(self, ctx: TenantContext, emp: MasterEmployee) -> SecUser:
        if not emp.user_id:
            raise AppException("Employee has no login account")
        user = self._db.get(SecUser, emp.user_id)
        if user is None or user.is_deleted:
            raise NotFoundException("Login user not found")
        role = self._role(ctx.tenant_id, HR_ADMIN_ROLE_CODE)
        link = self._db.scalar(
            select(SecUserRole).where(
                SecUserRole.user_id == user.id,
                SecUserRole.role_id == role.id,
            )
        )
        if link is None:
            raise AppException("Employee is not an HR Admin")
        return user

    def _apply_password(self, ctx: TenantContext, user: SecUser, password: str) -> None:
        user.password_hash = PasswordHasher.hash_password(password)
        user.must_change_password = True
        user.updated_by = ctx.user_id
        self._users.revoke_all_sessions(ctx.tenant_id, user.id, revoked_by=ctx.user_id)
        self._audit.log_security_event(
            tenant_id=ctx.tenant_id,
            event_type="hr.hr_admin.password_reset",
            user_id=user.id,
            details_json={"by": str(ctx.user_id), "email": user.email},
        )

    def assign(
        self,
        ctx: TenantContext,
        employee_id: UUID,
        company_ids: list[UUID] | None = None,
    ) -> HrAdminRecord:
        emp = self._employee(ctx, employee_id)
        role = self._role(ctx.tenant_id, HR_ADMIN_ROLE_CODE)
        login_created = False
        temporary_password: str | None = None

        user: SecUser | None = None
        if emp.user_id:
            user = self._db.get(SecUser, emp.user_id)
        if user is None or user.is_deleted:
            email = (emp.email or "").strip().lower()
            if not email:
                raise AppException("Employee has no email — cannot create an HR Admin login")
            existing = self._db.scalar(
                select(SecUser).where(
                    SecUser.tenant_id == ctx.tenant_id,
                    SecUser.email == email,
                    SecUser.is_deleted.is_(False),
                )
            )
            if existing:
                user = existing
                emp.user_id = existing.id
            else:
                temporary_password = generate_hr_login_password()
                created = self._users.create_user(
                    tenant_id=ctx.tenant_id,
                    email=email,
                    password=temporary_password,
                    display_name=f"{emp.first_name} {emp.last_name}".strip(),
                    user_type="employee",
                    created_by=ctx.user_id,
                )
                user = self._db.get(SecUser, created.id)
                assert user is not None
                user.must_change_password = True
                emp.user_id = user.id
                login_created = True

        assert user is not None
        self._assert_not_superadmin(ctx, user)

        self._users.assign_role(
            tenant_id=ctx.tenant_id,
            user_id=user.id,
            role_id=role.id,
            assigned_by=ctx.user_id,
        )
        applied = self._apply_entity_scopes(
            ctx,
            user.id,
            self._resolve_company_ids(ctx, emp, company_ids),
            default_company_id=emp.company_id,
        )
        return self._to_record(
            emp,
            user,
            login_created=login_created,
            temporary_password=temporary_password,
            company_ids=applied,
        )

    def set_entities(
        self,
        ctx: TenantContext,
        employee_id: UUID,
        company_ids: list[UUID],
    ) -> HrAdminRecord:
        emp = self._employee(ctx, employee_id)
        user = self._require_hr_admin(ctx, emp)
        ids = self._resolve_company_ids(ctx, emp, company_ids, require_nonempty=True)
        previous = set(self._company_ids_for_user(user.id))
        applied = self._apply_entity_scopes(
            ctx, user.id, ids, default_company_id=emp.company_id
        )
        if previous - set(applied):
            self._users.revoke_all_sessions(ctx.tenant_id, user.id, revoked_by=ctx.user_id)
        return self._to_record(emp, user, login_created=False, company_ids=applied)

    def reset_password(self, ctx: TenantContext, employee_id: UUID) -> HrAdminPasswordResponse:
        emp = self._employee(ctx, employee_id)
        user = self._require_hr_admin(ctx, emp)
        password = generate_hr_login_password()
        self._apply_password(ctx, user, password)
        return HrAdminPasswordResponse(
            employee_id=emp.id,
            display_name=f"{emp.first_name} {emp.last_name}".strip(),
            email=user.email,
            temporary_password=password,
        )

    def revoke(self, ctx: TenantContext, employee_id: UUID) -> None:
        emp = self._employee(ctx, employee_id)
        if not emp.user_id:
            raise AppException("Employee has no login account")
        role = self._role(ctx.tenant_id, HR_ADMIN_ROLE_CODE)
        self._users.revoke_role(
            tenant_id=ctx.tenant_id,
            user_id=emp.user_id,
            role_id=role.id,
            revoked_by=ctx.user_id,
        )
        home = [emp.company_id] if emp.company_id else []
        self._apply_entity_scopes(
            ctx, emp.user_id, home, default_company_id=emp.company_id
        )
        self._users.revoke_all_sessions(
            ctx.tenant_id, emp.user_id, revoked_by=ctx.user_id
        )
        self._audit.log_security_event(
            tenant_id=ctx.tenant_id,
            event_type="hr.hr_admin.revoked",
            user_id=emp.user_id,
            details_json={"by": str(ctx.user_id), "employee_id": str(emp.id)},
        )

    def list_activity(self, ctx: TenantContext, *, limit: int = 200) -> list[HrActivityLogRecord]:
        cap = max(1, min(limit, 500))
        logs = list(
            self._db.scalars(
                select(AuditLog)
                .where(AuditLog.tenant_id == ctx.tenant_id)
                .order_by(AuditLog.performed_at.desc())
                .limit(cap)
            ).all()
        )
        events = list(
            self._db.scalars(
                select(AuditEvent)
                .where(AuditEvent.tenant_id == ctx.tenant_id)
                .order_by(AuditEvent.performed_at.desc())
                .limit(cap)
            ).all()
        )
        actor_ids = {row.performed_by for row in logs if row.performed_by} | {
            row.user_id for row in events if row.user_id
        }
        email_by_id: dict[UUID, str] = {}
        name_by_id: dict[UUID, str] = {}
        if actor_ids:
            users = self._db.scalars(select(SecUser).where(SecUser.id.in_(actor_ids))).all()
            for user in users:
                email_by_id[user.id] = user.email
                name_by_id[user.id] = user.display_name

        combined: list[HrActivityLogRecord] = []
        for row in logs:
            combined.append(
                HrActivityLogRecord(
                    id=row.id,
                    occurred_at=row.performed_at,
                    kind="change",
                    action=row.operation,
                    entity_name=row.entity_name,
                    actor_name=name_by_id.get(row.performed_by) if row.performed_by else None,
                    actor_email=email_by_id.get(row.performed_by) if row.performed_by else None,
                    summary=_brief_payload(row.new_value or row.old_value),
                )
            )
        for row in events:
            combined.append(
                HrActivityLogRecord(
                    id=row.id,
                    occurred_at=row.performed_at,
                    kind="event",
                    action=row.event_type,
                    entity_name=None,
                    actor_name=name_by_id.get(row.user_id) if row.user_id else None,
                    actor_email=email_by_id.get(row.user_id) if row.user_id else None,
                    summary=_brief_payload(row.details_json),
                )
            )
        combined.sort(key=lambda item: item.occurred_at, reverse=True)
        return combined[:cap]
