"""Analytics permission constants per ERD_20 section 14."""

ANALYTICS_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("analytics.dashboard:read", "analytics.dashboard", "read", "analytics"),
    ("analytics.dashboard:create", "analytics.dashboard", "create", "analytics"),
    ("analytics.dashboard:update", "analytics.dashboard", "update", "analytics"),
    ("analytics.dashboard:submit", "analytics.dashboard", "submit", "analytics"),
    ("analytics.dashboard:approve", "analytics.dashboard", "approve", "analytics"),
    ("analytics.dashboard:publish", "analytics.dashboard", "publish", "analytics"),
    ("analytics.widget:read", "analytics.widget", "read", "analytics"),
    ("analytics.widget:create", "analytics.widget", "create", "analytics"),
    ("analytics.widget:update", "analytics.widget", "update", "analytics"),
    ("analytics.report:read", "analytics.report", "read", "analytics"),
    ("analytics.report:create", "analytics.report", "create", "analytics"),
    ("analytics.report:update", "analytics.report", "update", "analytics"),
    ("analytics.report:submit", "analytics.report", "submit", "analytics"),
    ("analytics.report:approve", "analytics.report", "approve", "analytics"),
    ("analytics.report:publish", "analytics.report", "publish", "analytics"),
    ("analytics.report:run", "analytics.report", "run", "analytics"),
    ("analytics.schedule:read", "analytics.schedule", "read", "analytics"),
    ("analytics.schedule:create", "analytics.schedule", "create", "analytics"),
    ("analytics.schedule:update", "analytics.schedule", "update", "analytics"),
    ("analytics.execution:read", "analytics.execution", "read", "analytics"),
    ("analytics.execution:create", "analytics.execution", "create", "analytics"),
    ("analytics.execution:update", "analytics.execution", "update", "analytics"),
    ("analytics.dataset:read", "analytics.dataset", "read", "analytics"),
    ("analytics.dataset:create", "analytics.dataset", "create", "analytics"),
    ("analytics.dataset:update", "analytics.dataset", "update", "analytics"),
    ("analytics.dataset:submit", "analytics.dataset", "submit", "analytics"),
    ("analytics.dataset:approve", "analytics.dataset", "approve", "analytics"),
    ("analytics.dataset:refresh", "analytics.dataset", "refresh", "analytics"),
    ("analytics.source:read", "analytics.source", "read", "analytics"),
    ("analytics.source:create", "analytics.source", "create", "analytics"),
    ("analytics.source:update", "analytics.source", "update", "analytics"),
    ("analytics.metric:read", "analytics.metric", "read", "analytics"),
    ("analytics.metric:create", "analytics.metric", "create", "analytics"),
    ("analytics.metric:update", "analytics.metric", "update", "analytics"),
    ("analytics.dimension:read", "analytics.dimension", "read", "analytics"),
    ("analytics.dimension:create", "analytics.dimension", "create", "analytics"),
    ("analytics.dimension:update", "analytics.dimension", "update", "analytics"),
    ("analytics.fact:read", "analytics.fact", "read", "analytics"),
    ("analytics.fact:create", "analytics.fact", "create", "analytics"),
    ("analytics.fact:update", "analytics.fact", "update", "analytics"),
    ("analytics.kpi:read", "analytics.kpi", "read", "analytics"),
    ("analytics.kpi:create", "analytics.kpi", "create", "analytics"),
    ("analytics.kpi:update", "analytics.kpi", "update", "analytics"),
    ("analytics.kpi:submit", "analytics.kpi", "submit", "analytics"),
    ("analytics.kpi:approve", "analytics.kpi", "approve", "analytics"),
    ("analytics.snapshot:read", "analytics.snapshot", "read", "analytics"),
    ("analytics.snapshot:create", "analytics.snapshot", "create", "analytics"),
    ("analytics.snapshot:submit", "analytics.snapshot", "submit", "analytics"),
    ("analytics.refresh:read", "analytics.refresh", "read", "analytics"),
    ("analytics.refresh:create", "analytics.refresh", "create", "analytics"),
    ("analytics.refresh:submit", "analytics.refresh", "submit", "analytics"),
    ("analytics.alert:read", "analytics.alert", "read", "analytics"),
    ("analytics.alert:create", "analytics.alert", "create", "analytics"),
    ("analytics.alert:update", "analytics.alert", "update", "analytics"),
    ("analytics.alert:submit", "analytics.alert", "submit", "analytics"),
    ("analytics.alert:approve", "analytics.alert", "approve", "analytics"),
    ("analytics.notification:read", "analytics.notification", "read", "analytics"),
    ("analytics.notification:acknowledge", "analytics.notification", "acknowledge", "analytics"),
    ("analytics.subscription:read", "analytics.subscription", "read", "analytics"),
    ("analytics.subscription:create", "analytics.subscription", "create", "analytics"),
    ("analytics.subscription:update", "analytics.subscription", "update", "analytics"),
    ("analytics.subscription:cancel", "analytics.subscription", "cancel", "analytics"),
    ("analytics.export:read", "analytics.export", "read", "analytics"),
    ("analytics.export:create", "analytics.export", "create", "analytics"),
    ("analytics.export:run", "analytics.export", "run", "analytics"),
    ("analytics.import:read", "analytics.import", "read", "analytics"),
    ("analytics.import:create", "analytics.import", "create", "analytics"),
    ("analytics.import:run", "analytics.import", "run", "analytics"),
    ("analytics.query_history:read", "analytics.query_history", "read", "analytics"),
    ("analytics.usage_audit:read", "analytics.usage_audit", "read", "analytics"),
]

_ALL = [p[0] for p in ANALYTICS_PERMISSIONS]

BI_ANALYST_PERMISSIONS = [
    p for p in _ALL
    if any(
        x in p
        for x in (
            "analytics.dashboard",
            "analytics.widget",
            "analytics.report",
            "analytics.schedule",
            "analytics.execution",
            "analytics.metric:read",
            "analytics.kpi:read",
            "analytics.dataset:read",
            "analytics.query_history:read",
            "analytics.subscription",
            "analytics.export",
        )
    )
    and ":approve" not in p
]
BI_MANAGER_PERMISSIONS = list(_ALL)
DATA_STEWARD_PERMISSIONS = [
    p for p in _ALL
    if any(
        x in p
        for x in (
            "analytics.dataset",
            "analytics.source",
            "analytics.metric",
            "analytics.dimension",
            "analytics.fact",
            "analytics.snapshot",
            "analytics.refresh",
            "analytics.kpi",
            "analytics.import",
            "analytics.query_history:read",
        )
    )
]
BI_ADMIN_PERMISSIONS = list(_ALL)
