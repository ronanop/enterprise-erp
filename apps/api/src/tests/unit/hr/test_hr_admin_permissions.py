"""HR Superadmin permission pack invariants."""

from modules.hr.permissions import (
    HR_ADMIN_PERMISSIONS,
    HR_ADMIN_WORKSPACE_PERMISSIONS,
    HR_SUPERADMIN_PERMISSION,
)


def test_hr_admin_does_not_get_superadmin_panel_permission() -> None:
    assert HR_SUPERADMIN_PERMISSION not in HR_ADMIN_PERMISSIONS
    assert HR_SUPERADMIN_PERMISSION not in HR_ADMIN_WORKSPACE_PERMISSIONS


def test_hr_admin_workspace_includes_employee_create() -> None:
    assert "master.employee:create" in HR_ADMIN_WORKSPACE_PERMISSIONS
    assert "master.employee:update" in HR_ADMIN_WORKSPACE_PERMISSIONS
    assert "hr.employee_profile:create" in HR_ADMIN_WORKSPACE_PERMISSIONS


def test_generated_hr_login_password_meets_policy() -> None:
    from security.password import validate_password_policy
    from modules.hr.service.superadmin_service import generate_hr_login_password

    for _ in range(20):
        password = generate_hr_login_password()
        validate_password_policy(password)
        assert len(password) >= 8

