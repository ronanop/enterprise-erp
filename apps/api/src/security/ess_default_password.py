"""Default ESS login password: normalized employee code + DOB (DDMMYYYY), ERP-policy safe."""

from __future__ import annotations

import re
from datetime import date


def normalize_employee_code(employee_code: str) -> str:
    """Strip non-alphanumeric characters and uppercase (EMP-004 → EMP004)."""
    return re.sub(r"[^A-Za-z0-9]", "", (employee_code or "")).upper()


def format_dob_for_password(dob: date) -> str:
    return dob.strftime("%d%m%Y")


def build_ess_default_password(employee_code: str, date_of_birth: date | None) -> str:
    """Timelabs-style mnemonic password that satisfies platform password policy.

    Format: ``{First}{restLower}@{DDMMYYYY}`` e.g. ``Emp004@07051994`` for EMP-004.
    """
    if date_of_birth is None:
        raise ValueError("date_of_birth is required to build default ESS password")
    code = normalize_employee_code(employee_code)
    if not code:
        raise ValueError("employee_code is required to build default ESS password")
    if len(code) == 1:
        styled = code.upper()
    else:
        styled = f"{code[0].upper()}{code[1:].lower()}"
    return f"{styled}@{format_dob_for_password(date_of_birth)}"
