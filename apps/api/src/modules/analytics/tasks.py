"""Analytics Celery task stubs per ERD_20 section 15."""

from workers.celery_app import celery_app


@celery_app.task(name="analytics.dataset_refresh_scheduler")
def dataset_refresh_scheduler() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.analytics.models import BiDataRefresh

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(BiDataRefresh).where(
                    BiDataRefresh.is_deleted.is_(False),
                    BiDataRefresh.status.in_(["submitted", "queued"]),
                )
            ).all()
        )
        return {"status": "ok", "refreshes_due": len(rows)}
    finally:
        db.close()


@celery_app.task(name="analytics.dashboard_cache_refresh")
def dashboard_cache_refresh() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.analytics.models import BiDashboard

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(BiDashboard).where(
                    BiDashboard.is_deleted.is_(False),
                    BiDashboard.status.in_(["published", "approved"]),
                )
            ).all()
        )
        return {"status": "ok", "dashboards": len(rows)}
    finally:
        db.close()


@celery_app.task(name="analytics.report_scheduler")
def report_scheduler() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.analytics.models import BiReportSchedule

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(BiReportSchedule).where(
                    BiReportSchedule.is_deleted.is_(False),
                    BiReportSchedule.is_enabled.is_(True),
                    BiReportSchedule.status == "active",
                )
            ).all()
        )
        return {"status": "ok", "schedules_due": len(rows)}
    finally:
        db.close()


@celery_app.task(name="analytics.alert_monitor")
def alert_monitor() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.analytics.models import BiAlertRule

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(BiAlertRule).where(
                    BiAlertRule.is_deleted.is_(False),
                    BiAlertRule.is_enabled.is_(True),
                    BiAlertRule.status == "active",
                )
            ).all()
        )
        return {"status": "ok", "alert_rules": len(rows)}
    finally:
        db.close()


@celery_app.task(name="analytics.usage_statistics_refresh")
def usage_statistics_refresh() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.analytics.models import BiUsageAudit

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(BiUsageAudit).where(BiUsageAudit.is_deleted.is_(False))
            ).all()
        )
        return {"status": "ok", "usage_rows": len(rows)}
    finally:
        db.close()


@celery_app.task(name="analytics.retry_failed_refresh")
def retry_failed_refresh() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.analytics.models import BiDataRefresh, BiReportExecution

    db = SessionLocal()
    try:
        refreshes = list(
            db.scalars(
                select(BiDataRefresh).where(
                    BiDataRefresh.is_deleted.is_(False),
                    BiDataRefresh.status == "failed",
                )
            ).all()
        )
        executions = list(
            db.scalars(
                select(BiReportExecution).where(
                    BiReportExecution.is_deleted.is_(False),
                    BiReportExecution.status == "failed",
                )
            ).all()
        )
        return {
            "status": "ok",
            "failed_refreshes": len(refreshes),
            "failed_executions": len(executions),
        }
    finally:
        db.close()
