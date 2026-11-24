"""Default ESS login password: normalized employee code + DOB (DDMMYYYY), ERP-policy safe."""

from __future__ import annotations

import re
from datetime import date, datetime


def normalize_employee_code(employee_code: str) -> str:
    """Strip non-alphanumeric characters and uppercase (EMP-004 → EMP004)."""
    return re.sub(r"[^A-Za-z0-9]", "", (employee_code or "")).upper()


def format_dob_for_password(dob: date) -> str:
    return dob.strftime("%d%m%Y")


def build_ess_default_password(employee_code: str, date_of_birth: date | None) -> str:
    """Default employee password format: {CODE}{DDMMYYYY} e.g. CT535415102003."""
    if date_of_birth is None:
        raise ValueError("date_of_birth is required to build default ESS password")
    code = normalize_employee_code(employee_code)
    if not code:
        raise ValueError("employee_code is required to build default ESS password")
    return f"{code}{format_dob_for_password(date_of_birth)}"


def parse_ess_dob_password(password: str, employee_code: str) -> date | None:
    """If password is CODE+DDMMYYYY, return the parsed DOB; else None."""
    if not password or not employee_code:
        return None
    clean_code = normalize_employee_code(employee_code)
    raw = password.strip().upper()
    if not clean_code or not raw.startswith(clean_code):
        return None
    dob_part = raw[len(clean_code) :]
    if len(dob_part) != 8 or not dob_part.isdigit():
        return None
    try:
        parsed = datetime.strptime(dob_part, "%d%m%Y").date()
    except ValueError:
        return None
    # Reasonable employee DOB window
    year = parsed.year
    if year < 1945 or year > 2012:
        return None
    return parsed


def verify_ess_dob_password(password: str, employee_code: str, date_of_birth: date | None) -> bool:
    """Verify if the entered password matches employee code + DOB."""
    if date_of_birth is None or not employee_code or not password:
        return False
    clean_code = normalize_employee_code(employee_code)
    dob_str = format_dob_for_password(date_of_birth)

    # Primary format: CT535415102003
    if password.strip().upper() == f"{clean_code}{dob_str}".upper():
        return True

    # Legacy format: Ct5354@15102003
    if len(clean_code) == 1:
        styled = clean_code.upper()
    else:
        styled = f"{clean_code[0].upper()}{clean_code[1:].lower()}"
    if password.strip() == f"{styled}@{dob_str}":
        return True

    return False

