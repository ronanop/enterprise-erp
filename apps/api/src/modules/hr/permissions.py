"""HR permission constants per ERD_11."""

HR_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("hr.designation:read", "hr.designation", "read", "hr"),
    ("hr.designation:create", "hr.designation", "create", "hr"),
    ("hr.designation:update", "hr.designation", "update", "hr"),
    ("hr.shift:read", "hr.shift", "read", "hr"),
    ("hr.shift:create", "hr.shift", "create", "hr"),
    ("hr.shift:update", "hr.shift", "update", "hr"),
    ("hr.leave_type:read", "hr.leave_type", "read", "hr"),
    ("hr.leave_type:create", "hr.leave_type", "create", "hr"),
    ("hr.leave_type:update", "hr.leave_type", "update", "hr"),
    ("hr.holiday_calendar:read", "hr.holiday_calendar", "read", "hr"),
    ("hr.holiday_calendar:create", "hr.holiday_calendar", "create", "hr"),
    ("hr.holiday_calendar:update", "hr.holiday_calendar", "update", "hr"),
    ("hr.employee_profile:read", "hr.employee_profile", "read", "hr"),
    ("hr.employee_profile:create", "hr.employee_profile", "create", "hr"),
    ("hr.employee_profile:update", "hr.employee_profile", "update", "hr"),
    ("hr.employment:read", "hr.employment", "read", "hr"),
    ("hr.employment:create", "hr.employment", "create", "hr"),
    ("hr.employment:update", "hr.employment", "update", "hr"),
    ("hr.employment:confirm", "hr.employment", "confirm", "hr"),
    ("hr.job_level:read", "hr.job_level", "read", "hr"),
    ("hr.job_level:create", "hr.job_level", "create", "hr"),
    ("hr.job_level:update", "hr.job_level", "update", "hr"),
    ("hr.grade:read", "hr.grade", "read", "hr"),
    ("hr.grade:create", "hr.grade", "create", "hr"),
    ("hr.grade:update", "hr.grade", "update", "hr"),
    ("hr.attendance:read", "hr.attendance", "read", "hr"),
    ("hr.attendance:create", "hr.attendance", "create", "hr"),
    ("hr.attendance:update", "hr.attendance", "update", "hr"),
    ("hr.attendance:lock", "hr.attendance", "lock", "hr"),
    ("hr.leave:read", "hr.leave", "read", "hr"),
    ("hr.leave:create", "hr.leave", "create", "hr"),
    ("hr.leave:update", "hr.leave", "update", "hr"),
    ("hr.leave:submit", "hr.leave", "submit", "hr"),
    ("hr.leave:approve", "hr.leave", "approve", "hr"),
    ("hr.shift_assignment:read", "hr.shift_assignment", "read", "hr"),
    ("hr.shift_assignment:create", "hr.shift_assignment", "create", "hr"),
    ("hr.shift_assignment:submit", "hr.shift_assignment", "submit", "hr"),
    ("hr.shift_assignment:approve", "hr.shift_assignment", "approve", "hr"),
    ("hr.document:read", "hr.document", "read", "hr"),
    ("hr.document:create", "hr.document", "create", "hr"),
    ("hr.document:verify", "hr.document", "verify", "hr"),
    ("hr.performance:read", "hr.performance", "read", "hr"),
    ("hr.performance:create", "hr.performance", "create", "hr"),
    ("hr.performance:submit", "hr.performance", "submit", "hr"),
    ("hr.performance:approve", "hr.performance", "approve", "hr"),
    ("hr.training:read", "hr.training", "read", "hr"),
    ("hr.training:create", "hr.training", "create", "hr"),
    ("hr.training:update", "hr.training", "update", "hr"),
    ("hr.training:assign", "hr.training", "assign", "hr"),
    ("hr.separation:read", "hr.separation", "read", "hr"),
    ("hr.separation:create", "hr.separation", "create", "hr"),
    ("hr.separation:submit", "hr.separation", "submit", "hr"),
    ("hr.separation:approve", "hr.separation", "approve", "hr"),
    ("hr.separation:complete", "hr.separation", "complete", "hr"),
    ("hr.report:read", "hr.report", "read", "hr"),
    ("hr.report:export", "hr.report", "export", "hr"),
    ("hr.management_group:read", "hr.management_group", "read", "hr"),
    ("hr.management_group:create", "hr.management_group", "create", "hr"),
    ("hr.management_group:update", "hr.management_group", "update", "hr"),
    ("hr.employee_asset:read", "hr.employee_asset", "read", "hr"),
    ("hr.employee_asset:assign", "hr.employee_asset", "assign", "hr"),
    ("hr.employee_asset:return", "hr.employee_asset", "return", "hr"),
    ("hr.superadmin:manage", "hr.superadmin", "manage", "hr"),
]

