"""Quality Celery tasks."""

from workers.celery_app import celery_app


@celery_app.task(name="quality.inspection_failed_alerts")
def inspection_failed_alerts() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.quality.models import QmIncomingInspection

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(QmIncomingInspection).where(
                    QmIncomingInspection.is_deleted.is_(False),
                    QmIncomingInspection.result == "rejected",
                    QmIncomingInspection.status == "completed",
                )
            ).all()
        )
        return {"status": "ok", "failed_inspections": len(rows)}
    finally:
        db.close()


@celery_app.task(name="quality.capa_overdue_alerts")
def capa_overdue_alerts() -> dict:
    from datetime import date

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.quality.models import QmCapa

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(QmCapa).where(
                    QmCapa.is_deleted.is_(False),
                    QmCapa.status.in_(["approved", "in_progress", "submitted"]),
                    QmCapa.due_date.is_not(None),
                    QmCapa.due_date < date.today(),
                )
            ).all()
        )
        return {"status": "ok", "overdue_capas": len(rows)}
    finally:
        db.close()


@celery_app.task(name="quality.audit_due_alerts")
def audit_due_alerts() -> dict:
    from datetime import date, timedelta

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.quality.models import QmQualityAudit

    db = SessionLocal()
    try:
        horizon = date.today() + timedelta(days=7)
        rows = list(
            db.scalars(
                select(QmQualityAudit).where(
                    QmQualityAudit.is_deleted.is_(False),
                    QmQualityAudit.status == "planned",
                    QmQualityAudit.planned_start.is_not(None),
                    QmQualityAudit.planned_start <= horizon,
                )
            ).all()
        )
        return {"status": "ok", "due_audits": len(rows)}
    finally:
        db.close()


@celery_app.task(name="quality.refresh_quality_scores")
def refresh_quality_scores() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.quality.models import QmQualityScore

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(QmQualityScore).where(
                    QmQualityScore.is_deleted.is_(False),
                    QmQualityScore.status == "draft",
                )
            ).all()
        )
        return {"status": "ok", "draft_scores": len(rows)}
    finally:
        db.close()


@celery_app.task(name="quality.retry_finance_posting")
def retry_finance_posting() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.quality.models import QmIncomingInspection

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(QmIncomingInspection).where(
                    QmIncomingInspection.is_deleted.is_(False),
                    QmIncomingInspection.status == "completed",
                    QmIncomingInspection.period_id.is_not(None),
                    QmIncomingInspection.finance_journal_id.is_(None),
                )
            ).all()
        )
        return {"status": "ok", "pending_finance_posts": len(rows)}
    finally:
        db.close()


@celery_app.task(name="quality.retry_inventory_disposition")
def retry_inventory_disposition() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.quality.models import QmIncomingInspection

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(QmIncomingInspection).where(
                    QmIncomingInspection.is_deleted.is_(False),
                    QmIncomingInspection.status == "completed",
                    QmIncomingInspection.inventory_event_id.is_(None),
                    QmIncomingInspection.warehouse_id.is_not(None),
                )
            ).all()
        )
        return {"status": "ok", "pending_dispositions": len(rows)}
    finally:
        db.close()
