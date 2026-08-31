"""Assignable ERP module keys (mirrors apps/web/src/config/modules.ts top-level keys)."""

ERP_MODULE_KEYS: tuple[str, ...] = (
    "foundation",
    "email",
    "organization",
    "master-data",
    "finance",
    "sales",
    "procurement",
    "inventory",
    "manufacturing",
    "quality",
    "crm",
    "hr",
    "payroll",
    "recruitment",
    "projects",
    "assets",
    "service",
    "helpdesk",
    "documents",
    "grc",
    "analytics",
    "integration",
    "ecommerce",
    "portal",
    "marketing",
)

ERP_MODULE_KEY_SET = frozenset(ERP_MODULE_KEYS)

ADMIN_USER_TYPES = frozenset({"super_admin", "tenant_admin"})
ADMIN_ROLE_CODES = frozenset({"SUPER_ADMIN", "TENANT_ADMIN"})

MODULE_ROLE_ADMIN = "admin"
MODULE_ROLE_MEMBER = "member"
MODULE_ROLES = frozenset({MODULE_ROLE_ADMIN, MODULE_ROLE_MEMBER})

# Permission seed `module` column occasionally differs from UI/module-assignment keys.
PERMISSION_MODULE_ALIASES: dict[str, str] = {
    "project": "projects",
}


def resolve_erp_module_key(module_or_permission_prefix: str) -> str | None:
    """Map a permission module / code prefix to an assignable ERP module key."""
    raw = (module_or_permission_prefix or "").strip().lower()
    if not raw:
        return None
    aliased = PERMISSION_MODULE_ALIASES.get(raw, raw)
    if aliased in ERP_MODULE_KEY_SET:
        return aliased
    return None


def module_key_for_permission_code(permission_code: str) -> str | None:
    """Best-effort module key from `module.resource:action` permission codes."""
    head = permission_code.split(".", 1)[0].strip().lower()
    return resolve_erp_module_key(head)


def has_platform_module_access(user_type: str, role_codes: list[str] | None = None) -> bool:
    if user_type in ADMIN_USER_TYPES:
        return True
    codes = {c.upper() for c in (role_codes or [])}
    return bool(ADMIN_ROLE_CODES & codes)


def resolve_session_user_type(
    stored_user_type: str,
    email: str,
    role_codes: list[str] | None = None,
    *,
    platform_admin_emails: set[str] | None = None,
) -> str:
    """Entra sync often assigns TENANT_ADMIN while leaving user_type as employee."""
    if platform_admin_emails and email.lower() in platform_admin_emails:
        return "super_admin"
    if stored_user_type in ADMIN_USER_TYPES:
        return stored_user_type
    codes = {c.upper() for c in (role_codes or [])}
    if "SUPER_ADMIN" in codes:
        return "super_admin"
    if "TENANT_ADMIN" in codes:
        return "tenant_admin"
    return stored_user_type


def effective_module_keys(
    user_type: str,
    assigned: list[str],
    role_codes: list[str] | None = None,
) -> list[str]:
    if has_platform_module_access(user_type, role_codes):
        return list(ERP_MODULE_KEYS)
    return sorted({k for k in assigned if k in ERP_MODULE_KEY_SET})


def effective_admin_module_keys(
    user_type: str,
    admin_assigned: list[str],
    role_codes: list[str] | None = None,
) -> list[str]:
    if has_platform_module_access(user_type, role_codes):
        return list(ERP_MODULE_KEYS)
    return sorted({k for k in admin_assigned if k in ERP_MODULE_KEY_SET})
