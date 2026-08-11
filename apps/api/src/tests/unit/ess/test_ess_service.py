"""Unit tests for ESS ownership filtering."""

from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from core.exceptions import ForbiddenException, NotFoundException
from modules.ess.service import EssService
from modules.foundation.domain.value_objects import TenantContext


def _ctx(user_id=None, tenant_id=None) -> TenantContext:
    return TenantContext(
        tenant_id=tenant_id or uuid4(),
        user_id=user_id or uuid4(),
        user_type="employee",
        session_id=uuid4(),
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def _employee(**overrides):
    base = dict(
        id=uuid4(),
        tenant_id=uuid4(),
        company_id=uuid4(),
        branch_id=uuid4(),
        department_id=uuid4(),
        employee_code="E001",
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
        mobile="9999999999",
        designation="Engineer",
        date_of_joining=date(2020, 1, 1),
        reporting_manager_id=None,
        date_of_leaving=None,
        user_id=uuid4(),
        status="active",
        version=1,
        is_deleted=False,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_resolve_employee_missing_raises(monkeypatch):
    svc = EssService(db=SimpleNamespace())
    monkeypatch.setattr(svc._employees, "get_by_user_id", lambda ctx, user_id: None)
    with pytest.raises(NotFoundException):
        svc.resolve_employee(_ctx())


def test_get_me_maps_employee(monkeypatch):
    emp = _employee()
    ctx = _ctx(user_id=emp.user_id, tenant_id=emp.tenant_id)
    svc = EssService(db=SimpleNamespace())
    monkeypatch.setattr(svc._employees, "get_by_user_id", lambda c, u: emp)
    me = svc.get_me(ctx)
    assert me.employee_id == emp.id
    assert me.display_name == "Ada Lovelace"
    assert me.employee_code == "E001"


def test_list_leave_requests_filters_to_self(monkeypatch):
    emp = _employee()
    other_id = uuid4()
    mine = SimpleNamespace(
        id=uuid4(),
        document_number="LR-1",
        leave_type_id=uuid4(),
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 2),
        days_count=Decimal("2"),
        reason="vacation",
        status="submitted",
        employee_id=emp.id,
    )
    other = SimpleNamespace(
        id=uuid4(),
        document_number="LR-2",
        leave_type_id=uuid4(),
        start_date=date(2026, 7, 3),
        end_date=date(2026, 7, 4),
        days_count=Decimal("2"),
        reason=None,
        status="submitted",
        employee_id=other_id,
    )
    svc = EssService(db=SimpleNamespace())
    monkeypatch.setattr(svc._employees, "get_by_user_id", lambda c, u: emp)
    monkeypatch.setattr(svc._leave_requests, "list", lambda c, company_id=None: [mine, other])
    rows = svc.list_leave_requests(_ctx(user_id=emp.user_id))
    assert len(rows) == 1
    assert rows[0].document_number == "LR-1"


def test_get_payslip_rejects_other_employee(monkeypatch):
    emp = _employee()
    other_payslip = SimpleNamespace(
        id=uuid4(),
        document_number="PS-1",
        employee_id=uuid4(),
        employee_code="X",
        employee_name="Other",
        payroll_period_id=uuid4(),
        gross_salary=Decimal("100"),
        total_deductions=Decimal("10"),
        net_salary=Decimal("90"),
        issued_at=None,
        delivery_status="pending",
        payment_status="unpaid",
        status="issued",
        payslip_json=None,
        company_id=emp.company_id,
        branch_id=emp.branch_id,
    )
    svc = EssService(db=SimpleNamespace())
    monkeypatch.setattr(svc._employees, "get_by_user_id", lambda c, u: emp)
    monkeypatch.setattr(svc._payslips, "get", lambda c, row_id: other_payslip)
    with pytest.raises(ForbiddenException):
        svc.get_payslip(_ctx(user_id=emp.user_id), other_payslip.id)
