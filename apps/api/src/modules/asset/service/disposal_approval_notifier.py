"""CEO disposal approval notifications via Foundation NotificationService."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import get_settings
from modules.asset.domain.workflow_codes import ENTITY_AST_DISPOSAL
from modules.foundation.models.security import SecRole, SecUser, SecUserRole
from modules.foundation.service.notification_service import NotificationService
from modules.foundation.domain.value_objects import TenantContext

CEO_APPROVAL_TEMPLATE_CODE = "AST_DISPOSAL_CEO_APPROVAL"
_CEO_ROLE_CODES = ("TENANT_ADMIN", "ASSET_ADMIN", "SUPER_ADMIN")


def resolve_disposal_approver_emails(db: Session, tenant_id: UUID) -> list[str]:
    settings = get_settings()
    configured = sorted(settings.asset_disposal_approver_email_set())
    if configured:
        return configured

    stmt = (
        select(SecUser.email)
        .join(SecUserRole, SecUserRole.user_id == SecUser.id)
        .join(SecRole, SecRole.id == SecUserRole.role_id)
        .where(
            SecUser.tenant_id == tenant_id,
            SecUser.is_deleted.is_(False),
            SecRole.tenant_id == tenant_id,
            SecRole.is_deleted.is_(False),
            SecRole.role_code.in_(_CEO_ROLE_CODES),
        )
        .distinct()
    )
    rows = db.scalars(stmt).all()
    return sorted({str(email).strip().lower() for email in rows if email})


def build_ceo_approval_email_payload(
    *,
    asset,
    disposal,
    requested_by_label: str,
    approval_url: str,
) -> dict:
    make_model = " / ".join(
        part
        for part in [
            str(getattr(asset, "make", None) or "").strip() or None,
            str(getattr(asset, "model", None) or "").strip() or None,
        ]
        if part
    ) or "—"
    return {
        "subject": f"Asset Disposal Approval Required - {asset.asset_code}",
        "asset_code": asset.asset_code,
        "asset_name": asset.asset_name,
        "serial_number": getattr(asset, "serial_number", None) or "—",
        "make_model": make_model,
        "current_assignee": str(getattr(asset, "custodian_employee_id", None) or "—"),
        "department": str(getattr(asset, "department_id", None) or "—"),
        "branch": str(getattr(asset, "branch_id", None) or "—"),
        "location": getattr(asset, "current_location_label", None) or "—",
        "disposal_type": "Scrap",
        "reason": (disposal.remarks or "").strip(),
        "requested_by": requested_by_label,
        "requested_date": str(getattr(disposal, "created_at", None) or ""),
        "document_number": disposal.document_number,
        "approval_url": approval_url,
        "entity_name": ENTITY_AST_DISPOSAL,
        "entity_id": str(disposal.id),
    }


def render_ceo_approval_email_body(payload: dict) -> str:
    return (
        "CEO approval is required for the following asset disposal request.\n\n"
        f"Asset Code: {payload.get('asset_code')}\n"
        f"Asset Name: {payload.get('asset_name')}\n"
        f"Serial Number: {payload.get('serial_number')}\n"
        f"Make / Model: {payload.get('make_model')}\n"
        f"Current Assignee: {payload.get('current_assignee')}\n"
        f"Department: {payload.get('department')}\n"
        f"Branch / Location: {payload.get('branch')} / {payload.get('location')}\n"
        f"Disposal Type: {payload.get('disposal_type')}\n"
        f"Reason for Disposal: {payload.get('reason')}\n"
        f"Requested By: {payload.get('requested_by')}\n"
        f"Requested Date: {payload.get('requested_date')}\n"
        f"Disposal Document: {payload.get('document_number')}\n"
        f"Approval Link: {payload.get('approval_url')}\n"
    )


class DisposalApprovalNotifier:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._notifications = NotificationService(db)

    def _ensure_template(self, tenant_id: UUID, created_by: UUID | None):
        templates = self._notifications.list_templates(tenant_id)
        existing = next(
            (
                t
                for t in templates
                if t.template_code == CEO_APPROVAL_TEMPLATE_CODE and t.is_active
            ),
            None,
        )
        if existing is not None:
            return existing
        return self._notifications.create_template(
            tenant_id=tenant_id,
            template_code=CEO_APPROVAL_TEMPLATE_CODE,
            template_name="Asset Disposal CEO Approval",
            channel="email",
            subject_template="Asset Disposal Approval Required - {{asset_code}}",
            body_template=(
                "CEO approval is required.\n"
                "Asset Code: {{asset_code}}\n"
                "Reason: {{reason}}\n"
                "Approval Link: {{approval_url}}\n"
            ),
            created_by=created_by,
        )

    def notify_ceo_approval_required(
        self,
        ctx: TenantContext,
        *,
        asset,
        disposal,
        requested_by_label: str,
    ) -> int:
        settings = get_settings()
        approval_url = (
            f"{settings.frontend_url.rstrip('/')}/assets/asset-disposals"
            f"?id={disposal.id}"
        )
        payload = build_ceo_approval_email_payload(
            asset=asset,
            disposal=disposal,
            requested_by_label=requested_by_label,
            approval_url=approval_url,
        )
        payload["body_text"] = render_ceo_approval_email_body(payload)
        template = self._ensure_template(ctx.tenant_id, ctx.user_id)
        recipients = resolve_disposal_approver_emails(self._db, ctx.tenant_id)
        sent = 0
        for email in recipients:
            self._notifications.send(
                tenant_id=ctx.tenant_id,
                template_id=template.id,
                event_type=f"{ENTITY_AST_DISPOSAL}.ceo_approval_required",
                recipient_user_id=None,
                recipient_address=email,
                payload_json=payload,
                created_by=ctx.user_id,
            )
            sent += 1
        if sent == 0:
            # Still record an in-app/event trail for the requester when no CEO email resolved.
            self._notifications.send(
                tenant_id=ctx.tenant_id,
                template_id=template.id,
                event_type=f"{ENTITY_AST_DISPOSAL}.ceo_approval_required",
                recipient_user_id=ctx.user_id,
                recipient_address=None,
                payload_json=payload,
                created_by=ctx.user_id,
            )
            sent = 1
        return sent
