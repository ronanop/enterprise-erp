"""Unit tests for additive quality report helpers and existing KPI shape."""

from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from modules.quality.service.report_service import warranty_trend_rows


def test_warranty_trend_groups_by_product_component_period():
    pid = uuid4()
    cid = uuid4()
    rows = [
        SimpleNamespace(
            document_date=date(2026, 8, 1),
            product_id=pid,
            component_product_id=cid,
            quantity=Decimal("2"),
        ),
        SimpleNamespace(
            document_date=date(2026, 8, 20),
            product_id=pid,
            component_product_id=cid,
            quantity=Decimal("1"),
        ),
        SimpleNamespace(
            document_date=date(2026, 7, 5),
            product_id=pid,
            component_product_id=None,
            quantity=Decimal("4"),
        ),
    ]
    data = warranty_trend_rows(rows)
    assert len(data) == 2
    august = next(r for r in data if r["period"] == "2026-08")
    assert august["claim_count"] == 2
    assert august["quantity"] == 3.0
    assert august["product_id"] == str(pid)
    assert august["component_product_id"] == str(cid)


def test_existing_kpi_dashboard_method_unchanged_on_class():
    from modules.quality.service.report_service import QualityReportService

    assert QualityReportService.inspection_summary is not None
    assert QualityReportService.defect_summary is not None
    assert QualityReportService.ncr_summary is not None
    assert QualityReportService.capa_summary is not None
    assert QualityReportService.kpi_dashboard is not None
    assert hasattr(QualityReportService, "ppap_status_summary")
    assert hasattr(QualityReportService, "scar_summary")
    assert hasattr(QualityReportService, "spc_capability_summary")
    assert hasattr(QualityReportService, "warranty_trend")
