"""Procurement email notifications for configured Approvers (PO / invoice steps)."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import get_settings
from modules.foundation.models.security import SecUser
from modules.foundation.service.engines.email_delivery_engine import render_template
from modules.foundation.service.notification_service import NotificationService

logger = logging.getLogger(__name__)

_SIGNATURE_HTML = (
    "<p>Thanks And Regards,</p>"
    "<p><strong>Cache Technologies / Cache Digitech Pvt. Ltd.</strong><br/>"
    "CRC2 Building, 337, Ground Floor, Sultanpur, New Delhi - 110030<br/>"
    '<a href="https://www.cachedigitech.com">www.cachedigitech.com</a></p>'
)

_SHELL_OPEN = (
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;'
    'line-height:1.5;color:#1a1a1a;max-width:640px;">'
)
_SHELL_CLOSE = "</div>"

PROC_EMAIL_TEMPLATES: dict[str, tuple[str, str, str]] = {
    "proc.email.approver.action_required": (
        "Procurement approver — action required",
        "Approval required – {{approval_type}}",
        _SHELL_OPEN
        + "<p>Dear Approver,</p>"
        + "<p>A procurement request requires your action. Please review the details below:</p>"
        + "<ul>"
        + "<li><strong>Type:</strong> {{approval_type}}</li>"
        + "<li><strong>Record:</strong> {{record_title}}</li>"
        + "<li><strong>Requested by:</strong> {{requested_by_name}}</li>"
        + "<li><strong>Remarks:</strong> {{remarks}}</li>"
        + "</ul>"
        + "<p>The Purchase Order PDF is attached when available. "
        + "Please review and complete the task in My Jobs.</p>"
        + '<p><a href="{{record_url}}">Open My Jobs</a></p>'
        + _SIGNATURE_HTML
        + _SHELL_CLOSE,
    ),
    "proc.email.vendor.po_issued": (
        "Procurement — vendor PO issued",
        "Purchase Order {{po_number}} issued",
        _SHELL_OPEN
        + "<p>Dear {{vendor_name}},</p>"
        + "<p>Please find attached Purchase Order <strong>{{po_number}}</strong>.</p>"
        + "<ul>"
        + "<li><strong>PO number:</strong> {{po_number}}</li>"
        + "<li><strong>Document date:</strong> {{document_date}}</li>"
        + "<li><strong>Customer reference:</strong> {{customer_reference}}</li>"
        + "</ul>"
        + "<p>Kindly acknowledge receipt and confirm expected delivery as applicable.</p>"
        + _SIGNATURE_HTML
        + _SHELL_CLOSE,
    ),
}


def _frontend_url(path: str) -> str:
    base = get_settings().frontend_url.rstrip("/")
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{base}{path}"


def _user_label(user: SecUser | None) -> str:
    if user is None:
        return "—"
    return (user.display_name or user.email or "—").strip() or "—"


class ProcEmailNotificationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._notif = NotificationService(db)

    def _ensure_template(self, tenant_id: UUID, template_code: str, created_by: UUID | None):
        name, subject, body = PROC_EMAIL_TEMPLATES[template_code]
        return self._notif.get_or_create_template(
            tenant_id=tenant_id,
            template_code=template_code,
            template_name=name,
            channel="email",
            subject_template=subject,
            body_template=body,
            created_by=created_by,
        )

    def _get_user(self, tenant_id: UUID, user_id: UUID | None) -> SecUser | None:
        if user_id is None:
            return None
        return self._db.scalar(
            select(SecUser).where(
                SecUser.id == user_id,
                SecUser.tenant_id == tenant_id,
                SecUser.is_deleted.is_(False),
            )
        )

    def _send(
        self,
        *,
        tenant_id: UUID,
        recipient_user_id: UUID,
        payload: dict,
        created_by: UUID | None,
        attachments: list[dict] | None = None,
    ) -> bool:
        user = self._get_user(tenant_id, recipient_user_id)
        email = (user.email or "").strip() if user else ""
        if not email:
            logger.info(
                "Procurement email skip: no email for user %s",
                recipient_user_id,
            )
            return False
        try:
            tpl = self._ensure_template(
                tenant_id, "proc.email.approver.action_required", created_by
            )
            enriched = dict(payload)
            if not enriched.get("_subject"):
                enriched["_subject"] = (
                    render_template(tpl.subject_template, enriched)
                    or "proc.email.approver.action_required"
                )
            if not enriched.get("_body"):
                enriched["_body"] = render_template(tpl.body_template, enriched)
            if attachments:
                enriched["_attachments"] = attachments
            self._notif.send(
                tenant_id=tenant_id,
                template_id=tpl.id,
                event_type="proc.email.approver.action_required",
                recipient_user_id=recipient_user_id,
                recipient_address=email,
                payload_json=enriched,
                created_by=created_by,
                channel_override="email",
            )
            return True
        except Exception:  # noqa: BLE001 - never break PO flows on mail failure
            logger.exception("Procurement email send failed to=%s", email)
            return False

    def notify_step_approvers(
        self,
        *,
        tenant_id: UUID,
        recipient_user_ids: list[UUID],
        approval_type: str,
        record_title: str,
        requested_by: UUID | None,
        remarks: str | None = None,
        jobs_path: str = "/procurement/my-jobs",
        attachments: list[dict] | None = None,
    ) -> int:
        """Email configured step owners; attach PO PDF when provided."""
        assigner = self._get_user(tenant_id, requested_by)
        payload = {
            "approval_type": approval_type,
            "record_title": record_title,
            "requested_by_name": _user_label(assigner),
            "remarks": (remarks or "").strip() or "—",
            "record_url": _frontend_url(jobs_path),
        }
        sent = 0
        seen: set[UUID] = set()
        for uid in recipient_user_ids:
            if uid is None or uid in seen:
                continue
            seen.add(uid)
            if self._send(
                tenant_id=tenant_id,
                recipient_user_id=uid,
                payload=payload,
                created_by=requested_by,
                attachments=attachments,
            ):
                sent += 1
        return sent

    def notify_vendor_po_issued(
        self,
        *,
        tenant_id: UUID,
        to_address: str,
        vendor_name: str,
        po_number: str,
        document_date: str | None = None,
        customer_reference: str | None = None,
        order_id: UUID | None = None,
        created_by: UUID | None = None,
        attachments: list[dict] | None = None,
    ) -> bool:
        """Email the vendor the issued PO with PDF attachment (SMTP)."""
        email = (to_address or "").strip()
        if not email or "@" not in email:
            logger.info("Vendor PO issued email skip: invalid recipient %r", to_address)
            return False
        try:
            tpl = self._ensure_template(
                tenant_id, "proc.email.vendor.po_issued", created_by
            )
            payload = {
                "vendor_name": (vendor_name or "").strip() or "Vendor",
                "po_number": (po_number or "").strip() or "PO",
                "document_date": (document_date or "").strip() or "—",
                "customer_reference": (customer_reference or "").strip() or "—",
                "order_id": str(order_id) if order_id else None,
                "kind": "vendor_po_issued",
            }
            subject = (
                render_template(tpl.subject_template, payload)
                or f"Purchase Order {payload['po_number']} issued"
            )
            body_html = render_template(tpl.body_template, payload) or ""
            if attachments:
                payload["_attachments"] = attachments
            self._notif.send_email(
                tenant_id=tenant_id,
                to_address=email,
                subject=subject,
                body_html=body_html,
                event_type="procurement.vendor_po_issued",
                template_id=tpl.id,
                payload_json=payload,
                created_by=created_by,
            )
            return True
        except Exception:  # noqa: BLE001 - never break PO issue on mail failure
            logger.exception("Vendor PO issued email failed to=%s", email)
            return False
