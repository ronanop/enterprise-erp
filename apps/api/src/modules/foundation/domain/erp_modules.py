"""Assignable HRMS module keys (product is HRMS-only)."""

# Product module + nested permission prefixes unlocked by an `hr` assignment.
ERP_MODULE_KEYS: tuple[str, ...] = (
    "hr",
    "organization",
    "master-data",
    "payroll",
    "recruitment",
)

ERP_MODULE_KEY_SET = frozenset(ERP_MODULE_KEYS)

ADMIN_USER_TYPES = frozenset({"super_admin", "tenant_admin"})
ADMIN_ROLE_CODES = frozenset({"SUPER_ADMIN", "TENANT_ADMIN"})

MODULE_ROLE_ADMIN = "admin"
MODULE_ROLE_MEMBER = "member"
MODULE_ROLES = frozenset({MODULE_ROLE_ADMIN, MODULE_ROLE_MEMBER})

# Permission seed `module` column occasionally differs from UI/module-assignment keys.
PERMISSION_MODULE_ALIASES: dict[str, str] = {
    "master": "master-data",
}

# HRMS sidebar nests Org Setup / Payroll / Hire under the `hr` module assignment.
# Those APIs use organization.* / payroll.* / recruitment.* / master.* permission codes.
HRMS_NESTED_MODULE_KEYS = frozenset(
    {
        "organization",
        "payroll",
        "recruitment",
        "master-data",
    }
)


def module_member_roles(module_key: str) -> frozenset[str]:
    """Roles that may be assigned when adding a module user (excludes module admin)."""
    _ = module_key
    return frozenset({MODULE_ROLE_MEMBER})


def is_module_admin_role(role: str | None) -> bool:
    return (role or MODULE_ROLE_MEMBER) == MODULE_ROLE_ADMIN


def default_module_member_role(module_key: str) -> str:
    _ = module_key
    return MODULE_ROLE_MEMBER


def resolve_erp_module_key(module_or_permission_prefix: str) -> str | None:
    """Map a permission module / code prefix to an assignable module key."""
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


def assignment_module_keys_for_permission(permission_code: str) -> list[str]:
    """``sec_user_module`` keys that unlock this permission for non-role users.

    Direct module key first; HRMS assignees also unlock nested workspace modules.
    """
    key = module_key_for_permission_code(permission_code)
    if key is None:
        return []
    if key == "hr" or key in HRMS_NESTED_MODULE_KEYS:
        # Deduplicate while keeping stable order for tests / debugging.
        return list(dict.fromkeys([key, "hr"]))
    return [key]


def has_platform_module_access(user_type: str, role_codes: list[str] | None = None) -> bool:
    """Platform-wide access is driven by resolved user_type only."""
    _ = role_codes
    return user_type in ADMIN_USER_TYPES


def has_all_modules_admin(admin_assigned: list[str] | None) -> bool:
    """True when every product module is assigned as module-admin."""
    if not admin_assigned:
        return False
    return ERP_MODULE_KEY_SET.issubset({k for k in admin_assigned if k})


def resolve_session_user_type(
    stored_user_type: str,
    email: str = "",
    role_codes: list[str] | None = None,
) -> str:
    """Admin status comes from ``sec_user.user_type`` in the database."""
    _ = email, role_codes
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
