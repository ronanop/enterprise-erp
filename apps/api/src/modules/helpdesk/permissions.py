"""Helpdesk permission constants per ERD_17 section 14."""

HELPDESK_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("helpdesk.category:read", "helpdesk.category", "read", "helpdesk"),
    ("helpdesk.category:create", "helpdesk.category", "create", "helpdesk"),
    ("helpdesk.category:update", "helpdesk.category", "update", "helpdesk"),
    ("helpdesk.priority:read", "helpdesk.priority", "read", "helpdesk"),
    ("helpdesk.priority:create", "helpdesk.priority", "create", "helpdesk"),
    ("helpdesk.priority:update", "helpdesk.priority", "update", "helpdesk"),
    ("helpdesk.ticket:read", "helpdesk.ticket", "read", "helpdesk"),
    ("helpdesk.ticket:create", "helpdesk.ticket", "create", "helpdesk"),
    ("helpdesk.ticket:update", "helpdesk.ticket", "update", "helpdesk"),
    ("helpdesk.ticket:submit", "helpdesk.ticket", "submit", "helpdesk"),
    ("helpdesk.ticket:approve", "helpdesk.ticket", "approve", "helpdesk"),
    ("helpdesk.assignment:read", "helpdesk.assignment", "read", "helpdesk"),
    ("helpdesk.assignment:create", "helpdesk.assignment", "create", "helpdesk"),
    ("helpdesk.assignment:submit", "helpdesk.assignment", "submit", "helpdesk"),
    ("helpdesk.assignment:approve", "helpdesk.assignment", "approve", "helpdesk"),
    ("helpdesk.assignment:complete", "helpdesk.assignment", "complete", "helpdesk"),
    ("helpdesk.comment:read", "helpdesk.comment", "read", "helpdesk"),
    ("helpdesk.comment:create", "helpdesk.comment", "create", "helpdesk"),
    ("helpdesk.comment:update", "helpdesk.comment", "update", "helpdesk"),
    ("helpdesk.attachment:read", "helpdesk.attachment", "read", "helpdesk"),
    ("helpdesk.attachment:create", "helpdesk.attachment", "create", "helpdesk"),
    ("helpdesk.attachment:update", "helpdesk.attachment", "update", "helpdesk"),
    ("helpdesk.activity:read", "helpdesk.activity", "read", "helpdesk"),
    ("helpdesk.activity:create", "helpdesk.activity", "create", "helpdesk"),
    ("helpdesk.activity:update", "helpdesk.activity", "update", "helpdesk"),
    ("helpdesk.sla:read", "helpdesk.sla", "read", "helpdesk"),
    ("helpdesk.sla:create", "helpdesk.sla", "create", "helpdesk"),
    ("helpdesk.sla:update", "helpdesk.sla", "update", "helpdesk"),
    ("helpdesk.escalation:read", "helpdesk.escalation", "read", "helpdesk"),
    ("helpdesk.escalation:create", "helpdesk.escalation", "create", "helpdesk"),
    ("helpdesk.escalation:update", "helpdesk.escalation", "update", "helpdesk"),
    ("helpdesk.escalation:escalate", "helpdesk.escalation", "escalate", "helpdesk"),
    ("helpdesk.knowledge:read", "helpdesk.knowledge", "read", "helpdesk"),
    ("helpdesk.knowledge:create", "helpdesk.knowledge", "create", "helpdesk"),
    ("helpdesk.knowledge:submit", "helpdesk.knowledge", "submit", "helpdesk"),
    ("helpdesk.knowledge:approve", "helpdesk.knowledge", "approve", "helpdesk"),
    ("helpdesk.knowledge:publish", "helpdesk.knowledge", "publish", "helpdesk"),
    ("helpdesk.resolution:read", "helpdesk.resolution", "read", "helpdesk"),
    ("helpdesk.resolution:create", "helpdesk.resolution", "create", "helpdesk"),
    ("helpdesk.resolution:submit", "helpdesk.resolution", "submit", "helpdesk"),
    ("helpdesk.resolution:complete", "helpdesk.resolution", "complete", "helpdesk"),
    ("helpdesk.feedback:read", "helpdesk.feedback", "read", "helpdesk"),
    ("helpdesk.feedback:create", "helpdesk.feedback", "create", "helpdesk"),
    ("helpdesk.team:read", "helpdesk.team", "read", "helpdesk"),
    ("helpdesk.team:create", "helpdesk.team", "create", "helpdesk"),
    ("helpdesk.team:update", "helpdesk.team", "update", "helpdesk"),
    ("helpdesk.shift:read", "helpdesk.shift", "read", "helpdesk"),
    ("helpdesk.shift:create", "helpdesk.shift", "create", "helpdesk"),
    ("helpdesk.shift:update", "helpdesk.shift", "update", "helpdesk"),
    ("helpdesk.schedule:read", "helpdesk.schedule", "read", "helpdesk"),
    ("helpdesk.schedule:create", "helpdesk.schedule", "create", "helpdesk"),
    ("helpdesk.schedule:update", "helpdesk.schedule", "update", "helpdesk"),
    ("helpdesk.notification:read", "helpdesk.notification", "read", "helpdesk"),
    ("helpdesk.notification:create", "helpdesk.notification", "create", "helpdesk"),
    ("helpdesk.report:read", "helpdesk.report", "read", "helpdesk"),
    ("helpdesk.report:export", "helpdesk.report", "export", "helpdesk"),
    ("helpdesk.dashboard:read", "helpdesk.dashboard", "read", "helpdesk"),
    ("helpdesk.dashboard:export", "helpdesk.dashboard", "export", "helpdesk"),
]

_ALL = [p[0] for p in HELPDESK_PERMISSIONS]

HELPDESK_MANAGER_PERMISSIONS = list(_ALL)
SUPPORT_ENGINEER_PERMISSIONS = [
    p
    for p in _ALL
    if not any(
        x in p
        for x in (
            ":approve",
            "knowledge:publish",
            "category:create",
            "category:update",
            "priority:create",
            "priority:update",
            "sla:create",
            "sla:update",
            "team:create",
            "team:update",
            "report:export",
            "dashboard:export",
        )
    )
]
HELPDESK_AGENT_PERMISSIONS = [
    p
    for p in _ALL
    if not any(
        x in p
        for x in (
            ":approve",
            "knowledge:publish",
            "escalation:escalate",
            "category:create",
            "category:update",
            "priority:create",
            "priority:update",
            "sla:create",
            "sla:update",
            "team:create",
            "team:update",
            "shift:create",
            "shift:update",
            "schedule:create",
            "schedule:update",
            "report:export",
            "dashboard:export",
        )
    )
]
HELPDESK_ADMIN_PERMISSIONS = list(_ALL)
