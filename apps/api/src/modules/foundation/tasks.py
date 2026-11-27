"""Celery tasks for foundation module."""

import json
from uuid import UUID

from database.session import SessionLocal
from modules.foundation.models.notification import NtfDelivery, NtfEvent
from modules.foundation.repository.base import utcnow
from modules.foundation.service.engines.email_delivery_engine import EmailDeliveryEngine
from workers.celery_app import celery_app


def _expo_ticket_failed(resp: dict | list | None) -> str | None:
    """Return error message if Expo push ticket indicates failure."""
    if resp is None:
        return "empty_expo_response"
    data = resp.get("data") if isinstance(resp, dict) else resp
    tickets = data if isinstance(data, list) else [data] if isinstance(data, dict) else []
    for ticket in tickets:
        if not isinstance(ticket, dict):
            continue
        if ticket.get("status") == "error":
            details = ticket.get("details") or {}
            return str(ticket.get("message") or details.get("error") or "expo_push_error")
    return None


@celery_app.task(name="foundation.send_notification")
def send_notification_task(
    event_id: str,
    delivery_id: str,
    push_token: str | None = None,
    push_platform: str | None = None,
) -> dict:
    db = SessionLocal()
    try:
        event = db.get(NtfEvent, UUID(event_id))
        delivery = db.get(NtfDelivery, UUID(delivery_id))
        if event is None or delivery is None:
            return {"status": "not_found"}

        if delivery.channel == "push":
            payload = event.payload_json if isinstance(event.payload_json, dict) else {}
            title = str(payload.get("title") or event.event_type or "Notification")
            body = str(payload.get("body") or "")
            data = {k: v for k, v in payload.items() if k not in {"title", "body"}}
            platform = push_platform or "web"

            from modules.foundation.service.expo_push_client import (
                is_expo_push_token,
                send_expo_push,
            )
            from modules.foundation.service.fcm_client import is_fcm_configured, send_fcm_push

            # Employee app registers Expo tokens (iOS + Android EAS builds).
            if push_token and is_expo_push_token(push_token):
                try:
                    expo_resp = send_expo_push(
                        token=push_token,
                        title=title,
                        body=body,
                        data=data,
                        sound="default",
                        priority="high",
                        channel_id="ess-alerts",
                    )
                    ticket_error = _expo_ticket_failed(expo_resp)
                    delivery.provider_response = json.dumps(
                        {
                            "provider": "expo",
                            "platform": platform,
                            "response": expo_resp,
                        }
                    )
                    if ticket_error:
                        delivery.status = "failed"
                        delivery.delivered_at = None
                        event.status = "failed"
                        db.commit()
                        return {
                            "status": "failed",
                            "event_id": event_id,
                            "channel": "push",
                            "error": ticket_error,
                        }
                except Exception as exc:
                    delivery.provider_response = json.dumps(
                        {
                            "provider": "expo",
                            "platform": platform,
                            "error": str(exc),
                        }
                    )
                    delivery.status = "failed"
                    delivery.delivered_at = None
                    event.status = "failed"
                    db.commit()
                    return {
                        "status": "failed",
                        "event_id": event_id,
                        "channel": "push",
                        "error": str(exc),
                    }
            elif is_fcm_configured() and push_token:
                try:
                    fcm_resp = send_fcm_push(
                        token=push_token,
                        title=title,
                        body=body,
                        data=data,
                    )
                    delivery.provider_response = json.dumps(
                        {
                            "provider": "fcm",
                            "platform": platform,
                            "response": fcm_resp,
                        }
                    )
                    # FCM legacy returns failure counts in body even with HTTP 200
                    if isinstance(fcm_resp, dict) and int(fcm_resp.get("failure") or 0) > 0:
                        delivery.status = "failed"
                        delivery.delivered_at = None
                        event.status = "failed"
                        db.commit()
                        return {
                            "status": "failed",
                            "event_id": event_id,
                            "channel": "push",
                        }
                except Exception as exc:
                    delivery.provider_response = json.dumps(
                        {
                            "provider": "fcm",
                            "platform": platform,
                            "error": str(exc),
                        }
                    )
                    delivery.status = "failed"
                    delivery.delivered_at = None
                    event.status = "failed"
                    db.commit()
                    return {
                        "status": "failed",
                        "event_id": event_id,
                        "channel": "push",
                        "error": str(exc),
                    }
            else:
                delivery.provider_response = json.dumps(
                    {
                        "provider": "stub",
                        "platform": platform,
                        "token_suffix": (push_token or "")[-8:],
                        "message": (
                            "Push queued (no Expo token and FCM_SERVER_KEY not configured)"
                        ),
                    }
                )

            delivery.status = "delivered"
            delivery.delivered_at = utcnow()
            event.status = "sent"
            db.commit()
            return {
                "status": "delivered",
                "event_id": event_id,
                "channel": delivery.channel,
            }

        return EmailDeliveryEngine(db).deliver(UUID(event_id), UUID(delivery_id))
    finally:
        db.close()


@celery_app.task(name="foundation.workflow_escalation")
def workflow_escalation_stub() -> dict:
    """Stub for SLA-based workflow escalation - full logic in Sprint 2+."""
    return {"status": "stub", "escalated": 0}
