"""Quality Celery task registration smoke tests."""

from modules.quality import tasks


def test_task_names_registered():
    assert tasks.inspection_failed_alerts.name == "quality.inspection_failed_alerts"
    assert tasks.capa_overdue_alerts.name == "quality.capa_overdue_alerts"
    assert tasks.audit_due_alerts.name == "quality.audit_due_alerts"
    assert tasks.refresh_quality_scores.name == "quality.refresh_quality_scores"
    assert tasks.retry_finance_posting.name == "quality.retry_finance_posting"
    assert tasks.retry_inventory_disposition.name == "quality.retry_inventory_disposition"
    assert tasks.spc_out_of_control_alert.name == "quality.spc_out_of_control_alert"
    assert tasks.ppap_pending_approval_alerts.name == "quality.ppap_pending_approval_alerts"
    assert tasks.scar_overdue_alerts.name == "quality.scar_overdue_alerts"


def test_quality_due_date_tasks_on_beat_schedule():
    from workers.celery_app import celery_app

    names = {entry["task"] for entry in celery_app.conf.beat_schedule.values()}
    assert "quality.spc_out_of_control_alert" in names
    assert "quality.ppap_pending_approval_alerts" in names
    assert "quality.scar_overdue_alerts" in names
