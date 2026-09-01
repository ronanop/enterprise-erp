"""Process inbound emails and create service request tickets automatically."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import AppException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.master_data.models.party import MasterCustomer
from modules.organization.models.branch import OrgBranch
from modules.service.email_inbound_schemas import EmailToTicketResult, InboundEmailPayload
from modules.service.models import SvcEmailIngestLog, SvcServiceCategory
from modules.service.service.mailbox_ticket_classifier import skip_ticket_reason
from modules.service.service.service_email_parser import parse_service_email_body
from modules.service.service.service_request_ticket_service import ServiceRequestTicketService
from shared.email_utils import parse_email_address, send_smtp_email, strip_html


def _resolve_system_user_id(db: Session, tenant_id: UUID) -> UUID:
    user = db.scalar(
        select(SecUser).where(
            SecUser.tenant_id == tenant_id,
            SecUser.is_deleted.is_(False),
            SecUser.status == "active",
        ).order_by(SecUser.created_at.asc()).limit(1)
    )
    if user is None:
        raise AppException("No active system user found for email automation", status_code=503)
    return user.id


class EmailToTicketService:
    def __init__(self, db: Session) -> None:
        self._db = db

    def process(self, payload: InboundEmailPayload, *, source: str = "webhook") -> EmailToTicketResult:
        if not settings.email_ticket_enabled:
            raise AppException("Email-to-ticket automation is disabled", status_code=503)

        _, from_email = parse_email_address(payload.from_address)
        if not from_email:
            raise AppException("Invalid sender email address", status_code=422)

        message_id = payload.message_id.strip()
        existing = self._db.scalar(
            select(SvcEmailIngestLog).where(SvcEmailIngestLog.message_id == message_id)
        )
        if existing:
            return EmailToTicketResult(
                status="duplicate",
                message="Email already processed",
                ticket_id=existing.request_id,
                ingest_log_id=existing.id,
            )

        contact_name = (payload.from_name or "").strip() or from_email.split("@")[0]
        subject = (payload.subject or "(No subject)").strip()[:500]

        skip_reason = skip_ticket_reason(subject=subject, from_address=from_email)
        if skip_reason:
            return EmailToTicketResult(
                status="skipped",
                message="Automated sender — no ticket created",
            )

        body = (payload.body_text or "").strip()
        if not body and payload.body_html:
            body = strip_html(payload.body_html)
        if not body:
            body = subject

        customer, branch_id, company_id, tenant_id = self._resolve_customer_and_scope(from_email)
        category_id = self._resolve_category_id(company_id, tenant_id)

        ctx = TenantContext(
            tenant_id=tenant_id,
            user_id=_resolve_system_user_id(self._db, tenant_id),
            user_type="tenant_admin",
            company_id=company_id,
            branch_id=branch_id,
        )

        log = SvcEmailIngestLog(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            company_id=company_id,
            message_id=message_id,
            from_address=from_email,
            subject=subject,
            status="processed",
            source=source,
            received_at=payload.received_at or datetime.now(timezone.utc),
            processed_at=datetime.now(timezone.utc),
        )
        self._db.add(log)
        self._db.flush()

        try:
            parsed = parse_service_email_body(body, subject=subject)
            # Inbound sender wins for contact email; keep parsed NOC name/phone when present
            ticket_fields = {
                "mode_of_action": None,
                # Must match DB check ck_svc_service_request_type
                "service_type": "corrective",
                "subject": parsed.get("subject") or subject,
                "contact_name": parsed.get("contact_name") or contact_name,
                "status": "ticket_registered",
                "priority": "p3",
                "channel": "email",
                "ticket_category": None,
                "sla_status": "within_sla",
                "email": from_email,
                "issue_description": parsed.get("issue_description") or body[:8000],
                "description": parsed.get("description") or body[:8000],
            }
            for key in (
                "mobile",
                "reference_sr_number",
                "customer_reference",
                "lsi",
                "ckt_id",
                "end_customer_name",
                "coordinator_name",
                "coordinator_phone",
                "end_customer_street",
                "end_customer_state",
                "end_customer_city",
                "end_customer_postal_code",
                "asset_name",
                "serial_number",
                "asset_status",
                "additional_description",
                "site_availability",
                "site_instructions",
                "link_type",
                "bandwidth",
                "ports_in_use",
                "previous_fe_notes",
                "ip_details",
                "mail_extra_info",
                "company_name_from_mail",
            ):
                if parsed.get(key):
                    ticket_fields[key] = parsed[key]

            ticket_svc = ServiceRequestTicketService(self._db)
            ticket = ticket_svc.create_ticket(
                ctx,
                branch_id=branch_id,
                company_id=company_id,
                category_id=category_id,
                customer_id=customer.id,
                **ticket_fields,
            )
            log.request_id = ticket.id
            row = ticket_svc._repo.get(ctx, ticket.id)
            if row is not None:
                # Unassigned email tickets must surface for Service Head / Manager queue.
                ticket_svc._notify_service_heads(
                    ctx,
                    row,
                    "email_ticket_created",
                    f"New email ticket {ticket.document_number} from {from_email} — assign an engineer",
                )
            # Confirmation mail is optional — never block ticket creation.
            self._send_confirmation(from_email, contact_name, ticket.document_number, subject)
            self._db.flush()
            return EmailToTicketResult(
                status="processed",
                message="Service request ticket created from email",
                ticket_id=ticket.id,
                document_number=ticket.document_number,
                ingest_log_id=log.id,
            )
        except Exception as exc:
            log.status = "failed"
            log.error_message = str(exc)[:2000]
            self._db.flush()
            raise

    def _resolve_customer_and_scope(self, from_email: str) -> tuple[MasterCustomer, UUID, UUID, UUID]:
        customer = self._db.scalar(
            select(MasterCustomer).where(
                MasterCustomer.is_deleted.is_(False),
                MasterCustomer.status == "active",
                func.lower(MasterCustomer.email) == from_email.lower(),
            )
        )
        if customer is None and settings.email_ticket_default_customer_id:
            customer = self._db.scalar(
                select(MasterCustomer).where(
                    MasterCustomer.id == UUID(settings.email_ticket_default_customer_id),
                    MasterCustomer.is_deleted.is_(False),
                )
            )
        if customer is None:
            customer = self._db.scalar(
                select(MasterCustomer)
                .where(MasterCustomer.is_deleted.is_(False), MasterCustomer.status == "active")
                .order_by(MasterCustomer.created_at.asc())
                .limit(1)
            )
        if customer is None:
            raise AppException(
                f"No customer found for sender {from_email}. Add a customer with this email or set EMAIL_TICKET_DEFAULT_CUSTOMER_ID.",
                status_code=422,
            )

        branch_id = self._resolve_branch_id(customer)
        return customer, branch_id, customer.company_id, customer.tenant_id

    def _resolve_branch_id(self, customer: MasterCustomer) -> UUID:
        if settings.email_ticket_default_branch_id:
            return UUID(settings.email_ticket_default_branch_id)
        if customer.branch_id:
            return customer.branch_id
        branch = self._db.scalar(
            select(OrgBranch).where(
                OrgBranch.company_id == customer.company_id,
                OrgBranch.is_deleted.is_(False),
                OrgBranch.status == "active",
            ).order_by(OrgBranch.created_at.asc()).limit(1)
        )
        if branch is None:
            raise AppException("No active branch found for ticket creation", status_code=422)
        return branch.id

    def _resolve_category_id(self, company_id: UUID, tenant_id: UUID) -> UUID:
        if settings.email_ticket_default_category_id:
            return UUID(settings.email_ticket_default_category_id)
        category = self._db.scalar(
            select(SvcServiceCategory).where(
                SvcServiceCategory.company_id == company_id,
                SvcServiceCategory.tenant_id == tenant_id,
                SvcServiceCategory.is_deleted.is_(False),
                SvcServiceCategory.status == "active",
            ).order_by(SvcServiceCategory.created_at.asc()).limit(1)
        )
        if category is None:
            raise AppException("No active service category found", status_code=422)
        return category.id

    def _send_confirmation(
        self, to_address: str, contact_name: str, document_number: str, subject: str
    ) -> None:
        # Local/dev placeholders (e.g. localhost) are treated as "not ready to send".
        if not settings.smtp_configured:
            return
        host = (settings.smtp_host or "").strip().lower()
        if host in {"", "localhost", "127.0.0.1"}:
            return
        if not settings.smtp_user and not settings.smtp_password:
            # Host set for UI status only — skip real send until credentials are provided.
            return
        body = (
            f"Hello {contact_name},\n\n"
            f"Your support request has been received and a service ticket has been created.\n\n"
            f"Ticket Number: {document_number}\n"
            f"Subject: {subject}\n\n"
            f"Our team will review your request and respond shortly.\n\n"
            f"— Support Team"
        )
        try:
            send_smtp_email(
                to_address=to_address,
                subject=f"[{document_number}] We received your request",
                body_text=body,
                reply_to=settings.smtp_from_address or None,
            )
        except Exception:
            pass  # ticket created; email failure should not roll back

    @staticmethod
    def message_id_from_headers(message_id: str | None, from_addr: str, subject: str, date: str) -> str:
        if message_id and message_id.strip():
            return message_id.strip()[:512]
        raw = f"{from_addr}|{subject}|{date}"
        return hashlib.sha256(raw.encode()).hexdigest()
