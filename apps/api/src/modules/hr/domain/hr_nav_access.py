"""HR Admin sidebar nav keys (must match apps/web hr-nav navKey values)."""

from __future__ import annotations

HR_SIDEBAR_NAV_KEYS: tuple[str, ...] = (
    "dashboard",
    "recruitment",
    "onboarding",
    "employees",
    "attendance",
    "biometric-devices",
    "performance",
    "training",
    "payroll-salary-structure",
    "payroll-assign-salary",
    "payroll-run",
    "payroll-payslip",
    "payroll-revised-salary",
    "payroll-incentives",
    "payroll-salary-configuration",
    "employee-requests",
    "edoc",
    "org-organisation",
    "org-employment",
    "org-leave-setup",
    "org-shifts-roster",
    "it-meeting-room",
    "it-stocks",
    "it-travel",
    "it-requisition",
    "offboarding",
)

HR_SIDEBAR_NAV_KEY_SET = frozenset(HR_SIDEBAR_NAV_KEYS)


def normalize_hr_nav_keys(keys: list[str] | None) -> list[str]:
    if not keys:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for raw in keys:
        key = str(raw or "").strip()
        if key not in HR_SIDEBAR_NAV_KEY_SET or key in seen:
            continue
        seen.add(key)
        out.append(key)
    return out


def default_hr_nav_keys() -> list[str]:
    return list(HR_SIDEBAR_NAV_KEYS)
