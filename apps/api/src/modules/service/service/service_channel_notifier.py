"""Multi-channel outbound notifications for service tickets (email / SMS / WhatsApp)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

import httpx
from sqlalchemy.orm import Session

from core.config import settings
from modules.service.models import SvcServiceNotification, SvcServiceRequest
from shared.email_utils import send_smtp_email

logger = logging.getLogger(__name__)


class ServiceChannelNotifier:
    """Best-effort outbound channels; never raises to callers."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def dispatch(
        self,
        *,
        tenant_id: UUID,
        company_id: UUID,
        branch_id: UUID | None,
        request: SvcServiceRequest,
        notification_type: str,
        message: str,
        recipient_user_id: UUID,
        created_by: UUID,
        channels: list[str] | None = None,
    ) -> None:
        channels = channels or ["in_app", "email", "sms", "whatsapp"]
        delivery: dict[str, Any] = {"in_app": "queued"}

        if "email" in channels:
            delivery["email"] = self._send_email(request, message)
        if "sms" in channels:
            delivery["sms"] = self._send_sms(request, message)
        if "whatsapp" in channels:
            delivery["whatsapp"] = self._send_whatsapp(request, message)

        status = "sent" if any(v == "sent" for v in delivery.values()) else "pending"
        if all(v in ("skipped", "failed", "disabled") for k, v in delivery.items() if k != "in_app"):
            if delivery.get("email") == "sent" or delivery.get("sms") == "sent" or delivery.get("whatsapp") == "sent":
                status = "sent"

        notif = SvcServiceNotification(
            id=uuid4(),
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            request_id=request.id,
            notification_type=notification_type,
            recipient_user_id=recipient_user_id,
            payload_json={
                "message": message,
                "ticket_id": str(request.id),
                "document_number": request.document_number,
                "channels": delivery,
            },
            sent_at=datetime.now(timezone.utc),
            delivery_status=status,
            status="active",
            created_by=created_by,
            updated_by=created_by,
        )
        self._db.add(notif)

    def _send_email(self, request: SvcServiceRequest, message: str) -> str:
        to_addr = (request.email or request.alternate_email or "").strip()
        if not to_addr:
            return "skipped"
        if not settings.smtp_configured:
            return "disabled"
        host = (settings.smtp_host or "").strip().lower()
        if host in {"", "localhost", "127.0.0.1"}:
            return "disabled"
        try:
            send_smtp_email(
                to_address=to_addr,
                subject=f"[{request.document_number}] Service update",
                body_text=(
                    f"Hello {request.contact_name or 'Customer'},\n\n"
                    f"{message}\n\n"
                    f"Ticket: {request.document_number}\n"
                    f"Subject: {request.subject}\n\n"
                    f"— Support Team"
                ),
                reply_to=settings.smtp_from_address or None,
            )
            return "sent"
        except Exception as exc:
            logger.warning("service email notify failed: %s", exc)
            return "failed"

    def _send_sms(self, request: SvcServiceRequest, message: str) -> str:
        mobile = (request.mobile or request.remote_engineer_contact or "").strip()
        if not mobile:
            return "skipped"
        if not settings.sms_gateway_enabled or not settings.sms_gateway_url:
            return "disabled"
        try:
            resp = httpx.post(
                settings.sms_gateway_url,
                json={"to": mobile, "message": f"[{request.document_number}] {message}"[:480]},
                headers={"Authorization": f"Bearer {settings.sms_gateway_api_key}"}
                if settings.sms_gateway_api_key
                else None,
                timeout=8.0,
            )
            return "sent" if resp.is_success else "failed"
        except Exception as exc:
            logger.warning("service SMS notify failed: %s", exc)
            return "failed"

    def _send_whatsapp(self, request: SvcServiceRequest, message: str) -> str:
        mobile = (request.mobile or request.remote_engineer_contact or "").strip()
        if not mobile:
            return "skipped"
        if not settings.whatsapp_gateway_enabled or not settings.whatsapp_gateway_url:
            return "disabled"
        try:
            resp = httpx.post(
                settings.whatsapp_gateway_url,
                json={"to": mobile, "message": f"[{request.document_number}] {message}"},
                headers={"Authorization": f"Bearer {settings.whatsapp_gateway_api_key}"}
                if settings.whatsapp_gateway_api_key
                else None,
                timeout=8.0,
            )
            return "sent" if resp.is_success else "failed"
        except Exception as exc:
            logger.warning("service WhatsApp notify failed: %s", exc)
            return "failed"
