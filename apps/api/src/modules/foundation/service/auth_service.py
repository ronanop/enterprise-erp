"""Authentication service (ERP user id + password)."""

import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import UnauthorizedException
from core.redis import SessionStore
from modules.foundation.domain.exceptions import (
    AccountLockedException,
    InvalidCredentialsException,
    PasswordResetTokenInvalidException,
)
from modules.foundation.domain.erp_modules import ADMIN_USER_TYPES, resolve_session_user_type
from modules.foundation.models.security import SecRole, SecUser, SecUserRole
from modules.foundation.repository.session_repository import SessionRepository
from modules.foundation.repository.user_repository import UserRepository
from modules.foundation.service.audit_service import AuditService
from modules.master_data.models.employee import MasterEmployee
from modules.master_data.published import EmployeeRead
from modules.organization.models.company import OrgCompany
from security.ess_default_password import normalize_employee_code
from security.ess_login_captcha import verify_challenge
from security.field_crypto import pii_lookup
from security.jwt import JWTService
from security.password import PasswordHasher, validate_password_policy
from shared.text_safety import escape_html_text

logger = logging.getLogger(__name__)

# Users deactivated by HRMS sync (exited employees) cannot sign in.
BLOCKED_LOGIN_STATUSES = frozenset({"inactive"})

# Public ESS portal company codes → org company_code (ERP remains CDPL, etc.).
ESS_PORTAL_COMPANY_ALIASES: dict[str, str] = {
    "CDPL0112": "CDPL",
}

# Zero-width / BOM / NBSP often sneak in when copying credentials from HTML email.
_INVISIBLE_RE = re.compile(r"[\u200b\u200c\u200d\ufeff\u00a0]")


def _sanitize_login_text(value: str) -> str:
    text = _INVISIBLE_RE.sub("", value or "")
    # Fullwidth @ / digits sometimes appear after Outlook linkify + copy.
    text = text.replace("\uff20", "@").replace("＠", "@")
    return text.strip()


def _resolve_ess_company_code(company_code: str) -> str:
    code = _sanitize_login_text(company_code).upper()
    return ESS_PORTAL_COMPANY_ALIASES.get(code, code)


