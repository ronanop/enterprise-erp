"""HR sidebar nav key helpers."""

from modules.hr.domain.hr_nav_access import default_hr_nav_keys, normalize_hr_nav_keys


def test_normalize_drops_unknown_and_duplicates() -> None:
    keys = normalize_hr_nav_keys(["dashboard", "payroll-run", "dashboard", "not-a-key", " "])
    assert keys == ["dashboard", "payroll-run"]


def test_default_keys_include_payroll_and_org() -> None:
    keys = default_hr_nav_keys()
    assert "attendance" in keys
    assert "payroll-salary-configuration" in keys
    assert "org-leave-setup" in keys
    assert "superadmin" not in keys
