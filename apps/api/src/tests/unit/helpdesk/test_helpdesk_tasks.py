"""Unit tests for helpdesk Celery tasks."""

from modules.helpdesk import tasks as helpdesk_tasks


def test_helpdesk_task_names_registered():
    assert helpdesk_tasks.sla_monitor.name == "helpdesk.sla_monitor"
    assert helpdesk_tasks.ticket_assignment_reminders.name == "helpdesk.ticket_assignment_reminders"
    assert helpdesk_tasks.ticket_escalation_monitor.name == "helpdesk.ticket_escalation_monitor"
    assert helpdesk_tasks.knowledge_review_reminders.name == "helpdesk.knowledge_review_reminders"
    assert helpdesk_tasks.customer_feedback_followups.name == "helpdesk.customer_feedback_followups"
    assert helpdesk_tasks.retry_finance_posting.name == "helpdesk.retry_finance_posting"