class AuthService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._users = UserRepository(db)
        self._sessions = SessionRepository(db)
        self._audit = AuditService(db)
        self._jwt = JWTService()
        self._store = SessionStore()

    def resolve_login_user(self, identifier: str) -> SecUser | None:
        """Resolve a sign-in id: work email, or an HRMS employee code linked to one login."""
        value = _sanitize_login_text(identifier)
        if not value:
            return None
        if "@" in value:
            return self._users.get_active_by_email(value)

        code = normalize_employee_code(value)
        if not code:
            return None
        rows = self._db.scalars(
            select(EmployeeRead.user_id).where(
                EmployeeRead.is_deleted.is_(False),
                EmployeeRead.user_id.is_not(None),
                func.upper(func.regexp_replace(EmployeeRead.employee_code, "[^A-Za-z0-9]", "", "g"))
                == code,
            )
        ).all()
        user_ids = {row for row in rows if row is not None}
        if len(user_ids) != 1:
            return None
        user = self._db.get(SecUser, next(iter(user_ids)))
        if user is None or user.is_deleted:
            return None
        return user

    def login(
        self,
        *,
        email: str,
        password: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> dict:
        import time

        from modules.platform.observability import log_path_metric

        started = time.perf_counter()
        success = False
        try:
            result = self._login_inner(
                identifier=email,
                password=password,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            success = True
            return result
        finally:
            log_path_metric(
                "auth.login",
                latency_ms=(time.perf_counter() - started) * 1000,
                success=success,
            )

    def _login_inner(
        self,
        *,
        identifier: str,
        password: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> dict:
        # Block well-known demo credentials unless explicitly allowed (VAPT 7.1.1).
        demo_password = "Secure1!"
        demo_emails = {
            "admin@example.com",
            "tenant.admin@example.com",
        }
        allow_demo = settings.allow_demo_login
        identifier = _sanitize_login_text(identifier)
        password = _sanitize_login_text(password)
        if (
            not allow_demo
            and identifier.lower() in demo_emails
            and password == demo_password
        ):
            self._audit.log_security_event(
                tenant_id=None,
                event_type="auth.demo_login_blocked",
                user_id=None,
                ip_address=ip_address,
            )
            raise InvalidCredentialsException()

        user = self.resolve_login_user(identifier)
        password_ok = bool(user) and PasswordHasher.verify_password(password, user.password_hash)
        # Temp-password email clients often linkify Cache@123; accept legacy typed temp against
        # either the stored legacy hash or the current default temp hash (migration window).
        if user is not None and not password_ok and user.must_change_password:
            from modules.foundation.service.user_service import DEFAULT_TEMPORARY_PASSWORD

            typed_temps = {
                DEFAULT_TEMPORARY_PASSWORD,
                "Cache@123",
                "cache@123",
                "CACHE@123",
            }
            if password in typed_temps:
                for stored in (DEFAULT_TEMPORARY_PASSWORD, "Cache@123"):
                    if PasswordHasher.verify_password(stored, user.password_hash):
                        password_ok = True
                        break
        if user is None or not password_ok:
            if user is not None:
                self._users.record_failed_login(user)
                if user.failed_login_count >= settings.account_lockout_threshold:
                    locked_until = datetime.now(timezone.utc) + timedelta(
                        minutes=settings.account_lockout_minutes
                    )
                    self._users.lock_account(user, locked_until)
            raise InvalidCredentialsException()

        if (
            not allow_demo
            and password == demo_password
            and user.email.lower() in demo_emails
        ):
            raise InvalidCredentialsException()

        if user.status in BLOCKED_LOGIN_STATUSES:
            raise InvalidCredentialsException("This account is inactive. Contact your ERP admin.")

        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            raise AccountLockedException()
        if user.status == "locked":
            user.status = "active"

        if user.mfa_enabled:
            challenge = self._jwt.create_access_token(
                user_id=user.id,
                tenant_id=user.tenant_id,
                user_type=user.user_type,
                session_id=uuid4(),
            )
            return {"mfa_required": True, "mfa_challenge_token": challenge}

        return self._issue_tokens(user, ip_address=ip_address, user_agent=user_agent)

    def lookup_ess_company(self, *, company_code: str) -> dict:
        """Public company check for the ESS login step-1 screen."""
        portal_code = _sanitize_login_text(company_code).upper()
        code = _resolve_ess_company_code(portal_code)
        if not code:
            raise InvalidCredentialsException("Enter a valid company code")
        company = self._db.scalar(
            select(OrgCompany).where(
                OrgCompany.company_code == code,
                OrgCompany.is_deleted.is_(False),
            )
        )
        if company is None:
            raise InvalidCredentialsException("Company code not found")
        # Echo the portal code users typed (e.g. CDPL0112), not the internal ERP code.
        return {
            "company_code": portal_code or company.company_code,
            "company_name": company.company_name,
        }

    def login_ess(
        self,
        *,
        company_code: str,
        email: str,
        password: str,
        captcha_id: str | None = None,
        captcha_answer: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> dict:
        """ESS sign-in: validated company + work email + password (default = code+DOB)."""
        if not verify_challenge(captcha_id, captcha_answer):
            raise InvalidCredentialsException("CAPTCHA verification failed")

        code = _resolve_ess_company_code(company_code)
        email_clean = _sanitize_login_text(email).lower()
        password = _sanitize_login_text(password)
        if not code or not email_clean or "@" not in email_clean:
            raise InvalidCredentialsException()

        company = self._db.scalar(
            select(OrgCompany).where(
                OrgCompany.company_code == code,
                OrgCompany.is_deleted.is_(False),
            )
        )
        if company is None:
            raise InvalidCredentialsException()

        email_key = pii_lookup(email_clean)
        employee: MasterEmployee | None = None
        if email_key:
            employee = self._db.scalar(
                select(MasterEmployee).where(
                    MasterEmployee.company_id == company.id,
                    MasterEmployee.email_lookup == email_key,
                    MasterEmployee.is_deleted.is_(False),
                )
            )

        # Fallback: resolve ERP user by email, then ensure they belong to this company.
        if employee is None:
            user_by_email = self._users.get_active_by_email(email_clean)
            if user_by_email is not None:
                employee = self._db.scalar(
                    select(MasterEmployee).where(
                        MasterEmployee.company_id == company.id,
                        MasterEmployee.user_id == user_by_email.id,
                        MasterEmployee.is_deleted.is_(False),
                    )
                )

        if employee is None:
            raise InvalidCredentialsException()

        from modules.hr.models import HrEmployeeProfile
        from security.ess_default_password import verify_ess_dob_password

        profile = self._db.scalar(
            select(HrEmployeeProfile).where(
                HrEmployeeProfile.employee_id == employee.id,
                HrEmployeeProfile.is_deleted.is_(False),
            )
        )

        user = self._db.get(SecUser, employee.user_id) if employee.user_id else None
        used_default_password = False

        password_valid = False
        if user and user.password_hash:
            password_valid = PasswordHasher.verify_password(password, user.password_hash)

        if not password_valid and profile and profile.date_of_birth:
            if verify_ess_dob_password(password, employee.employee_code, profile.date_of_birth):
                password_valid = True
                used_default_password = True
                display = f"{employee.first_name} {employee.last_name or ''}".strip()
                # Prefer the login email the employee typed (work mailbox).
                bind_email = email_clean
                if user is None:
                    user = SecUser(
                        tenant_id=employee.tenant_id,
                        email=bind_email,
                        display_name=display or bind_email,
                        user_type="employee",
                        status="active",
                        password_hash=PasswordHasher.hash_password(password, validate=False),
                        must_change_password=True,
                    )
                    self._db.add(user)
                    self._db.flush()
                    employee.user_id = user.id
                    self._db.flush()
                else:
                    user.password_hash = PasswordHasher.hash_password(password, validate=False)
                    user.must_change_password = True
                    self._db.flush()

        if user is None or user.is_deleted or not password_valid:
            if user:
                self._users.record_failed_login(user)
                if user.failed_login_count >= settings.account_lockout_threshold:
                    locked_until = datetime.now(timezone.utc) + timedelta(
                        minutes=settings.account_lockout_minutes
                    )
                    self._users.lock_account(user, locked_until)
            raise InvalidCredentialsException()

        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            raise AccountLockedException(
                "Account is temporarily locked. Try again later or contact HR."
            )

        if user.status in BLOCKED_LOGIN_STATUSES:
            raise InvalidCredentialsException("This account is inactive. Contact HR.")

        # Default ESS password (employee code + DOB) always requires a change.
        if used_default_password:
            user.must_change_password = True
            self._db.flush()

        if user.mfa_enabled:
            challenge = self._jwt.create_access_token(
                user_id=user.id,
                tenant_id=user.tenant_id,
                user_type=user.user_type,
                session_id=uuid4(),
            )
            return {
                "mfa_required": True,
                "mfa_challenge_token": challenge,
                "must_change_password": bool(user.must_change_password),
            }

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

        user = self.resolve_login_user(email)
        if user is None or not user.mfa_enabled or not user.mfa_secret_encrypted:
            raise InvalidCredentialsException()
        totp = pyotp.TOTP(user.mfa_secret_encrypted)
        if not totp.verify(otp, valid_window=1):
            raise InvalidCredentialsException()
        return self._issue_tokens(user, ip_address=ip_address, user_agent=user_agent)

    # -- password lifecycle -------------------------------------------------

    def request_password_reset(self, *, identifier: str, ip_address: str | None = None) -> None:
        """Start a reset without revealing whether the account exists."""
        user = self.resolve_login_user(identifier)
        if user is None or user.status in BLOCKED_LOGIN_STATUSES:
            self._audit.log_security_event(
                tenant_id=None,
                event_type="auth.password_reset_unknown",
                user_id=None,
                ip_address=ip_address,
            )
            return

        token = secrets.token_urlsafe(32)
        minutes = max(5, int(settings.password_reset_token_minutes or 30))
        self._store.set_password_reset(token, user.id, ttl_seconds=minutes * 60)
        reset_url = f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}"
        self._audit.log_security_event(
            tenant_id=user.tenant_id,
            event_type="auth.password_reset_requested",
            user_id=user.id,
            ip_address=ip_address,
        )
        self._send_reset_email(user, reset_url, minutes)
        self._notify_erp_admins_of_reset(user)

    def _send_reset_email(self, user: SecUser, reset_url: str, minutes: int) -> None:
        from modules.foundation.service.notification_service import NotificationService

        if not settings.smtp_configured:
            logger.info("Password reset requested for %s but SMTP is not configured", user.email)
            return
        name = escape_html_text(user.display_name or user.email)
        link = escape_html_text(reset_url)
        body = (
            f"<p>Hello {name},</p>"
            "<p>We received a request to reset your iConnect Plus password.</p>"
            f'<p><a href="{link}">Reset your password</a></p>'
            f"<p>This link expires in {minutes} minutes. If you did not request this, ignore this email.</p>"
        )
        try:
            NotificationService(self._db).send_email(
                tenant_id=user.tenant_id,
                to_address=user.email,
                subject="Reset your iConnect Plus password",
                body_html=body,
                event_type="auth.password_reset",
                created_by=user.id,
            )
        except Exception as exc:  # noqa: BLE001 - reset request must not leak delivery errors
            logger.warning("Password reset email failed for %s: %s", user.email, exc)

    def _notify_erp_admins_of_reset(self, user: SecUser) -> None:
        """In-app heads-up so an ERP admin can issue a temporary password when mail is off."""
        from modules.platform.compat.notify_facade import PlatformNotifyFacade

        if user.user_type in ADMIN_USER_TYPES:
            return
        admins = self._db.scalars(
            select(SecUser).where(
                SecUser.tenant_id == user.tenant_id,
                SecUser.is_deleted.is_(False),
                SecUser.status == "active",
                SecUser.user_type.in_(tuple(ADMIN_USER_TYPES)),
                SecUser.id != user.id,
            )
        ).all()
        if not admins:
            return
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
        for admin in admins:
            try:
                PlatformNotifyFacade(self._db).send(
                    tenant_id=user.tenant_id,
                    template_code="auth.password_reset_requested",
                    event_type="auth.password_reset_requested",
                    recipient_user_id=admin.id,
                    payload_json={
                        "title": "Password reset requested",
                        "body": (
                            f"{user.display_name or user.email} ({user.email}) asked to reset their "
                            "password. Issue a temporary password from Organization → Users if "
                            "they cannot receive email."
                        ),
                        "kind": "auth_password_reset_requested",
                        "entity_type": "sec_user",
                        "entity_id": str(user.id),
                        "href": "/organization/users",
                    },
                    created_by=user.id,
                    channel="in_app",
                    idempotency_key=f"auth:reset:{user.id}:{admin.id}:{stamp}",
                    aggregate_id=user.id,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Could not notify ERP admin about reset: %s", exc)

    def _set_password(self, user: SecUser, new_password: str, *, must_change: bool) -> None:
        validate_password_policy(new_password)
        user.password_hash = PasswordHasher.hash_password(new_password, validate=False)
        user.must_change_password = must_change
        user.failed_login_count = 0
        user.locked_until = None
        if user.status == "locked":
            user.status = "active"
        self._db.flush()

    def reset_password(self, *, token: str, new_password: str) -> None:
        user_id = self._store.pop_password_reset(token)
        user = self._db.get(SecUser, user_id) if user_id else None
        if user is None or user.is_deleted or user.status in BLOCKED_LOGIN_STATUSES:
            raise PasswordResetTokenInvalidException()
        self._set_password(user, new_password, must_change=False)
        self._sessions.revoke_all_for_user(user.tenant_id, user.id, revoked_by=user.id)
        self._audit.log_security_event(
            tenant_id=user.tenant_id,
            event_type="auth.password_reset_completed",
            user_id=user.id,
        )

    def change_password(self, *, user_id: UUID, current_password: str, new_password: str) -> None:
        user = self._db.get(SecUser, user_id)
        if user is None or user.is_deleted:
            raise UnauthorizedException("User not found")
        current_password = _sanitize_login_text(current_password)
        current_ok = PasswordHasher.verify_password(current_password, user.password_hash)
        # Same temp-password migration window as login (legacy Cache@123 vs CacheDigi#123).
        if not current_ok and user.must_change_password:
            from modules.foundation.service.user_service import DEFAULT_TEMPORARY_PASSWORD

            typed_temps = {
                DEFAULT_TEMPORARY_PASSWORD,
                "Cache@123",
                "cache@123",
                "CACHE@123",
            }
            if current_password in typed_temps:
                for stored in (DEFAULT_TEMPORARY_PASSWORD, "Cache@123"):
                    if PasswordHasher.verify_password(stored, user.password_hash):
                        current_ok = True
                        break
        if not current_ok:
            raise InvalidCredentialsException("Current password is incorrect")
        if current_password == new_password:
            raise InvalidCredentialsException("Choose a password you have not used just now")
        self._set_password(user, new_password, must_change=False)
        self._audit.log_security_event(
            tenant_id=user.tenant_id,
            event_type="auth.password_changed",
            user_id=user.id,
        )

    # -- sessions -----------------------------------------------------------

    def refresh(
        self,
        refresh_token: str,
        *,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> dict:
        payload = self._jwt.decode_token(refresh_token, expected_type="refresh")
        stored = self._sessions.get_refresh_token(refresh_token)
        if stored is None:
            # Refresh-token reuse: a previously rotated token presented again → kill family.
            if settings.refresh_reuse_detection:
                prior = self._sessions.get_refresh_token_any(refresh_token)
                if prior is not None and prior.revoked_at is not None:
                    self._sessions.revoke(prior.session_id, revoked_by=UUID(payload["sub"]))
                    self._sessions.revoke_all_refresh_for_session(prior.session_id)
                    self._store.delete_session(prior.session_id)
                    self._audit.log_security_event(
                        tenant_id=prior.tenant_id,
                        event_type="auth.refresh_reuse",
                        user_id=prior.user_id,
                    )
            raise UnauthorizedException("Refresh token revoked or invalid")

        user_id = UUID(payload["sub"])
        session_id = UUID(payload["session_id"])
        session = self._sessions.get_active(session_id)
        if session is None:
            raise UnauthorizedException("Session expired or revoked")

        # Session-to-client binding (VAPT 7.1.6) — reject replay from mismatched clients.
        if settings.session_bind_user_agent:
            issued_ua = (session.user_agent or "").strip()
            current_ua = (user_agent or "").strip()
            if issued_ua and current_ua and issued_ua != current_ua:
                self._sessions.revoke(session_id, revoked_by=user_id)
                self._store.delete_session(session_id)
                raise UnauthorizedException("Session binding mismatch — please sign in again")
        if settings.session_bind_ip:
            issued_ip = (session.ip_address or "").strip()
            current_ip = (ip_address or "").strip()
            if issued_ip and current_ip and issued_ip != current_ip:
                self._sessions.revoke(session_id, revoked_by=user_id)
                self._store.delete_session(session_id)
                raise UnauthorizedException("Session binding mismatch — please sign in again")

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
            "session_id": str(session_id),
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
        return resolve_session_user_type(
            user.user_type,
            user.email,
            self._role_codes_for_user(user.id),
        )

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
            "must_change_password": bool(getattr(user, "must_change_password", False)),
        }
