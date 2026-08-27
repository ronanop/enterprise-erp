"""Project permission constants per ERD_14 §14."""

PROJECT_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("project.project:read", "project.project", "read", "project"),
    ("project.project:create", "project.project", "create", "project"),
    ("project.project:update", "project.project", "update", "project"),
    ("project.project:submit", "project.project", "submit", "project"),
    ("project.project:approve", "project.project", "approve", "project"),
    ("project.project:complete", "project.project", "complete", "project"),
    ("project.project:close", "project.project", "close", "project"),
    ("project.phase:read", "project.phase", "read", "project"),
    ("project.phase:create", "project.phase", "create", "project"),
    ("project.phase:update", "project.phase", "update", "project"),
    ("project.phase:complete", "project.phase", "complete", "project"),
    ("project.milestone:read", "project.milestone", "read", "project"),
    ("project.milestone:create", "project.milestone", "create", "project"),
    ("project.milestone:update", "project.milestone", "update", "project"),
    ("project.milestone:complete", "project.milestone", "complete", "project"),
    ("project.task:read", "project.task", "read", "project"),
    ("project.task:create", "project.task", "create", "project"),
    ("project.task:update", "project.task", "update", "project"),
    ("project.task:complete", "project.task", "complete", "project"),
    ("project.task:approve", "project.task", "approve", "project"),
    ("project.timesheet:read", "project.timesheet", "read", "project"),
    ("project.timesheet:create", "project.timesheet", "create", "project"),
    ("project.timesheet:submit", "project.timesheet", "submit", "project"),
    ("project.timesheet:approve", "project.timesheet", "approve", "project"),
    ("project.resource:read", "project.resource", "read", "project"),
    ("project.resource:create", "project.resource", "create", "project"),
    ("project.resource:update", "project.resource", "update", "project"),
    ("project.budget:read", "project.budget", "read", "project"),
    ("project.budget:create", "project.budget", "create", "project"),
    ("project.budget:submit", "project.budget", "submit", "project"),
    ("project.budget:approve", "project.budget", "approve", "project"),
    ("project.cost:read", "project.cost", "read", "project"),
    ("project.cost:create", "project.cost", "create", "project"),
    ("project.cost:post", "project.cost", "post", "project"),
    ("project.issue:read", "project.issue", "read", "project"),
    ("project.issue:create", "project.issue", "create", "project"),
    ("project.issue:update", "project.issue", "update", "project"),
    ("project.risk:read", "project.risk", "read", "project"),
    ("project.risk:create", "project.risk", "create", "project"),
    ("project.risk:update", "project.risk", "update", "project"),
    ("project.change_request:read", "project.change_request", "read", "project"),
    ("project.change_request:create", "project.change_request", "create", "project"),
    ("project.change_request:submit", "project.change_request", "submit", "project"),
    ("project.change_request:approve", "project.change_request", "approve", "project"),
    ("project.document:read", "project.document", "read", "project"),
    ("project.document:create", "project.document", "create", "project"),
    ("project.document:update", "project.document", "update", "project"),
    ("project.comment:read", "project.comment", "read", "project"),
    ("project.comment:create", "project.comment", "create", "project"),
    ("project.comment:update", "project.comment", "update", "project"),
    ("project.report:read", "project.report", "read", "project"),
    ("project.report:export", "project.report", "export", "project"),
]

PROJECT_MEMBER_PERMISSIONS = list(
    dict.fromkeys(
        [
            p[0]
            for p in PROJECT_PERMISSIONS
            if p[2] in {"read", "create", "update", "submit", "complete"}
            and p[1]
            in {
                "project.task",
                "project.timesheet",
                "project.comment",
                "project.document",
                "project.issue",
                "project.project",
            }
        ]
    )
)

PROJECT_COORDINATOR_PERMISSIONS = list(
    dict.fromkeys(
        PROJECT_MEMBER_PERMISSIONS
        + [
            p[0]
            for p in PROJECT_PERMISSIONS
            if p[1] in {"project.phase", "project.milestone", "project.resource", "project.task"}
        ]
    )
)

PROJECT_MANAGER_PERMISSIONS = list(
    dict.fromkeys(
        PROJECT_COORDINATOR_PERMISSIONS
        + [
            "project.project:submit",
            "project.project:approve",
            "project.project:complete",
            "project.project:close",
            "project.task:approve",
            "project.timesheet:approve",
            "project.budget:submit",
            "project.budget:approve",
            "project.cost:create",
            "project.cost:post",
            "project.change_request:submit",
            "project.change_request:approve",
            "project.risk:create",
            "project.risk:update",
            "project.report:read",
            "project.report:export",
        ]
    )
)

PROJECT_ADMIN_PERMISSIONS = list(dict.fromkeys([p[0] for p in PROJECT_PERMISSIONS]))
