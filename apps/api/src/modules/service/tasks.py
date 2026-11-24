"""Service Celery task stubs per ERD_16 section 15."""

import logging

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="service.unopened_ticket_roster_reminders")
def unopened_ticket_roster_reminders() -> dict:
    """Every ~10 minutes: notify on-duty roster for tickets that are still unopened."""
    from modules.service.service.roster_open_reminder_service import run_unopened_roster_reminders

    return run_unopened_roster_reminders()


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
    """Poll support mailbox and create tickets.

    Priority: MailAPI (demo proxy) → Microsoft Graph → IMAP.
    Demo mode (EMAIL_TICKET_ACCEPT_ALL=false) only creates tickets when subject
    matches EMAIL_TICKET_SUBJECT_PATTERNS (default: contains \"ticket\").
    """
    from core.config import settings

    if not settings.email_ticket_enabled:
        return {"status": "skipped", "reason": "email automation disabled"}

    if settings.mailapi_configured:
        from modules.foundation.adapters.mailapi_adapter import MailApiAdapter

        if not MailApiAdapter().ping():
            return {
                "status": "error",
                "source": "mailapi",
                "reason": (
                    f"MailAPI unreachable at {settings.mailapi_base_url}. "
                    f"Start MailAPI for {settings.mailapi_mailbox or 'support mailbox'}."
                ),
            }
        result = _poll_support_mailbox_mailapi()
        if result.get("status") != "error":
            return result
        return {
            "status": "error",
            "source": "mailapi",
            "reason": str(result.get("reason") or "MailAPI poll failed"),
        }
    if settings.graph_mail_configured:
        return _poll_support_mailbox_graph()
    if settings.imap_configured:
        return _poll_support_mailbox_imap()
    return {
        "status": "skipped",
        "reason": (
            "Configure MAILAPI_ENABLED/BASE_URL/API_KEY (preferred), "
            "or Microsoft Graph (MICROSOFT_* + GRAPH_MAILBOX_EMAIL), or IMAP credentials"
        ),
    }


def _poll_support_mailbox_mailapi() -> dict:
    """Poll MailAPI proxy inbox and create tickets from matching messages."""
    from sqlalchemy import select

    from core.config import settings
    from database.session import SessionLocal
    from modules.foundation.adapters.mailapi_adapter import MailApiAdapter
    from modules.service.email_inbound_schemas import InboundEmailPayload
    from modules.service.models import SvcEmailIngestLog
    from modules.service.service.email_to_ticket_service import EmailToTicketService
    from modules.service.service.mailbox_ticket_classifier import skip_ticket_reason
    from shared.email_utils import parse_email_address

    db = SessionLocal()
    processed = 0
    errors = 0
    skipped = 0
    scanned = 0
    try:
        adapter = MailApiAdapter()
        mailbox, messages = adapter.list_messages(top=40, unread_only=False)
        scanned = len(messages)
        service = EmailToTicketService(db)

        for msg in messages:
            try:
                external_id = str(msg.get("id") or "").strip()
                if not external_id:
                    continue
                subject = (msg.get("subject") or "(No subject)").strip()
                from_name, from_addr = parse_email_address(msg.get("from") or "")
                from_addr = (from_addr or "").strip()
                if not from_addr:
                    skipped += 1
                    continue

                # Demo filter: subject must contain "ticket" (unless ACCEPT_ALL).
                if skip_ticket_reason(subject=subject, from_address=from_addr):
                    skipped += 1
                    continue

                received = str(msg.get("receivedDateTime") or "")
                message_id = EmailToTicketService.message_id_from_headers(
                    external_id, from_addr, subject, received
                )
                existing = db.scalar(
                    select(SvcEmailIngestLog.id)
                    .where(SvcEmailIngestLog.message_id == message_id)
                    .limit(1)
                )
                if existing:
                    skipped += 1
                    continue

                # Prefer full body; if MailAPI is slow/down, still create from list preview.
                detail: dict = {}
                try:
                    _, detail = adapter.get_message(external_id)
                except Exception as detail_exc:
                    logger.warning(
                        "MailAPI get_message failed for %s — using list preview: %s",
                        external_id[:48],
                        detail_exc,
                    )
                    detail = dict(msg)

                body_text = (
                    detail.get("bodyText")
                    or detail.get("body_text")
                    or detail.get("preview")
                    or detail.get("bodyPreview")
                    or msg.get("preview")
                    or msg.get("bodyPreview")
                    or ""
                )
                body_html = detail.get("bodyHtml") or detail.get("body_html")
                nested = detail.get("body")
                if isinstance(nested, dict) and nested.get("content"):
                    ctype = str(nested.get("contentType") or "text").lower()
                    if ctype == "html":
                        body_html = body_html or nested.get("content")
                    else:
                        body_text = body_text or nested.get("content") or ""
                to_list = detail.get("toRecipients") or msg.get("toRecipients") or []
                to_addr = None
                if isinstance(to_list, list) and to_list:
                    first = to_list[0]
                    to_addr = first if isinstance(first, str) else None

                payload_in = InboundEmailPayload(
                    message_id=message_id,
                    from_address=from_addr,
                    from_name=from_name or None,
                    to_address=to_addr or mailbox or settings.mailapi_mailbox or None,
                    subject=subject or "(No subject)",
                    body_text=body_text or None,
                    body_html=body_html or None,
                )
                result = service.process(payload_in, source="mailapi")
                if result.status == "skipped":
                    skipped += 1
                    db.commit()
                    continue
                if result.status == "duplicate":
                    skipped += 1
                    db.commit()
                    continue
                db.commit()
                if result.status == "processed" and result.ticket_id:
                    processed += 1
                    logger.info(
                        "MailAPI created ticket %s from subject=%r",
                        result.document_number,
                        subject[:120],
                    )
                else:
                    skipped += 1
            except Exception:
                logger.exception("MailAPI ticket ingest failed for one message")
                db.rollback()
                errors += 1

        return {
            "status": "ok",
            "source": "mailapi",
            "mailbox": mailbox or settings.mailapi_mailbox,
            "processed": processed,
            "skipped": skipped,
            "errors": errors,
            "scanned": scanned,
        }
    except Exception as exc:
        return {"status": "error", "source": "mailapi", "reason": str(exc)[:800]}
    finally:
        db.close()


