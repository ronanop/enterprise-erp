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


def test_hr_admin_assign_request_accepts_company_ids() -> None:
    from uuid import uuid4

    from modules.hr.schemas import HrAdminAssignRequest, HrAdminEntitiesRequest, HrAdminRecord

    employee_id = uuid4()
    company_id = uuid4()
    body = HrAdminAssignRequest(employee_id=employee_id, company_ids=[company_id])
    assert body.company_ids == [company_id]

    entities = HrAdminEntitiesRequest(company_ids=[company_id])
    assert entities.company_ids == [company_id]

    record = HrAdminRecord(
        employee_id=employee_id,
        employee_code="EMP-1",
        display_name="Test User",
        email="hr@example.com",
        designation="HR",
        user_id=uuid4(),
        company_ids=[company_id],
    )
    assert record.company_ids == [company_id]

