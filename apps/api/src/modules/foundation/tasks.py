"""Celery tasks for foundation module."""

import json
from uuid import UUID

from database.session import SessionLocal
from modules.foundation.models.notification import NtfDelivery, NtfEvent
from modules.foundation.repository.base import utcnow
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
            from modules.foundation.service.fcm_client import is_fcm_configured, send_fcm_push

            if is_fcm_configured() and push_token:
                try:
                    fcm_resp = send_fcm_push(
                        token=push_token,
                        title=title,
                        body=body,
                        data={k: v for k, v in payload.items() if k not in {"title", "body"}},
                    )
                    delivery.provider_response = json.dumps(
                        {
                            "provider": "fcm",
                            "platform": push_platform or "web",
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
            else:
                delivery.provider_response = json.dumps(
                    {
                        "provider": "stub",
                        "platform": push_platform or "web",
                        "token_suffix": (push_token or "")[-8:],
                        "message": "Push queued (FCM_SERVER_KEY not configured)",
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
    finally:
        db.close()


@celery_app.task(name="foundation.workflow_escalation")
def workflow_escalation_stub() -> dict:
    """Stub for SLA-based workflow escalation — full logic in Sprint 2+."""
    return {"status": "stub", "escalated": 0}