def _poll_support_mailbox_graph() -> dict:
    from core.config import settings
    from database.session import SessionLocal
    from modules.foundation.adapters.graph_email_adapter import GraphEmailAdapter
    from modules.service.email_inbound_schemas import InboundEmailPayload
    from modules.service.service.email_to_ticket_service import EmailToTicketService
    from modules.service.service.mailbox_ticket_classifier import is_noise_sender, skip_ticket_reason

    db = SessionLocal()
    processed = 0
    errors = 0
    scanned = 0
    skipped = 0
    try:
        adapter = GraphEmailAdapter()
        messages = adapter.list_unread_messages(top=25)
        scanned = len(messages)
        service = EmailToTicketService(db)
        for msg in messages:
            try:
                from_obj = ((msg.get("from") or {}).get("emailAddress") or {})
                from_addr = (from_obj.get("address") or "").strip()
                from_name = (from_obj.get("name") or "").strip() or None
                if not from_addr:
                    continue
                subject = msg.get("subject") or "(No subject)"
                skip_reason = skip_ticket_reason(subject=subject, from_address=from_addr)
                graph_id = msg.get("id")
                if skip_reason:
                    skipped += 1
                    if graph_id:
                        try:
                            adapter.mark_message_read(str(graph_id))
                        except Exception:
                            pass
                    continue
                body = msg.get("body") or {}
                content = body.get("content") or msg.get("bodyPreview") or ""
                content_type = (body.get("contentType") or "text").lower()
                body_text = content if content_type != "html" else None
                body_html = content if content_type == "html" else None
                to_recipients = msg.get("toRecipients") or []
                to_addr = None
                if to_recipients:
                    to_addr = ((to_recipients[0].get("emailAddress") or {}).get("address"))
                internet_id = msg.get("internetMessageId")
                received = msg.get("receivedDateTime") or ""
                payload_in = InboundEmailPayload(
                    message_id=EmailToTicketService.message_id_from_headers(
                        internet_id, from_addr, subject, received
                    ),
                    from_address=from_addr,
                    from_name=from_name,
                    to_address=to_addr or settings.resolved_graph_mailbox(),
                    subject=subject,
                    body_text=body_text,
                    body_html=body_html,
                )
                result = service.process(payload_in, source="graph")
                if result.status == "skipped":
                    if graph_id and is_noise_sender(from_addr):
                        try:
                            adapter.mark_message_read(str(graph_id))
                        except Exception:
                            pass
                    continue
                db.commit()
                graph_id = msg.get("id")
                if graph_id:
                    try:
                        adapter.mark_message_read(str(graph_id))
                    except Exception:
                        pass
                processed += 1
            except Exception:
                db.rollback()
                errors += 1
        return {
            "status": "ok",
            "source": "graph",
            "mailbox": settings.resolved_graph_mailbox(),
            "processed": processed,
            "skipped": skipped,
            "errors": errors,
            "scanned": scanned,
        }
    except Exception as exc:
        return {"status": "error", "source": "graph", "reason": str(exc)[:800]}
    finally:
        db.close()


def _poll_support_mailbox_imap() -> dict:
    """Poll IMAP inbox and create tickets from unread support emails."""
    import email
    import imaplib
    from email.header import decode_header

    from core.config import settings
    from database.session import SessionLocal
    from modules.service.email_inbound_schemas import InboundEmailPayload
    from modules.service.service.email_to_ticket_service import EmailToTicketService
    from modules.service.service.mailbox_ticket_classifier import skip_ticket_reason
    from shared.email_utils import parse_email_address

    db = SessionLocal()
    processed = 0
    errors = 0
    skipped = 0
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
                from_addr = from_addr or from_raw
                reason = skip_ticket_reason(subject=subject or "(No subject)", from_address=from_addr)
                if reason:
                    skipped += 1
                    mail.store(msg_id, "+FLAGS", "\\Seen")
                    continue
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
                    from_address=from_addr,
                    from_name=from_name or None,
                    to_address=msg.get("To"),
                    subject=subject or "(No subject)",
                    body_text=body_text or None,
                    body_html=body_html or None,
                )
                result = service.process(payload_in, source="imap")
                if result.status == "skipped":
                    continue
                db.commit()
                mail.store(msg_id, "+FLAGS", "\\Seen")
                processed += 1
            except Exception:
                db.rollback()
                errors += 1

        mail.logout()
        return {
            "status": "ok",
            "source": "imap",
            "processed": processed,
            "skipped": skipped,
            "errors": errors,
            "scanned": len(ids),
        }
    finally:
        db.close()
