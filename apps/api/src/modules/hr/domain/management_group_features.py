"""Data-driven feature toggle catalog for management groups (employment type config)."""

from __future__ import annotations

from typing import Any

# (section_id, section_title, (key, label, default_on, parent_key|None))
FEATURE_SECTIONS: tuple[tuple[str, str, tuple[tuple[str, str, bool, str | None], ...]], ...] = (
    (
        "attendance",
        "Attendance",
        (
            ("attendance.enable", "Enable Attendance", True, None),
            ("attendance.biometric", "Enable Biometric Attendance", True, "attendance.enable"),
            ("attendance.gps", "Enable GPS Attendance", False, "attendance.enable"),
            ("attendance.face", "Enable Face Recognition", False, "attendance.enable"),
            ("attendance.manual", "Enable Manual Attendance", True, "attendance.enable"),
            ("attendance.regularization", "Enable Attendance Regularization", True, "attendance.enable"),
            ("attendance.shift_rotation", "Enable Shift Rotation", True, "attendance.enable"),
            ("attendance.auto_shift", "Enable Auto Shift Assignment", True, "attendance.enable"),
            ("attendance.overtime", "Enable Overtime", True, "attendance.enable"),
            ("attendance.night_allowance", "Enable Night Shift Allowance", False, "attendance.enable"),
        ),
    ),
    (
        "leave",
        "Leave",
        (
            ("leave.enable", "Enable Leave Requests", True, None),
            ("leave.half_day", "Enable Half-Day Leave", True, "leave.enable"),
            ("leave.compoff", "Enable Comp-Off", True, "leave.enable"),
            ("leave.wfh", "Enable Work From Home", True, "leave.enable"),
            ("leave.outdoor_duty", "Enable Outdoor Duty", True, "leave.enable"),
            ("leave.encashment", "Enable Leave Encashment", False, "leave.enable"),
        ),
    ),
    (
        "payroll",
        "Payroll",
        (
            ("payroll.enable", "Enable Payroll", True, None),
            ("payroll.advance", "Enable Salary Advance", False, "payroll.enable"),
            ("payroll.incentives", "Enable Incentives", True, "payroll.enable"),
            ("payroll.bonus", "Enable Bonus", False, "payroll.enable"),
            ("payroll.reimbursement", "Enable Reimbursement", True, "payroll.enable"),
            ("payroll.expense_claims", "Enable Expense Claims", True, "payroll.enable"),
        ),
    ),
    (
        "ess",
        "Employee Self Service",
        (
            ("ess.enable", "Enable Employee Dashboard", True, None),
            ("ess.profile_edit", "Enable Profile Editing", True, "ess.enable"),
            ("ess.documents", "Enable Document Upload", True, "ess.enable"),
            ("ess.assets", "Enable Asset Requests", True, "ess.enable"),
            ("ess.exit", "Enable Exit Process", True, "ess.enable"),
            ("ess.transfer", "Enable Transfer Requests", True, "ess.enable"),
        ),
    ),
    (
        "performance",
        "Performance",
        (
            ("performance.enable", "Enable Performance Module", True, None),
            ("performance.kpi", "Enable KPI", True, "performance.enable"),
            ("performance.appraisal", "Enable Appraisal", True, "performance.enable"),
            ("performance.goals", "Enable Goal Tracking", True, "performance.enable"),
            ("performance.reviews", "Enable Performance Reviews", True, "performance.enable"),
        ),
    ),
    (
        "training",
        "Training",
        (
            ("training.enable", "Enable Training", True, None),
            ("training.certifications", "Enable Certifications", True, "training.enable"),
            ("training.skill_matrix", "Enable Skill Matrix", True, "training.enable"),
        ),
    ),
    (
        "recruitment",
        "Recruitment",
        (
            ("recruitment.enable", "Enable Recruitment Features", True, None),
            ("recruitment.referral", "Enable Referral Portal", True, "recruitment.enable"),
            ("recruitment.internal_jobs", "Enable Internal Job Posting", True, "recruitment.enable"),
        ),
    ),
    (
        "client",
        "Client Features",
        (
            ("client.enable", "Enable Client Features", False, None),
            ("client.timesheets", "Client Timesheets", False, "client.enable"),
            ("client.shift_rules", "Client Shift Rules", False, "client.enable"),
            ("client.holiday_calendar", "Client Holiday Calendar", False, "client.enable"),
            ("client.billing_hours", "Client Billing Hours", False, "client.enable"),
        ),
    ),
)

