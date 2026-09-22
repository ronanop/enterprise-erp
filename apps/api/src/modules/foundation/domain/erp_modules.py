"""Assignable ERP module keys (mirrors apps/web/src/config/modules.ts top-level keys)."""

ERP_MODULE_KEYS: tuple[str, ...] = (
    "foundation",
    "email",
    "voice-agent",
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

# Marketing team roles (stored on sec_user_module.role for module_key=marketing).
# Work-structure permissions will layer on these later.
MARKETING_ROLE_HEAD = "marketing_head"
MARKETING_ROLE_APPROVAL_HEAD = "approval_head"
MARKETING_ROLE_CONTENT_CREATOR = "content_creator"
MARKETING_ROLE_VIDEO_EDITOR = "video_editor"
MARKETING_ROLE_GRAPHIC_DESIGNER = "graphic_designer"
MARKETING_ROLE_SUPPORTING_MEMBER = "supporting_member"
MARKETING_TEAM_ROLES = frozenset(
    {
        MARKETING_ROLE_HEAD,
        MARKETING_ROLE_APPROVAL_HEAD,
        MARKETING_ROLE_CONTENT_CREATOR,
        MARKETING_ROLE_VIDEO_EDITOR,
        MARKETING_ROLE_GRAPHIC_DESIGNER,
        MARKETING_ROLE_SUPPORTING_MEMBER,
        MODULE_ROLE_ADMIN,
        MODULE_ROLE_MEMBER,
    }
)

MARKETING_FUNCTIONAL_ROLES: tuple[tuple[str, str], ...] = (
    (MARKETING_ROLE_HEAD, "Marketing head"),
    (MARKETING_ROLE_VIDEO_EDITOR, "Video editor"),
    (MARKETING_ROLE_GRAPHIC_DESIGNER, "Graphic designer"),
    (MARKETING_ROLE_CONTENT_CREATOR, "Content creator"),
    (MARKETING_ROLE_APPROVAL_HEAD, "Approval head"),
    (MARKETING_ROLE_SUPPORTING_MEMBER, "Supporting member"),
)
MARKETING_FUNCTIONAL_ROLE_SET = frozenset(code for code, _ in MARKETING_FUNCTIONAL_ROLES)
MARKETING_FUNCTIONAL_ROLE_LABELS = dict(MARKETING_FUNCTIONAL_ROLES)


def module_member_roles(module_key: str) -> frozenset[str]:
    """Roles that may be assigned when adding a module user (excludes module admin)."""
    if module_key == "marketing":
        return MARKETING_FUNCTIONAL_ROLE_SET | {MODULE_ROLE_MEMBER}
    return frozenset({MODULE_ROLE_MEMBER})


def is_module_admin_role(role: str | None) -> bool:
    return (role or MODULE_ROLE_MEMBER) == MODULE_ROLE_ADMIN


def default_module_member_role(module_key: str) -> str:
    if module_key == "marketing":
        return MARKETING_ROLE_SUPPORTING_MEMBER
    return MODULE_ROLE_MEMBER

# Permission seed `module` column occasionally differs from UI/module-assignment keys.
PERMISSION_MODULE_ALIASES: dict[str, str] = {
    "project": "projects",
    "asset": "assets",
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
    """ERP-wide access is driven by resolved user_type only (not SUPER_ADMIN role alone)."""
    _ = role_codes
    return user_type in ADMIN_USER_TYPES


def has_all_modules_admin(admin_assigned: list[str] | None) -> bool:
    """True when every ERP module is assigned as module-admin (All modules entitlement)."""
    if not admin_assigned:
        return False
    return ERP_MODULE_KEY_SET.issubset({k for k in admin_assigned if k})


def resolve_session_user_type(
    stored_user_type: str,
    email: str,
    role_codes: list[str] | None = None,
    *,
    platform_admin_emails: set[str] | None = None,
) -> str:
    """Only allowlisted platform emails are ERP admins (super_admin).

    SUPER_ADMIN / TENANT_ADMIN roles and stored admin user_types do not elevate
    non-allowlisted users - those accounts use per-module (or All modules) grants.
    """
    _ = role_codes
    email_l = (email or "").strip().lower()
    if platform_admin_emails and email_l in platform_admin_emails:
        return "super_admin"
    if stored_user_type in ADMIN_USER_TYPES:
        return "employee"
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
