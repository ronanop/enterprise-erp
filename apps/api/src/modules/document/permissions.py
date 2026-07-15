"""Document permission constants per ERD_18 section 14."""

DOCUMENT_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("document.folder:read", "document.folder", "read", "document"),
    ("document.folder:create", "document.folder", "create", "document"),
    ("document.folder:update", "document.folder", "update", "document"),
    ("document.document:read", "document.document", "read", "document"),
    ("document.document:create", "document.document", "create", "document"),
    ("document.document:update", "document.document", "update", "document"),
    ("document.document:submit", "document.document", "submit", "document"),
    ("document.document:approve", "document.document", "approve", "document"),
    ("document.document:publish", "document.document", "publish", "document"),
    ("document.version:read", "document.version", "read", "document"),
    ("document.version:create", "document.version", "create", "document"),
    ("document.version:update", "document.version", "update", "document"),
    ("document.metadata:read", "document.metadata", "read", "document"),
    ("document.metadata:create", "document.metadata", "create", "document"),
    ("document.metadata:update", "document.metadata", "update", "document"),
    ("document.tag:read", "document.tag", "read", "document"),
    ("document.tag:create", "document.tag", "create", "document"),
    ("document.tag:update", "document.tag", "update", "document"),
    ("document.permission:read", "document.permission", "read", "document"),
    ("document.permission:create", "document.permission", "create", "document"),
    ("document.permission:revoke", "document.permission", "revoke", "document"),
    ("document.share:read", "document.share", "read", "document"),
    ("document.share:create", "document.share", "create", "document"),
    ("document.share:revoke", "document.share", "revoke", "document"),
    ("document.comment:read", "document.comment", "read", "document"),
    ("document.comment:create", "document.comment", "create", "document"),
    ("document.comment:update", "document.comment", "update", "document"),
    ("document.approval:read", "document.approval", "read", "document"),
    ("document.approval:create", "document.approval", "create", "document"),
    ("document.approval:submit", "document.approval", "submit", "document"),
    ("document.approval:complete", "document.approval", "complete", "document"),
    ("document.workflow:read", "document.workflow", "read", "document"),
    ("document.workflow:create", "document.workflow", "create", "document"),
    ("document.workflow:update", "document.workflow", "update", "document"),
    ("document.checkout:read", "document.checkout", "read", "document"),
    ("document.checkout:create", "document.checkout", "create", "document"),
    ("document.checkout:submit", "document.checkout", "submit", "document"),
    ("document.checkout:complete", "document.checkout", "complete", "document"),
    ("document.audit:read", "document.audit", "read", "document"),
    ("document.attachment:read", "document.attachment", "read", "document"),
    ("document.attachment:create", "document.attachment", "create", "document"),
    ("document.attachment:update", "document.attachment", "update", "document"),
    ("document.template:read", "document.template", "read", "document"),
    ("document.template:create", "document.template", "create", "document"),
    ("document.template:update", "document.template", "update", "document"),
    ("document.retention:read", "document.retention", "read", "document"),
    ("document.retention:create", "document.retention", "create", "document"),
    ("document.retention:submit", "document.retention", "submit", "document"),
    ("document.retention:approve", "document.retention", "approve", "document"),
    ("document.archive:read", "document.archive", "read", "document"),
    ("document.archive:create", "document.archive", "create", "document"),
    ("document.archive:submit", "document.archive", "submit", "document"),
    ("document.archive:approve", "document.archive", "approve", "document"),
    ("document.notification:read", "document.notification", "read", "document"),
    ("document.report:read", "document.report", "read", "document"),
    ("document.report:export", "document.report", "export", "document"),
]

_ALL = [p[0] for p in DOCUMENT_PERMISSIONS]

DOCUMENT_MANAGER_PERMISSIONS = list(_ALL)
DOCUMENT_EDITOR_PERMISSIONS = [
    p for p in _ALL
    if not any(
        x in p
        for x in (
            ":approve",
            "document:publish",
            "permission:create",
            "permission:revoke",
            "retention:",
            "archive:approve",
            "workflow:create",
            "workflow:update",
            "report:export",
        )
    )
]
DOCUMENT_REVIEWER_PERMISSIONS = [
    p for p in _ALL
    if any(
        x in p
        for x in (
            ":read",
            "document:approve",
            "approval:",
            "comment:",
            "document:publish",
        )
    )
    and "report:export" not in p
]
DOCUMENT_ADMIN_PERMISSIONS = list(_ALL)
