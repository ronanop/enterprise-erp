"""GRC permission constants per ERD_19 section 14."""

GRC_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("grc.policy:read", "grc.policy", "read", "grc"),
    ("grc.policy:create", "grc.policy", "create", "grc"),
    ("grc.policy:update", "grc.policy", "update", "grc"),
    ("grc.policy:submit", "grc.policy", "submit", "grc"),
    ("grc.policy:approve", "grc.policy", "approve", "grc"),
    ("grc.policy:publish", "grc.policy", "publish", "grc"),
    ("grc.policy_version:read", "grc.policy_version", "read", "grc"),
    ("grc.policy_version:create", "grc.policy_version", "create", "grc"),
    ("grc.policy_version:update", "grc.policy_version", "update", "grc"),
    ("grc.acknowledgement:read", "grc.acknowledgement", "read", "grc"),
    ("grc.acknowledgement:create", "grc.acknowledgement", "create", "grc"),
    ("grc.acknowledgement:update", "grc.acknowledgement", "update", "grc"),
    ("grc.control:read", "grc.control", "read", "grc"),
    ("grc.control:create", "grc.control", "create", "grc"),
    ("grc.control:update", "grc.control", "update", "grc"),
    ("grc.control_test:read", "grc.control_test", "read", "grc"),
    ("grc.control_test:create", "grc.control_test", "create", "grc"),
    ("grc.control_test:update", "grc.control_test", "update", "grc"),
    ("grc.risk_category:read", "grc.risk_category", "read", "grc"),
    ("grc.risk_category:create", "grc.risk_category", "create", "grc"),
    ("grc.risk_category:update", "grc.risk_category", "update", "grc"),
    ("grc.risk:read", "grc.risk", "read", "grc"),
    ("grc.risk:create", "grc.risk", "create", "grc"),
    ("grc.risk:update", "grc.risk", "update", "grc"),
    ("grc.risk:submit", "grc.risk", "submit", "grc"),
    ("grc.risk:approve", "grc.risk", "approve", "grc"),
    ("grc.risk_assessment:read", "grc.risk_assessment", "read", "grc"),
    ("grc.risk_assessment:create", "grc.risk_assessment", "create", "grc"),
    ("grc.risk_assessment:update", "grc.risk_assessment", "update", "grc"),
    ("grc.risk_treatment:read", "grc.risk_treatment", "read", "grc"),
    ("grc.risk_treatment:create", "grc.risk_treatment", "create", "grc"),
    ("grc.risk_treatment:update", "grc.risk_treatment", "update", "grc"),
    ("grc.compliance_framework:read", "grc.compliance_framework", "read", "grc"),
    ("grc.compliance_framework:create", "grc.compliance_framework", "create", "grc"),
    ("grc.compliance_framework:update", "grc.compliance_framework", "update", "grc"),
    ("grc.compliance_requirement:read", "grc.compliance_requirement", "read", "grc"),
    ("grc.compliance_requirement:create", "grc.compliance_requirement", "create", "grc"),
    ("grc.compliance_requirement:update", "grc.compliance_requirement", "update", "grc"),
    ("grc.compliance_assessment:read", "grc.compliance_assessment", "read", "grc"),
    ("grc.compliance_assessment:create", "grc.compliance_assessment", "create", "grc"),
    ("grc.compliance_assessment:update", "grc.compliance_assessment", "update", "grc"),
    ("grc.audit_plan:read", "grc.audit_plan", "read", "grc"),
    ("grc.audit_plan:create", "grc.audit_plan", "create", "grc"),
    ("grc.audit_plan:update", "grc.audit_plan", "update", "grc"),
    ("grc.audit:read", "grc.audit", "read", "grc"),
    ("grc.audit:create", "grc.audit", "create", "grc"),
    ("grc.audit:update", "grc.audit", "update", "grc"),
    ("grc.audit:submit", "grc.audit", "submit", "grc"),
    ("grc.audit:approve", "grc.audit", "approve", "grc"),
    ("grc.finding:read", "grc.finding", "read", "grc"),
    ("grc.finding:create", "grc.finding", "create", "grc"),
    ("grc.finding:update", "grc.finding", "update", "grc"),
    ("grc.corrective_action:read", "grc.corrective_action", "read", "grc"),
    ("grc.corrective_action:create", "grc.corrective_action", "create", "grc"),
    ("grc.corrective_action:update", "grc.corrective_action", "update", "grc"),
    ("grc.corrective_action:submit", "grc.corrective_action", "submit", "grc"),
    ("grc.corrective_action:approve", "grc.corrective_action", "approve", "grc"),
    ("grc.corrective_action:complete", "grc.corrective_action", "complete", "grc"),
    ("grc.exception:read", "grc.exception", "read", "grc"),
    ("grc.exception:create", "grc.exception", "create", "grc"),
    ("grc.exception:update", "grc.exception", "update", "grc"),
    ("grc.exception:approve", "grc.exception", "approve", "grc"),
    ("grc.incident:read", "grc.incident", "read", "grc"),
    ("grc.incident:create", "grc.incident", "create", "grc"),
    ("grc.incident:update", "grc.incident", "update", "grc"),
    ("grc.incident:submit", "grc.incident", "submit", "grc"),
    ("grc.incident:review", "grc.incident", "review", "grc"),
    ("grc.incident:close", "grc.incident", "close", "grc"),
    ("grc.notification:read", "grc.notification", "read", "grc"),
    ("grc.report:read", "grc.report", "read", "grc"),
    ("grc.report:export", "grc.report", "export", "grc"),
]

_ALL = [p[0] for p in GRC_PERMISSIONS]

GRC_MANAGER_PERMISSIONS = list(_ALL)
RISK_MANAGER_PERMISSIONS = [
    p for p in _ALL
    if any(
        x in p
        for x in (
            "grc.risk",
            "grc.risk_category",
            "grc.risk_assessment",
            "grc.risk_treatment",
            "grc.incident",
            "grc.control",
            "grc.notification:read",
            "grc.report:read",
        )
    )
]
COMPLIANCE_OFFICER_PERMISSIONS = [
    p for p in _ALL
    if any(
        x in p
        for x in (
            "grc.policy",
            "grc.acknowledgement",
            "grc.compliance",
            "grc.corrective_action",
            "grc.control",
            "grc.notification:read",
            "grc.report:read",
        )
    )
]
GRC_ADMIN_PERMISSIONS = list(_ALL)
