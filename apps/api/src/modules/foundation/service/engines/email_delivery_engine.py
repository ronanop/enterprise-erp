"""Email channel delivery engine — template render + Graph send (C-05)."""

from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.adapters.graph_email_adapter import GraphEmailAdapter
from modules.foundation.models.notification import NtfDelivery, NtfEvent, NtfTemplate
from modules.foundation.repository.base import utcnow


_VAR_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


def render_template(template: str | None, payload: dict | None) -> str:
    text = template or ""
    data = payload or {}

    def _replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key in data and data[key] is not None:
            return str(data[key])
        return match.group(0)

    return _VAR_RE.sub(_replace, text)


class EmailDeliveryEngine:
    """Delivers a queued email notification via Microsoft Graph."""

    def __init__(self, db: Session, adapter: GraphEmailAdapter | None = None) -> None:
        self._db = db
        self._adapter = adapter or GraphEmailAdapter()

    def deliver(self, event_id: UUID, delivery_id: UUID) -> dict:
        event = self._db.get(NtfEvent, event_id)
        delivery = self._db.get(NtfDelivery, delivery_id)
        if event is None or delivery is None:
            return {"status": "not_found"}

        if delivery.status == "delivered":
            return {"status": "already_delivered", "event_id": str(event_id)}

        if delivery.channel != "email":
            delivery.status = "delivered"
            delivery.delivered_at = utcnow()
            delivery.provider_response = "non_email_channel_stub"
            event.status = "sent"
            self._db.commit()
            return {"status": "delivered", "channel": delivery.channel}

        if not self._adapter.configured:
            delivery.status = "failed"
            delivery.provider_response = "graph_not_configured"
            event.status = "failed"
            self._db.commit()
            return {"status": "failed", "message": "Graph email not configured"}

        template = self._db.get(NtfTemplate, event.template_id)
        payload = dict(event.payload_json or {})

        # Direct compose overrides (pre-rendered by NotificationService)
        subject = str(payload.get("_subject") or "")
        body = str(payload.get("_body") or "")
        if not subject and template is not None:
            subject = render_template(template.subject_template, payload)
        if not body and template is not None:
            body = render_template(template.body_template, payload)

        to_address = (event.recipient_address or "").strip()
        if not to_address:
            delivery.status = "failed"
            delivery.provider_response = "missing_recipient_address"
            event.status = "failed"
            self._db.commit()
            return {"status": "failed", "message": "missing recipient"}

        result = self._adapter.send_mail(
            to_address=to_address,
            subject=subject or "(no subject)",
            body_html=body or "",
        )
        delivery.provider_response = result.provider_response
        if result.ok:
            delivery.status = "delivered"
            delivery.delivered_at = utcnow()
            event.status = "sent"
            self._db.commit()
            return {
                "status": "delivered",
                "event_id": str(event_id),
                "to": to_address,
                "from": self._adapter.from_email,
            }

        delivery.status = "failed"
        delivery.attempt_no = (delivery.attempt_no or 1) + 0
        event.status = "failed"
        self._db.commit()
        return {
            "status": "failed",
            "event_id": str(event_id),
            "message": result.message,
            "provider_status": result.status_code,
        }
