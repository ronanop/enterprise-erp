"""Opportunity sales-blueprint orchestration.

Implements the BOQ/SOW -> approval -> deal-reg -> OEM -> quote -> PO ->
approval -> OVF -> won/lost flow described in the product spec, delegating
approval-gated steps to :class:`ApprovalTaskService` (My Jobs) and every
transition to :mod:`sales_blueprint_engine`.
"""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.crm.models import CrmOpportunity
from modules.crm.repository.opportunity_repository import OpportunityRepository
from modules.crm.repository.state_history_repository import StateHistoryRepository
from modules.crm.service.attachment_service import AttachmentService
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.engines import sales_blueprint_engine
from modules.foundation.domain.value_objects import TenantContext


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def log_state_history(
    db: Session,
    ctx: TenantContext,
    *,
    company_id: UUID,
    branch_id: UUID,
    entity_type: str,
    entity_id: UUID,
    from_state: str | None,
    to_state: str,
    action: str,
    remark: str | None = None,
) -> None:
    StateHistoryRepository(db).create(
        ctx,
        company_id=company_id,
        branch_id=branch_id,
        entity_type=entity_type,
        entity_id=entity_id,
        from_state=from_state,
        to_state=to_state,
        action=action,
        remark=remark,
        performed_by=ctx.user_id,
        performed_at=utcnow(),
    )


# Opportunity actions that are UI affordances only — driven by Quote/OVF services.
_GATED_OPPORTUNITY_ACTIONS = {"create_quote", "quote_accepted", "create_ovf", "deal_won"}

# Actions that resume a previously "sent for approval" (locked) opportunity —
# these must be allowed to run *while* the record is locked, since they are
# exactly what releases the lock (approve) or sends it back for rework
# (reject). Only invoked by ApprovalTaskService._resume() from a My Jobs
# decision, never directly by the generic action endpoint pre-lock.
_UNLOCKING_ACTIONS = {"approve_boq", "reject_boq", "approve_po", "reject_po"}


