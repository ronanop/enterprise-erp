"""SMTP emails when Organization assigns module access (welcome + grant notice)."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from core.config import get_settings
from modules.foundation.domain.erp_modules import MODULE_ROLE_ADMIN
from modules.foundation.models.security import SecUser
from modules.foundation.service.engines.email_delivery_engine import render_template
from modules.foundation.service.notification_service import NotificationService
from modules.foundation.service.user_service import DEFAULT_TEMPORARY_PASSWORD

logger = logging.getLogger(__name__)

_SIGNATURE = (
    "<p>Thanks And Regards,</p>"
    "<p><strong>iConnect Plus ERP</strong><br/>"
    "Cache Technologies / Cache Digitech Pvt. Ltd.<br/>"
    '<a href="https://www.cachedigitech.com">www.cachedigitech.com</a></p>'
)

_SHELL_OPEN = (
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;'
    'line-height:1.5;color:#1a1a1a;max-width:640px;">'
)
_SHELL_CLOSE = "</div>"

MODULE_TITLES: dict[str, str] = {
    "foundation": "Foundation",
    "email": "Email",
    "voice-agent": "Voice assistant",
    "organization": "Organization",
    "master-data": "Master Data",
    "finance": "Finance",
    "sales": "Sales",
    "procurement": "Procurement",
    "inventory": "Inventory",
    "manufacturing": "Manufacturing",
    "quality": "Quality",
    "crm": "CRM",
    "hr": "HR",
    "payroll": "Payroll",
    "recruitment": "Recruitment",
    "projects": "Projects",
    "assets": "Assets",
    "service": "Service",
    "helpdesk": "Helpdesk",
    "documents": "Documents",
    "grc": "GRC",
    "analytics": "Analytics",
    "integration": "Integration",
    "ecommerce": "E-commerce",
    "portal": "Portal",
    "marketing": "Marketing",
}

TEMPLATES: dict[str, tuple[str, str, str]] = {
    "org.email.module_assigned": (
        "Organization — module access granted",
        "Module access granted – {{module_name}}",
        _SHELL_OPEN
        + "<p>Hello {{user_name}},</p>"
        + "<p>You have been given access to <strong>{{module_name}}</strong> "
        + "on iConnect Plus ERP as <strong>{{role_label}}</strong>.</p>"
        + "<p>Sign in at: <a href=\"{{login_url}}\">{{login_url}}</a></p>"
        + "<p>Use your work email: <strong>{{user_email}}</strong></p>"
        + _SIGNATURE
        + _SHELL_CLOSE,
    ),
    "org.email.welcome": (
        "Organization — welcome to iConnect Plus",
        "Welcome to iConnect Plus ERP – {{module_name}}",
        _SHELL_OPEN
        + "<p>Hello {{user_name}},</p>"
        + "<p>Welcome to <strong>iConnect Plus ERP</strong>.</p>"
        + "<p>You have been onboarded with access to "
        + "<strong>{{module_name}}</strong> as <strong>{{role_label}}</strong>.</p>"
        + "<p><strong>Sign in</strong></p>"
        + "<ul>"
        + "<li>URL: <a href=\"{{login_url}}\">{{login_url}}</a></li>"
        + "<li>Email: <strong>{{user_email}}</strong></li>"
        + "<li>Temporary password: "
        + '<code style="font-size:15px;letter-spacing:0.02em;user-select:all;'
        + 'background:#f4f4f5;padding:2px 6px;border-radius:4px;">{{temporary_password}}</code></li>'
        + "</ul>"
        + "<p>Type the password exactly (it is case-sensitive). "
        + "You will be asked to change it on first sign-in.</p>"
        + _SIGNATURE
        + _SHELL_CLOSE,
    ),
    "org.email.temporary_password": (
        "Organization — temporary password issued",
        "Your iConnect Plus temporary password",
        _SHELL_OPEN
        + "<p>Hello {{user_name}},</p>"
        + "<p>An ERP administrator reset your iConnect Plus password.</p>"
        + "<ul>"
        + "<li>URL: <a href=\"{{login_url}}\">{{login_url}}</a></li>"
        + "<li>Email: <strong>{{user_email}}</strong></li>"
        + "<li>Temporary password: "
        + '<code style="font-size:15px;letter-spacing:0.02em;user-select:all;'
        + 'background:#f4f4f5;padding:2px 6px;border-radius:4px;">{{temporary_password}}</code></li>'
        + "</ul>"
        + "<p>Type the password exactly (it is case-sensitive), then change it after sign-in.</p>"
        + _SIGNATURE
        + _SHELL_CLOSE,
    ),
}


def module_display_name(module_key: str) -> str:
    key = (module_key or "").strip()
    if key == "*":
        return "All modules"
    return MODULE_TITLES.get(key, key.replace("-", " ").title() or "ERP")


def modules_display_name(module_keys: list[str] | tuple[str, ...] | str | None) -> str:
    """Single label for one or many modules (for one combined access email)."""
    if isinstance(module_keys, str):
        keys = [module_keys]
    else:
        keys = [k for k in (module_keys or []) if (k or "").strip()]
    if not keys:
        return "ERP"
    if any((k or "").strip() == "*" for k in keys) or len(keys) >= len(MODULE_TITLES):
        return "All modules"
    names = [module_display_name(k) for k in keys]
    # Preserve order, drop duplicates
    seen: set[str] = set()
    ordered: list[str] = []
    for name in names:
        if name in seen:
            continue
        seen.add(name)
        ordered.append(name)
    if len(ordered) == 1:
        return ordered[0]
    if len(ordered) == 2:
        return f"{ordered[0]} and {ordered[1]}"
    return f"{', '.join(ordered[:-1])}, and {ordered[-1]}"


def role_display_name(role: str) -> str:
    return "Admin" if role == MODULE_ROLE_ADMIN else "User"


def login_url() -> str:
    return f"{get_settings().frontend_url.rstrip('/')}/login"


class OrgAccessEmailService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._notif = NotificationService(db)

    def _ensure(self, tenant_id: UUID, code: str, created_by: UUID | None):
        name, subject, body = TEMPLATES[code]
        return self._notif.get_or_create_template(
            tenant_id=tenant_id,
            template_code=code,
            template_name=name,
            channel="email",
            subject_template=subject,
            body_template=body,
            created_by=created_by,
        )

    def _send(
        self,
        *,
        tenant_id: UUID,
        user: SecUser,
        template_code: str,
        event_type: str,
        payload: dict,
        created_by: UUID | None,
    ) -> bool:
        email = (user.email or "").strip()
        if not email:
            return False
        try:
            tpl = self._ensure(tenant_id, template_code, created_by)
            enriched = dict(payload)
            enriched.setdefault("_subject", render_template(tpl.subject_template, enriched) or template_code)
            enriched.setdefault("_body", render_template(tpl.body_template, enriched))
            self._notif.send(
                tenant_id=tenant_id,
                template_id=tpl.id,
                event_type=event_type,
                recipient_user_id=user.id,
                recipient_address=email,
                payload_json=enriched,
                created_by=created_by,
                channel_override="email",
            )
            return True
        except Exception:  # noqa: BLE001
            logger.exception("Org access email failed template=%s to=%s", template_code, email)
            return False

    def notify_module_assigned(
        self,
        *,
        tenant_id: UUID,
        user: SecUser,
        module_key: str | None = None,
        module_keys: list[str] | None = None,
        role: str,
        created_by: UUID | None,
    ) -> bool:
        keys = list(module_keys or [])
        if module_key:
            keys.append(module_key)
        return self._send(
            tenant_id=tenant_id,
            user=user,
            template_code="org.email.module_assigned",
            event_type="org.email.module_assigned",
            payload={
                "user_name": (user.display_name or user.email or "there").strip(),
                "user_email": user.email,
                "module_name": modules_display_name(keys),
                "role_label": role_display_name(role),
                "login_url": login_url(),
            },
            created_by=created_by,
        )

    def notify_welcome(
        self,
        *,
        tenant_id: UUID,
        user: SecUser,
        module_key: str | None = None,
        module_keys: list[str] | None = None,
        role: str,
        temporary_password: str,
        created_by: UUID | None,
    ) -> bool:
        keys = list(module_keys or [])
        if module_key:
            keys.append(module_key)
        return self._send(
            tenant_id=tenant_id,
            user=user,
            template_code="org.email.welcome",
            event_type="org.email.welcome",
            payload={
                "user_name": (user.display_name or user.email or "there").strip(),
                "user_email": user.email,
                "module_name": modules_display_name(keys),
                "role_label": role_display_name(role),
                "temporary_password": temporary_password or DEFAULT_TEMPORARY_PASSWORD,
                "login_url": login_url(),
            },
            created_by=created_by,
        )

    def notify_temporary_password(
        self,
        *,
        tenant_id: UUID,
        user: SecUser,
        temporary_password: str,
        created_by: UUID | None,
    ) -> bool:
        return self._send(
            tenant_id=tenant_id,
            user=user,
            template_code="org.email.temporary_password",
            event_type="org.email.temporary_password",
            payload={
                "user_name": (user.display_name or user.email or "there").strip(),
                "user_email": user.email,
                "temporary_password": temporary_password or DEFAULT_TEMPORARY_PASSWORD,
                "login_url": login_url(),
            },
            created_by=created_by,
        )
