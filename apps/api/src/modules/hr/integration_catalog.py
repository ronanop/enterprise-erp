"""Selectable endpoints and employee fields for integration API keys."""

from __future__ import annotations

INTEGRATION_ENDPOINTS: list[dict[str, str]] = [
    {
        "id": "employees",
        "label": "Employees",
        "method": "GET",
        "path": "/api/v1/hr/integration/employees",
        "description": "List employees with the selected fields",
    },
]

INTEGRATION_EMPLOYEE_FIELDS: list[dict[str, str]] = [
    {"id": "employee_code", "label": "Employee ID"},
    {"id": "name", "label": "Name"},
    {"id": "first_name", "label": "First name"},
    {"id": "last_name", "label": "Last name"},
    {"id": "email", "label": "Official email"},
    {"id": "mobile", "label": "Mobile"},
    {"id": "designation", "label": "Designation"},
    {"id": "department", "label": "Department"},
    {"id": "manager", "label": "Reporting manager"},
    {"id": "manager_code", "label": "Reporting manager ID"},
    {"id": "branch", "label": "Branch"},
    {"id": "company", "label": "Entity / Company"},
    {"id": "status", "label": "Employment status"},
    {"id": "date_of_joining", "label": "Date of joining"},
    {"id": "date_of_leaving", "label": "Date of leaving"},
    {"id": "gender", "label": "Gender"},
    {"id": "date_of_birth", "label": "Date of birth"},
    {"id": "employment_type", "label": "Employment type"},
    {"id": "work_location", "label": "Work location"},
    {"id": "is_manager", "label": "Is manager"},
    {"id": "leave_balances", "label": "Leave balances (all types)"},
    {"id": "leave_balance_total", "label": "Leave balance total"},
    {"id": "leave_used_total", "label": "Leave used total"},
    {"id": "salary", "label": "Salary (CTC / gross / structure)"},
    {"id": "payroll", "label": "Payroll (latest run line)"},
    {"id": "payslip", "label": "Payslip (latest)"},
    {"id": "shift", "label": "Shift (current assignment)"},
]

ENDPOINT_IDS = {row["id"] for row in INTEGRATION_ENDPOINTS}
FIELD_IDS = {row["id"] for row in INTEGRATION_EMPLOYEE_FIELDS}


def normalize_endpoints(raw: list[str] | None) -> list[str]:
    values = [str(v).strip() for v in (raw or []) if str(v).strip()]
    out = [v for v in values if v in ENDPOINT_IDS]
    return list(dict.fromkeys(out))


def normalize_fields(raw: list[str] | None) -> list[str]:
    values = [str(v).strip() for v in (raw or []) if str(v).strip()]
    out = [v for v in values if v in FIELD_IDS]
    return list(dict.fromkeys(out))
