"""Customer Portal Celery task stubs per ERD_23 section 11."""

from workers.celery_app import celery_app


@celery_app.task(name="portal.session_expiry_sweeper")
def session_expiry_sweeper() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.portal.models import PtPortalSession

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(PtPortalSession).where(
                    PtPortalSession.is_deleted.is_(False),
                    PtPortalSession.status == "active",
                )
            ).all()
        )
        return {"status": "ok", "active_sessions": len(rows)}
    finally:
        db.close()


@celery_app.task(name="portal.order_view_sync")
def order_view_sync() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.portal.models import PtOrderView

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(PtOrderView).where(
                    PtOrderView.is_deleted.is_(False),
                    PtOrderView.status.in_(["visible", "stale"]),
                )
            ).all()
        )
        return {"status": "ok", "order_views": len(rows)}
    finally:
        db.close()


@celery_app.task(name="portal.invoice_view_sync")
def invoice_view_sync() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.portal.models import PtInvoiceView

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(PtInvoiceView).where(
                    PtInvoiceView.is_deleted.is_(False),
                    PtInvoiceView.status.in_(["visible", "stale"]),
                )
            ).all()
        )
        return {"status": "ok", "invoice_views": len(rows)}
    finally:
        db.close()


@celery_app.task(name="portal.notification_dispatcher")
def notification_dispatcher() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.portal.models import PtNotification

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(PtNotification).where(
                    PtNotification.is_deleted.is_(False),
                    PtNotification.delivery_status == "pending",
                )
            ).all()
        )
        return {"status": "ok", "pending_notifications": len(rows)}
    finally:
        db.close()


@celery_app.task(name="portal.login_audit_retention")
def login_audit_retention() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.portal.models import PtLoginAudit

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(PtLoginAudit).where(
                    PtLoginAudit.is_deleted.is_(False),
                    PtLoginAudit.status == "recorded",
                )
            ).all()
        )
        return {"status": "ok", "audit_rows": len(rows)}
    finally:
        db.close()


@celery_app.task(name="portal.ticket_status_poller")
def ticket_status_poller() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.portal.models import PtSupportTicket

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(PtSupportTicket).where(
                    PtSupportTicket.is_deleted.is_(False),
                    PtSupportTicket.status.in_(["submitted", "open", "in_progress", "waiting"]),
                )
            ).all()
        )
        return {"status": "ok", "tickets_to_poll": len(rows)}
    finally:
        db.close()

