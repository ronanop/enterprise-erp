"""KPI compute_current_value aggregation tests — does not touch KpiEngine."""

from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from modules.analytics.domain.enums import SourceKpiKey
from modules.analytics.domain.exceptions import UnknownKpiSource
from modules.analytics.service.kpi_service import KpiService


class _FakeRepo:
    def __init__(self, row):
        self.row = row

    def get(self, ctx, row_id):
        return self.row

    def update(self, ctx, row_id, **fields):
        for k, v in fields.items():
            setattr(self.row, k, v)
        return self.row


class _FakeIntegration:
    def headcount_by_department(self, ctx, company_id):
        return 8, [
            {"dimension_label": "Human Resources", "value": 8},
            {"dimension_label": "Finance", "value": 0},
        ]

    def count_active_customers(self, ctx, company_id):
        return 3

    def count_active_vendors(self, ctx, company_id):
        return 2

    def get_total_revenue(self, ctx, company_id):
        return Decimal("50000"), []

    def get_cash_position(self, ctx, company_id):
        return Decimal("0"), [{"dimension_label": "Cash", "value": Decimal("0")}]

    def get_ar_aging(self, ctx, company_id):
        return Decimal("50000"), [{"dimension_label": "Unbucketed", "value": Decimal("50000")}]

    def get_ap_aging(self, ctx, company_id):
        return Decimal("30000"), []


def _svc(row) -> KpiService:
    svc = KpiService.__new__(KpiService)
    svc._repo = _FakeRepo(row)
    svc._integration = _FakeIntegration()
    return svc


def test_compute_headcount_writes_real_total():
    row = SimpleNamespace(
        id=uuid4(),
        company_id=uuid4(),
        kpi_code="HCNT",
        source_kpi_key=SourceKpiKey.ORG_HEADCOUNT_BY_DEPARTMENT.value,
        current_value=None,
        target_value=Decimal("20"),
    )
    updated = _svc(row).compute_current_value(SimpleNamespace(), row.id)
    assert updated.current_value == Decimal("8")


def test_detail_headcount_includes_department_breakdown():
    row = SimpleNamespace(
        id=uuid4(),
        company_id=uuid4(),
        kpi_code="HCNT",
        source_kpi_key="org.headcount_by_department",
        current_value=Decimal("8"),
        target_value=Decimal("20"),
    )
    detail = _svc(row).get_detail(SimpleNamespace(), row.id)
    assert detail["kpi_code"] == "HCNT"
    assert detail["current_value"] == Decimal("8")
    assert detail["breakdown"][0]["dimension_label"] == "Human Resources"
    assert detail["breakdown"][0]["value"] == 8
    assert detail["history"] == []


def test_master_customers_breakdown_empty():
    row = SimpleNamespace(
        id=uuid4(),
        company_id=uuid4(),
        kpi_code="ACUST",
        source_kpi_key="master.active_customers",
        current_value=None,
        target_value=None,
    )
    detail = _svc(row).get_detail(SimpleNamespace(), row.id)
    assert detail["current_value"] == Decimal("3")
    assert detail["breakdown"] == []


def test_finance_revenue_compute():
    row = SimpleNamespace(
        id=uuid4(),
        company_id=uuid4(),
        kpi_code="REV",
        source_kpi_key="finance.total_revenue",
        current_value=None,
        target_value=None,
    )
    updated = _svc(row).compute_current_value(SimpleNamespace(), row.id)
    assert updated.current_value == Decimal("50000")


def test_unknown_source_raises():
    row = SimpleNamespace(
        id=uuid4(),
        company_id=uuid4(),
        kpi_code="X",
        source_kpi_key="not.a.key",
        current_value=None,
        target_value=None,
    )
    with pytest.raises(UnknownKpiSource):
        _svc(row).compute_current_value(SimpleNamespace(), row.id)
