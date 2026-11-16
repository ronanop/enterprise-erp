"""Read support mailbox messages for Service Head / Engineer inbox UI."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import settings
from modules.foundation.adapters.graph_email_adapter import GraphEmailAdapter
from modules.service.email_inbound_schemas import MailboxMessageDetail, MailboxMessageItem, MailboxMessagesResult
from modules.service.models import SvcEmailIngestLog
from modules.service.models.service_request import SvcServiceRequest
from modules.service.service.email_to_ticket_service import EmailToTicketService
from modules.service.service.mailbox_ticket_classifier import classify_mailbox_message, resolved_subject_patterns
from shared.email_utils import strip_html


def _message_id_keys(*values: str | None) -> list[str]:
    keys: list[str] = []
    for raw in values:
        if not raw:
            continue
        for candidate in (raw.strip(),):
            if not candidate:
                continue
            if candidate not in keys:
                keys.append(candidate)
            if candidate.startswith("<") and candidate.endswith(">"):
                inner = candidate[1:-1].strip()
                if inner and inner not in keys:
                    keys.append(inner)
            else:
                wrapped = f"<{candidate}>"
                if wrapped not in keys:
                    keys.append(wrapped)
    return keys


def _ticket_fields(ticket: SvcServiceRequest | None) -> dict:
    if ticket is None:
        return {
            "ticket_id": None,
            "document_number": None,
            "ticket_status": None,
            "opened_at": None,
            "resolved_at": None,
            "closed_at": None,
        }
    return {
        "ticket_id": ticket.id,
        "document_number": ticket.document_number,
        "ticket_status": ticket.status,
        "opened_at": ticket.opened_at,
        "resolved_at": ticket.resolved_at,
        "closed_at": ticket.closed_at,
    }


def _find_ingest_log(
    ingest_by_message: dict[str, SvcEmailIngestLog],
    *,
    message_id: str,
    internet_message_id: str | None,
) -> SvcEmailIngestLog | None:
    for key in _message_id_keys(message_id, internet_message_id):
        log = ingest_by_message.get(key)
        if log is not None:
            return log
    return None


def _parse_graph_message(msg: dict) -> dict:
    from_obj = ((msg.get("from") or {}).get("emailAddress") or {})
    from_addr = (from_obj.get("address") or "").strip()
    from_name = (from_obj.get("name") or "").strip() or None
    body = msg.get("body") or {}
    content = body.get("content") or msg.get("bodyPreview") or ""
    content_type = (body.get("contentType") or "text").lower()
    body_text = content if content_type != "html" else strip_html(content)
    body_html = content if content_type == "html" else None
    received_raw = msg.get("receivedDateTime")
    received_at = None
    if received_raw:
        try:
            received_at = datetime.fromisoformat(str(received_raw).replace("Z", "+00:00"))
        except ValueError:
            received_at = None
    subject = (msg.get("subject") or "(No subject)").strip()
    internet_id = msg.get("internetMessageId")
    message_id = EmailToTicketService.message_id_from_headers(
        internet_id, from_addr, subject, str(received_raw or "")
    )
    return {
        "graph_id": str(msg.get("id") or ""),
        "message_id": message_id,
        "internet_message_id": internet_id,
        "from_address": from_addr,
        "from_name": from_name,
        "subject": subject[:500],
        "body_preview": (msg.get("bodyPreview") or body_text or "")[:2000],
        "body_text": body_text[:50000] if body_text else None,
        "body_html": body_html[:50000] if body_html else None,
        "received_at": received_at,
        "is_read": bool(msg.get("isRead")),
    }


class MailboxInboxService:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_messages(self, *, top: int = 50) -> MailboxMessagesResult:
        if not settings.graph_mail_configured:
            raise RuntimeError(
                "Microsoft Graph mailbox is not configured. Set MICROSOFT_* / AZURE_* and GRAPH_MAILBOX_EMAIL."
            )
        adapter = GraphEmailAdapter()
        raw_messages = adapter.list_inbox_messages(top=top, unread_only=False, order="desc")
        parsed = [_parse_graph_message(msg) for msg in raw_messages if msg.get("id")]
        lookup_keys: set[str] = set()
        for row in parsed:
            lookup_keys.update(_message_id_keys(row["message_id"], row.get("internet_message_id")))

        ingest_by_message: dict[str, SvcEmailIngestLog] = {}
        if lookup_keys:
            logs = self._db.scalars(
                select(SvcEmailIngestLog).where(SvcEmailIngestLog.message_id.in_(lookup_keys))
            ).all()
            for log in logs:
                for key in _message_id_keys(log.message_id):
                    ingest_by_message.setdefault(key, log)

        ticket_ids = [log.request_id for log in ingest_by_message.values() if log.request_id]
        tickets_by_id: dict[UUID, SvcServiceRequest] = {}
        if ticket_ids:
            tickets = self._db.scalars(
                select(SvcServiceRequest).where(SvcServiceRequest.id.in_(ticket_ids))
            ).all()
            tickets_by_id = {ticket.id: ticket for ticket in tickets}

        items: list[MailboxMessageItem] = []
        for row in parsed:
            log = _find_ingest_log(
                ingest_by_message,
                message_id=row["message_id"],
                internet_message_id=row.get("internet_message_id"),
            )
            ticket = tickets_by_id.get(log.request_id) if log and log.request_id else None
            ticket_data = _ticket_fields(ticket)
            classification = classify_mailbox_message(
                subject=row["subject"],
                from_address=row["from_address"],
            )
            items.append(
                MailboxMessageItem(
                    graph_id=row["graph_id"],
                    message_id=row["message_id"],
                    internet_message_id=row["internet_message_id"],
                    from_address=row["from_address"],
                    from_name=row["from_name"],
                    subject=row["subject"],
                    body_preview=row["body_preview"],
                    received_at=row["received_at"],
                    is_read=row["is_read"],
                    classification=classification,
                    ingest_status=log.status if log else None,
                    **ticket_data,
                )
            )

        return MailboxMessagesResult(
            mailbox=settings.resolved_graph_mailbox(),
            total=len(items),
            subject_patterns=resolved_subject_patterns(),
            messages=items,
        )

    def get_message(self, graph_id: str) -> MailboxMessageDetail:
        if not settings.graph_mail_configured:
            raise RuntimeError("Microsoft Graph mailbox is not configured.")
        adapter = GraphEmailAdapter()
        msg = adapter.get_message(graph_id)
        row = _parse_graph_message(msg)
        logs = self._db.scalars(
            select(SvcEmailIngestLog).where(
                SvcEmailIngestLog.message_id.in_(
                    _message_id_keys(row["message_id"], row.get("internet_message_id"))
                )
            )
        ).all()
        ingest_by_message = {}
        for log in logs:
            for key in _message_id_keys(log.message_id):
                ingest_by_message.setdefault(key, log)
        log = _find_ingest_log(
            ingest_by_message,
            message_id=row["message_id"],
            internet_message_id=row.get("internet_message_id"),
        )
        ticket = None
        if log and log.request_id:
            ticket = self._db.scalar(select(SvcServiceRequest).where(SvcServiceRequest.id == log.request_id))
        ticket_data = _ticket_fields(ticket)
        classification = classify_mailbox_message(
            subject=row["subject"],
            from_address=row["from_address"],
        )
        return MailboxMessageDetail(
            graph_id=row["graph_id"],
            message_id=row["message_id"],
            internet_message_id=row["internet_message_id"],
            from_address=row["from_address"],
            from_name=row["from_name"],
            subject=row["subject"],
            body_preview=row["body_preview"],
            body_text=row["body_text"],
            body_html=row["body_html"],
            received_at=row["received_at"],
            is_read=row["is_read"],
            classification=classification,
            ingest_status=log.status if log else None,
            **ticket_data,
        )
