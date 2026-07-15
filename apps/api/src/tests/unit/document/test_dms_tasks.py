"""Unit tests for document Celery tasks."""

from modules.document import tasks as document_tasks


def test_document_task_names_registered():
    assert document_tasks.retention_policy_runner.name == "document.retention_policy_runner"
    assert document_tasks.archive_scheduler.name == "document.archive_scheduler"
    assert document_tasks.document_expiry_notifications.name == "document.document_expiry_notifications"
    assert document_tasks.document_review_reminders.name == "document.document_review_reminders"
    assert document_tasks.metadata_index_refresh.name == "document.metadata_index_refresh"
    assert document_tasks.retry_finance_posting.name == "document.retry_finance_posting"
