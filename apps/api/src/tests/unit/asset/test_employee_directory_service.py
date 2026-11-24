"""Asset employee directory service tests."""

from types import SimpleNamespace
from uuid import uuid4

from modules.asset.repository.employee_directory_repository import (
    DEFAULT_DIRECTORY_STATUSES,
    EmployeeDirectoryRow,
)
from modules.asset.service.employee_directory_service import EmployeeDirectoryService


def test_default_directory_statuses_are_assignable_only() -> None:
    assert DEFAULT_DIRECTORY_STATUSES == ("active", "probation", "on_leave")


def test_list_employees_maps_slim_projection(monkeypatch) -> None:
    emp_id = uuid4()
    dept_id = uuid4()
    ctx = SimpleNamespace(tenant_id=uuid4(), user_id=uuid4())

    service = EmployeeDirectoryService(db=SimpleNamespace())

    monkeypatch.setattr(
        service._scope,
        "resolve_list_company_id",
        lambda _ctx, company_id: company_id,
    )
    monkeypatch.setattr(
        service._repo,
        "list_employees",
        lambda *_args, **_kwargs: [
            EmployeeDirectoryRow(
                id=emp_id,
                employee_code="EMP-001",
                first_name="Ada",
                last_name="Lovelace",
                department_id=dept_id,
                department_code="ENG",
                department_name="Engineering",
                status="active",
            )
        ],
    )

    rows = service.list_employees(ctx, company_id=uuid4())
    assert len(rows) == 1
    assert rows[0] == {
        "id": emp_id,
        "employee_code": "EMP-001",
        "first_name": "Ada",
        "last_name": "Lovelace",
        "display_name": "Ada Lovelace",
        "department_id": dept_id,
        "department_code": "ENG",
        "department_name": "Engineering",
        "status": "active",
    }


def test_list_employees_validates_branch(monkeypatch) -> None:
    ctx = SimpleNamespace(tenant_id=uuid4(), user_id=uuid4())
    service = EmployeeDirectoryService(db=SimpleNamespace())
    branch_id = uuid4()
    seen: dict[str, object] = {}

    monkeypatch.setattr(
        service._scope,
        "resolve_list_company_id",
        lambda _ctx, company_id: company_id,
    )

    def _validate_branch(_ctx, bid):
        seen["branch_id"] = bid

    monkeypatch.setattr(service._scope, "validate_branch_access", _validate_branch)
    monkeypatch.setattr(service._repo, "list_employees", lambda *_a, **_k: [])

    service.list_employees(ctx, branch_id=branch_id)
    assert seen["branch_id"] == branch_id