DEFAULT_GROUP_SPECS: tuple[dict[str, Any], ...] = (
    {
        "group_code": "MG-ATT-AUTO",
        "group_name": "Attendance Management (Auto)",
        "description": "Default attendance-managed workforce with full punch and roster automation.",
        "employment_type": "permanent",
    },
    {
        "group_code": "MG-STAFF",
        "group_name": "Staff Group (Non-Technical)",
        "description": "General staff — standard shifts, leave, and payroll.",
        "employment_type": "permanent",
    },
    {
        "group_code": "MG-TECH",
        "group_name": "Technical Group",
        "description": "Technical teams with rotational shifts and extended ESS.",
        "employment_type": "permanent",
    },
    {
        "group_code": "MG-CLIENT",
        "group_name": "Client Group",
        "description": "Client-deployed staff with client calendars and billing.",
        "employment_type": "contract",
    },
)


def default_feature_toggles() -> dict[str, bool]:
    out: dict[str, bool] = {}
    for _sid, _title, items in FEATURE_SECTIONS:
        for key, _label, default_on, _parent in items:
            out[key] = default_on
    return out


def preset_for_group_code(group_code: str) -> dict[str, bool]:
    toggles = default_feature_toggles()
    if group_code == "MG-CLIENT":
        toggles["client.enable"] = True
        toggles["client.timesheets"] = True
        toggles["client.shift_rules"] = True
        toggles["client.holiday_calendar"] = True
        toggles["client.billing_hours"] = True
    if group_code == "MG-TECH":
        toggles["attendance.shift_rotation"] = True
        toggles["attendance.overtime"] = True
    if group_code == "MG-STAFF":
        toggles["attendance.overtime"] = False
        toggles["leave.compoff"] = False
    return toggles


def catalog_for_api() -> list[dict[str, Any]]:
    sections: list[dict[str, Any]] = []
    for section_id, title, items in FEATURE_SECTIONS:
        sections.append(
            {
                "id": section_id,
                "title": title,
                "features": [
                    {"key": key, "label": label, "default": default_on, "parent_key": parent}
                    for key, label, default_on, parent in items
                ],
            }
        )
    return sections


def normalize_toggles(raw: dict[str, Any] | None) -> dict[str, bool]:
    base = default_feature_toggles()
    if not raw:
        return base
    for key in base:
        if key in raw:
            base[key] = bool(raw[key])
    return enforce_parent_rules(base)


def enforce_parent_rules(toggles: dict[str, bool]) -> dict[str, bool]:
    out = dict(toggles)
    for _sid, _title, items in FEATURE_SECTIONS:
        for key, _label, _default_on, parent in items:
            if parent and not out.get(parent):
                out[key] = False
    return out


def validate_toggles(raw: dict[str, Any] | None) -> dict[str, bool]:
    normalized = normalize_toggles(raw)
    for key, enabled in normalized.items():
        if not enabled:
            continue
        parent = _parent_of(key)
        if parent and not normalized.get(parent):
            raise ValueError(f"Cannot enable '{key}' while parent '{parent}' is disabled")
    return normalized


def _parent_of(key: str) -> str | None:
    for _sid, _title, items in FEATURE_SECTIONS:
        for k, _label, _d, parent in items:
            if k == key:
                return parent
    return None


def is_feature_enabled(toggles: dict[str, bool], feature_key: str) -> bool:
    t = normalize_toggles(toggles)
    return bool(t.get(feature_key, False))