class OpportunityBlueprintService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = OpportunityRepository(db)
        self._attachments = AttachmentService(db)
        self._scope = CrmScopeValidator(db)

    def get(self, ctx: TenantContext, opportunity_id: UUID) -> CrmOpportunity:
        row = self._repo.get(ctx, opportunity_id)
        if row is None:
            raise NotFoundException("Opportunity not found")
        return row

    def _require_blueprint(self, opp: CrmOpportunity) -> str:
        if not opp.blueprint_state:
            raise ConflictException(
                "Opportunity is not part of the sales blueprint. Only opportunities "
                "created via lead-convert support blueprint actions."
            )
        return opp.blueprint_state

    def state(self, ctx: TenantContext, opportunity_id: UUID) -> dict[str, Any]:
        opp = self.get(ctx, opportunity_id)
        is_sales_blueprint = opp.blueprint_state is not None
        current = opp.blueprint_state or "open"
        if not is_sales_blueprint:
            allowed: list[str] = []
        elif opp.locked:
            # While locked, only Lost remains available to the actor; approve/reject
            # run exclusively through My Jobs.
            allowed = ["lost"] if "lost" in sales_blueprint_engine.allowed_actions("opportunity", current) else []
        else:
            allowed = [
                action
                for action in sales_blueprint_engine.allowed_actions("opportunity", current)
                if action not in _GATED_OPPORTUNITY_ACTIONS or action in {"create_quote", "create_ovf"}
            ]
            # Keep create_quote / create_ovf for UI CTAs; drop quote_accepted / deal_won
            # which must never be invoked via the generic opportunity endpoint.
            allowed = [action for action in allowed if action not in {"quote_accepted", "deal_won"}]
        if current == "boq_pending":
            # BOQ and SOW are alternatives in one document step. Once one is
            # selected, only surface re-attachment for that document type.
            if opp.boq_attached and not opp.sow_attached:
                allowed = [action for action in allowed if action != "attach_sow"]
            elif opp.sow_attached and not opp.boq_attached:
                allowed = [action for action in allowed if action != "attach_boq"]
        return {
            "entity_type": "opportunity",
            "entity_id": opp.id,
            "state": current,
            "locked": opp.locked,
            "allowed_actions": allowed,
            "is_sales_blueprint": is_sales_blueprint,
        }

    def perform_action(
        self,
        ctx: TenantContext,
        opportunity_id: UUID,
        action: str,
        payload: dict[str, Any] | None = None,
    ) -> CrmOpportunity:
        payload = payload or {}
        opp = self.get(ctx, opportunity_id)
        current = self._require_blueprint(opp)

        if action != "lost" and action not in _UNLOCKING_ACTIONS:
            sales_blueprint_engine.assert_not_locked(opp)
        if action in _UNLOCKING_ACTIONS and not opp.locked:
            raise ConflictException(
                f"Action '{action}' is only available while the opportunity is locked "
                "pending approval via My Jobs"
            )

        next_state = sales_blueprint_engine.transition("opportunity", current, action, ctx)
        updates: dict[str, Any] = {}

        if action == "attach_boq":
            self._attach(ctx, opp, payload, category="boq")
            updates["boq_attached"] = True
        elif action == "send_boq_approval":
            if not opp.boq_attached and not opp.sow_attached:
                raise ConflictException("Attach a BOQ or SOW before requesting approval")
            document_label = "SOW" if opp.sow_attached and not opp.boq_attached else "BOQ"
            self._raise_approval(
                ctx,
                opp,
                action="approve_boq",
                team_role=payload.get("team_role", "presales"),
                title=f"Approve {document_label} — {opp.opportunity_name}",
                remarks=payload.get("remarks"),
            )
            updates["locked"] = True
        elif action == "approve_boq":
            if opp.sow_attached and not opp.boq_attached:
                updates["sow_approved"] = True
            else:
                updates["boq_approved"] = True
            updates["locked"] = False
        elif action == "reject_boq":
            if opp.sow_attached and not opp.boq_attached:
                updates["sow_approved"] = False
            else:
                updates["boq_approved"] = False
            updates["locked"] = False
        elif action == "attach_sow":
            self._attach(ctx, opp, payload, category="sow")
            updates["sow_attached"] = True
        elif action == "skip_sow":
            updates["sow_skipped"] = True
        elif action == "deal_reg":
            reg_no = payload.get("deal_reg_number")
            if not reg_no:
                raise ConflictException("deal_reg_number is required")
            updates["deal_reg_number"] = reg_no
        elif action == "oem_received":
            updates["oem_quotation_received"] = True
        elif action == "attach_oem_quote":
            self._attach(ctx, opp, payload, category="oem_quote")
            updates["oem_quote_attached"] = True
        elif action == "attach_po":
            self._attach(ctx, opp, payload, category="customer_po")
            updates["customer_po_attached"] = True
        elif action == "send_po_approval":
            if not opp.customer_po_attached:
                raise ConflictException("Attach the customer PO before requesting approval")
            self._raise_approval(
                ctx,
                opp,
                action="approve_po",
                team_role=payload.get("team_role", "management"),
                title=f"Approve Customer PO — {opp.opportunity_name}",
                remarks=payload.get("remarks"),
            )
            updates["locked"] = True
        elif action == "approve_po":
            updates["customer_po_approved"] = True
            updates["locked"] = False
        elif action == "reject_po":
            updates["customer_po_approved"] = False
            updates["locked"] = False
        elif action in _GATED_OPPORTUNITY_ACTIONS:
            # These transitions are driven exclusively by QuoteService /
            # OvfService as a side effect of their own lifecycle (create a
            # quote, accept a quote, create an OVF, mark deal won). They are
            # only listed in allowed_actions for UI affordance — invoking them
            # directly is rejected.
            raise ConflictException(
                f"Action '{action}' must be performed via its dedicated endpoint "
                "(quotes / OVF), not the generic opportunity action endpoint."
            )
        elif action == "lost":
            updates["status"] = "lost"
            updates["current_stage"] = "lost"
            updates["probability_percent"] = 0
            updates["forecast_amount"] = 0
            updates["lost_reason"] = payload.get("reason")
            updates["lost_at"] = utcnow()
            updates["locked"] = False
        else:
            raise ConflictException(f"Unsupported opportunity blueprint action '{action}'")

        updates["blueprint_state"] = next_state
        row = self._repo.update(ctx, opportunity_id, **updates)
        log_state_history(
            self._db,
            ctx,
            company_id=opp.company_id,
            branch_id=opp.branch_id,
            entity_type="opportunity",
            entity_id=opportunity_id,
            from_state=current,
            to_state=next_state,
            action=action,
            remark=payload.get("remark") or payload.get("remarks"),
        )
        return row

    def _attach(
        self, ctx: TenantContext, opp: CrmOpportunity, payload: dict[str, Any], *, category: str
    ) -> None:
        if not payload.get("file_name"):
            raise ConflictException(f"A file is required to attach {category.replace('_', ' ')}")
        if not payload.get("content_base64") and not payload.get("file_path"):
            raise ConflictException(
                f"Upload file content is required to attach {category.replace('_', ' ')}"
            )
        self._attachments.create(
            ctx,
            entity_type="opportunity",
            entity_id=opp.id,
            file_name=payload["file_name"],
            category=category,
            branch_id=opp.branch_id,
            company_id=opp.company_id,
            file_path=payload.get("file_path"),
            content_base64=payload.get("content_base64"),
            content_type=payload.get("content_type"),
        )

    def _raise_approval(
        self,
        ctx: TenantContext,
        opp: CrmOpportunity,
        *,
        action: str,
        team_role: str,
        title: str,
        remarks: str | None,
    ) -> None:
        from modules.crm.service.approval_task_service import ApprovalTaskService

        ApprovalTaskService(self._db).create_task(
            ctx,
            title=title,
            entity_type="opportunity",
            entity_id=opp.id,
            team_role=team_role,
            action=action,
            company_id=opp.company_id,
            branch_id=opp.branch_id,
            remarks=remarks,
        )
