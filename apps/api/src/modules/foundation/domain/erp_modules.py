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
    "assets-it",
    "assets-non-it",
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

# Parent shell key + IT / Non-IT assignable submodules (Organization → Users).
ASSET_MODULE_KEY = "assets"
ASSET_IT_MODULE_KEY = "assets-it"
ASSET_NON_IT_MODULE_KEY = "assets-non-it"
ASSET_SUBMODULE_KEYS = frozenset({ASSET_IT_MODULE_KEY, ASSET_NON_IT_MODULE_KEY})
ASSET_DOMAIN_BY_MODULE_KEY: dict[str, str] = {
    ASSET_IT_MODULE_KEY: "IT",
    ASSET_NON_IT_MODULE_KEY: "NON_IT",
}
# Parent is granted via sync / legacy; not offered in the Org Users module picker.
ASSET_PARENT_HIDDEN_FROM_ASSIGN = frozenset({ASSET_MODULE_KEY})

ERP_MODULE_KEY_SET = frozenset(ERP_MODULE_KEYS)

ADMIN_USER_TYPES = frozenset({"super_admin", "tenant_admin"})
ADMIN_ROLE_CODES = frozenset({"SUPER_ADMIN", "TENANT_ADMIN"})

MODULE_ROLE_ADMIN = "admin"
MODULE_ROLE_MEMBER = "member"
MODULE_ROLES = frozenset({MODULE_ROLE_ADMIN, MODULE_ROLE_MEMBER})

# Marketing team roles (stored on sec_user_module.role for module_key=marketing).
# Work-structure permissions will layer on these later.
MARKETING_ROLE_HEAD = "marketing_head"
MARKETING_ROLE_ASSOCIATE = "marketing_associate"
MARKETING_ROLE_APPROVAL_HEAD = "approval_head"
MARKETING_ROLE_CONTENT_CREATOR = "content_creator"
MARKETING_ROLE_VIDEO_EDITOR = "video_editor"
MARKETING_ROLE_GRAPHIC_DESIGNER = "graphic_designer"
MARKETING_ROLE_SUPPORTING_MEMBER = "supporting_member"
MARKETING_TEAM_ROLES = frozenset(
    {
        MARKETING_ROLE_HEAD,
        MARKETING_ROLE_ASSOCIATE,
        MARKETING_ROLE_APPROVAL_HEAD,
        MARKETING_ROLE_CONTENT_CREATOR,
        MARKETING_ROLE_VIDEO_EDITOR,
        MARKETING_ROLE_GRAPHIC_DESIGNER,
        MARKETING_ROLE_SUPPORTING_MEMBER,
        MODULE_ROLE_ADMIN,
        MODULE_ROLE_MEMBER,
    }
)

# Head + associate (+ legacy content_creator) can plan events/channel work.
MARKETING_PLANNER_ROLES = frozenset(
    {
        MARKETING_ROLE_HEAD,
        MARKETING_ROLE_ASSOCIATE,
        MARKETING_ROLE_CONTENT_CREATOR,
    }
)

MARKETING_FUNCTIONAL_ROLES: tuple[tuple[str, str], ...] = (
    (MARKETING_ROLE_HEAD, "Marketing head"),
    (MARKETING_ROLE_ASSOCIATE, "Marketing associate"),
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
    "master": "master-data",
}


def asset_domain_for_module_key(module_key: str) -> str | None:
    """Map assets-it / assets-non-it to IT / NON_IT domain codes."""
    return ASSET_DOMAIN_BY_MODULE_KEY.get((module_key or "").strip().lower())


def expand_asset_module_keys(keys: set[str], *, for_admin: bool = False) -> set[str]:
    """Expand legacy ``assets`` and IT/Non-IT submodules for effective access.

    - Legacy parent-only → both submodules (full Assets access).
    - Member/assigned: either submodule → parent ``assets`` (shell + permission unlock).
    - Admin: submodule admin does **not** elevate to parent admin; parent is only
      implied when both IT and Non-IT are admin. Leftover parent+one-submodule
      drops the parent from the effective admin set so the other domain stays closed.
    """
    out = {k for k in keys if k}
    has_parent = ASSET_MODULE_KEY in out
    has_subs = bool(out & ASSET_SUBMODULE_KEYS)
    if has_parent and not has_subs:
        out |= ASSET_SUBMODULE_KEYS
    if for_admin:
        if ASSET_SUBMODULE_KEYS.issubset(out):
            out.add(ASSET_MODULE_KEY)
        elif has_parent and has_subs and not ASSET_SUBMODULE_KEYS.issubset(out):
            out.discard(ASSET_MODULE_KEY)
        return out
    if out & ASSET_SUBMODULE_KEYS:
        out.add(ASSET_MODULE_KEY)
    return out

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


def assignment_module_keys_for_permission(permission_code: str) -> list[str]:
    """``sec_user_module`` keys that unlock this permission for non-role users.

    Direct module key first; HRMS assignees also unlock nested workspace modules.
    Assets Configuration → Departments manages ``organization.department:*``.
    Asset APIs unlock for parent ``assets`` or either IT / Non-IT submodule.
    """
    key = module_key_for_permission_code(permission_code)
    if key is None:
        return []
    keys: list[str] = [key]
    if key == "hr" or key in HRMS_NESTED_MODULE_KEYS:
        # Deduplicate while keeping stable order for tests / debugging.
        keys = list(dict.fromkeys([*keys, "hr"]))
    if key == ASSET_MODULE_KEY:
        keys = list(
            dict.fromkeys([*keys, ASSET_IT_MODULE_KEY, ASSET_NON_IT_MODULE_KEY])
        )
    if permission_code.startswith("organization.department:"):
        keys = list(
            dict.fromkeys(
                [*keys, ASSET_MODULE_KEY, ASSET_IT_MODULE_KEY, ASSET_NON_IT_MODULE_KEY]
            )
        )
    return keys


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
    email: str = "",
    role_codes: list[str] | None = None,
) -> str:
    """ERP admin status comes from ``sec_user.user_type`` in the database.

    Promote or demote via Organization → Users / ``bootstrap_erp_admin`` — not env.
    """
    _ = email, role_codes
    return stored_user_type


def effective_module_keys(
    user_type: str,
    assigned: list[str],
    role_codes: list[str] | None = None,
) -> list[str]:
    if has_platform_module_access(user_type, role_codes):
        return list(ERP_MODULE_KEYS)
    raw = {k for k in assigned if k in ERP_MODULE_KEY_SET}
    return sorted(expand_asset_module_keys(raw, for_admin=False))


def effective_admin_module_keys(
    user_type: str,
    admin_assigned: list[str],
    role_codes: list[str] | None = None,
) -> list[str]:
    if has_platform_module_access(user_type, role_codes):
        return list(ERP_MODULE_KEYS)
    raw = {k for k in admin_assigned if k in ERP_MODULE_KEY_SET}
    return sorted(expand_asset_module_keys(raw, for_admin=True))
