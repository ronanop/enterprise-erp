"""CRM SMTP email notifications (Zoho-style templates via Notification Engine).

Audience:
  - CRM admins: lead created, deal won, deal lost
  - Lead / deal owners: approval results, document submissions, won/lost
  - Assignees: task assigned, submission results, follow-ups
  - Approvers: action required (My Jobs)
"""

from __future__ import annotations

import logging
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import get_settings
from modules.crm.adapters.user_lookup_adapter import CrmUserLookupAdapter
from modules.crm.service.crm_module_admin import CrmModuleAdminService
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

# template_code -> (name, subject_template, body_template)
CRM_EMAIL_TEMPLATES: dict[str, tuple[str, str, str]] = {
    "crm.email.admin.lead_created": (
        "CRM admin — lead created",
        "New lead created – {{lead_code}}",
        _SHELL_OPEN
        + "<p>Dear Admin,</p>"
        + "<p><strong>{{created_by_name}}</strong> created lead "
        + "<strong>{{lead_name}}</strong> ({{lead_code}}) for "
        + "<strong>{{company_name}}</strong>.</p>"
        + "<ul>"
        + "<li><strong>Owner:</strong> {{owner_name}}</li>"
        + "<li><strong>Expected value:</strong> {{expected_value}}</li>"
        + "<li><strong>Source:</strong> {{lead_source}}</li>"
        + "</ul>"
        + '<p><a href="{{record_url}}">Open lead</a></p>'
        + _SIGNATURE_HTML
        + _SHELL_CLOSE,
    ),
    "crm.email.admin.deal_won": (
        "CRM admin — deal won",
        "Deal Won Notification – {{customer_name}}",
        _SHELL_OPEN
        + "<p>Dear Team,</p>"
        + "<p>I am pleased to inform you that the following opportunity has been "
        + "successfully <strong>Won</strong>:</p>"
        + "<ul>"
        + "<li><strong>Opportunity Name:</strong> {{opportunity_name}}</li>"
        + "<li><strong>Customer Name:</strong> {{customer_name}}</li>"
        + "<li><strong>Salesperson:</strong> {{salesperson_name}}</li>"
        + "<li><strong>Final Value:</strong> {{final_value}}</li>"
        + "</ul>"
        + "<p>Congratulations to the team for this successful deal!</p>"
        + '<p><a href="{{record_url}}">Review opportunity</a></p>'
        + _SIGNATURE_HTML
        + _SHELL_CLOSE,
    ),
    "crm.email.admin.deal_lost": (
        "CRM admin — deal lost",
        "Deal Lost Notification – {{customer_name}}",
        _SHELL_OPEN
        + "<p>Dear Team,</p>"
        + "<p>The following opportunity has been marked as <strong>Lost</strong>:</p>"
        + "<ul>"
        + "<li><strong>Project Name:</strong> {{opportunity_name}}</li>"
        + "<li><strong>Customer Name:</strong> {{customer_name}}</li>"
        + "<li><strong>Salesperson:</strong> {{salesperson_name}}</li>"
        + "<li><strong>Reason for Loss:</strong> {{loss_reason}}</li>"
        + "</ul>"
        + '<p><a href="{{record_url}}">Open opportunity</a></p>'
        + _SIGNATURE_HTML
        + _SHELL_CLOSE,
    ),
    "crm.email.owner.approval_result": (
        "CRM owner — approval result",
        "Your request has been {{approval_status}} – {{record_title}}",
        _SHELL_OPEN
        + "<p>Hello {{owner_name}},</p>"
        + "<p><strong>{{entity_label}}</strong> <em>{{record_title}}</em> has been "
        + "<strong>{{approval_status}}</strong> by {{approver_name}}.</p>"
        + "<p><strong>Comments:</strong> {{comments}}</p>"
        + '<p><a href="{{record_url}}">Open record</a></p>'
        + _SIGNATURE_HTML
        + _SHELL_CLOSE,
    ),
    "crm.email.owner.document_submitted": (
        "CRM owner — document submitted",
        "New submission on {{record_title}} – {{document_type}}",
        _SHELL_OPEN
        + "<p>Hello {{owner_name}},</p>"
        + "<p><strong>{{actor_name}}</strong> submitted "
        + "<strong>{{document_type}}</strong> on {{record_title}}.</p>"
        + '<p><a href="{{record_url}}">Review submission</a></p>'
        + _SIGNATURE_HTML
        + _SHELL_CLOSE,
    ),
    "crm.email.owner.deal_won": (
        "CRM owner — deal won",
        "Deal Won – {{opportunity_name}}",
        _SHELL_OPEN
        + "<p>Dear {{owner_name}},</p>"
        + "<p>Your opportunity has been successfully <strong>Won</strong>:</p>"
        + "<ul>"
        + "<li><strong>Opportunity Name:</strong> {{opportunity_name}}</li>"
        + "<li><strong>Customer Name:</strong> {{customer_name}}</li>"
        + "<li><strong>Final Value:</strong> {{final_value}}</li>"
        + "</ul>"
        + '<p><a href="{{record_url}}">Open opportunity</a></p>'
        + _SIGNATURE_HTML
        + _SHELL_CLOSE,
    ),
    "crm.email.owner.deal_lost": (
        "CRM owner — deal lost",
        "Deal Lost – {{opportunity_name}}",
        _SHELL_OPEN
        + "<p>Dear {{owner_name}},</p>"
        + "<p>Your opportunity has been marked as <strong>Lost</strong>:</p>"
        + "<ul>"
        + "<li><strong>Project Name:</strong> {{opportunity_name}}</li>"
        + "<li><strong>Customer Name:</strong> {{customer_name}}</li>"
        + "<li><strong>Reason for Loss:</strong> {{loss_reason}}</li>"
        + "</ul>"
        + '<p><a href="{{record_url}}">Open opportunity</a></p>'
        + _SIGNATURE_HTML
        + _SHELL_CLOSE,
    ),
    "crm.email.assignee.task_assigned": (
        "CRM assignee — task assigned",
        "Task assigned: {{task_title}}",
        _SHELL_OPEN
        + "<p>Dear {{assignee_name}},</p>"
        + "<p>You have been assigned <strong>{{task_title}}</strong> "
        + "on {{entity_label}} <em>{{record_title}}</em>.</p>"
        + "<ul>"
        + "<li><strong>Assigned by:</strong> {{assigner_name}}</li>"
        + "<li><strong>Priority:</strong> {{priority}}</li>"
        + "</ul>"
        + '<p><a href="{{record_url}}">Open My Jobs</a></p>'
        + _SIGNATURE_HTML
        + _SHELL_CLOSE,
    ),
    "crm.email.assignee.submission_result": (
        "CRM assignee — submission result",
        "Your {{document_type}} was {{approval_status}}",
        _SHELL_OPEN
        + "<p>Dear {{assignee_name}},</p>"
        + "<p>Your <strong>{{document_type}}</strong> for "
        + "<em>{{record_title}}</em> was <strong>{{approval_status}}</strong>.</p>"
        + "<p><strong>Remarks:</strong> {{comments}}</p>"
        + '<p><a href="{{record_url}}">Open record</a></p>'
        + _SIGNATURE_HTML
        + _SHELL_CLOSE,
    ),
    "crm.email.assignee.followup": (
        "CRM assignee — follow-up reminder",
        "Reminder: Follow-up – {{record_title}}",
        _SHELL_OPEN
        + "<p>Dear {{assignee_name}},</p>"
        + "<p>This is a reminder to follow up on:</p>"
        + "<ul>"
        + "<li><strong>Project / Lead:</strong> {{record_title}}</li>"
        + "<li><strong>Customer:</strong> {{customer_name}}</li>"
        + "<li><strong>Stage:</strong> {{stage}}</li>"
        + "<li><strong>Idle days:</strong> {{days_idle}}</li>"
        + "</ul>"
        + "<p>Please ensure timely follow-ups to maintain engagement.</p>"
        + '<p><a href="{{record_url}}">Open record</a></p>'
        + _SIGNATURE_HTML
        + _SHELL_CLOSE,
    ),
    "crm.email.approver.action_required": (
        "CRM approver — action required",
        "Approval required – {{approval_type}}",
        _SHELL_OPEN
        + "<p>Dear Approver,</p>"
        + "<p>A new request requires your approval. Please review the details below:</p>"
        + "<ul>"
        + "<li><strong>Type:</strong> {{approval_type}}</li>"
        + "<li><strong>Record:</strong> {{record_title}}</li>"
        + "<li><strong>Requested by:</strong> {{requested_by_name}}</li>"
        + "<li><strong>Remarks:</strong> {{remarks}}</li>"
        + "</ul>"
        + "<p>Please review and approve/reject at your earliest convenience.</p>"
        + '<p><a href="{{record_url}}">Open My Jobs</a></p>'
        + _SIGNATURE_HTML
        + _SHELL_CLOSE,
    ),
}


