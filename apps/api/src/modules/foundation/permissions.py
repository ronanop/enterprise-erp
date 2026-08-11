"""Foundation permission constants."""

FOUNDATION_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("foundation.tenant:read", "foundation.tenant", "read", "foundation"),
    ("foundation.tenant:create", "foundation.tenant", "create", "foundation"),
    ("foundation.tenant:update", "foundation.tenant", "update", "foundation"),
    ("foundation.tenant:delete", "foundation.tenant", "delete", "foundation"),
    ("foundation.user:read", "foundation.user", "read", "foundation"),
    ("foundation.user:create", "foundation.user", "create", "foundation"),
    ("foundation.user:update", "foundation.user", "update", "foundation"),
    ("foundation.user:delete", "foundation.user", "delete", "foundation"),
    ("foundation.role:read", "foundation.role", "read", "foundation"),
    ("foundation.role:create", "foundation.role", "create", "foundation"),
    ("foundation.role:update", "foundation.role", "update", "foundation"),
    ("foundation.role:delete", "foundation.role", "delete", "foundation"),
    ("foundation.permission:read", "foundation.permission", "read", "foundation"),
    ("foundation.workflow:read", "foundation.workflow", "read", "foundation"),
    ("foundation.workflow:create", "foundation.workflow", "create", "foundation"),
    ("foundation.workflow:update", "foundation.workflow", "update", "foundation"),
    ("foundation.workflow:approve", "foundation.workflow", "approve", "foundation"),
    ("foundation.notification:read", "foundation.notification", "read", "foundation"),
    ("foundation.notification:create", "foundation.notification", "create", "foundation"),
    ("foundation.notification:update", "foundation.notification", "update", "foundation"),
    ("foundation.audit:read", "foundation.audit", "read", "foundation"),
    ("foundation.setting:read", "foundation.setting", "read", "foundation"),
    ("foundation.setting:update", "foundation.setting", "update", "foundation"),
    ("foundation.setting:delete", "foundation.setting", "delete", "foundation"),
]

SYSTEM_ROLE_CODES = ("SUPER_ADMIN", "TENANT_ADMIN")

# Checklist Phase 13.2.1 — system role packs
SYSTEM_ROLE_PACKS: list[tuple[str, str]] = [
    ("SUPER_ADMIN", "Super Admin"),
    ("TENANT_ADMIN", "Tenant Admin"),
]
