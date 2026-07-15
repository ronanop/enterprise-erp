"""Helpdesk Celery task stubs per ERD_17 section 15."""

from workers.celery_app import celery_app


@celery_app.task(name="helpdesk.sla_monitor")
def sla_monitor() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.helpdesk.models import HdTicket

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(HdTicket).where(
                    HdTicket.is_deleted.is_(False),
                    HdTicket.sla_status.in_(["at_risk", "breached"]),
                )
            ).all()
        )
        return {"status": "ok", "at_risk_or_breached": len(rows)}
    finally:
        db.close()


@celery_app.task(name="helpdesk.ticket_assignment_reminders")
def ticket_assignment_reminders() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.helpdesk.models import HdTicket

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(HdTicket).where(
                    HdTicket.is_deleted.is_(False),
                    HdTicket.status.in_(["new", "approved"]),
                )
            ).all()
        )
        return {"status": "ok", "unassigned_tickets": len(rows)}
    finally:
        db.close()


@celery_app.task(name="helpdesk.ticket_escalation_monitor")
def ticket_escalation_monitor() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.helpdesk.models import HdTicketEscalation

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(HdTicketEscalation).where(
                    HdTicketEscalation.is_deleted.is_(False),
                    HdTicketEscalation.status == "open",
                )
            ).all()
        )
        return {"status": "ok", "open_escalations": len(rows)}
    finally:
        db.close()


@celery_app.task(name="helpdesk.knowledge_review_reminders")
def knowledge_review_reminders() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.helpdesk.models import HdKnowledgeArticle

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(HdKnowledgeArticle).where(
                    HdKnowledgeArticle.is_deleted.is_(False),
                    HdKnowledgeArticle.status.in_(["draft", "submitted"]),
                )
            ).all()
        )
        return {"status": "ok", "articles_to_review": len(rows)}
    finally:
        db.close()


@celery_app.task(name="helpdesk.customer_feedback_followups")
def customer_feedback_followups() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.helpdesk.models import HdResolution

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(HdResolution).where(
                    HdResolution.is_deleted.is_(False),
                    HdResolution.status == "completed",
                )
            ).all()
        )
        return {"status": "ok", "completed_resolutions": len(rows)}
    finally:
        db.close()


@celery_app.task(name="helpdesk.retry_finance_posting")
def retry_finance_posting() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.helpdesk.models import HdResolution

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(HdResolution).where(
                    HdResolution.is_deleted.is_(False),
                    HdResolution.status == "completed",
                    HdResolution.finance_journal_id.is_(None),
                )
            ).all()
        )
        return {"status": "ok", "unposted_resolutions": len(rows)}
    finally:
        db.close()
