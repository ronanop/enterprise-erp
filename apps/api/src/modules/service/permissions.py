"""Service permission constants per ERD_16 section 14."""

SERVICE_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("service.category:read", "service.category", "read", "service"),
    ("service.category:create", "service.category", "create", "service"),
    ("service.category:update", "service.category", "update", "service"),
    ("service.request:read", "service.request", "read", "service"),
    ("service.request:create", "service.request", "create", "service"),
    ("service.request:update", "service.request", "update", "service"),
    ("service.request:submit", "service.request", "submit", "service"),
    ("service.request:approve", "service.request", "approve", "service"),
    ("service.ticket:read", "service.ticket", "read", "service"),
    ("service.ticket:create", "service.ticket", "create", "service"),
    ("service.ticket:update", "service.ticket", "update", "service"),
    ("service.assignment:read", "service.assignment", "read", "service"),
    ("service.assignment:create", "service.assignment", "create", "service"),
    ("service.assignment:update", "service.assignment", "update", "service"),
    ("service.assignment:complete", "service.assignment", "complete", "service"),
    ("service.schedule:read", "service.schedule", "read", "service"),
    ("service.schedule:create", "service.schedule", "create", "service"),
    ("service.schedule:update", "service.schedule", "update", "service"),
    ("service.schedule:complete", "service.schedule", "complete", "service"),
    ("service.work_order:read", "service.work_order", "read", "service"),
    ("service.work_order:create", "service.work_order", "create", "service"),
    ("service.work_order:submit", "service.work_order", "submit", "service"),
    ("service.work_order:approve", "service.work_order", "approve", "service"),
    ("service.work_order:complete", "service.work_order", "complete", "service"),
    ("service.task:read", "service.task", "read", "service"),
    ("service.task:create", "service.task", "create", "service"),
    ("service.task:update", "service.task", "update", "service"),
    ("service.task:complete", "service.task", "complete", "service"),
    ("service.checklist:read", "service.checklist", "read", "service"),
    ("service.checklist:create", "service.checklist", "create", "service"),
    ("service.checklist:update", "service.checklist", "update", "service"),
    ("service.checklist:complete", "service.checklist", "complete", "service"),
    ("service.visit:read", "service.visit", "read", "service"),
    ("service.visit:create", "service.visit", "create", "service"),
    ("service.visit:update", "service.visit", "update", "service"),
    ("service.visit:complete", "service.visit", "complete", "service"),
    ("service.material:read", "service.material", "read", "service"),
    ("service.material:create", "service.material", "create", "service"),
    ("service.material:update", "service.material", "update", "service"),
    ("service.time_entry:read", "service.time_entry", "read", "service"),
    ("service.time_entry:create", "service.time_entry", "create", "service"),
    ("service.time_entry:update", "service.time_entry", "update", "service"),
    ("service.expense:read", "service.expense", "read", "service"),
    ("service.expense:create", "service.expense", "create", "service"),
    ("service.expense:submit", "service.expense", "submit", "service"),
    ("service.expense:approve", "service.expense", "approve", "service"),
    ("service.expense:post", "service.expense", "post", "service"),
    ("service.sla:read", "service.sla", "read", "service"),
    ("service.sla:create", "service.sla", "create", "service"),
    ("service.sla:update", "service.sla", "update", "service"),
    ("service.escalation:read", "service.escalation", "read", "service"),
    ("service.escalation:create", "service.escalation", "create", "service"),
    ("service.escalation:update", "service.escalation", "update", "service"),
    ("service.escalation:escalate", "service.escalation", "escalate", "service"),
    ("service.feedback:read", "service.feedback", "read", "service"),
    ("service.feedback:create", "service.feedback", "create", "service"),
    ("service.feedback:complete", "service.feedback", "complete", "service"),
    ("service.resolution:read", "service.resolution", "read", "service"),
    ("service.resolution:create", "service.resolution", "create", "service"),
    ("service.resolution:complete", "service.resolution", "complete", "service"),
    ("service.contract:read", "service.contract", "read", "service"),
    ("service.contract:create", "service.contract", "create", "service"),
    ("service.contract:submit", "service.contract", "submit", "service"),
    ("service.contract:approve", "service.contract", "approve", "service"),
    ("service.document:read", "service.document", "read", "service"),
    ("service.document:create", "service.document", "create", "service"),
    ("service.document:update", "service.document", "update", "service"),
    ("service.notification:read", "service.notification", "read", "service"),
    ("service.notification:create", "service.notification", "create", "service"),
    ("service.notification:update", "service.notification", "update", "service"),
    ("service.report:read", "service.report", "read", "service"),
    ("service.report:export", "service.report", "export", "service"),
]

_ALL = [p[0] for p in SERVICE_PERMISSIONS]

# Master/org reads needed for service ticket form dropdowns (customer, branch, owner, product).
SERVICE_LOOKUP_PERMISSIONS = [
    "master.customer:read",
    "organization.branch:read",
    "master.employee:read",
    "master.product:read",
]

SERVICE_MANAGER_PERMISSIONS = list(_ALL) + list(SERVICE_LOOKUP_PERMISSIONS)
SERVICE_ENGINEER_PERMISSIONS = [
    p for p in _ALL
    if not any(
        x in p
        for x in (
            ":approve",
            "expense:post",
            "contract:submit",
            "contract:approve",
            "category:create",
            "category:update",
            "sla:create",
            "sla:update",
            "report:export",
        )
    )
] + list(SERVICE_LOOKUP_PERMISSIONS)
SERVICE_COORDINATOR_PERMISSIONS = [
    p for p in _ALL
    if not any(
        x in p
        for x in (
            "expense:post",
            "contract:approve",
            "category:create",
            "category:update",
            "sla:create",
            "sla:update",
        )
    )
] + list(SERVICE_LOOKUP_PERMISSIONS)
SERVICE_ADMIN_PERMISSIONS = list(_ALL) + list(SERVICE_LOOKUP_PERMISSIONS)

# Field engineers only need FE dashboard + mark-solved (read permission covers both routes).
SERVICE_FIELD_ENGINEER_PERMISSIONS = [
    "service.request:read",
]
