"""Authentication service."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import UnauthorizedException
from core.redis import SessionStore
from modules.foundation.domain.exceptions import (
    AccountLockedException,
    InvalidCredentialsException,
)
from modules.foundation.domain.erp_modules import resolve_session_user_type
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecRole, SecTenant, SecUser, SecUserRole
from modules.foundation.repository.session_repository import SessionRepository
from modules.foundation.repository.user_repository import UserRepository
from modules.foundation.service.audit_service import AuditService
from modules.foundation.service.microsoft_oauth_service import MicrosoftOAuthService
from modules.foundation.service.org_context_service import OrgContextService
from modules.foundation.service.user_employee_link_service import UserEmployeeLinkService
from modules.foundation.service.user_service import UserService
from security.jwt import JWTService
from security.password import PasswordHasher


class AuthService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._users = UserRepository(db)
        self._sessions = SessionRepository(db)
        self._audit = AuditService(db)
        self._jwt = JWTService()
        self._store = SessionStore()

    def login(
        self,
        *,
        email: str,
        password: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> dict:
        user = self._users.get_active_by_email(email)
        if user is None or not PasswordHasher.verify_password(password, user.password_hash):
            if user is not None:
                self._users.record_failed_login(user)
                if user.failed_login_count >= settings.account_lockout_threshold:
                    locked_until = datetime.now(timezone.utc) + timedelta(
                        minutes=settings.account_lockout_minutes
                    )
                    self._users.lock_account(user, locked_until)
            raise InvalidCredentialsException()

        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            raise AccountLockedException()

        if user.mfa_enabled:
            challenge = self._jwt.create_access_token(
                user_id=user.id,
                tenant_id=user.tenant_id,
                user_type=user.user_type,
                session_id=uuid4(),
            )
            return {"mfa_required": True, "mfa_challenge_token": challenge}

        return self._issue_tokens(user, ip_address=ip_address, user_agent=user_agent)

    def verify_mfa(
        self,
        *,
        email: str,
        otp: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> dict:
        import pyotp

        user = self._users.get_active_by_email(email)
        if user is None or not user.mfa_enabled or not user.mfa_secret_encrypted:
            raise InvalidCredentialsException()
        totp = pyotp.TOTP(user.mfa_secret_encrypted)
        if not totp.verify(otp, valid_window=1):
            raise InvalidCredentialsException()
        return self._issue_tokens(user, ip_address=ip_address, user_agent=user_agent)

    def login_with_microsoft(
        self,
        *,
        email: str,
        display_name: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> dict:
        normalized = email.strip().lower()
        user = self._users.get_active_by_email(normalized)
        if user is None:
            user = self._provision_microsoft_user(
                email=normalized,
                display_name=display_name,
            )
            if user is None:
                raise InvalidCredentialsException(
                    "No ERP account is linked to this Microsoft identity"
                )

        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            raise AccountLockedException()

        return self._issue_tokens(user, ip_address=ip_address, user_agent=user_agent)

    def complete_microsoft_oauth(
        self,
        *,
        code: str,
        state: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[str, str]:
        oauth = MicrosoftOAuthService()
        stored = self._store.pop_oauth_state(state)
        if stored is None:
            raise InvalidCredentialsException("Microsoft sign-in session expired. Try again.")

        return_to = (
            stored.get("return_to") if isinstance(stored.get("return_to"), str) else "/"
        )
        claims = oauth.exchange_authorization_code(code)
        email = MicrosoftOAuthService.email_from_claims(claims)
        if not email:
            raise InvalidCredentialsException("Microsoft account did not include an email address")

        name = claims.get("name")
        display_name = name.strip() if isinstance(name, str) and name.strip() else None

        tokens = self.login_with_microsoft(
            email=email,
            display_name=display_name,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        exchange_code = oauth.create_exchange_code()
        self._store.set_oauth_exchange(exchange_code, {**tokens, "return_to": return_to})
        return exchange_code, return_to

    def _microsoft_email_allowed(self, email: str) -> bool:
        if email in settings.microsoft_platform_admin_email_set():
            return True
        domain = settings.microsoft_user_email_domain.strip().lower().lstrip("@")
        return bool(domain) and email.endswith(f"@{domain}")

    def _ensure_role(self, tenant_id: UUID, role_code: str, role_name: str) -> SecRole:
        role = self._db.scalar(
            select(SecRole).where(
                SecRole.tenant_id == tenant_id,
                SecRole.role_code == role_code,
                SecRole.is_deleted.is_(False),
            )
        )
        if role:
            return role
        role = SecRole(
            tenant_id=tenant_id,
            role_code=role_code,
            role_name=role_name,
            is_system_role=True,
            status="active",
        )
        self._db.add(role)
        self._db.flush()
        return role

    def _provision_microsoft_user(
        self,
        *,
        email: str,
        display_name: str | None,
    ) -> SecUser | None:
        """JIT-provision org Microsoft users into the bootstrap tenant on first SSO."""
        if not self._microsoft_email_allowed(email):
            return None

        tenant = self._db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
        if tenant is None:
            return None

        is_admin = email in settings.microsoft_platform_admin_email_set()
        user_service = UserService(self._db)
        org_context = OrgContextService(self._db)
        user_employee = UserEmployeeLinkService(self._db)

        created = user_service.create_user(
            tenant_id=tenant.id,
            email=email,
            password=f"Ms0!{secrets.token_urlsafe(18)}",
            display_name=(display_name or email.split("@")[0]).strip() or email,
            user_type="super_admin" if is_admin else "employee",
        )
        user = self._db.scalar(select(SecUser).where(SecUser.id == created.id))
        if user is None:
            return None

        role = self._ensure_role(
            tenant.id,
            "SUPER_ADMIN" if is_admin else "TENANT_ADMIN",
            "Super Admin" if is_admin else "Tenant Admin",
        )
        existing_link = self._db.scalar(
            select(SecUserRole).where(
                SecUserRole.user_id == user.id,
                SecUserRole.role_id == role.id,
            )
        )
        if existing_link is None:
            user_service.assign_role(
                tenant_id=tenant.id,
                user_id=user.id,
                role_id=role.id,
                assigned_by=None,
            )

        primary_company, primary_branch = org_context.get_tenant_primary_org(tenant.id)
        if primary_company is not None:
            org_context.ensure_default_scope(
                tenant_id=tenant.id,
                user_id=user.id,
                company_id=primary_company.id,
                branch_id=primary_branch.id if primary_branch else None,
            )

        link_ctx = TenantContext(
            tenant_id=tenant.id,
            user_id=user.id,
            user_type=user.user_type,
            company_id=primary_company.id if primary_company else None,
            branch_id=primary_branch.id if primary_branch else None,
        )
        user_employee.ensure_employee_for_user(link_ctx, user)
        self._db.flush()
        return user

    def redeem_microsoft_exchange(self, exchange_code: str) -> dict:
        payload = self._store.pop_oauth_exchange(exchange_code)
        if payload is None:
            raise InvalidCredentialsException("Sign-in code expired or already used")
        return payload

    def refresh(self, refresh_token: str) -> dict:
        payload = self._jwt.decode_token(refresh_token, expected_type="refresh")
        stored = self._sessions.get_refresh_token(refresh_token)
        if stored is None:
            raise UnauthorizedException("Refresh token revoked or invalid")

        user_id = UUID(payload["sub"])
        session_id = UUID(payload["session_id"])
        session = self._sessions.get_active(session_id)
        if session is None:
            raise UnauthorizedException("Session expired or revoked")

        user_model = self._db.get(SecUser, user_id)
        if user_model is None:
            raise UnauthorizedException("User not found")

        session_user_type = self._session_user_type(user_model)
        new_refresh, _ = self._jwt.create_refresh_token(user_id=user_id, session_id=session_id)
        refresh_days = settings.jwt_refresh_token_expire_days
        new_row = self._sessions.store_refresh_token(
            tenant_id=session.tenant_id,
            user_id=user_id,
            session_id=session_id,
            token=new_refresh,
            expires_at=datetime.now(timezone.utc) + timedelta(days=refresh_days),
        )
        self._sessions.revoke_refresh_token(stored, replaced_by=new_row.id)

        access = self._jwt.create_access_token(
            user_id=user_id,
            tenant_id=session.tenant_id,
            user_type=session_user_type,
            session_id=session_id,
        )
        # Keep Redis session alive alongside refreshed tokens.
        self._store.touch_session(session_id)
        return {
            "access_token": access,
            "refresh_token": new_refresh,
            "token_type": "bearer",
        }

    def logout(self, session_id: UUID, user_id: UUID, tenant_id: UUID) -> None:
        self._sessions.revoke(session_id, revoked_by=user_id)
        self._store.delete_session(session_id)
        self._audit.log_security_event(
            tenant_id=tenant_id,
            event_type="auth.logout",
            user_id=user_id,
        )

    def _role_codes_for_user(self, user_id: UUID) -> list[str]:
        stmt = (
            select(SecRole.role_code)
            .join(SecUserRole, SecUserRole.role_id == SecRole.id)
            .where(SecUserRole.user_id == user_id, SecRole.is_deleted.is_(False))
        )
        return list(self._db.scalars(stmt).all())

    def _session_user_type(self, user: SecUser) -> str:
        resolved = resolve_session_user_type(
            user.user_type,
            user.email,
            self._role_codes_for_user(user.id),
            platform_admin_emails=settings.microsoft_platform_admin_email_set(),
        )
        if resolved != user.user_type:
            user.user_type = resolved
            self._db.flush()
        return resolved

    def _issue_tokens(
        self,
        user: SecUser,
        *,
        ip_address: str | None,
        user_agent: str | None,
    ) -> dict:
        user_type = self._session_user_type(user)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.session_ttl_seconds)
        provisional_session_id = uuid4()
        session = self._sessions.create_session(
            tenant_id=user.tenant_id,
            user_id=user.id,
            session_token=str(provisional_session_id),
            ip_address=ip_address,
            user_agent=user_agent,
            expires_at=expires_at,
        )
        access = self._jwt.create_access_token(
            user_id=user.id,
            tenant_id=user.tenant_id,
            user_type=user_type,
            session_id=session.id,
        )
        refresh, _ = self._jwt.create_refresh_token(user_id=user.id, session_id=session.id)
        refresh_days = settings.jwt_refresh_token_expire_days
        self._sessions.store_refresh_token(
            tenant_id=user.tenant_id,
            user_id=user.id,
            session_id=session.id,
            token=refresh,
            expires_at=datetime.now(timezone.utc) + timedelta(days=refresh_days),
        )
        from modules.foundation.service.org_context_service import OrgContextService

        company_id, branch_id = OrgContextService(self._db).resolve_company_and_branch(
            user_id=user.id,
            tenant_id=user.tenant_id,
            user_type=user.user_type,
        )
        session_payload: dict[str, str | None] = {
            "user_id": str(user.id),
            "tenant_id": str(user.tenant_id),
            "ip": ip_address,
            "user_agent": user_agent,
        }
        if company_id:
            session_payload["company_id"] = str(company_id)
        if branch_id:
            session_payload["branch_id"] = str(branch_id)
        self._store.set_session(session.id, session_payload)
        self._users.record_successful_login(user)
        self._audit.log_security_event(
            tenant_id=user.tenant_id,
            event_type="auth.login",
            user_id=user.id,
            ip_address=ip_address,
        )
        return {
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "bearer",
            "session_id": str(session.id),
        }
