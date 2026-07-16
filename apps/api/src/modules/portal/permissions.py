"""Customer Portal permission constants per ERD_23 section 10."""

PORTAL_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("portal.account:read", "portal.account", "read", "portal"),
    ("portal.account:create", "portal.account", "create", "portal"),
    ("portal.account:update", "portal.account", "update", "portal"),
    ("portal.account:submit", "portal.account", "submit", "portal"),
    ("portal.account:approve", "portal.account", "approve", "portal"),
    ("portal.account:lock", "portal.account", "lock", "portal"),
    ("portal.profile:read", "portal.profile", "read", "portal"),
    ("portal.profile:create", "portal.profile", "create", "portal"),
    ("portal.profile:update", "portal.profile", "update", "portal"),
    ("portal.profile:submit", "portal.profile", "submit", "portal"),
    ("portal.profile:approve", "portal.profile", "approve", "portal"),
    ("portal.session:read", "portal.session", "read", "portal"),
    ("portal.session:create", "portal.session", "create", "portal"),
    ("portal.session:update", "portal.session", "update", "portal"),
    ("portal.session:revoke", "portal.session", "revoke", "portal"),
    ("portal.device:read", "portal.device", "read", "portal"),
    ("portal.device:create", "portal.device", "create", "portal"),
    ("portal.device:update", "portal.device", "update", "portal"),
    ("portal.device:revoke", "portal.device", "revoke", "portal"),
    ("portal.login_audit:read", "portal.login_audit", "read", "portal"),
    ("portal.login_audit:create", "portal.login_audit", "create", "portal"),
    ("portal.login_audit:update", "portal.login_audit", "update", "portal"),
    ("portal.dashboard:read", "portal.dashboard", "read", "portal"),
    ("portal.dashboard:create", "portal.dashboard", "create", "portal"),
    ("portal.dashboard:update", "portal.dashboard", "update", "portal"),
    ("portal.widget:read", "portal.widget", "read", "portal"),
    ("portal.widget:create", "portal.widget", "create", "portal"),
    ("portal.widget:update", "portal.widget", "update", "portal"),
    ("portal.notification:read", "portal.notification", "read", "portal"),
    ("portal.notification:create", "portal.notification", "create", "portal"),
    ("portal.notification:update", "portal.notification", "update", "portal"),
    ("portal.notification:acknowledge", "portal.notification", "acknowledge", "portal"),
    ("portal.message:read", "portal.message", "read", "portal"),
    ("portal.message:create", "portal.message", "create", "portal"),
    ("portal.message:update", "portal.message", "update", "portal"),
    ("portal.thread:read", "portal.thread", "read", "portal"),
    ("portal.thread:create", "portal.thread", "create", "portal"),
    ("portal.thread:update", "portal.thread", "update", "portal"),
    ("portal.order_view:read", "portal.order_view", "read", "portal"),
    ("portal.order_view:create", "portal.order_view", "create", "portal"),
    ("portal.order_view:update", "portal.order_view", "update", "portal"),
    ("portal.order_view:sync", "portal.order_view", "sync", "portal"),
    ("portal.invoice_view:read", "portal.invoice_view", "read", "portal"),
    ("portal.invoice_view:create", "portal.invoice_view", "create", "portal"),
    ("portal.invoice_view:update", "portal.invoice_view", "update", "portal"),
    ("portal.invoice_view:sync", "portal.invoice_view", "sync", "portal"),
    ("portal.document_access:read", "portal.document_access", "read", "portal"),
    ("portal.document_access:create", "portal.document_access", "create", "portal"),
    ("portal.document_access:update", "portal.document_access", "update", "portal"),
    ("portal.document_access:submit", "portal.document_access", "submit", "portal"),
    ("portal.document_access:approve", "portal.document_access", "approve", "portal"),
    ("portal.document_access:revoke", "portal.document_access", "revoke", "portal"),
    ("portal.download:read", "portal.download", "read", "portal"),
    ("portal.download:create", "portal.download", "create", "portal"),
    ("portal.download:update", "portal.download", "update", "portal"),
    ("portal.support_ticket:read", "portal.support_ticket", "read", "portal"),
    ("portal.support_ticket:create", "portal.support_ticket", "create", "portal"),
    ("portal.support_ticket:submit", "portal.support_ticket", "submit", "portal"),
    ("portal.support_ticket:update", "portal.support_ticket", "update", "portal"),
    ("portal.service_request:read", "portal.service_request", "read", "portal"),
    ("portal.service_request:create", "portal.service_request", "create", "portal"),
    ("portal.service_request:submit", "portal.service_request", "submit", "portal"),
    ("portal.service_request:update", "portal.service_request", "update", "portal"),
    ("portal.saved_report:read", "portal.saved_report", "read", "portal"),
    ("portal.saved_report:create", "portal.saved_report", "create", "portal"),
    ("portal.saved_report:update", "portal.saved_report", "update", "portal"),
    ("portal.saved_search:read", "portal.saved_search", "read", "portal"),
    ("portal.saved_search:create", "portal.saved_search", "create", "portal"),
    ("portal.saved_search:update", "portal.saved_search", "update", "portal"),
    ("portal.preference:read", "portal.preference", "read", "portal"),
    ("portal.preference:create", "portal.preference", "create", "portal"),
    ("portal.preference:update", "portal.preference", "update", "portal"),
    ("portal.report:read", "portal.report", "read", "portal"),
    ("portal.report:export", "portal.report", "export", "portal"),
]

_ALL = [p[0] for p in PORTAL_PERMISSIONS]

PORTAL_ADMIN_PERMISSIONS = list(_ALL)
PORTAL_MANAGER_PERMISSIONS = [
    p for p in _ALL
    if ":approve" not in p and ":lock" not in p
]
CUSTOMER_USER_PERMISSIONS = [
    p for p in _ALL
    if any(
        x in p
        for x in (
            "portal.profile:read",
            "portal.profile:update",
            "portal.profile:submit",
            "portal.session",
            "portal.device",
            "portal.dashboard",
            "portal.widget",
            "portal.notification",
            "portal.message",
            "portal.thread",
            "portal.order_view",
            "portal.invoice_view",
            "portal.document_access:read",
            "portal.download",
            "portal.support_ticket",
            "portal.service_request",
            "portal.saved_report",
            "portal.saved_search",
            "portal.preference",
        )
    )
    and ":approve" not in p
    and ":lock" not in p
    and ":revoke" not in p
]
SUPPORT_USER_PERMISSIONS = [
    p for p in _ALL
    if any(
        x in p
        for x in (
            "portal.account:read",
            "portal.account:create",
            "portal.account:update",
            "portal.account:submit",
            "portal.profile:read",
            "portal.profile:create",
            "portal.profile:update",
            "portal.profile:submit",
            "portal.session:read",
            "portal.device:read",
            "portal.login_audit:read",
            "portal.notification",
            "portal.message",
            "portal.thread",
            "portal.document_access",
            "portal.support_ticket",
            "portal.service_request",
            "portal.report:read",
        )
    )
    and ":approve" not in p
]
