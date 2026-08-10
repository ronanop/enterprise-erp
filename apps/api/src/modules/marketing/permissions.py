"""Marketing permission constants."""

MARKETING_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("marketing.campaign:read", "marketing.campaign", "read", "marketing"),
    ("marketing.campaign:create", "marketing.campaign", "create", "marketing"),
    ("marketing.campaign:update", "marketing.campaign", "update", "marketing"),
    ("marketing.campaign:activate", "marketing.campaign", "activate", "marketing"),
    ("marketing.channel:read", "marketing.channel", "read", "marketing"),
    ("marketing.channel:create", "marketing.channel", "create", "marketing"),
    ("marketing.channel:update", "marketing.channel", "update", "marketing"),
    ("marketing.content:read", "marketing.content", "read", "marketing"),
    ("marketing.content:create", "marketing.content", "create", "marketing"),
    ("marketing.content:update", "marketing.content", "update", "marketing"),
    ("marketing.content:submit", "marketing.content", "submit", "marketing"),
    ("marketing.content:approve_media", "marketing.content", "approve_media", "marketing"),
    ("marketing.content:approve", "marketing.content", "approve", "marketing"),
    ("marketing.content:schedule", "marketing.content", "schedule", "marketing"),
    ("marketing.content:publish", "marketing.content", "publish", "marketing"),
    ("marketing.content:archive", "marketing.content", "archive", "marketing"),
    ("marketing.content:verify", "marketing.content", "verify", "marketing"),
    ("marketing.publication:read", "marketing.publication", "read", "marketing"),
    ("marketing.publication:create", "marketing.publication", "create", "marketing"),
    ("marketing.asset:read", "marketing.asset", "read", "marketing"),
    ("marketing.asset:create", "marketing.asset", "create", "marketing"),
    ("marketing.asset:update", "marketing.asset", "update", "marketing"),
    ("marketing.report:read", "marketing.report", "read", "marketing"),
]

_ALL = [p[0] for p in MARKETING_PERMISSIONS]

# Minimal org read for content creation (branch_id) without full Organization module access.
MARKETING_ORG_READ_PERMISSIONS = [
    "organization.branch:read",
    "organization.company:read",
]

MARKETING_ADMIN_PERMISSIONS = list(_ALL)
MARKETING_MANAGER_PERMISSIONS = list(_ALL)
MARKETING_CREATOR_PERMISSIONS = [
    p for p in _ALL if ":approve" not in p and ":activate" not in p and ":approve_media" not in p
] + MARKETING_ORG_READ_PERMISSIONS
MARKETING_MEDIA_PERMISSIONS = [
    "marketing.campaign:read",
    "marketing.channel:read",
    "marketing.content:read",
    "marketing.content:approve_media",
    "marketing.asset:read",
    "marketing.asset:create",
    "marketing.asset:update",
    "marketing.report:read",
]
MARKETING_CAMPAIGN_HANDLER_PERMISSIONS = [
    "marketing.campaign:read",
    "marketing.campaign:create",
    "marketing.campaign:update",
    "marketing.campaign:activate",
    "marketing.channel:read",
    "marketing.content:read",
    "marketing.content:verify",
    "marketing.content:approve_media",
    "marketing.asset:read",
    "marketing.asset:create",
    "marketing.report:read",
]
MARKETING_LINKEDIN_HANDLER_PERMISSIONS = [
    "marketing.channel:read",
    "marketing.channel:update",
    "marketing.content:read",
    "marketing.content:create",
    "marketing.content:update",
    "marketing.content:submit",
    "marketing.content:verify",
    "marketing.content:schedule",
    "marketing.publication:read",
    "marketing.asset:read",
    "marketing.asset:create",
    "marketing.asset:update",
    "marketing.report:read",
] + MARKETING_ORG_READ_PERMISSIONS
MARKETING_VIDEO_EDITOR_PERMISSIONS = [
    "marketing.content:read",
    "marketing.content:update",
    "marketing.content:verify",
    "marketing.asset:read",
    "marketing.asset:create",
    "marketing.asset:update",
    "marketing.report:read",
]
MARKETING_PUBLISHER_PERMISSIONS = [
    "marketing.channel:read",
    "marketing.content:read",
    "marketing.content:verify",
    "marketing.content:schedule",
    "marketing.content:publish",
    "marketing.content:archive",
    "marketing.publication:read",
    "marketing.publication:create",
    "marketing.report:read",
]
MARKETING_ANALYST_PERMISSIONS = [p for p in _ALL if ":create" not in p and ":update" not in p and ":submit" not in p and ":approve" not in p and ":schedule" not in p and ":publish" not in p and ":archive" not in p and ":activate" not in p]
MARKETING_VIEWER_PERMISSIONS = [p for p in _ALL if p.endswith(":read") or p == "marketing.report:read"]
