"""Service Celery task stubs per ERD_16 section 15."""

from workers.celery_app import celery_app


@celery_app.task(name="service.sla_breach_monitor")
def sla_breach_monitor() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.service.models import SvcServiceRequest

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(SvcServiceRequest).where(
                    SvcServiceRequest.is_deleted.is_(False),
                    SvcServiceRequest.sla_status.in_(["at_risk", "breached"]),
                )
            ).all()
        )
        return {"status": "ok", "at_risk_or_breached": len(rows)}
    finally:
        db.close()


@celery_app.task(name="service.work_order_reminders")
def work_order_reminders() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.service.models import SvcServiceWorkOrder

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(SvcServiceWorkOrder).where(
                    SvcServiceWorkOrder.is_deleted.is_(False),
                    SvcServiceWorkOrder.status.in_(["approved", "assigned", "in_progress"]),
                )
            ).all()
        )
        return {"status": "ok", "open_work_orders": len(rows)}
    finally:
        db.close()


@celery_app.task(name="service.preventive_service_scheduler")
def preventive_service_scheduler() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.service.models import SvcServiceContract

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(SvcServiceContract).where(
                    SvcServiceContract.is_deleted.is_(False),
                    SvcServiceContract.status == "active",
                )
            ).all()
        )
        return {"status": "ok", "active_contracts": len(rows)}
    finally:
        db.close()


@celery_app.task(name="service.service_contract_expiry")
def service_contract_expiry() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.service.models import SvcServiceContract

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(SvcServiceContract).where(
                    SvcServiceContract.is_deleted.is_(False),
                    SvcServiceContract.status == "active",
                )
            ).all()
        )
        return {"status": "ok", "contracts_to_review": len(rows)}
    finally:
        db.close()


@celery_app.task(name="service.customer_feedback_reminders")
def customer_feedback_reminders() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.service.models import SvcServiceResolution

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(SvcServiceResolution).where(
                    SvcServiceResolution.is_deleted.is_(False),
                    SvcServiceResolution.status == "completed",
                )
            ).all()
        )
        return {"status": "ok", "completed_resolutions": len(rows)}
    finally:
        db.close()


@celery_app.task(name="service.retry_finance_posting")
def retry_finance_posting() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.service.models import SvcServiceExpense

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(SvcServiceExpense).where(
                    SvcServiceExpense.is_deleted.is_(False),
                    SvcServiceExpense.status == "approved",
                    SvcServiceExpense.finance_journal_id.is_(None),
                )
            ).all()
        )
        return {"status": "ok", "unposted_expenses": len(rows)}
    finally:
        db.close()


@celery_app.task(name="service.poll_support_mailbox")
def poll_support_mailbox() -> dict:
    """Poll IMAP inbox and create tickets from unread support emails."""
    import email
    import imaplib
    from email.header import decode_header

    from core.config import settings
    from database.session import SessionLocal
    from modules.service.email_inbound_schemas import InboundEmailPayload
    from modules.service.service.email_to_ticket_service import EmailToTicketService
    from shared.email_utils import parse_email_address

    if not settings.email_ticket_enabled or not settings.imap_configured:
        return {"status": "skipped", "reason": "email automation or IMAP not configured"}

    db = SessionLocal()
    processed = 0
    errors = 0
    try:
        mail = imaplib.IMAP4_SSL(settings.imap_host, settings.imap_port)
        mail.login(settings.imap_user, settings.imap_password)
        mail.select(settings.imap_mailbox)
        _, data = mail.search(None, "UNSEEN")
        ids = data[0].split() if data and data[0] else []
        service = EmailToTicketService(db)

        for msg_id in ids:
            try:
                _, msg_data = mail.fetch(msg_id, "(RFC822)")
                if not msg_data or not msg_data[0]:
                    continue
                raw = msg_data[0][1]
                msg = email.message_from_bytes(raw)

                subject_hdr = msg.get("Subject", "")
                decoded_parts = decode_header(subject_hdr)
                subject = ""
                for part, enc in decoded_parts:
                    if isinstance(part, bytes):
                        subject += part.decode(enc or "utf-8", errors="replace")
                    else:
                        subject += str(part)

                from_raw = msg.get("From", "")
                from_name, from_addr = parse_email_address(from_raw)
                message_id_hdr = msg.get("Message-ID") or msg.get("Message-Id")
                date_hdr = msg.get("Date", "")

                body_text = ""
                body_html = ""
                if msg.is_multipart():
                    for part in msg.walk():
                        ctype = part.get_content_type()
                        if ctype == "text/plain" and not body_text:
                            payload = part.get_payload(decode=True)
                            if payload:
                                body_text = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
                        elif ctype == "text/html" and not body_html:
                            payload = part.get_payload(decode=True)
                            if payload:
                                body_html = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
                else:
                    payload = msg.get_payload(decode=True)
                    if payload:
                        body_text = payload.decode(msg.get_content_charset() or "utf-8", errors="replace")

                payload_in = InboundEmailPayload(
                    message_id=EmailToTicketService.message_id_from_headers(
                        message_id_hdr, from_addr, subject, date_hdr
                    ),
                    from_address=from_addr or from_raw,
                    from_name=from_name or None,
                    to_address=msg.get("To"),
                    subject=subject or "(No subject)",
                    body_text=body_text or None,
                    body_html=body_html or None,
                )
                service.process(payload_in, source="imap")
                db.commit()
                mail.store(msg_id, "+FLAGS", "\\Seen")
                processed += 1
            except Exception:
                db.rollback()
                errors += 1

        mail.logout()
        return {"status": "ok", "processed": processed, "errors": errors, "scanned": len(ids)}
    finally:
        db.close()