def _frontend_url(path: str) -> str:
    base = get_settings().frontend_url.rstrip("/")
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{base}{path}"


def _fmt_money(value: object | None) -> str:
    if value is None or value == "":
        return "—"
    try:
        amount = Decimal(str(value))
        return f"₹{amount:,.2f}"
    except Exception:  # noqa: BLE001
        return str(value)


def _user_label(user: SecUser | None) -> str:
    if user is None:
        return "—"
    return (user.display_name or user.email or "—").strip() or "—"


class CrmEmailNotificationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._notif = NotificationService(db)
        self._users = CrmUserLookupAdapter(db)

    def _ensure_template(self, tenant_id: UUID, template_code: str, created_by: UUID | None):
        name, subject, body = CRM_EMAIL_TEMPLATES[template_code]
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
        template_code: str,
        event_type: str,
        recipient_user_id: UUID | None,
        payload: dict,
        created_by: UUID | None = None,
        exclude_user_ids: set[UUID] | None = None,
        attachments: list[dict] | None = None,
    ) -> bool:
        if recipient_user_id is None:
            return False
        if exclude_user_ids and recipient_user_id in exclude_user_ids:
            return False
        user = self._get_user(tenant_id, recipient_user_id)
        email = (user.email or "").strip() if user else ""
        if not email:
            logger.info("CRM email skip %s: no email for user %s", template_code, recipient_user_id)
            return False
        try:
            tpl = self._ensure_template(tenant_id, template_code, created_by)
            enriched = dict(payload)
            # Stamp rendered subject so Deliveries UI can show it without re-render.
            if not enriched.get("_subject"):
                enriched["_subject"] = render_template(tpl.subject_template, enriched) or template_code
            if not enriched.get("_body"):
                enriched["_body"] = render_template(tpl.body_template, enriched)
            if attachments:
                enriched["_attachments"] = attachments
            self._notif.send(
                tenant_id=tenant_id,
                template_id=tpl.id,
                event_type=event_type,
                recipient_user_id=recipient_user_id,
                recipient_address=email,
                payload_json=enriched,
                created_by=created_by,
                channel_override="email",
            )
            return True
        except Exception:  # noqa: BLE001 - never break CRM flows on mail failure
            logger.exception("CRM email send failed template=%s to=%s", template_code, email)
            return False

    def _admin_ids(self, tenant_id: UUID) -> list[UUID]:
        return CrmModuleAdminService(self._db).list_admin_user_ids(tenant_id)

    def _owner_user_id(self, tenant_id: UUID, owner_employee_id: UUID | None) -> UUID | None:
        return self._users.resolve_employee_user_id(tenant_id, owner_employee_id)

    def _company_name(self, company_account_id: UUID | None, fallback: str | None = None) -> str:
        if company_account_id is None:
            return (fallback or "").strip() or "—"
        from modules.crm.models.company import CrmCompany

        row = self._db.get(CrmCompany, company_account_id)
        if row is None:
            return (fallback or "").strip() or "—"
        return (row.customer_name or fallback or "—").strip() or "—"

    # ── Admin: lead created ─────────────────────────────────────────────

    def notify_admins_lead_created(
        self,
        *,
        tenant_id: UUID,
        lead_id: UUID,
        lead_code: str,
        lead_name: str,
        company_name: str,
        owner_name: str,
        expected_value: object | None,
        lead_source: str,
        created_by: UUID | None,
    ) -> int:
        actor = self._get_user(tenant_id, created_by)
        payload = {
            "lead_code": lead_code,
            "lead_name": lead_name or lead_code,
            "company_name": company_name or "—",
            "owner_name": owner_name or "—",
            "expected_value": _fmt_money(expected_value),
            "lead_source": lead_source or "—",
            "created_by_name": _user_label(actor),
            "record_url": _frontend_url(f"/crm/leads/{lead_id}"),
        }
        sent = 0
        for uid in self._admin_ids(tenant_id):
            if self._send(
                tenant_id=tenant_id,
                template_code="crm.email.admin.lead_created",
                event_type="crm.email.admin.lead_created",
                recipient_user_id=uid,
                payload=payload,
                created_by=created_by,
            ):
                sent += 1
        return sent

    # ── Admin + owner: deal won / lost ──────────────────────────────────

    def notify_deal_won(
        self,
        *,
        tenant_id: UUID,
        opportunity_id: UUID,
        opportunity_name: str,
        customer_name: str,
        salesperson_name: str,
        final_value: object | None,
        owner_employee_id: UUID | None,
        created_by: UUID | None,
    ) -> int:
        payload = {
            "opportunity_name": opportunity_name or "Opportunity",
            "customer_name": customer_name or "—",
            "salesperson_name": salesperson_name or "—",
            "final_value": _fmt_money(final_value),
            "record_url": _frontend_url(f"/crm/opportunities/{opportunity_id}"),
        }
        sent = 0
        for uid in self._admin_ids(tenant_id):
            if self._send(
                tenant_id=tenant_id,
                template_code="crm.email.admin.deal_won",
                event_type="crm.email.admin.deal_won",
                recipient_user_id=uid,
                payload=payload,
                created_by=created_by,
            ):
                sent += 1

        owner_uid = self._owner_user_id(tenant_id, owner_employee_id)
        owner = self._get_user(tenant_id, owner_uid)
        owner_payload = {
            **payload,
            "owner_name": _user_label(owner),
        }
        if self._send(
            tenant_id=tenant_id,
            template_code="crm.email.owner.deal_won",
            event_type="crm.email.owner.deal_won",
            recipient_user_id=owner_uid,
            payload=owner_payload,
            created_by=created_by,
        ):
            sent += 1
        return sent

    def notify_deal_lost(
        self,
        *,
        tenant_id: UUID,
        opportunity_id: UUID,
        opportunity_name: str,
        customer_name: str,
        salesperson_name: str,
        loss_reason: str | None,
        owner_employee_id: UUID | None,
        created_by: UUID | None,
    ) -> int:
        payload = {
            "opportunity_name": opportunity_name or "Opportunity",
            "customer_name": customer_name or "—",
            "salesperson_name": salesperson_name or "—",
            "loss_reason": (loss_reason or "").strip() or "—",
            "record_url": _frontend_url(f"/crm/opportunities/{opportunity_id}"),
        }
        sent = 0
        for uid in self._admin_ids(tenant_id):
            if self._send(
                tenant_id=tenant_id,
                template_code="crm.email.admin.deal_lost",
                event_type="crm.email.admin.deal_lost",
                recipient_user_id=uid,
                payload=payload,
                created_by=created_by,
            ):
                sent += 1

        owner_uid = self._owner_user_id(tenant_id, owner_employee_id)
        owner = self._get_user(tenant_id, owner_uid)
        owner_payload = {**payload, "owner_name": _user_label(owner)}
        if self._send(
            tenant_id=tenant_id,
            template_code="crm.email.owner.deal_lost",
            event_type="crm.email.owner.deal_lost",
            recipient_user_id=owner_uid,
            payload=owner_payload,
            created_by=created_by,
        ):
            sent += 1
        return sent

    # ── Owner: approval result ──────────────────────────────────────────

    def notify_owner_approval_result(
        self,
        *,
        tenant_id: UUID,
        recipient_user_id: UUID | None,
        owner_name: str | None,
        entity_label: str,
        record_title: str,
        approval_status: str,
        approver_name: str,
        comments: str | None,
        record_url: str,
        created_by: UUID | None,
    ) -> bool:
        return self._send(
            tenant_id=tenant_id,
            template_code="crm.email.owner.approval_result",
            event_type="crm.email.owner.approval_result",
            recipient_user_id=recipient_user_id,
            payload={
                "owner_name": owner_name or "—",
                "entity_label": entity_label,
                "record_title": record_title,
                "approval_status": approval_status,
                "approver_name": approver_name or "—",
                "comments": (comments or "").strip() or "—",
                "record_url": record_url,
            },
            created_by=created_by,
        )

    # ── Owner: document submitted ───────────────────────────────────────

    def notify_owner_document_submitted(
        self,
        *,
        tenant_id: UUID,
        owner_employee_id: UUID | None,
        actor_user_id: UUID | None,
        document_type: str,
        record_title: str,
        record_url: str,
        created_by: UUID | None,
    ) -> bool:
        owner_uid = self._owner_user_id(tenant_id, owner_employee_id)
        if owner_uid is None:
            return False
        owner = self._get_user(tenant_id, owner_uid)
        actor = self._get_user(tenant_id, actor_user_id)
        return self._send(
            tenant_id=tenant_id,
            template_code="crm.email.owner.document_submitted",
            event_type="crm.email.owner.document_submitted",
            recipient_user_id=owner_uid,
            payload={
                "owner_name": _user_label(owner),
                "actor_name": _user_label(actor),
                "document_type": document_type,
                "record_title": record_title,
                "record_url": record_url,
            },
            created_by=created_by,
        )

    # ── Assignee: task assigned + approver action required ──────────────

    def notify_task_assigned_and_approver(
        self,
        *,
        tenant_id: UUID,
        assignee_user_id: UUID | None,
        task_title: str,
        entity_type: str,
        entity_id: UUID,
        action: str | None,
        assigner_user_id: UUID | None,
        priority: str,
        remarks: str | None,
        is_admin_copy: bool,
        attachments: list[dict] | None = None,
    ) -> int:
        del entity_id  # reserved for future deep-links by entity
        if assignee_user_id is None or is_admin_copy:
            return 0
        assignee = self._get_user(tenant_id, assignee_user_id)
        assigner = self._get_user(tenant_id, assigner_user_id)
        entity_label = entity_type.replace("_", " ").title()
        jobs_url = _frontend_url("/crm/my-jobs")
        action_key = (action or "").strip().lower()
        # approve_* / approve → action-required; provide_* / other work → assignment.
        use_approver = action_key.startswith("approve") or action_key in {"approve", "approve_internally"}
        # Quote/OVF approval mails should include the print PDF for primary approvers.
        mail_attachments = attachments if use_approver else None

        sent = 0
        if use_approver:
            if self._send(
                tenant_id=tenant_id,
                template_code="crm.email.approver.action_required",
                event_type="crm.email.approver.action_required",
                recipient_user_id=assignee_user_id,
                payload={
                    "approval_type": task_title,
                    "record_title": task_title,
                    "requested_by_name": _user_label(assigner),
                    "remarks": (remarks or "").strip() or "—",
                    "record_url": jobs_url,
                },
                created_by=assigner_user_id,
                attachments=mail_attachments,
            ):
                sent += 1
            return sent

        if self._send(
            tenant_id=tenant_id,
            template_code="crm.email.assignee.task_assigned",
            event_type="crm.email.assignee.task_assigned",
            recipient_user_id=assignee_user_id,
            payload={
                "assignee_name": _user_label(assignee),
                "task_title": task_title,
                "entity_label": entity_label,
                "record_title": task_title,
                "assigner_name": _user_label(assigner),
                "priority": priority or "normal",
                "record_url": jobs_url,
            },
            created_by=assigner_user_id,
        ):
            sent += 1
        return sent

    def notify_assignee_submission_result(
        self,
        *,
        tenant_id: UUID,
        recipient_user_id: UUID | None,
        document_type: str,
        record_title: str,
        approval_status: str,
        comments: str | None,
        record_url: str,
        created_by: UUID | None,
    ) -> bool:
        user = self._get_user(tenant_id, recipient_user_id)
        return self._send(
            tenant_id=tenant_id,
            template_code="crm.email.assignee.submission_result",
            event_type="crm.email.assignee.submission_result",
            recipient_user_id=recipient_user_id,
            payload={
                "assignee_name": _user_label(user),
                "document_type": document_type,
                "record_title": record_title,
                "approval_status": approval_status,
                "comments": (comments or "").strip() or "—",
                "record_url": record_url,
            },
            created_by=created_by,
        )

    def notify_followup(
        self,
        *,
        tenant_id: UUID,
        recipient_user_id: UUID | None,
        record_title: str,
        customer_name: str,
        stage: str,
        days_idle: int,
        record_url: str,
        created_by: UUID | None = None,
    ) -> bool:
        user = self._get_user(tenant_id, recipient_user_id)
        return self._send(
            tenant_id=tenant_id,
            template_code="crm.email.assignee.followup",
            event_type="crm.email.assignee.followup",
            recipient_user_id=recipient_user_id,
            payload={
                "assignee_name": _user_label(user),
                "record_title": record_title,
                "customer_name": customer_name or "—",
                "stage": stage or "—",
                "days_idle": str(days_idle),
                "record_url": record_url,
            },
            created_by=created_by,
        )


def entity_record_url(entity_type: str, entity_id: UUID) -> str:
    return {
        "opportunity": _frontend_url(f"/crm/opportunities/{entity_id}"),
        "lead": _frontend_url(f"/crm/leads/{entity_id}"),
        "quote": _frontend_url(f"/crm/quotes/{entity_id}"),
        "ovf": _frontend_url(f"/crm/ovf/{entity_id}"),
    }.get(entity_type, _frontend_url("/crm/my-jobs"))
