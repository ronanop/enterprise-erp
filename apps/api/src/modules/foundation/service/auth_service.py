"""Authentication service."""

import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import UnauthorizedException
from core.redis import SessionStore
from modules.foundation.domain.exceptions import AccountLockedException, InvalidCredentialsException
from modules.foundation.models.security import SecTenant, SecUser
from modules.foundation.repository.role_repository import RoleRepository
from modules.foundation.repository.session_repository import SessionRepository
from modules.foundation.repository.user_repository import UserRepository
from modules.foundation.service.audit_service import AuditService
from modules.foundation.service.microsoft_oauth_service import MicrosoftOAuthService
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
        domain = settings.microsoft_user_email_domain.strip().lower().lstrip("@")
        if domain and not email.endswith(f"@{domain}"):
            raise InvalidCredentialsException(
                f"Microsoft sign-in is limited to @{domain} accounts"
            )

        user = self._users.get_active_by_email(email)
        if user is None:
            user = self._provision_microsoft_user(email=email, display_name=display_name or email)

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

        return_to = stored.get("return_to") if isinstance(stored.get("return_to"), str) else "/"
        claims = oauth.exchange_authorization_code(code)
        email = MicrosoftOAuthService.email_from_claims(claims)
        if not email:
            raise InvalidCredentialsException("Microsoft account did not include an email address")

        tokens = self.login_with_microsoft(
            email=email,
            display_name=MicrosoftOAuthService.display_name_from_claims(claims, email),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        exchange_code = oauth.create_exchange_code()
        self._store.set_oauth_exchange(exchange_code, {**tokens, "return_to": return_to})
        return exchange_code, return_to

    def redeem_microsoft_exchange(self, exchange_code: str) -> dict:
        payload = self._store.pop_oauth_exchange(exchange_code)
        if payload is None:
            raise InvalidCredentialsException("Sign-in code expired or already used")
        return payload

    def _provision_microsoft_user(self, *, email: str, display_name: str) -> SecUser:
        tenant = self._db.scalars(
            select(SecTenant).where(
                SecTenant.is_deleted.is_(False),
                SecTenant.status == "active",
            )
        ).first()
        if tenant is None:
            raise InvalidCredentialsException(
                "No ERP tenant is available to link this Microsoft account"
            )

        is_platform_admin = email in settings.microsoft_platform_admin_email_set()
        user_type = "super_admin" if is_platform_admin else "employee"
        users = UserService(self._db)
        created = users.create_user(
            tenant_id=tenant.id,
            email=email,
            password=secrets.token_urlsafe(32) + "Aa1!",
            display_name=display_name,
            user_type=user_type,
            created_by=None,
        )
        role_code = "SUPER_ADMIN" if is_platform_admin else "TENANT_ADMIN"
        role = RoleRepository(self._db).get_by_code(tenant.id, role_code)
        if role is None and role_code != "SUPER_ADMIN":
            role = RoleRepository(self._db).get_by_code(tenant.id, "SUPER_ADMIN")
        if role is not None:
            users.assign_role(
                tenant_id=tenant.id,
                user_id=created.id,
                role_id=role.id,
                assigned_by=None,
            )
        user = self._db.get(SecUser, created.id)
        if user is None:
            raise InvalidCredentialsException("Failed to provision Microsoft account")
        return user

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
            user_type=user_model.user_type,
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

    def _issue_tokens(
        self,
        user: SecUser,
        *,
        ip_address: str | None,
        user_agent: str | None,
    ) -> dict:
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
            user_type=user.user_type,
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
        self._store.set_session(
            session.id,
            {
                "user_id": str(user.id),
                "tenant_id": str(user.tenant_id),
                "ip": ip_address,
                "user_agent": user_agent,
            },
        )
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
