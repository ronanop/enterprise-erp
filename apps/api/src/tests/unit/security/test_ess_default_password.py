"""Tests for Timelabs-style default ESS password."""

from datetime import date

from security.ess_default_password import (
    build_ess_default_password,
    normalize_employee_code,
)
from security.password import validate_password_policy


def test_normalize_employee_code():
    assert normalize_employee_code("EMP-004") == "EMP004"
    assert normalize_employee_code(" emp 001 ") == "EMP001"


def test_build_ess_default_password():
    pw = build_ess_default_password("EMP-004", date(1992, 3, 15))
    assert pw == "Emp004@15031992"
    validate_password_policy(pw)
