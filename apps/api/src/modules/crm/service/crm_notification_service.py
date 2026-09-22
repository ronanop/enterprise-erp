"""CRM in-app notifications (Foundation notification engine)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.service.notification_service import NotificationService


def notify_approval_rejected(
    db: Session,
    *,
    tenant_id: UUID,
    recipient_user_id: UUID,
    title: str,
    body: str,
    entity_type: str,
    entity_id: UUID,
    task_title: str | None = None,
    remark: str | None = None,
    created_by: UUID | None = None,
) -> None:
    from modules.foundation.repository.base import utcnow

    notif = NotificationService(db)
    tpl = notif.get_or_create_template(
        tenant_id=tenant_id,
        template_code="crm.approval_rejected",
        template_name="CRM approval rejected",
        channel="in_app",
        subject_template="{{title}}",
        body_template="{{body}}",
        created_by=created_by,
    )
    digest_key = f"{entity_type}:{entity_id}"
    payload = {
        "title": title,
        "body": body,
        "kind": "crm_approval_rejected",
        "entity_type": entity_type,
        "entity_id": str(entity_id),
        "task_title": task_title,
        "remark": remark,
        "digest_key": digest_key,
    }
    existing = notif.find_unread_digest(
        tenant_id=tenant_id,
        user_id=recipient_user_id,
        event_type="crm.approval.rejected",
        digest_key=digest_key,
    )
    if existing is not None:
        existing.payload_json = payload
        existing.created_at = utcnow()
        db.flush()
        return

    notif.send(
        tenant_id=tenant_id,
        template_id=tpl.id,
        event_type="crm.approval.rejected",
        recipient_user_id=recipient_user_id,
        recipient_address=None,
        payload_json=payload,
        created_by=created_by,
    )


def notify_stale_lead(
    db: Session,
    *,
    tenant_id: UUID,
    recipient_user_id: UUID,
    lead_id: UUID,
    lead_code: str,
    lead_name: str,
    company_name: str,
    days_idle: int,
    digest_bucket: int,
    created_by: UUID | None = None,
) -> bool:
    """Remind lead owner that an unconverted lead has been idle. Returns True if sent."""
    notif = NotificationService(db)
    tpl = notif.get_or_create_template(
        tenant_id=tenant_id,
        template_code="crm.lead_stale_reminder",
        template_name="CRM stale lead reminder",
        channel="in_app",
        subject_template="{{title}}",
        body_template="{{body}}",
        created_by=created_by,
    )
    digest_key = f"lead:{lead_id}:idle:{digest_bucket}"
    existing = notif.find_digest(
        tenant_id=tenant_id,
        user_id=recipient_user_id,
        event_type="crm.lead.stale_reminder",
        digest_key=digest_key,
    )
    if existing is not None:
        return False

    title = f"Lead reminder: {lead_code}"
    body = (
        f"{lead_name} at {company_name} has not been worked on for {days_idle} days "
        "and is still not converted to an opportunity. Please follow up."
    )
    payload = {
        "title": title,
        "body": body,
        "kind": "crm_lead_stale_reminder",
        "entity_type": "lead",
        "entity_id": str(lead_id),
        "lead_code": lead_code,
        "days_idle": days_idle,
        "href": f"/crm/leads/{lead_id}",
        "digest_key": digest_key,
    }
    notif.send(
        tenant_id=tenant_id,
        template_id=tpl.id,
        event_type="crm.lead.stale_reminder",
        recipient_user_id=recipient_user_id,
        recipient_address=None,
        payload_json=payload,
        created_by=created_by,
    )
    return True


_OPPORTUNITY_STATE_LABELS: dict[str, str] = {
    "open": "Open",
    "cloud_docs": "Cloud documents",
    "cloud_discount_approval": "Cloud discount approval",
    "map_oem_pending": "MAP OEM quote",
    "cloud_onboarding": "Cloud onboarding",
    "boq_pending": "BOQ / SOW",
    "boq_approval": "BOQ approval",
    "sow_approval": "SOW approval",
    "sow_optional": "SOW",
    "deal_reg": "Deal registration",
    "oem_pending": "OEM pending",
    "oem_attached": "OEM attached",
    "quote_ready": "Quote ready",
    "quote_in_progress": "Quote in progress",
    "po_pending": "Customer PO",
    "po_approval": "PO approval",
    "ovf_ready": "OVF ready",
    "won": "Won",
    "lost": "Lost",
}

_STAGE_ACTION_LABELS: dict[str, str] = {
    "approve_po_finance": "Finance PO validation",
    "approve_po_terms": "Legal terms validation",
    "approve_po": "Management PO approval",
    "approve_boq": "BOQ approval",
    "approve_sow": "SOW approval",
    "approve_cloud_discount": "Cloud discount approval",
    "quote_accepted": "Quote accepted",
    "deal_won": "Deal won",
    "mark_onboarding_done": "Cloud onboarding",
    "deal_reg": "Deal registration",
    "oem_received": "OEM received",
    "attach_oem_quote": "OEM quote attached",
    "create_quote": "Quote created",
    "send_po_approval": "PO sent for approval",
    "send_boq_approval": "BOQ sent for approval",
    "send_sow_approval": "SOW sent for approval",
    "attach_boq": "BOQ attached",
    "attach_sow": "SOW attached",
    "attach_contract": "Contract attached",
    "attach_po": "Customer PO attached",
}

# Same-state actions that still mean a milestone completed (PO chain).
_SAME_STATE_STAGE_ACTIONS = frozenset({"approve_po_finance", "approve_po_terms"})

# Noisy / non-milestone actions — do not alert admins.
_SKIP_STAGE_ACTIONS = frozenset(
    {
        "reject_boq",
        "reject_sow",
        "reject_cloud_discount",
        "reject_po_finance",
        "reject_po_terms",
        "reject_po",
        "lost",
        "create_ovf",
        "negotiate",
        "follow_up",
    }
)


def should_notify_opportunity_stage(
    *,
    from_state: str | None,
    to_state: str,
    action: str,
) -> bool:
    if action in _SKIP_STAGE_ACTIONS:
        return False
    if from_state != to_state:
        return True
    return action in _SAME_STATE_STAGE_ACTIONS


def _label_state(state: str | None) -> str:
    if not state:
        return "Start"
    return _OPPORTUNITY_STATE_LABELS.get(state, state.replace("_", " ").title())


def notify_opportunity_stage_completed(
    db: Session,
    *,
    tenant_id: UUID,
    opportunity_id: UUID,
    opportunity_name: str,
    from_state: str | None,
    to_state: str,
    action: str,
    actor_user_id: UUID | None = None,
    actor_name: str | None = None,
) -> int:
    """Fan-out stage-complete alerts to CRM admins (excludes the actor). Returns send count."""
    if not should_notify_opportunity_stage(
        from_state=from_state, to_state=to_state, action=action
    ):
        return 0

    from modules.crm.service.crm_module_admin import CrmModuleAdminService
    from modules.foundation.repository.base import utcnow

    recipients = CrmModuleAdminService(db).list_admin_user_ids(tenant_id)
    if actor_user_id is not None:
        recipients = [uid for uid in recipients if uid != actor_user_id]
    if not recipients:
        return 0

    stage_label = _STAGE_ACTION_LABELS.get(action) or _label_state(to_state)
    from_label = _label_state(from_state)
    to_label = _label_state(to_state)
    title = f"Stage completed: {stage_label}"
    if from_state == to_state:
        body = f"{opportunity_name} — {stage_label} completed."
    else:
        body = f"{opportunity_name} moved from {from_label} to {to_label}."
    if actor_name:
        body = f"{body} By {actor_name}."

    notif = NotificationService(db)
    tpl = notif.get_or_create_template(
        tenant_id=tenant_id,
        template_code="crm.opportunity_stage_completed",
        template_name="CRM opportunity stage completed",
        channel="in_app",
        subject_template="{{title}}",
        body_template="{{body}}",
        created_by=actor_user_id,
    )
    digest_key = f"opportunity:{opportunity_id}:{from_state or '-'}:{to_state}:{action}"
    payload = {
        "title": title,
        "body": body,
        "kind": "crm_opportunity_stage_completed",
        "entity_type": "opportunity",
        "entity_id": str(opportunity_id),
        "from_state": from_state,
        "to_state": to_state,
        "action": action,
        "stage_label": stage_label,
        "opportunity_name": opportunity_name,
        "actor_name": actor_name,
        "href": f"/crm/opportunities/{opportunity_id}",
        "digest_key": digest_key,
    }

    sent = 0
    for user_id in recipients:
        existing = notif.find_unread_digest(
            tenant_id=tenant_id,
            user_id=user_id,
            event_type="crm.opportunity.stage_completed",
            digest_key=digest_key,
        )
        if existing is not None:
            existing.payload_json = payload
            existing.created_at = utcnow()
            db.flush()
            continue
        notif.send(
            tenant_id=tenant_id,
            template_id=tpl.id,
            event_type="crm.opportunity.stage_completed",
            recipient_user_id=user_id,
            recipient_address=None,
            payload_json=payload,
            created_by=actor_user_id,
        )
        sent += 1
    return sent
