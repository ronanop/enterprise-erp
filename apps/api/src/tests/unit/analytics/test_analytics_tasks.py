"""Analytics Celery task name registration tests."""

from modules.analytics import tasks


def test_analytics_task_names_registered():
    assert tasks.dataset_refresh_scheduler.name == "analytics.dataset_refresh_scheduler"
    assert tasks.dashboard_cache_refresh.name == "analytics.dashboard_cache_refresh"
    assert tasks.report_scheduler.name == "analytics.report_scheduler"
    assert tasks.alert_monitor.name == "analytics.alert_monitor"
    assert tasks.usage_statistics_refresh.name == "analytics.usage_statistics_refresh"
    assert tasks.retry_failed_refresh.name == "analytics.retry_failed_refresh"
