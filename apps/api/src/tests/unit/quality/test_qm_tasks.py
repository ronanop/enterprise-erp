"""Quality Celery task registration smoke tests."""

from modules.quality import tasks


def test_task_names_registered():
    assert tasks.inspection_failed_alerts.name == "quality.inspection_failed_alerts"
    assert tasks.capa_overdue_alerts.name == "quality.capa_overdue_alerts"
    assert tasks.audit_due_alerts.name == "quality.audit_due_alerts"
    assert tasks.refresh_quality_scores.name == "quality.refresh_quality_scores"
    assert tasks.retry_finance_posting.name == "quality.retry_finance_posting"
    assert tasks.retry_inventory_disposition.name == "quality.retry_inventory_disposition"
