"""Assignable ERP module keys (mirrors apps/web/src/config/modules.ts top-level keys)."""

ERP_MODULE_KEYS: tuple[str, ...] = (
    "foundation",
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
)

ERP_MODULE_KEY_SET = frozenset(ERP_MODULE_KEYS)

ADMIN_USER_TYPES = frozenset({"super_admin", "tenant_admin"})


def effective_module_keys(user_type: str, assigned: list[str]) -> list[str]:
    if user_type in ADMIN_USER_TYPES:
        return list(ERP_MODULE_KEYS)
    return sorted({k for k in assigned if k in ERP_MODULE_KEY_SET})
