"""Unit tests for HR Celery task registration."""

from modules.hr import tasks


def test_hr_tasks_registered():
    assert callable(tasks.attendance_auto_lock)
    assert callable(tasks.leave_balance_accrual)
    assert callable(tasks.leave_carry_forward_year_end)
    assert callable(tasks.leave_reminders)
    assert callable(tasks.performance_review_due)
    assert callable(tasks.training_due_alerts)
    assert callable(tasks.separation_followups)
