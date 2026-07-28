"""HR Celery tasks."""

from workers.celery_app import celery_app


@celery_app.task(name="hr.attendance_auto_lock")
def attendance_auto_lock() -> dict:
    from datetime import date, timedelta

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.hr.models import HrAttendance

    db = SessionLocal()
    try:
        cutoff = date.today() - timedelta(days=1)
        rows = list(
            db.scalars(
                select(HrAttendance).where(
                    HrAttendance.is_deleted.is_(False),
                    HrAttendance.status.in_(["recorded", "adjusted"]),
                    HrAttendance.attendance_date <= cutoff,
                )
            ).all()
        )
        return {"status": "ok", "candidates": len(rows)}
    finally:
        db.close()


@celery_app.task(name="hr.leave_balance_accrual")
def leave_balance_accrual() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.hr.models import HrLeaveBalance

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(HrLeaveBalance).where(
                    HrLeaveBalance.is_deleted.is_(False),
                    HrLeaveBalance.status == "open",
                )
            ).all()
        )
        return {"status": "ok", "open_balances": len(rows)}
    finally:
        db.close()


@celery_app.task(name="hr.leave_reminders")
def leave_reminders() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.hr.models import HrLeaveRequest

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(HrLeaveRequest).where(
                    HrLeaveRequest.is_deleted.is_(False),
                    HrLeaveRequest.status == "submitted",
                )
            ).all()
        )
        return {"status": "ok", "pending_approvals": len(rows)}
    finally:
        db.close()


@celery_app.task(name="hr.performance_review_due")
def performance_review_due() -> dict:
    from datetime import date

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.hr.models import HrPerformanceReview

    db = SessionLocal()
    try:
        today = date.today()
        rows = list(
            db.scalars(
                select(HrPerformanceReview).where(
                    HrPerformanceReview.is_deleted.is_(False),
                    HrPerformanceReview.status.in_(["draft", "in_progress"]),
                    HrPerformanceReview.period_end <= today,
                )
            ).all()
        )
        return {"status": "ok", "due_reviews": len(rows)}
    finally:
        db.close()


@celery_app.task(name="hr.training_due_alerts")
def training_due_alerts() -> dict:
    """Find trainings scheduled for today and enrolled attendees (for notification workers)."""
    from datetime import date

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.hr.models import HrTraining, HrTrainingAttendance

    db = SessionLocal()
    try:
        today = date.today()
        trainings = list(
            db.scalars(
                select(HrTraining).where(
                    HrTraining.is_deleted.is_(False),
                    HrTraining.status.in_(["planned", "in_progress"]),
                    HrTraining.start_date == today,
                )
            ).all()
        )
        attendee_count = 0
        for trn in trainings:
            attendee_count += len(
                list(
                    db.scalars(
                        select(HrTrainingAttendance).where(
                            HrTrainingAttendance.training_id == trn.id,
                            HrTrainingAttendance.is_deleted.is_(False),
                            HrTrainingAttendance.status == "active",
                        )
                    ).all()
                )
            )
        return {
            "status": "ok",
            "due_trainings": len(trainings),
            "attendees_to_notify": attendee_count,
            "message": "Day-of reminders ready for notification engine",
        }
    finally:
        db.close()


@celery_app.task(name="hr.separation_followups")
def separation_followups() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.hr.models import HrSeparation

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(HrSeparation).where(
                    HrSeparation.is_deleted.is_(False),
                    HrSeparation.status.in_(["submitted", "manager_approved", "hr_approved"]),
                )
            ).all()
        )
        return {"status": "ok", "open_separations": len(rows)}
    finally:
        db.close()
