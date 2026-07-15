"""Unit tests for Analytics engines."""

from types import SimpleNamespace

from modules.analytics.service.engines import (
    AlertNotificationEngine,
    AlertRuleEngine,
    DashboardEngine,
    DataExportEngine,
    DatasetEngine,
    KpiEngine,
    ReportEngine,
)


def test_dashboard_lifecycle():
    engine = DashboardEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    assert row.status == "submitted"
    engine.approve(row)
    assert row.status == "approved"
    engine.publish(row)
    assert row.status == "published"


def test_report_lifecycle_and_run():
    engine = ReportEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    engine.publish(row)
    engine.run(row)
    assert row.status == "published"


def test_dataset_refresh():
    engine = DatasetEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    engine.refresh(row)
    assert row.status == "refreshing"


def test_kpi_lifecycle():
    engine = KpiEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    assert row.status == "approved"


def test_alert_rule_lifecycle():
    engine = AlertRuleEngine()
    row = SimpleNamespace(status="draft", is_enabled=False)
    engine.submit(row)
    engine.approve(row)
    engine.activate(row)
    assert row.status == "active"
    assert row.is_enabled is True


def test_alert_notification_acknowledge():
    engine = AlertNotificationEngine()
    row = SimpleNamespace(status="open", delivery_status="sent")
    engine.acknowledge(row)
    assert row.status == "acknowledged"


def test_data_export_run():
    engine = DataExportEngine()
    row = SimpleNamespace(status="queued")
    engine.run(row)
    assert row.status == "running"
