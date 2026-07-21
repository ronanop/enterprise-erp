"""Authentication service."""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import UnauthorizedException
from core.redis import SessionStore
from modules.foundation.domain.exceptions import AccountLockedException, InvalidCredentialsException
from modules.foundation.models.security import SecUser
from modules.foundation.repository.session_repository import SessionRepository
from modules.foundation.repository.user_repository import UserRepository
from modules.foundation.service.audit_service import AuditService
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
