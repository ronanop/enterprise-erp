"""Asset department directory service tests."""

from types import SimpleNamespace
from uuid import uuid4

from modules.asset.repository.department_directory_repository import (
    DEFAULT_DIRECTORY_STATUSES,
    DepartmentDirectoryRow,
)
from modules.asset.service.department_directory_service import DepartmentDirectoryService


def test_default_directory_statuses_are_active_only() -> None:
    assert DEFAULT_DIRECTORY_STATUSES == ("active",)


def test_list_departments_maps_slim_projection(monkeypatch) -> None:
    dept_id = uuid4()
    company_id = uuid4()
    branch_id = uuid4()
    ctx = SimpleNamespace(tenant_id=uuid4(), user_id=uuid4())
    service = DepartmentDirectoryService(db=SimpleNamespace())

    monkeypatch.setattr(
        service._scope,
        "resolve_list_company_id",
        lambda _ctx, cid: cid,
    )
    monkeypatch.setattr(
        service._repo,
        "list_departments",
        lambda *_args, **_kwargs: [
            DepartmentDirectoryRow(
                id=dept_id,
                department_code="ADMIN",
                department_name="Admin",
                company_id=company_id,
                branch_id=branch_id,
                status="active",
            )
        ],
    )

    rows = service.list_departments(ctx, company_id=company_id)
    assert rows == [
        {
            "id": dept_id,
            "department_code": "ADMIN",
            "department_name": "Admin",
            "company_id": company_id,
            "branch_id": branch_id,
            "status": "active",
        }
    ]
