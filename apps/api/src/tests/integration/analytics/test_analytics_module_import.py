"""Integration smoke: Analytics module imports and router mount."""

from modules.analytics.models import BiDashboard, BiDataset, BiReport
from modules.analytics.router import analytics_router
from modules.analytics.service import (
    AnalyticsApplicationService,
    AnalyticsIntegrationService,
    DashboardService,
    DatasetService,
    ReportService,
)
from modules.analytics.service.engines import DashboardEngine, DatasetEngine, ReportEngine


def test_analytics_models_importable():
    assert BiDashboard.__tablename__ == "bi_dashboard"
    assert BiReport.__tablename__ == "bi_report"
    assert BiDataset.__tablename__ == "bi_dataset"


def test_analytics_router_mounted():
    assert analytics_router.prefix == "/analytics"
    paths = [getattr(r, "path", "") for r in analytics_router.routes]
    assert any("/{row_id}" in p for p in paths)
    assert any("dashboards" in p for p in paths)
    assert any("datasets" in p for p in paths)


def test_analytics_services_and_engines_importable():
    assert AnalyticsApplicationService is not None
    assert DashboardService is not None
    assert ReportService is not None
    assert DatasetService is not None
    assert AnalyticsIntegrationService is not None
    assert DashboardEngine is not None
    assert ReportEngine is not None
    assert DatasetEngine is not None
