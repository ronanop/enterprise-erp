"""Marketing permission constants."""

MARKETING_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("marketing.campaign:read", "marketing.campaign", "read", "marketing"),
    ("marketing.campaign:create", "marketing.campaign", "create", "marketing"),
    ("marketing.campaign:update", "marketing.campaign", "update", "marketing"),
    ("marketing.campaign:submit", "marketing.campaign", "submit", "marketing"),
    ("marketing.platform:read", "marketing.platform", "read", "marketing"),
    ("marketing.platform:create", "marketing.platform", "create", "marketing"),
    ("marketing.platform:update", "marketing.platform", "update", "marketing"),
    ("marketing.pillar:read", "marketing.pillar", "read", "marketing"),
    ("marketing.pillar:create", "marketing.pillar", "create", "marketing"),
    ("marketing.pillar:update", "marketing.pillar", "update", "marketing"),
    ("marketing.brand_voice:read", "marketing.brand_voice", "read", "marketing"),
    ("marketing.brand_voice:create", "marketing.brand_voice", "create", "marketing"),
    ("marketing.brand_voice:update", "marketing.brand_voice", "update", "marketing"),
    ("marketing.social_account:read", "marketing.social_account", "read", "marketing"),
    ("marketing.social_account:create", "marketing.social_account", "create", "marketing"),
    ("marketing.social_account:update", "marketing.social_account", "update", "marketing"),
    ("marketing.content:read", "marketing.content", "read", "marketing"),
    ("marketing.content:create", "marketing.content", "create", "marketing"),
    ("marketing.content:update", "marketing.content", "update", "marketing"),
    ("marketing.content:generate", "marketing.content", "generate", "marketing"),
    ("marketing.content:approve", "marketing.content", "approve", "marketing"),
    ("marketing.research:read", "marketing.research", "read", "marketing"),
    ("marketing.research:create", "marketing.research", "create", "marketing"),
    ("marketing.trend:read", "marketing.trend", "read", "marketing"),
    ("marketing.trend:create", "marketing.trend", "create", "marketing"),
    ("marketing.competitor:read", "marketing.competitor", "read", "marketing"),
    ("marketing.competitor:create", "marketing.competitor", "create", "marketing"),
    ("marketing.competitor:update", "marketing.competitor", "update", "marketing"),
    ("marketing.calendar:read", "marketing.calendar", "read", "marketing"),
    ("marketing.calendar:create", "marketing.calendar", "create", "marketing"),
    ("marketing.calendar:update", "marketing.calendar", "update", "marketing"),
    ("marketing.publish:read", "marketing.publish", "read", "marketing"),
    ("marketing.publish:create", "marketing.publish", "create", "marketing"),
    ("marketing.publish:update", "marketing.publish", "update", "marketing"),
    ("marketing.analytics:read", "marketing.analytics", "read", "marketing"),
    ("marketing.task:read", "marketing.task", "read", "marketing"),
    ("marketing.task:create", "marketing.task", "create", "marketing"),
    ("marketing.task:update", "marketing.task", "update", "marketing"),
    ("marketing.approval:read", "marketing.approval", "read", "marketing"),
    ("marketing.approval:act", "marketing.approval", "act", "marketing"),
    ("marketing.m365:read", "marketing.m365", "read", "marketing"),
    ("marketing.m365:update", "marketing.m365", "update", "marketing"),
    ("marketing.workload:read", "marketing.workload", "read", "marketing"),
    ("marketing.ops:read", "marketing.ops", "read", "marketing"),
]

_ALL = [p[0] for p in MARKETING_PERMISSIONS]

MARKETING_MANAGER_PERMISSIONS = list(_ALL)
MARKETING_EDITOR_PERMISSIONS = [
    p
    for p in _ALL
    if not any(x in p for x in (":approve", "campaign:submit"))
]
MARKETING_VIEWER_PERMISSIONS = [p for p in _ALL if p.endswith(":read")]
MARKETING_ADMIN_PERMISSIONS = list(_ALL)
