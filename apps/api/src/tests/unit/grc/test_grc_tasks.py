"""Unit tests for GRC Celery tasks."""

from modules.grc import tasks as grc_tasks


def test_grc_task_names_registered():
    assert grc_tasks.policy_review_reminders.name == "grc.policy_review_reminders"
    assert grc_tasks.risk_review_scheduler.name == "grc.risk_review_scheduler"
    assert grc_tasks.audit_due_notifications.name == "grc.audit_due_notifications"
    assert grc_tasks.corrective_action_followups.name == "grc.corrective_action_followups"
    assert grc_tasks.compliance_refresh.name == "grc.compliance_refresh"
    assert grc_tasks.retry_finance_posting.name == "grc.retry_finance_posting"
