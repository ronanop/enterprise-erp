"""Aggregate opportunity activity into a chronological timeline.

Timeline cards use the same Current State labels as BlueprintActions:
Lead Open → … → Deal Won.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.crm.repository.approval_task_repository import ApprovalTaskRepository
from modules.crm.repository.lead_repository import LeadRepository
from modules.crm.repository.opportunity_repository import OpportunityRepository
from modules.crm.repository.ovf_repository import OvfRepository
from modules.crm.repository.quote_repository import QuoteRepository
from modules.crm.repository.state_history_repository import StateHistoryRepository
from modules.crm.service.crm_record_visibility import CrmRecordVisibility
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.user_repository import UserRepository


def _event(
    *,
    id: str,
    occurred_at,
    title: str,
    entity_type: str,
    entity_id: UUID | None,
    entity_label: str | None = None,
    event_type: str = "state_transition",
    summary: str | None = None,
    action: str | None = None,
    from_state: str | None = None,
    to_state: str | None = None,
    actor_id=None,
    actor_name: str | None = None,
    **extra,
) -> dict:
    base = {
        "id": id,
        "occurred_at": occurred_at,
        "event_type": event_type,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_label": entity_label,
        "title": title,
        "summary": summary,
        "action": action,
        "from_state": from_state,
        "to_state": to_state,
        "actor_id": actor_id,
        "actor_name": actor_name,
        "requested_by_id": None,
        "requested_by_name": None,
        "decided_by_id": None,
        "decided_by_name": None,
        "assignee_names": [],
        "decision": None,
        "team_role": None,
        "remark": None,
        "version": None,
    }
    base.update(extra)
    return base


# Blueprint "send" actions → My Jobs task.action (the approve action stored on the task).
_SEND_ACTION_TO_TASK_ACTION: dict[str, str] = {
    "send_sow_approval": "approve_sow",
    "send_boq_approval": "approve_boq",
    "send_boq_for_attachment": "provide_boq_attachment",
    "send_sow_for_attachment": "provide_sow_attachment",
    "send_po_approval": "approve_po",
    "send_cloud_discount_approval": "approve_cloud_discount",
}

# Timeline approve/study actions that resolve from My Jobs decided_by.
_APPROVE_TASK_ACTIONS: frozenset[str] = frozenset(
    {
        "approve_sow",
        "approve_boq",
        "provide_boq_attachment",
        "provide_sow_attachment",
        "approve_po",
        "approve_internally",
        "approve",
        "approve_cloud_discount",
        "provide_freight",
    }
)


# Map blueprint actions → Current State label (hardware happy path).
_ACTION_MILESTONE: dict[str, str] = {
    "convert": "Converted to Opportunity",
    "converted": "Converted to Opportunity",
    "convert_lead": "Converted to Opportunity",
    "attach_boq": "BOQ Attached",
    "attach_sow": "SOW Attached",
    "send_boq_for_attachment": "BOQ attachment requested",
    "send_sow_for_attachment": "SOW attachment requested",
    "provide_boq_attachment": "BOQ Attached",
    "provide_sow_attachment": "SOW Attached",
    "send_boq_approval": "BOQ Sent for Approval",
    "send_sow_approval": "SOW Sent for Approval",
    "approve_boq": "BOQ Attached",
    "approve_sow": "SOW Attached",
    "deal_reg": "Deal Registration Submitted",
    "oem_received": "OEM Quotation Received",
    "attach_oem_quote": "OEM Quote Attached",
    "create_quote": "Quote Created",
    "send_for_approval": "Quote Sent for Approval",  # quote/ovf disambiguated by entity
    "approve_internally": "Quote Approved",
    "send_to_customer": "Quote Sent",
    "negotiate": "Quote Sent",
    "follow_up": "Quote Sent",
    "accept": "Quote Accepted",
    "quote_accepted": "Quote Accepted",
    "attach_po": "Customer PO Attached",
    "send_po_approval": "Customer PO Sent for Approval",
    "approve_po": "Customer PO Approved / OVF Ready",
    "create_ovf": "OVF Created",
    "approve": "OVF Approved",
    "share_to_scm": "OVF Shared to SCM",
    "deal_won": "Deal Won",
    "won": "Deal Won",
    "lost": "Lost Deal",
}

_TO_STATE_MILESTONE: dict[str, dict[str, str]] = {
    "lead": {
        "open": "Lead Open",
        "converted": "Converted to Opportunity",
        "lost": "Lost Deal",
    },
    "opportunity": {
        "open": "Opportunity Open",
        "boq_pending": "BOQ Attached",
        "boq_attachment_pending": "BOQ attachment requested",
        "sow_attachment_pending": "SOW attachment requested",
        "sow_approval": "SOW Sent for Approval",
        "boq_approval": "BOQ Sent for Approval",
        "deal_reg": "Deal Registration",
        "oem_pending": "Deal Registration Submitted",
        "oem_attached": "OEM Quotation Received",
        "quote_ready": "OEM Quote Attached",
        "quote_in_progress": "Quote Created",
        "po_pending": "Quote Accepted",
        "po_approval": "Customer PO Sent for Approval",
        "ovf_ready": "OVF Ready",
        "won": "Deal Won",
        "lost": "Lost Deal",
    },
    "quote": {
        "draft": "Quote Created",
        "internal_approval": "Quote Sent for Approval",
        "approved_internal": "Quote Approved",
        "sent_to_customer": "Quote Sent",
        "negotiation": "Quote Sent",
        "follow_up": "Quote Sent",
        "accepted": "Quote Accepted",
        "lost": "Lost Deal",
    },
    "ovf": {
        "draft": "OVF Created · Draft",
        "approval": "OVF Sent for Approval",
        "approved": "OVF Approved",
        "shared_scm": "OVF Shared to SCM",
        "deal_won": "Deal Won",
    },
}


def _milestone_title(
    *,
    entity_type: str | None,
    action: str | None,
    to_state: str | None,
) -> str | None:
    action_key = (action or "").strip().lower()
    state_key = (to_state or "").strip().lower()
    et = (entity_type or "").strip().lower()

    if action_key == "send_for_approval":
        if et == "ovf":
            return "OVF Sent for Approval"
        if et == "quote":
            return "Quote Sent for Approval"
    if action_key == "approve" and et == "ovf":
        return "OVF Approved"
    if action_key == "approve_po":
        return "Customer PO Approved"
    if action_key in _ACTION_MILESTONE:
        return _ACTION_MILESTONE[action_key]
    if et in _TO_STATE_MILESTONE and state_key in _TO_STATE_MILESTONE[et]:
        return _TO_STATE_MILESTONE[et][state_key]
        return None


class OpportunityTimelineService:
    def __init__(self, db: Session) -> None:
        self._opportunities = OpportunityRepository(db)
        self._leads = LeadRepository(db)
        self._quotes = QuoteRepository(db)
        self._ovfs = OvfRepository(db)
        self._history = StateHistoryRepository(db)
        self._approvals = ApprovalTaskRepository(db)
        self._users = UserRepository(db)
        self._visibility = CrmRecordVisibility(db)

    def timeline(self, ctx: TenantContext, opportunity_id: UUID) -> dict:
        opp = self._opportunities.get(ctx, opportunity_id)
        if opp is None:
            raise NotFoundException("Opportunity not found")
        self._visibility.ensure_opportunity_access(ctx, opp)

        lead = self._leads.get(ctx, opp.lead_id) if opp.lead_id else None
        quotes = self._quotes.list_quotes(ctx, opp.company_id, opportunity_id=opportunity_id)
        ovfs = self._ovfs.list_ovfs(ctx, opp.company_id, opportunity_id=opportunity_id)
        quote = next((q for q in quotes if q.quote_stage == "accepted"), None) or (
            quotes[0] if quotes else None
        )
        ovf = ovfs[0] if ovfs else None

        entity_labels: dict[UUID, str] = {opp.id: opp.opportunity_code or "Opportunity"}
        for q in quotes:
            entity_labels[q.id] = f"Quote {q.quote_no}"
        for o in ovfs:
            entity_labels[o.id] = f"OVF {o.ovf_no}"
        if lead is not None:
            entity_labels[lead.id] = getattr(lead, "lead_code", None) or "Lead"

        related_ids = [opportunity_id, *[q.id for q in quotes], *[o.id for o in ovfs]]
        if lead is not None:
            related_ids.append(lead.id)

        history_rows = self._history.list_for_entities(ctx, related_ids)
        approval_tasks = self._approvals.list_for_entity_ids(ctx, opp.company_id, related_ids)

        user_ids: set[UUID] = set()
        for uid in (
            opp.created_by,
            getattr(opp, "updated_by", None),
            lead.created_by if lead is not None else None,
            getattr(lead, "updated_by", None) if lead is not None else None,
        ):
            if uid:
                user_ids.add(uid)
        for row in history_rows:
            if row.performed_by:
                user_ids.add(row.performed_by)
        for q in quotes:
            if q.created_by:
                user_ids.add(q.created_by)
            if getattr(q, "updated_by", None):
                user_ids.add(q.updated_by)
        for o in ovfs:
            if o.created_by:
                user_ids.add(o.created_by)
            if getattr(o, "updated_by", None):
                user_ids.add(o.updated_by)
        for task in approval_tasks:
            if task.assigned_user_id:
                user_ids.add(task.assigned_user_id)
            if task.requested_by:
                user_ids.add(task.requested_by)
            if task.decided_by:
                user_ids.add(task.decided_by)

        user_names = self._resolve_users(ctx.tenant_id, user_ids)

        def task_action_for_send(action: str | None, entity_type: str | None) -> str | None:
            key = (action or "").strip().lower()
            if key in _SEND_ACTION_TO_TASK_ACTION:
                return _SEND_ACTION_TO_TASK_ACTION[key]
            if key == "send_for_approval":
                et = (entity_type or "").strip().lower()
                if et == "quote":
                    return "approve_internally"
                if et == "ovf":
                    return "approve"
            return None

        def tasks_for(entity_id: UUID | None, task_action: str | None) -> list:
            if entity_id is None or not task_action:
                return []
            wanted = task_action.lower()
            return [
                t
                for t in approval_tasks
                if t.entity_id == entity_id and (t.action or "").strip().lower() == wanted
            ]

        def task_decided_times(entity_id: UUID | None, *actions: str) -> list[datetime]:
            times: list[datetime] = []
            for action in actions:
                for task in tasks_for(entity_id, action):
                    if (task.status or "").lower() == "approved" and task.decided_at:
                        times.append(task.decided_at)
            return times

        def attachment_milestone_time(
            *task_actions: str,
            history_actions: tuple[str, ...] | None = None,
            fallback_after_opp_seconds: int = 10,
            prefer_before_convert: bool = False,
        ) -> datetime | None:
            """BOQ/SOW attached on the lead must sort above Converted to Opportunity."""
            times: list[datetime] = []
            if lead is not None:
                times.extend(task_decided_times(lead.id, *task_actions))
            times.extend(task_decided_times(opp.id, *task_actions))
            if times:
                return max(times)
            hist = hist_time(*(history_actions or task_actions))
            if hist:
                return hist
            if prefer_before_convert and lead is not None:
                return bump(lead.converted_at or opp.created_at, -5)
            return bump(opp.created_at, fallback_after_opp_seconds)

        def assignee_names_for(entity_id: UUID | None, task_action: str | None) -> list[str]:
            rows = tasks_for(entity_id, task_action)
            selected = [t for t in rows if (t.assigned_role or "") != "admin_copy"]
            pool = selected or rows
            names: list[str] = []
            seen: set[str] = set()
            for task in pool:
                if not task.assigned_user_id:
                    continue
                label = user_names.get(task.assigned_user_id)
                if not label or label in seen:
                    continue
                seen.add(label)
                names.append(label)
            return names

        def decided_for(entity_id: UUID | None, task_action: str | None):
            rows = [
                t
                for t in tasks_for(entity_id, task_action)
                if (t.status or "").lower() == "approved" and t.decided_by
            ]
            if not rows:
                return None, None
            row = max(
                rows,
                key=lambda t: (
                    (t.decided_at or t.updated_at or datetime.min).timestamp()
                    if (t.decided_at or t.updated_at)
                    else 0.0
                ),
            )
            return row.decided_by, user_names.get(row.decided_by)

        def hist_matches(
            *,
            actions: tuple[str, ...] = (),
            to_state: str | None = None,
            entity_id: UUID | None = None,
        ) -> list:
            wanted_actions = {a.lower() for a in actions if a}
            state_key = (to_state or "").strip().lower() or None
            matches = []
            for row in history_rows:
                if entity_id is not None and row.entity_id != entity_id:
                    continue
                action_ok = (
                    not wanted_actions
                    or (row.action or "").strip().lower() in wanted_actions
                )
                state_ok = (
                    state_key is None
                    or (row.to_state or "").strip().lower() == state_key
                )
                if action_ok and state_ok and (wanted_actions or state_key):
                    matches.append(row)
            return matches

        def hist_time(*actions: str, entity_id: UUID | None = None) -> datetime | None:
            matches = hist_matches(actions=actions, entity_id=entity_id)
            if not matches:
                return None
            return min(matches, key=lambda r: r.performed_at or datetime.min).performed_at

        def hist_to_state(to_state: str, entity_id: UUID | None = None) -> datetime | None:
            matches = hist_matches(to_state=to_state, entity_id=entity_id)
            if not matches:
                return None
            return min(matches, key=lambda r: r.performed_at or datetime.min).performed_at

        def hist_actor(
            *actions: str,
            entity_id: UUID | None = None,
            to_state: str | None = None,
        ):
            matches = hist_matches(actions=actions, to_state=to_state, entity_id=entity_id)
            if not matches and to_state:
                matches = hist_matches(to_state=to_state, entity_id=entity_id)
            if not matches and actions:
                matches = hist_matches(actions=actions, entity_id=entity_id)
            if not matches:
                return None
            row = min(matches, key=lambda r: r.performed_at or datetime.min)
            return row.performed_by

        def bump(base: datetime | None, seconds: int) -> datetime | None:
            if base is None:
                return None
            return base + timedelta(seconds=seconds)

        events: list[dict] = []
        seen_titles: set[str] = set()
        default_actor = (
            getattr(opp, "updated_by", None)
            or opp.created_by
            or (lead.created_by if lead is not None else None)
        )

        def add_milestone(
            title: str,
            *,
            occurred_at,
            entity_type: str,
            entity_id: UUID | None,
            event_type: str = "state_transition",
            summary: str | None = None,
            action: str | None = None,
            to_state: str | None = None,
            actor_id=None,
            actor_actions: tuple[str, ...] = (),
            dedupe: bool = True,
        ) -> None:
            if occurred_at is None:
                return
            if dedupe and title in seen_titles:
                return
            seen_titles.add(title)
            resolved_actor = actor_id
            if resolved_actor is None:
                actions = actor_actions or ((action,) if action else ())
                resolved_actor = hist_actor(
                    *actions,
                    entity_id=entity_id,
                    to_state=to_state,
                )
            if resolved_actor is None:
                resolved_actor = default_actor

            send_task_action = task_action_for_send(action, entity_type)
            assignees = assignee_names_for(entity_id, send_task_action) if send_task_action else []

            approve_action = (action or "").strip().lower()
            if approve_action not in _APPROVE_TASK_ACTIONS and actor_actions:
                for candidate in actor_actions:
                    if candidate in _APPROVE_TASK_ACTIONS:
                        approve_action = candidate
                        break
            decided_id = None
            decided_name = None
            if approve_action in _APPROVE_TASK_ACTIONS:
                decided_id, decided_name = decided_for(entity_id, approve_action)
                if decided_id is not None:
                    resolved_actor = decided_id

            events.append(
                _event(
                    id=f"milestone-{title.lower().replace(' ', '-').replace('/', '-')}-{entity_id or opportunity_id}",
                    occurred_at=occurred_at,
                    title=title,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    entity_label=entity_labels.get(entity_id) if entity_id else None,
                    event_type=event_type,
                    summary=summary,
                    action=action,
                    to_state=to_state,
                    actor_id=resolved_actor,
                    actor_name=user_names.get(resolved_actor) if resolved_actor else None,
                    assignee_names=assignees,
                    decided_by_id=decided_id,
                    decided_by_name=decided_name,
                    decision="approved" if decided_id else None,
                )
            )

        # ── Hardware happy-path Current State milestones ─────────────────
        if lead is not None:
            add_milestone(
                "Lead Open",
                occurred_at=lead.created_at,
                entity_type="lead",
                entity_id=lead.id,
                event_type="created",
                summary=getattr(lead, "lead_code", None),
                action="create",
                to_state="open",
                actor_id=lead.created_by,
            )
            if lead.converted_at or lead.blueprint_state == "converted":
                add_milestone(
                    "Converted to Opportunity",
                    occurred_at=lead.converted_at
                    or hist_time("convert", "converted", "convert_lead")
                    or opp.created_at,
                    entity_type="lead",
                    entity_id=lead.id,
                    summary=opp.opportunity_code,
                    action="convert",
                    to_state="converted",
                    actor_id=lead.updated_by or lead.created_by,
                )

        add_milestone(
            "Opportunity Open",
            occurred_at=opp.created_at,
            entity_type="opportunity",
            entity_id=opp.id,
            event_type="created",
            summary=opp.opportunity_name or opp.opportunity_code,
            action="create",
            to_state="open",
            actor_id=opp.created_by,
        )

        # Document attach / study / registration
        if hist_time("send_boq_for_attachment") or (opp.blueprint_state == "boq_attachment_pending"):
            add_milestone(
                "BOQ attachment requested",
                occurred_at=hist_time("send_boq_for_attachment")
                or hist_to_state("boq_attachment_pending")
                or bump(opp.updated_at, 0),
                entity_type="opportunity",
                entity_id=opp.id,
                action="send_boq_for_attachment",
                to_state="boq_attachment_pending",
            )
        if hist_time("send_sow_for_attachment") or (opp.blueprint_state == "sow_attachment_pending"):
            add_milestone(
                "SOW attachment requested",
                occurred_at=hist_time("send_sow_for_attachment")
                or hist_to_state("sow_attachment_pending")
                or bump(opp.updated_at, 0),
                entity_type="opportunity",
                entity_id=opp.id,
                action="send_sow_for_attachment",
                to_state="sow_attachment_pending",
            )
        if opp.boq_attached and opp.sow_attached:
            from_lead = bool(lead is not None and lead.boq_attached and lead.sow_attached)
            add_milestone(
                "BOQ/SOW Attached",
                occurred_at=attachment_milestone_time(
                    "provide_boq_attachment",
                    "provide_sow_attachment",
                    history_actions=(
                        "provide_boq_attachment",
                        "provide_sow_attachment",
                        "attach_boq",
                        "attach_sow",
                    ),
                    prefer_before_convert=from_lead,
                )
                or hist_to_state("boq_pending"),
                entity_type="lead" if from_lead else "opportunity",
                entity_id=lead.id if from_lead and lead is not None else opp.id,
                action="provide_boq_attachment",
                actor_actions=(
                    "provide_boq_attachment",
                    "provide_sow_attachment",
                    "attach_boq",
                    "attach_sow",
                ),
                to_state="boq_pending",
            )
        elif opp.boq_attached:
            from_lead = bool(lead is not None and lead.boq_attached)
            add_milestone(
                "BOQ Attached",
                occurred_at=attachment_milestone_time(
                    "provide_boq_attachment",
                    history_actions=("provide_boq_attachment", "attach_boq", "approve_boq"),
                    prefer_before_convert=from_lead,
                )
                or hist_to_state("boq_pending"),
                entity_type="lead" if from_lead else "opportunity",
                entity_id=lead.id if from_lead and lead is not None else opp.id,
                action="provide_boq_attachment",
                to_state="boq_pending",
            )
        elif opp.sow_attached:
            from_lead = bool(lead is not None and lead.sow_attached)
            add_milestone(
                "SOW Attached",
                occurred_at=attachment_milestone_time(
                    "provide_sow_attachment",
                    history_actions=("provide_sow_attachment", "attach_sow", "approve_sow"),
                    fallback_after_opp_seconds=11,
                    prefer_before_convert=from_lead,
                ),
                entity_type="lead" if from_lead else "opportunity",
                entity_id=lead.id if from_lead and lead is not None else opp.id,
                action="provide_sow_attachment",
                to_state="boq_pending",
            )
        if hist_time("send_sow_approval") or (opp.blueprint_state == "sow_approval"):
            add_milestone(
                "SOW Sent for Approval",
                occurred_at=hist_time("send_sow_approval")
                or hist_to_state("sow_approval")
                or bump(opp.updated_at, 0),
                entity_type="opportunity",
                entity_id=opp.id,
                action="send_sow_approval",
                to_state="sow_approval",
            )
        if hist_time("send_boq_approval") or (opp.blueprint_state == "boq_approval"):
            add_milestone(
                "BOQ Sent for Approval",
                occurred_at=hist_time("send_boq_approval")
                or hist_to_state("boq_approval")
                or bump(opp.updated_at, 0),
                entity_type="opportunity",
                entity_id=opp.id,
                action="send_boq_approval",
                to_state="boq_approval",
            )
        # Legacy study milestones only when approve_* ran without provide_* attachment flow.
        if (
            opp.boq_approved
            and opp.sow_approved
            and hist_time("approve_boq", "approve_sow")
            and not hist_time("provide_boq_attachment", "provide_sow_attachment")
        ):
            add_milestone(
                "BOQ/SOW Studied",
                occurred_at=hist_time("approve_boq", "approve_sow") or bump(opp.updated_at, 2),
                entity_type="opportunity",
                entity_id=opp.id,
                action="approve_boq",
                to_state="deal_reg",
            )
        elif (
            opp.sow_approved
            and hist_time("approve_sow")
            and not hist_time("provide_sow_attachment")
        ):
            add_milestone(
                "SOW Studied",
                occurred_at=hist_time("approve_sow") or bump(opp.updated_at, 1),
                entity_type="opportunity",
                entity_id=opp.id,
                action="approve_sow",
                to_state="deal_reg",
            )
        elif (
            opp.boq_approved
            and hist_time("approve_boq")
            and not hist_time("provide_boq_attachment")
        ):
            add_milestone(
                "BOQ Studied",
                occurred_at=hist_time("approve_boq") or bump(opp.updated_at, 2),
                entity_type="opportunity",
                entity_id=opp.id,
                action="approve_boq",
                to_state="deal_reg",
            )
        if opp.boq_approved or opp.sow_approved or (opp.blueprint_state or "") in {
            "deal_reg",
            "oem_pending",
            "oem_attached",
            "quote_ready",
            "quote_in_progress",
            "po_pending",
            "po_approval",
            "ovf_ready",
            "won",
        }:
            if opp.boq_approved or opp.sow_approved:
                add_milestone(
                    "Deal Registration",
                    occurred_at=hist_to_state("deal_reg")
                    or hist_time("approve_boq", "approve_sow")
                    or bump(opp.updated_at, 3),
                    entity_type="opportunity",
                    entity_id=opp.id,
                    action="approve_boq",
                    to_state="deal_reg",
                )

        if (
            opp.blueprint_state
            in {
                "oem_pending",
                "oem_attached",
                "quote_ready",
                "quote_in_progress",
                "po_pending",
                "po_approval",
                "ovf_ready",
                "won",
            }
            or hist_time("deal_reg")
            or opp.deal_reg_number
        ):
            add_milestone(
                "Deal Registration Submitted",
                occurred_at=hist_time("deal_reg")
                or hist_to_state("oem_pending")
                or bump(opp.updated_at, 4),
                entity_type="opportunity",
                entity_id=opp.id,
                action="deal_reg",
                to_state="oem_pending",
                summary=opp.deal_reg_number,
            )

        if opp.oem_quotation_received or opp.blueprint_state in {
            "oem_attached",
            "quote_ready",
            "quote_in_progress",
            "po_pending",
            "po_approval",
            "ovf_ready",
            "won",
        }:
            add_milestone(
                "OEM Quotation Received",
                occurred_at=hist_time("oem_received")
                or hist_to_state("oem_attached")
                or bump(opp.updated_at, 5),
                entity_type="opportunity",
                entity_id=opp.id,
                action="oem_received",
                to_state="oem_attached",
            )

        if opp.oem_quote_attached or opp.blueprint_state in {
            "quote_ready",
            "quote_in_progress",
            "po_pending",
            "po_approval",
            "ovf_ready",
            "won",
        }:
            add_milestone(
                "OEM Quote Attached",
                occurred_at=hist_time("attach_oem_quote")
                or hist_to_state("quote_ready")
                or bump(opp.updated_at, 6),
                entity_type="opportunity",
                entity_id=opp.id,
                action="attach_oem_quote",
                to_state="quote_ready",
            )

        # Quote path
        if quote is not None:
            qid = quote.id
            add_milestone(
                "Quote Created",
                occurred_at=quote.created_at
                or hist_time("create_quote")
                or hist_to_state("quote_in_progress"),
                entity_type="quote",
                entity_id=qid,
                event_type="created",
                summary=quote.quote_no,
                action="create",
                to_state="draft",
                actor_id=quote.created_by,
            )
            stage = (quote.quote_stage or "").lower()
            quote_order = [
                ("internal_approval", "Quote Sent for Approval", ("send_for_approval",)),
                ("approved_internal", "Quote Approved", ("approve_internally",)),
                ("sent_to_customer", "Quote Sent", ("send_to_customer", "negotiate", "follow_up")),
                ("negotiation", "Quote Sent", ("negotiate",)),
                ("follow_up", "Quote Sent", ("follow_up",)),
                ("accepted", "Quote Accepted", ("accept", "quote_accepted")),
            ]
            stage_rank = {name: i for i, (name, _, _) in enumerate(quote_order)}
            current_rank = stage_rank.get(stage, -1)
            if opp.blueprint_state in {
                "po_pending",
                "po_approval",
                "ovf_ready",
                "won",
            }:
                current_rank = max(current_rank, stage_rank["accepted"])
            for name, title, actions in quote_order:
                if stage_rank[name] > current_rank and stage != name:
                    if not hist_time(*actions, entity_id=qid) and not hist_to_state(name, entity_id=qid):
                        continue
                add_milestone(
                    title,
                    occurred_at=hist_time(*actions, entity_id=qid)
                    or hist_to_state(name, entity_id=qid)
                    or (quote.updated_at if stage == name else None)
                    or bump(quote.created_at, 10 + stage_rank[name]),
                    entity_type="quote",
                    entity_id=qid,
                    action=actions[0],
                    actor_actions=actions,
                    to_state=name,
                    summary=quote.quote_no,
                )

        # Customer PO
        if opp.customer_po_attached or opp.blueprint_state in {"po_approval", "ovf_ready", "won"}:
            add_milestone(
                "Customer PO Attached",
                occurred_at=hist_time("attach_po") or bump(opp.updated_at, 20),
                entity_type="opportunity",
                entity_id=opp.id,
                action="attach_po",
                to_state="po_pending",
            )
        if (
            hist_time("send_po_approval")
            or opp.blueprint_state == "po_approval"
            or (opp.customer_po_attached and not opp.customer_po_approved and opp.locked)
        ):
            add_milestone(
                "Customer PO Sent for Approval",
                occurred_at=hist_time("send_po_approval")
                or hist_to_state("po_approval")
                or bump(opp.updated_at, 21),
                entity_type="opportunity",
                entity_id=opp.id,
                action="send_po_approval",
                to_state="po_approval",
            )
        if opp.customer_po_approved or opp.blueprint_state in {"ovf_ready", "won"} or ovf is not None:
            add_milestone(
                "Customer PO Approved / OVF Ready",
                occurred_at=hist_time("approve_po")
                or hist_to_state("ovf_ready")
                or bump(opp.updated_at, 22),
                entity_type="opportunity",
                entity_id=opp.id,
                action="approve_po",
                to_state="ovf_ready",
            )

        # OVF path
        if ovf is not None:
            oid = ovf.id
            ovf_stage = (ovf.blueprint_state or "draft").lower()
            created_title = "OVF Created · Draft" if ovf_stage == "draft" else "OVF Created"
            add_milestone(
                created_title,
                occurred_at=ovf.created_at or hist_time("create_ovf"),
                entity_type="ovf",
                entity_id=oid,
                event_type="created",
                summary=ovf.ovf_no,
                action="create",
                to_state="draft",
                actor_id=ovf.created_by,
            )
            ovf_steps = [
                ("approval", "OVF Sent for Approval", ("send_for_approval",)),
                ("approved", "OVF Approved", ("approve",)),
                ("shared_scm", "OVF Shared to SCM", ("share_to_scm",)),
                ("deal_won", "Deal Won", ("deal_won",)),
            ]
            rank = {name: i for i, (name, _, _) in enumerate(ovf_steps)}
            current = rank.get(ovf_stage, -1)
            if ovf.deal_won:
                current = rank["deal_won"]
            for name, title, actions in ovf_steps:
                if rank[name] > current and not hist_time(*actions, entity_id=oid):
                    continue
                add_milestone(
                    title,
                    occurred_at=hist_time(*actions, entity_id=oid)
                    or hist_to_state(name, entity_id=oid)
                    or (ovf.updated_at if ovf_stage == name else None)
                    or bump(ovf.created_at, 30 + rank[name]),
                    entity_type="ovf",
                    entity_id=oid,
                    action=actions[0],
                    actor_actions=actions,
                    to_state=name,
                    summary=ovf.ovf_no,
                )

        # Deal won without OVF (cloud / direct)
        if (opp.status or "").lower() == "won" or (opp.blueprint_state or "").lower() == "won":
            add_milestone(
                "Deal Won",
                occurred_at=getattr(opp, "won_at", None)
                or hist_time("deal_won", "won")
                or opp.updated_at,
                entity_type="opportunity",
                entity_id=opp.id,
                action="deal_won",
                to_state="won",
                summary=str(opp.deal_won_amount) if opp.deal_won_amount is not None else opp.opportunity_name,
            )

        # Lost
        if (opp.status or "").lower() == "lost" or (opp.blueprint_state or "").lower() == "lost":
            add_milestone(
                "Lost Deal",
                occurred_at=hist_time("lost") or opp.updated_at,
                entity_type="opportunity",
                entity_id=opp.id,
                action="lost",
                to_state="lost",
            )

        # Fill any remaining history rows that map to Current State labels we missed.
        for row in history_rows:
            title = _milestone_title(
                entity_type=row.entity_type,
                action=row.action,
                to_state=row.to_state,
            )
            if not title or title in seen_titles:
                continue
            add_milestone(
                title,
                occurred_at=row.performed_at,
                entity_type=row.entity_type or "opportunity",
                entity_id=row.entity_id,
                action=row.action,
                to_state=row.to_state,
                actor_id=row.performed_by,
                summary=row.remark,
            )

        events.sort(
            key=lambda e: (
                (e["occurred_at"].timestamp() if e["occurred_at"] else 0.0),
                e["id"],
            )
        )

        return {
            "opportunity_id": opportunity_id,
            "opportunity_code": opp.opportunity_code,
            "opportunity_name": opp.opportunity_name,
            "events": events,
        }

    def _resolve_users(self, tenant_id: UUID, user_ids: set[UUID]) -> dict[UUID, str]:
        names: dict[UUID, str] = {}
        for user_id in user_ids:
            user = self._users.get_by_id(tenant_id, user_id)
            if not user:
                continue
            label = (user.display_name or "").strip() or (user.email or "").strip()
            if label:
                names[user_id] = label
        return names
