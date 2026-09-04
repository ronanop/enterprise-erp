"""Aggregate opportunity activity into a chronological timeline."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.crm.repository.approval_task_repository import ApprovalTaskRepository
from modules.crm.repository.attachment_repository import AttachmentRepository
from modules.crm.repository.opportunity_repository import OpportunityRepository
from modules.crm.repository.opportunity_stage_repository import OpportunityStageRepository
from modules.crm.repository.ovf_repository import OvfRepository
from modules.crm.repository.quote_repository import QuoteRepository
from modules.crm.repository.state_history_repository import StateHistoryRepository
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.user_repository import UserRepository
from modules.master_data.service.employee_service import EmployeeService


def _humanize(value: str | None) -> str | None:
    if not value:
        return None
    return value.replace("_", " ").strip().title()


class OpportunityTimelineService:
    def __init__(self, db: Session) -> None:
        self._opportunities = OpportunityRepository(db)
        self._quotes = QuoteRepository(db)
        self._ovfs = OvfRepository(db)
        self._history = StateHistoryRepository(db)
        self._approvals = ApprovalTaskRepository(db)
        self._attachments = AttachmentRepository(db)
        self._stages = OpportunityStageRepository(db)
        self._users = UserRepository(db)
        self._employees = EmployeeService(db)

    def timeline(self, ctx: TenantContext, opportunity_id: UUID) -> dict:
        opp = self._opportunities.get(ctx, opportunity_id)
        if opp is None:
            raise NotFoundException("Opportunity not found")

        quotes = self._quotes.list_quotes(ctx, opp.company_id, opportunity_id=opportunity_id)
        ovfs = self._ovfs.list_ovfs(ctx, opp.company_id, opportunity_id=opportunity_id)

        entity_labels: dict[UUID, str] = {opp.id: opp.opportunity_code or "Opportunity"}
        for quote in quotes:
            entity_labels[quote.id] = f"Quote {quote.quote_no}"
        for ovf in ovfs:
            entity_labels[ovf.id] = f"OVF {ovf.ovf_no}"

        related_ids = [opportunity_id, *[q.id for q in quotes], *[o.id for o in ovfs]]
        if opp.lead_id:
            related_ids.append(opp.lead_id)
            entity_labels[opp.lead_id] = "Lead"

        history_rows = self._history.list_for_entities(ctx, related_ids)
        approval_rows = self._approvals.list_for_entity_ids(ctx, opp.company_id, related_ids)
        stage_rows = self._stages.list_for_opportunity(ctx, opportunity_id)

        attachment_rows = list(self._attachments.list_for_entity(ctx, "opportunity", opportunity_id))
        for quote in quotes:
            attachment_rows.extend(self._attachments.list_for_entity(ctx, "quote", quote.id))
        for ovf in ovfs:
            attachment_rows.extend(self._attachments.list_for_entity(ctx, "ovf", ovf.id))

        user_ids: set[UUID] = set()
        employee_ids: set[UUID] = set()
        if opp.created_by:
            user_ids.add(opp.created_by)
        for row in history_rows:
            if row.performed_by:
                user_ids.add(row.performed_by)
        for row in approval_rows:
            for uid in (row.requested_by, row.decided_by, row.assigned_user_id, row.created_by):
                if uid:
                    user_ids.add(uid)
        for row in attachment_rows:
            if row.uploaded_by:
                user_ids.add(row.uploaded_by)
            if row.created_by:
                user_ids.add(row.created_by)
        for quote in quotes:
            if quote.created_by:
                user_ids.add(quote.created_by)
        for ovf in ovfs:
            if ovf.created_by:
                user_ids.add(ovf.created_by)
        for stage in stage_rows:
            if stage.changed_by_employee_id:
                employee_ids.add(stage.changed_by_employee_id)

        user_names = self._resolve_users(ctx.tenant_id, user_ids)
        employee_names = self._resolve_employees(ctx, employee_ids)

        events: list[dict] = []

        events.append(
            {
                "id": f"opp-created-{opp.id}",
                "occurred_at": opp.created_at,
                "event_type": "created",
                "entity_type": "opportunity",
                "entity_id": opp.id,
                "entity_label": entity_labels[opp.id],
                "title": "Opportunity created",
                "summary": opp.opportunity_name or opp.opportunity_code,
                "action": "create",
                "from_state": None,
                "to_state": opp.blueprint_state or opp.current_stage or opp.status,
                "actor_id": opp.created_by,
                "actor_name": user_names.get(opp.created_by) if opp.created_by else None,
                "requested_by_id": None,
                "requested_by_name": None,
                "decided_by_id": None,
                "decided_by_name": None,
                "decision": None,
                "team_role": None,
                "remark": None,
                "version": getattr(opp, "version", None),
            }
        )

        for quote in quotes:
            events.append(
                {
                    "id": f"quote-created-{quote.id}",
                    "occurred_at": quote.created_at,
                    "event_type": "created",
                    "entity_type": "quote",
                    "entity_id": quote.id,
                    "entity_label": entity_labels[quote.id],
                    "title": "Quote created",
                    "summary": quote.quote_no,
                    "action": "create",
                    "from_state": None,
                    "to_state": quote.quote_stage,
                    "actor_id": quote.created_by,
                    "actor_name": user_names.get(quote.created_by) if quote.created_by else None,
                    "requested_by_id": None,
                    "requested_by_name": None,
                    "decided_by_id": None,
                    "decided_by_name": None,
                    "decision": None,
                    "team_role": None,
                    "remark": None,
                    "version": getattr(quote, "version", None),
                }
            )

        for ovf in ovfs:
            events.append(
                {
                    "id": f"ovf-created-{ovf.id}",
                    "occurred_at": ovf.created_at,
                    "event_type": "created",
                    "entity_type": "ovf",
                    "entity_id": ovf.id,
                    "entity_label": entity_labels[ovf.id],
                    "title": "OVF created",
                    "summary": ovf.ovf_no,
                    "action": "create",
                    "from_state": None,
                    "to_state": ovf.blueprint_state,
                    "actor_id": ovf.created_by,
                    "actor_name": user_names.get(ovf.created_by) if ovf.created_by else None,
                    "requested_by_id": None,
                    "requested_by_name": None,
                    "decided_by_id": None,
                    "decided_by_name": None,
                    "decision": None,
                    "team_role": None,
                    "remark": None,
                    "version": getattr(ovf, "version", None),
                }
            )

        for row in history_rows:
            from_label = _humanize(row.from_state)
            to_label = _humanize(row.to_state)
            action_label = _humanize(row.action) or "Transition"
            summary_parts = []
            if from_label and to_label:
                summary_parts.append(f"{from_label} → {to_label}")
            elif to_label:
                summary_parts.append(to_label)
            if row.remark:
                summary_parts.append(row.remark)
            events.append(
                {
                    "id": f"history-{row.id}",
                    "occurred_at": row.performed_at,
                    "event_type": "state_transition",
                    "entity_type": row.entity_type,
                    "entity_id": row.entity_id,
                    "entity_label": entity_labels.get(row.entity_id) or _humanize(row.entity_type),
                    "title": action_label,
                    "summary": " · ".join(summary_parts) if summary_parts else None,
                    "action": row.action,
                    "from_state": row.from_state,
                    "to_state": row.to_state,
                    "actor_id": row.performed_by,
                    "actor_name": user_names.get(row.performed_by) if row.performed_by else None,
                    "requested_by_id": None,
                    "requested_by_name": None,
                    "decided_by_id": None,
                    "decided_by_name": None,
                    "decision": None,
                    "team_role": None,
                    "remark": row.remark,
                    "version": None,
                }
            )

        for row in approval_rows:
            requested_name = user_names.get(row.requested_by) if row.requested_by else None
            decided_name = user_names.get(row.decided_by) if row.decided_by else None
            assigned_name = user_names.get(row.assigned_user_id) if row.assigned_user_id else None
            team = _humanize(row.team_role)
            entity_label = entity_labels.get(row.entity_id) or _humanize(row.entity_type)

            request_summary_parts = [f"Team: {team}" if team else None]
            if requested_name:
                request_summary_parts.append(f"Sent by {requested_name}")
            if assigned_name:
                request_summary_parts.append(f"Assigned to {assigned_name}")
            if row.remarks:
                request_summary_parts.append(row.remarks)

            events.append(
                {
                    "id": f"approval-request-{row.id}",
                    "occurred_at": row.created_at,
                    "event_type": "approval_requested",
                    "entity_type": row.entity_type,
                    "entity_id": row.entity_id,
                    "entity_label": entity_label,
                    "title": row.title or "Approval requested",
                    "summary": " · ".join(p for p in request_summary_parts if p),
                    "action": row.action or "send_for_approval",
                    "from_state": None,
                    "to_state": "pending",
                    "actor_id": row.requested_by or row.created_by,
                    "actor_name": requested_name
                    or (user_names.get(row.created_by) if row.created_by else None),
                    "requested_by_id": row.requested_by,
                    "requested_by_name": requested_name,
                    "decided_by_id": None,
                    "decided_by_name": None,
                    "decision": None,
                    "team_role": row.team_role,
                    "remark": row.remarks,
                    "version": None,
                }
            )

            if row.status in {"approved", "rejected"} and row.decided_at:
                decision_parts = [f"Decision: {_humanize(row.status)}"]
                if decided_name:
                    decision_parts.append(f"By {decided_name}")
                if row.decision_remark:
                    decision_parts.append(row.decision_remark)
                events.append(
                    {
                        "id": f"approval-decision-{row.id}",
                        "occurred_at": row.decided_at,
                        "event_type": "approval_decided",
                        "entity_type": row.entity_type,
                        "entity_id": row.entity_id,
                        "entity_label": entity_label,
                        "title": f"Approval {_humanize(row.status)}".strip(),
                        "summary": " · ".join(decision_parts),
                        "action": row.status,
                        "from_state": "pending",
                        "to_state": row.status,
                        "actor_id": row.decided_by,
                        "actor_name": decided_name,
                        "requested_by_id": row.requested_by,
                        "requested_by_name": requested_name,
                        "decided_by_id": row.decided_by,
                        "decided_by_name": decided_name,
                        "decision": row.status,
                        "team_role": row.team_role,
                        "remark": row.decision_remark,
                        "version": None,
                    }
                )
            elif row.status == "cancelled":
                events.append(
                    {
                        "id": f"approval-cancelled-{row.id}",
                        "occurred_at": row.updated_at or row.created_at,
                        "event_type": "approval_cancelled",
                        "entity_type": row.entity_type,
                        "entity_id": row.entity_id,
                        "entity_label": entity_label,
                        "title": "Approval cancelled",
                        "summary": row.title,
                        "action": "cancelled",
                        "from_state": "pending",
                        "to_state": "cancelled",
                        "actor_id": row.updated_by or row.requested_by,
                        "actor_name": user_names.get(row.updated_by or row.requested_by)
                        if (row.updated_by or row.requested_by)
                        else None,
                        "requested_by_id": row.requested_by,
                        "requested_by_name": requested_name,
                        "decided_by_id": None,
                        "decided_by_name": None,
                        "decision": "cancelled",
                        "team_role": row.team_role,
                        "remark": row.decision_remark or row.remarks,
                        "version": None,
                    }
                )

        for stage in stage_rows:
            actor_name = None
            actor_id = None
            if stage.changed_by_employee_id:
                actor_id = stage.changed_by_employee_id
                actor_name = employee_names.get(stage.changed_by_employee_id)
            events.append(
                {
                    "id": f"stage-{stage.id}",
                    "occurred_at": stage.entered_at,
                    "event_type": "stage_change",
                    "entity_type": "opportunity",
                    "entity_id": opportunity_id,
                    "entity_label": entity_labels[opportunity_id],
                    "title": f"Stage: {stage.stage_name or _humanize(stage.stage_code)}",
                    "summary": stage.notes,
                    "action": "stage_change",
                    "from_state": None,
                    "to_state": stage.stage_code,
                    "actor_id": actor_id,
                    "actor_name": actor_name,
                    "requested_by_id": None,
                    "requested_by_name": None,
                    "decided_by_id": None,
                    "decided_by_name": None,
                    "decision": None,
                    "team_role": None,
                    "remark": stage.notes,
                    "version": None,
                }
            )

        for att in attachment_rows:
            uploader = att.uploaded_by or att.created_by
            category = _humanize(att.category) or "Attachment"
            events.append(
                {
                    "id": f"attachment-{att.id}",
                    "occurred_at": att.created_at,
                    "event_type": "attachment",
                    "entity_type": att.entity_type,
                    "entity_id": att.entity_id,
                    "entity_label": entity_labels.get(att.entity_id) or _humanize(att.entity_type),
                    "title": f"{category} attached",
                    "summary": att.file_name,
                    "action": "attach",
                    "from_state": None,
                    "to_state": None,
                    "actor_id": uploader,
                    "actor_name": user_names.get(uploader) if uploader else None,
                    "requested_by_id": None,
                    "requested_by_name": None,
                    "decided_by_id": None,
                    "decided_by_name": None,
                    "decision": None,
                    "team_role": None,
                    "remark": None,
                    "version": None,
                }
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
            if user and user.display_name:
                names[user_id] = user.display_name
        return names

    def _resolve_employees(self, ctx: TenantContext, employee_ids: set[UUID]) -> dict[UUID, str]:
        names: dict[UUID, str] = {}
        for employee_id in employee_ids:
            try:
                employee = self._employees.get_employee(ctx, employee_id)
            except NotFoundException:
                continue
            label = f"{employee.first_name} {employee.last_name}".strip()
            if label:
                names[employee_id] = label
        return names