# Read-only master/org lookups scoped via SecUserOrgScope (HR dashboard + directory).
HR_MEMBER_WORKSPACE_READ_PERMISSIONS = [
    "master.employee:read",
    "organization.company:read",
    "organization.branch:read",
    "organization.department:read",
    "organization.location:read",
]

HR_EMPLOYEE_PERMISSIONS = list(
    dict.fromkeys(
        [
            "hr.employee_profile:read",
            "hr.employment:read",
            "hr.attendance:read",
            "hr.leave:read",
            "hr.leave:create",
            "hr.leave:submit",
            "hr.shift_assignment:read",
            "hr.document:read",
            "hr.performance:read",
            "hr.training:read",
            "hr.separation:read",
            "hr.separation:create",
            "hr.separation:submit",
            "hr.holiday_calendar:read",
            "hr.leave_type:read",
            "hr.shift:read",
            "hr.designation:read",
        ]
        + HR_MEMBER_WORKSPACE_READ_PERMISSIONS
    )
)

HR_MANAGER_PERMISSIONS = list(
    dict.fromkeys(
        HR_EMPLOYEE_PERMISSIONS
        + [
            "hr.leave:approve",
            "hr.leave:update",
            "hr.shift_assignment:create",
            "hr.shift_assignment:submit",
            "hr.shift_assignment:approve",
            "hr.performance:create",
            "hr.performance:submit",
            "hr.performance:approve",
            "hr.separation:approve",
            "hr.attendance:create",
            "hr.attendance:update",
            "hr.report:read",
            "hr.employee_asset:read",
        ]
    )
)

HR_EXECUTIVE_PERMISSIONS = list(
    dict.fromkeys(
        HR_MANAGER_PERMISSIONS
        + [
            "hr.designation:create",
            "hr.designation:update",
            "hr.shift:create",
            "hr.shift:update",
            "hr.leave_type:create",
            "hr.leave_type:update",
            "hr.holiday_calendar:create",
            "hr.holiday_calendar:update",
            "hr.employee_profile:create",
            "hr.employee_profile:update",
            "hr.employment:create",
            "hr.employment:update",
            "hr.attendance:lock",
            "hr.document:create",
            "hr.document:verify",
            "hr.training:create",
            "hr.training:update",
            "hr.training:assign",
            "hr.separation:complete",
            "hr.report:export",
            "hr.management_group:read",
            "hr.management_group:create",
            "hr.management_group:update",
            "hr.employee_asset:read",
            "hr.employee_asset:assign",
            "hr.employee_asset:return",
        ]
    )
)

HR_SUPERADMIN_PERMISSION = "hr.superadmin:manage"

HR_ADMIN_PERMISSIONS = [p[0] for p in HR_PERMISSIONS if p[0] != HR_SUPERADMIN_PERMISSION]


def _hr_admin_workspace_permissions() -> list[str]:
    from modules.organization.permissions import ORGANIZATION_PERMISSIONS
    from modules.payroll.permissions import PAYROLL_PERMISSIONS
    from modules.recruitment.permissions import RECRUITMENT_PERMISSIONS

    return list(
        dict.fromkeys(
            HR_ADMIN_PERMISSIONS
            + [
                "master.employee:read",
                "master.employee:create",
                "master.employee:update",
                "master.employee:delete",
            ]
            + [p[0] for p in PAYROLL_PERMISSIONS]
            + [p[0] for p in RECRUITMENT_PERMISSIONS]
            + [p[0] for p in ORGANIZATION_PERMISSIONS if p[2] != "delete"]
        )
    )


# Full HRMS sidebar access for assigned HR Admins (never includes superadmin panel).
HR_ADMIN_WORKSPACE_PERMISSIONS = _hr_admin_workspace_permissions()

# Named role packs (checklist Phase 13.2) — codes used by seed/resync migrations
HR_ROLE_PACKS: list[tuple[str, str, list[str]]] = [
    ("HR_EMPLOYEE", "Employee", HR_EMPLOYEE_PERMISSIONS),
    ("HR_MANAGER", "Manager", HR_MANAGER_PERMISSIONS),
    ("HR_EXECUTIVE", "HR Executive", HR_EXECUTIVE_PERMISSIONS),
    ("HR_ADMIN", "HR Admin", HR_ADMIN_WORKSPACE_PERMISSIONS),
]
