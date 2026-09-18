"""Celery tasks for foundation module."""

from email.message import EmailMessage
import smtplib
from uuid import UUID

from database.session import SessionLocal
from modules.foundation.models.notification import NtfDelivery, NtfEvent, NtfTemplate
from modules.foundation.repository.base import utcnow
from workers.celery_app import celery_app


def _send_smtp_email(*, to_address: str, subject: str, body: str) -> bool:
    from core.config import get_settings

    settings = get_settings()
    host = (settings.smtp_host or "").strip()
    if not host or not to_address:
        return False
    from_email = (settings.smtp_from_email or settings.smtp_username or "").strip()
    if not from_email:
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = from_email
    message["To"] = to_address
    message.set_content(body)

    with smtplib.SMTP(host, int(settings.smtp_port or 587), timeout=20) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        username = (settings.smtp_username or "").strip()
        password = settings.smtp_password or ""
        if username:
            smtp.login(username, password)
        smtp.send_message(message)
    return True


@celery_app.task(name="foundation.send_notification")
def send_notification_task(event_id: str, delivery_id: str) -> dict:
    db = SessionLocal()
    try:
        event = db.get(NtfEvent, UUID(event_id))
        delivery = db.get(NtfDelivery, UUID(delivery_id))
        if event is None or delivery is None:
            return {"status": "not_found"}

        template = db.get(NtfTemplate, event.template_id) if event.template_id else None
        payload = event.payload_json or {}
        channel = (delivery.channel or getattr(template, "channel", None) or "in_app").lower()
        emailed = False
        if channel == "email":
            subject = str(
                payload.get("subject")
                or getattr(template, "subject_template", None)
                or "Notification"
            )
            body = str(
                payload.get("body_text")
                or getattr(template, "body_template", None)
                or ""
            )
            to_address = event.recipient_address
            try:
                emailed = _send_smtp_email(
                    to_address=str(to_address or ""),
                    subject=subject,
                    body=body,
                )
            except Exception as exc:  # noqa: BLE001 — delivery stays pending/failed trail
                delivery.status = "failed"
                delivery.provider_response = str(exc)[:2000]
                event.status = "failed"
                db.commit()
                return {"status": "failed", "event_id": event_id, "error": str(exc)}

        delivery.status = "delivered"
        delivery.delivered_at = utcnow()
        event.status = "sent"
        db.commit()
        return {
            "status": "delivered",
            "event_id": event_id,
            "emailed": emailed,
            "channel": channel,
        }
    finally:
        db.close()


@celery_app.task(name="foundation.workflow_escalation")
def workflow_escalation_stub() -> dict:
    """Stub for SLA-based workflow escalation — full logic in Sprint 2+."""
    return {"status": "stub", "escalated": 0}
