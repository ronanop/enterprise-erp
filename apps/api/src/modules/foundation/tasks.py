"""Celery tasks for foundation module."""

import json
from uuid import UUID

from database.session import SessionLocal
from modules.foundation.models.notification import NtfDelivery, NtfEvent
from modules.foundation.repository.base import utcnow
from modules.foundation.service.engines.email_delivery_engine import EmailDeliveryEngine
from workers.celery_app import celery_app


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
            from modules.foundation.service.expo_push_client import (
                is_expo_push_token,
                send_expo_push,
            )
            from modules.foundation.service.fcm_client import is_fcm_configured, send_fcm_push

            provider = "stub"
            try:
                if push_token and is_expo_push_token(push_token):
                    provider = "expo"
                    expo_resp = send_expo_push(
                        token=push_token,
                        title=title,
                        body=body,
                        data=data,
                    )
                    delivery.provider_response = json.dumps(
                        {
                            "provider": "expo",
                            "platform": push_platform or "web",
                            "response": expo_resp,
                        }
                    )
                    # Expo returns { data: { status: "error", ... } } or list tickets
                    tickets = expo_resp.get("data") if isinstance(expo_resp, dict) else None
                    ticket = tickets[0] if isinstance(tickets, list) and tickets else tickets
                    if isinstance(ticket, dict) and ticket.get("status") == "error":
                        delivery.status = "failed"
                        delivery.delivered_at = None
                        event.status = "failed"
                        db.commit()
                        return {
                            "status": "failed",
                            "event_id": event_id,
                            "channel": "push",
                            "provider": "expo",
                        }
                elif push_token and is_fcm_configured():
                    provider = "fcm"
                    fcm_resp = send_fcm_push(
                        token=push_token,
                        title=title,
                        body=body,
                        data=data,
                    )
                    delivery.provider_response = json.dumps(
                        {
                            "provider": "fcm",
                            "platform": push_platform or "web",
                            "response": fcm_resp,
                        }
                    )
                    if isinstance(fcm_resp, dict) and int(fcm_resp.get("failure") or 0) > 0:
                        delivery.status = "failed"
                        delivery.delivered_at = None
                        event.status = "failed"
                        db.commit()
                        return {
                            "status": "failed",
                            "event_id": event_id,
                            "channel": "push",
                            "provider": "fcm",
                        }
                else:
                    delivery.provider_response = json.dumps(
                        {
                            "provider": "stub",
                            "platform": push_platform or "web",
                            "token_suffix": (push_token or "")[-8:],
                            "message": (
                                "Push queued (no Expo token and FCM_SERVER_KEY not configured)"
                            ),
                        }
                    )
            except Exception as exc:
                delivery.provider_response = json.dumps(
                    {
                        "provider": provider,
                        "platform": push_platform or "web",
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
