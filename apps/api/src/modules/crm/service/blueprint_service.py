"""Opportunity sales-blueprint orchestration.

Implements the BOQ/SOW -> approval -> deal-reg -> OEM -> quote -> PO ->
approval -> OVF -> won/lost flow described in the product spec, delegating
approval-gated steps to :class:`ApprovalTaskService` (My Jobs) and every
transition to :mod:`sales_blueprint_engine`.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.crm.models import CrmOpportunity
from modules.crm.repository.opportunity_repository import OpportunityRepository
from modules.crm.repository.state_history_repository import StateHistoryRepository
from modules.crm.service.attachment_service import AttachmentService
from modules.crm.service.cloud_flow import (
    HARDWARE_PIPELINE_ACTIONS,
    VARIANT_MIGRATION,
    filter_opportunity_actions,
    is_cloud_opportunity,
    uses_cloud_consumption_flow,
)
from modules.crm.service.crm_record_visibility import CrmRecordVisibility
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import is_deal_reg_number
from modules.crm.service.engines import sales_blueprint_engine
from modules.foundation.domain.value_objects import TenantContext


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _require_assigned_users(payload: dict[str, Any]) -> list[UUID]:
    """Collect one or more selected approvers from the action payload."""
    ids: list[UUID] = []
    seen: set[UUID] = set()
    raw_list = payload.get("assigned_user_ids")
    if isinstance(raw_list, list):
        for item in raw_list:
            if not item:
                continue
            uid = UUID(str(item))
            if uid in seen:
                continue
            seen.add(uid)
            ids.append(uid)
    raw_single = payload.get("assigned_user_id")
    if raw_single:
        uid = UUID(str(raw_single))
        if uid not in seen:
            ids.append(uid)
    if not ids:
        raise ConflictException("Select at least one approver before sending for approval")
    return ids


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
    if entity_type == "opportunity":
        _notify_admins_opportunity_stage(
            db,
            ctx,
            opportunity_id=entity_id,
            from_state=from_state,
            to_state=to_state,
            action=action,
        )


def _notify_admins_opportunity_stage(
    db: Session,
    ctx: TenantContext,
    *,
    opportunity_id: UUID,
    from_state: str | None,
    to_state: str,
    action: str,
) -> None:
    """Alert CRM admins when an opportunity milestone/stage completes."""
    from modules.crm.service.crm_notification_service import (
        notify_opportunity_stage_completed,
        should_notify_opportunity_stage,
    )

    if not should_notify_opportunity_stage(
        from_state=from_state, to_state=to_state, action=action
    ):
        return

    opp = db.get(CrmOpportunity, opportunity_id)
    if opp is None or getattr(opp, "is_deleted", False):
        return

    actor_name: str | None = None
    if ctx.user_id is not None:
        from sqlalchemy import select

        from modules.foundation.models.security import SecUser

        user = db.scalar(
            select(SecUser).where(
                SecUser.id == ctx.user_id,
                SecUser.tenant_id == ctx.tenant_id,
                SecUser.is_deleted.is_(False),
            )
        )
        if user is not None:
            actor_name = user.display_name or user.email

    notify_opportunity_stage_completed(
        db,
        tenant_id=ctx.tenant_id,
        opportunity_id=opportunity_id,
        opportunity_name=opp.opportunity_name or "Opportunity",
        from_state=from_state,
        to_state=to_state,
        action=action,
        actor_user_id=ctx.user_id,
        actor_name=actor_name,
    )


# Opportunity actions that are UI affordances only - driven by Quote/OVF services.
_GATED_OPPORTUNITY_ACTIONS = {"create_quote", "quote_accepted", "create_ovf", "deal_won"}

# Actions that resume a previously "sent for approval" (locked) opportunity -
# these must be allowed to run *while* the record is locked, since they are
# exactly what releases the lock (approve) or sends it back for rework
# (reject). Only invoked by ApprovalTaskService._resume() from a My Jobs
# decision, never directly by the generic action endpoint pre-lock.
_UNLOCKING_ACTIONS = {
    "approve_boq",
    "reject_boq",
    "approve_sow",
    "reject_sow",
    "provide_boq_attachment",
    "reject_boq_attachment",
    "provide_sow_attachment",
    "reject_sow_attachment",
    "approve_po_finance",
    "reject_po_finance",
    "approve_po_terms",
    "reject_po_terms",
    "approve_po",
    "reject_po",
    "approve_cloud_discount",
    "reject_cloud_discount",
}

# Customer PO validation chain: Finance checks tax/GST and commercial
# correctness, Legal checks terms & conditions, Management gives the final
# go-ahead. Each stage names the My Jobs team that owns it.
PO_VALIDATION_STAGES: tuple[tuple[str, str, str], ...] = (
    ("finance", "accounts", "approve_po_finance"),
    ("legal", "legal", "approve_po_terms"),
    ("management", "management", "approve_po"),
)

_PO_STAGE_TITLES = {
    "finance": "Validate Customer PO (Finance - tax & commercials)",
    "legal": "Validate Customer PO Terms & Conditions (Legal)",
    "management": "Approve Customer PO",
}

# Operations owners who receive the services/installation scope as soon as the
# customer PO is approved - they do not wait for the hardware to arrive.
OPERATIONS_STAGE = "operations"

# Entity type used for the Operations notice. It is informational, so it is
# deliberately outside the blueprint dispatch in ApprovalTaskService._resume.
SERVICE_SCOPE_ENTITY = "service_scope"


def _po_stage_user_ids(payload: dict[str, Any], stage: str) -> list[UUID]:
    """Approvers selected for one stage (empty list when none were provided)."""
    raw = payload.get(f"{stage}_user_ids")
    if not raw:
        return []
    return _require_assigned_users({"assigned_user_ids": raw})


PO_STAGE_TO_STEP_KEY = {
    "finance": "po_finance",
    "legal": "po_legal",
    "management": "po_management",
    "operations": "service_scope",
}


class OpportunityBlueprintService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = OpportunityRepository(db)
        self._attachments = AttachmentService(db)
        self._scope = CrmScopeValidator(db)
        self._visibility = CrmRecordVisibility(db)

    def get(self, ctx: TenantContext, opportunity_id: UUID) -> CrmOpportunity:
        row = self._repo.get(ctx, opportunity_id)
        if row is None:
            raise NotFoundException("Opportunity not found")
        self._visibility.ensure_opportunity_access(ctx, row)
        return row

    def next_deal_reg_number(self, ctx: TenantContext, opportunity_id: UUID) -> str:
        """Preview the DR number for Deal Registration (does not persist)."""
        from modules.crm.service.document_number_service import DocumentNumberService

        opp = self.get(ctx, opportunity_id)
        if opp.deal_reg_number:
            return opp.deal_reg_number
        entity_name = None
        if opp.lead_id is not None:
            from modules.crm.models import CrmLead

            lead = self._db.get(CrmLead, opp.lead_id)
            lead_dr = (getattr(lead, "dr_number", None) or getattr(lead, "lead_code", None) or "").strip()
            if is_deal_reg_number(lead_dr):
                return lead_dr
            entity_name = getattr(lead, "entity_name", None) if lead is not None else None
        return DocumentNumberService(self._db).next_deal_reg_number(
            opp.company_id, entity_name=entity_name
        )

    def _require_blueprint(self, opp: CrmOpportunity) -> str:
        if not opp.blueprint_state:
            raise ConflictException(
                "Opportunity is not part of the sales blueprint. Only opportunities "
                "created via lead-convert support blueprint actions."
            )
        return opp.blueprint_state

    def _blueprint_overlay_transitions(self, ctx: TenantContext) -> list[dict[str, Any]]:
        from modules.crm.service.crm_settings_service import CrmSettingsService

        settings = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
        block = settings.get("blueprint") if isinstance(settings, dict) else None
        rows = block.get("transitions") if isinstance(block, dict) else None
        if not isinstance(rows, list):
            return []
        return [r for r in rows if isinstance(r, dict)]

    def state(self, ctx: TenantContext, opportunity_id: UUID) -> dict[str, Any]:
        opp = self._reconcile_post_lead_docs(ctx, self.get(ctx, opportunity_id))
        is_sales_blueprint = opp.blueprint_state is not None
        current = opp.blueprint_state or "open"
        overlay_transitions = self._blueprint_overlay_transitions(ctx)
        if not is_sales_blueprint:
            allowed: list[str] = []
        elif opp.locked:
            # While locked, only Lost remains available to the actor; approve/reject
            # run exclusively through My Jobs.
            allowed = (
                ["lost"]
                if "lost"
                in sales_blueprint_engine.allowed_actions(
                    "opportunity", current, overlay_transitions=overlay_transitions
                )
                else []
            )
        else:
            allowed = [
                action
                for action in sales_blueprint_engine.allowed_actions(
                    "opportunity", current, overlay_transitions=overlay_transitions
                )
                if action not in _GATED_OPPORTUNITY_ACTIONS or action in {"create_quote", "create_ovf"}
            ]
            # Keep create_quote / create_ovf for UI CTAs; drop quote_accepted / deal_won
            # which must never be invoked via the generic opportunity endpoint.
            allowed = [action for action in allowed if action not in {"quote_accepted", "deal_won"}]
        allowed = filter_opportunity_actions(opp, allowed)
        allowed = self._filter_document_step_actions(allowed, opp)
        # Attach PO auto-sends for approval; never offer a separate send step.
        allowed = [action for action in allowed if action != "send_po_approval"]
        if opp.customer_po_attached and current != "po_pending":
            allowed = [action for action in allowed if action != "attach_po"]
        if opp.customer_po_approved:
            allowed = [action for action in allowed if action != "attach_po"]
        if current in {"boq_approval", "sow_approval", "po_approval"} and not opp.locked:
            # Approve/reject run via My Jobs while locked; hide stale actions if unlocked.
            allowed = [action for action in allowed if action not in _UNLOCKING_ACTIONS]
        allowed = self._ensure_peer_document_actions(allowed, opp, current)
        allowed = self._filter_create_actions_when_children_exist(ctx, opp, allowed)
        # Deal Lost ends once the quote is accepted / opportunity is won.
        if str(opp.status or "").lower() == "won" or current in {
            "po_pending",
            "po_approval",
            "ovf_ready",
            "won",
        }:
            allowed = [action for action in allowed if action != "lost"]
        from modules.crm.service.crm_settings_service import CrmSettingsService

        settings = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
        allowed = [
            action
            for action in allowed
            if CrmSettingsService.blueprint_action_enabled(settings, action, True)
        ]
        return {
            "entity_type": "opportunity",
            "entity_id": opp.id,
            "state": current,
            "locked": opp.locked,
            "allowed_actions": allowed,
            "is_sales_blueprint": is_sales_blueprint,
            "po_validation": self._po_validation(opp, current),
        }

    def _reconcile_post_lead_docs(
        self, ctx: TenantContext, opp: CrmOpportunity
    ) -> CrmOpportunity:
        """Advance opportunities after lead BOQ/SOW — skip Deal Reg when DR already exists.

        Attached lead docs are sent to Default task owners for BOQ/SOW approval
        (not auto-approved). DR is issued on lead create, so once both docs are
        approved the opportunity lands on Attach Vendor Quotation.
        """
        current = opp.blueprint_state or "open"
        has_dr = is_deal_reg_number(opp.deal_reg_number or opp.opportunity_code)

        # Already past docs but still sitting on Deal Registration with a DR → OEM next.
        if current == "deal_reg" and has_dr and (opp.boq_approved or opp.sow_approved):
            row = self._repo.update(ctx, opp.id, blueprint_state="oem_pending")
            return row or opp

        if current not in {"open", "boq_pending", "deal_reg"}:
            return opp
        if not opp.boq_attached and not opp.sow_attached:
            return opp

        boq_needs = bool(opp.boq_attached) and not bool(opp.boq_approved)
        sow_needs = bool(opp.sow_attached) and not bool(opp.sow_approved) and not bool(opp.sow_skipped)
        if not boq_needs and not sow_needs:
            if current == "open" and (opp.boq_approved or opp.sow_approved):
                row = self._repo.update(
                    ctx,
                    opp.id,
                    blueprint_state="oem_pending" if has_dr else "deal_reg",
                    locked=False,
                )
                return row or opp
            return opp

        # Prefer BOQ study first, then SOW. BOQ uses Default task owners;
        # SOW on Services deals routes only to the opportunity owner.
        if boq_needs:
            self._auto_raise_doc_approval(ctx, opp, doc="boq")
            row = self._repo.update(
                ctx, opp.id, blueprint_state="boq_approval", locked=True
            )
            return row or opp
        self._auto_raise_doc_approval(ctx, opp, doc="sow")
        row = self._repo.update(
            ctx, opp.id, blueprint_state="sow_approval", locked=True
        )
        return row or opp

    @staticmethod
    def _po_validation(opp: CrmOpportunity, current: str) -> dict[str, Any]:
        """Finance → Legal (terms) → Management progress on the customer PO."""
        finance_status = getattr(opp, "po_finance_status", None) or "not_required"
        terms_status = getattr(opp, "po_terms_status", None) or "not_required"
        if opp.customer_po_approved:
            management_status = "approved"
        elif terms_status == "approved" and current == "po_approval":
            management_status = "pending"
        else:
            management_status = "not_required"
        return {
            "finance": {
                "status": finance_status,
                "remark": getattr(opp, "po_finance_remark", None),
                "decided_at": getattr(opp, "po_finance_at", None),
            },
            "legal": {
                "status": terms_status,
                "remark": getattr(opp, "po_terms_remark", None),
                "decided_at": getattr(opp, "po_terms_at", None),
            },
            "management": {
                "status": management_status,
                "remark": None,
                "decided_at": None,
            },
        }

    def _filter_create_actions_when_children_exist(
        self, ctx: TenantContext, opp: CrmOpportunity, allowed: list[str]
    ) -> list[str]:
        """Hide Create Quote / Create OVF once those records already exist.

        One opportunity → one OVF that combines all accepted split quotes.
        """
        from modules.crm.repository.ovf_repository import OvfRepository
        from modules.crm.repository.quote_repository import QuoteRepository

        actions = list(allowed)
        quotes = QuoteRepository(self._db).list_quotes(
            ctx, opp.company_id, opportunity_id=opp.id
        )
        if "create_quote" in actions and quotes:
            actions = [action for action in actions if action != "create_quote"]
        if "create_ovf" in actions:
            ovfs = OvfRepository(self._db).list_ovfs(ctx, opp.company_id, opportunity_id=opp.id)
            if ovfs:
                actions = [action for action in actions if action != "create_ovf"]
            else:
                parent_ids_with_children = {
                    q.parent_quote_id for q in quotes if getattr(q, "parent_quote_id", None)
                }
                eligible = [
                    q
                    for q in quotes
                    if q.quote_stage == "accepted" and q.id not in parent_ids_with_children
                ]
                if not eligible:
                    actions = [action for action in actions if action != "create_ovf"]
        return actions

    @staticmethod
    def _filter_document_step_actions(allowed: list[str], opp: CrmOpportunity) -> list[str]:
        """Gate BOQ/SOW attachment requests and Deal Registration by document status.

        Primary path: Send BOQ/SOW for attachment (assignee uploads via My Jobs).
        Legacy attach + send-for-approval actions are hidden from the sales UI.
        """
        actions = list(allowed)

        # Prefer attachment-request flow; hide CRM self-attach / study approval.
        for legacy in ("attach_boq", "attach_sow", "send_boq_approval", "send_sow_approval"):
            actions = [action for action in actions if action != legacy]

        if opp.boq_attached or opp.boq_approved:
            actions = [action for action in actions if action != "send_boq_for_attachment"]
        if opp.sow_attached or opp.sow_approved:
            actions = [action for action in actions if action != "send_sow_for_attachment"]

        # Deal Registration only when docs are ready AND no DR yet (DR now comes from lead create).
        has_dr = is_deal_reg_number(opp.deal_reg_number or opp.opportunity_code)
        if not opp.boq_approved and not opp.sow_approved:
            actions = [action for action in actions if action != "deal_reg"]
        elif has_dr:
            actions = [action for action in actions if action != "deal_reg"]

        return actions

    @staticmethod
    def _ensure_peer_document_actions(
        allowed: list[str], opp: CrmOpportunity, current: str
    ) -> list[str]:
        """After one document is done, keep the other attachment-request path available."""
        if opp.locked or current not in {
            "boq_pending",
            "deal_reg",
            "boq_approval",
            "sow_approval",
            "open",
        }:
            return allowed
        if not opp.boq_approved and not opp.sow_approved:
            return allowed

        actions = list(allowed)

        if opp.sow_approved and not opp.boq_attached and "send_boq_for_attachment" not in actions:
            actions.append("send_boq_for_attachment")
        if opp.boq_approved and not opp.sow_attached and "send_sow_for_attachment" not in actions:
            actions.append("send_sow_for_attachment")

        return sorted(set(actions))

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

        if uses_cloud_consumption_flow(opp) and action in HARDWARE_PIPELINE_ACTIONS:
            raise ConflictException(
                f"Action '{action}' is not used in the cloud consumption sales flow "
                "(no DR, BOQ/SOW, or hardware quote path)."
            )
        if (
            action == "attach_oem_quote"
            and uses_cloud_consumption_flow(opp)
            and current != "map_oem_pending"
        ):
            raise ConflictException(
                "Attach OEM quote is only for MAP migration opportunities awaiting "
                "the AWS migration quotation."
            )
        if action == "deal_reg" and is_cloud_opportunity(opp):
            raise ConflictException("Deal registration is not used for cloud consumption opportunities")

        next_state = sales_blueprint_engine.transition(
            "opportunity",
            current,
            action,
            ctx,
            overlay_transitions=self._blueprint_overlay_transitions(ctx),
        )
        updates: dict[str, Any] = {}

        if action == "attach_contract":
            self._attach(ctx, opp, payload, category="contract")
            updates["contract_attached"] = True
        elif action == "send_cloud_discount_approval":
            self._validate_cloud_discount_fields(opp)
            summary = self._cloud_approval_summary(opp)
            self._raise_approval(
                ctx,
                opp,
                action="approve_cloud_discount",
                team_role=payload.get("team_role", "management"),
                title=f"Approve Cloud Discount - {opp.opportunity_name}",
                remarks=payload.get("remarks") or summary,
                assigned_user_ids=_require_assigned_users(payload),
            )
            updates["locked"] = True
        elif action == "approve_cloud_discount":
            updates["locked"] = False
            if is_cloud_opportunity(opp):
                next_state = (
                    "map_oem_pending"
                    if opp.cloud_blueprint_variant == VARIANT_MIGRATION
                    else "cloud_onboarding"
                )
        elif action == "reject_cloud_discount":
            updates["locked"] = False
        elif action == "attach_boq":
            self._attach(ctx, opp, payload, category="boq")
            updates["boq_attached"] = True
            updates["boq_approved"] = False
            self._auto_raise_doc_approval(ctx, opp, doc="boq")
            updates["locked"] = True
            next_state = "boq_approval"
        elif action == "send_boq_for_attachment":
            if is_cloud_opportunity(opp):
                raise ConflictException(
                    "Use Send Cloud Discount for Approval on cloud opportunities"
                )
            if opp.boq_attached or opp.boq_approved:
                raise ConflictException("BOQ is already attached")
            self._raise_approval(
                ctx,
                opp,
                action="provide_boq_attachment",
                team_role=payload.get("team_role", "presales"),
                title=f"Attach BOQ - {opp.opportunity_name}",
                remarks=payload.get("remarks"),
                assigned_user_ids=_require_assigned_users(payload),
            )
            updates["locked"] = True
        elif action == "send_sow_for_attachment":
            if opp.sow_attached or opp.sow_approved:
                raise ConflictException("SOW is already attached")
            self._raise_approval(
                ctx,
                opp,
                action="provide_sow_attachment",
                team_role=payload.get("team_role", "presales"),
                title=f"Attach SOW - {opp.opportunity_name}",
                remarks=payload.get("remarks"),
                assigned_user_ids=self._sow_assignee_ids(ctx, opp, payload),
            )
            updates["locked"] = True
        elif action == "provide_boq_attachment":
            self._attach(ctx, opp, payload, category="boq")
            updates["boq_attached"] = True
            updates["boq_approved"] = False
            self._auto_raise_doc_approval(ctx, opp, doc="boq")
            updates["locked"] = True
            next_state = "boq_approval"
        elif action == "reject_boq_attachment":
            updates["locked"] = False
        elif action == "provide_sow_attachment":
            self._attach(ctx, opp, payload, category="sow")
            updates["sow_attached"] = True
            updates["sow_approved"] = False
            self._auto_raise_doc_approval(ctx, opp, doc="sow")
            updates["locked"] = True
            next_state = "sow_approval"
        elif action == "reject_sow_attachment":
            updates["locked"] = False
        elif action == "send_boq_approval":
            if is_cloud_opportunity(opp):
                raise ConflictException(
                    "Use Send Cloud Discount for Approval on cloud opportunities"
                )
            if not opp.boq_attached:
                raise ConflictException("Attach a BOQ before requesting approval")
            if opp.boq_approved:
                raise ConflictException("BOQ is already approved")
            assigned = (
                _require_assigned_users(payload)
                if payload.get("assigned_user_ids") or payload.get("assigned_user_id")
                else self._default_doc_approver_ids(ctx, "boq")
            )
            self._raise_approval(
                ctx,
                opp,
                action="approve_boq",
                team_role=payload.get("team_role", "presales"),
                title=f"Approve BOQ - {opp.opportunity_name}",
                remarks=payload.get("remarks"),
                assigned_user_ids=assigned,
            )
            updates["locked"] = True
        elif action == "send_sow_approval":
            if not opp.sow_attached:
                raise ConflictException("Attach a SOW before requesting approval")
            if opp.sow_approved:
                raise ConflictException("SOW is already approved")
            self._raise_approval(
                ctx,
                opp,
                action="approve_sow",
                team_role=payload.get("team_role", "presales"),
                title=f"Approve SOW - {opp.opportunity_name}",
                remarks=payload.get("remarks"),
                assigned_user_ids=self._sow_assignee_ids(ctx, opp, payload),
            )
            updates["locked"] = True
        elif action == "approve_boq":
            updates["boq_approved"] = True
            next_state, lock = self._advance_after_doc_approval(
                ctx, opp, approved_doc="boq", updates=updates
            )
            updates["locked"] = lock
        elif action == "reject_boq":
            self._clear_approval_attachment(ctx, opp.id, "boq")
            updates["boq_approved"] = False
            updates["boq_attached"] = False
            updates["locked"] = False
        elif action == "approve_sow":
            updates["sow_approved"] = True
            next_state, lock = self._advance_after_doc_approval(
                ctx, opp, approved_doc="sow", updates=updates
            )
            updates["locked"] = lock
        elif action == "reject_sow":
            self._clear_approval_attachment(ctx, opp.id, "sow")
            updates["sow_approved"] = False
            updates["sow_attached"] = False
            updates["locked"] = False
        elif action == "attach_sow":
            self._attach(ctx, opp, payload, category="sow")
            updates["sow_attached"] = True
            updates["sow_approved"] = False
            self._auto_raise_doc_approval(ctx, opp, doc="sow")
            updates["locked"] = True
            next_state = "sow_approval"
        elif action == "skip_sow":
            updates["sow_skipped"] = True
        elif action == "deal_reg":
            if not opp.boq_approved and not opp.sow_approved:
                raise ConflictException(
                    "Attach a BOQ or SOW before Deal Registration"
                )
            reg_no = (payload.get("deal_reg_number") or "").strip() or (opp.deal_reg_number or "").strip()
            entity_name = None
            if not reg_no and opp.lead_id is not None:
                from modules.crm.models import CrmLead

                lead = self._db.get(CrmLead, opp.lead_id)
                lead_dr = (getattr(lead, "dr_number", None) or getattr(lead, "lead_code", None) or "").strip()
                if is_deal_reg_number(lead_dr):
                    reg_no = lead_dr
                entity_name = getattr(lead, "entity_name", None) if lead is not None else None
            if not reg_no:
                from modules.crm.service.document_number_service import DocumentNumberService

                reg_no = DocumentNumberService(self._db).next_deal_reg_number(
                    opp.company_id, entity_name=entity_name
                )
            updates["deal_reg_number"] = reg_no
            if not is_deal_reg_number(opp.opportunity_code):
                updates["opportunity_code"] = reg_no
        elif action == "oem_received":
            # Legacy acknowledgement step — kept for history replay only.
            updates["oem_quotation_received"] = True
        elif action == "attach_oem_quote":
            self._attach(ctx, opp, payload, category="oem_quote")
            updates["oem_quote_attached"] = True
            updates["oem_quotation_received"] = True
            if current == "map_oem_pending":
                next_state = "cloud_onboarding"
        elif action == "skip_map_oem_quote":
            if current != "map_oem_pending":
                raise ConflictException("skip_map_oem_quote is only available during MAP OEM quote step")
            next_state = "cloud_onboarding"
        elif action == "mark_onboarding_done":
            raw_date = payload.get("onboarding_date")
            if not raw_date:
                raise ConflictException("onboarding_date is required")
            onboarding_date = raw_date if isinstance(raw_date, date) else date.fromisoformat(str(raw_date)[:10])
            updates["onboarding_date"] = onboarding_date
            updates["onboarding_done"] = True
            updates["status"] = "won"
            updates["current_stage"] = "won"
            updates["probability_percent"] = 100
            updates["forecast_amount"] = opp.expected_revenue
            updates["won_at"] = utcnow()
        elif action == "attach_po":
            has_file = bool(payload.get("file_name")) and bool(
                payload.get("content_base64") or payload.get("file_path")
            )
            if has_file:
                self._attach(ctx, opp, payload, category="customer_po")
                updates["customer_po_attached"] = True
            elif not opp.customer_po_attached:
                raise ConflictException("A file is required to attach customer PO")
            # Attach + send for approval is one step (Finance → Legal → Management).
            po_updates = self._build_po_approval_updates(ctx, opp, payload)
            updates.update(po_updates)
            next_state = "po_approval"
        elif action == "send_po_approval":
            # Legacy path kept for in-flight clients; prefer attach_po which auto-sends.
            if not opp.customer_po_attached:
                raise ConflictException("Attach the customer PO before requesting approval")
            po_updates = self._build_po_approval_updates(ctx, opp, payload)
            updates.update(po_updates)
            next_state = "po_approval"
        elif action == "approve_po_finance":
            updates["po_finance_status"] = "approved"
            updates["po_finance_by"] = ctx.user_id
            updates["po_finance_at"] = utcnow()
            updates["po_finance_remark"] = payload.get("remark")
            updates["po_terms_status"] = "pending"
            # Finance signed off on tax/GST; terms & conditions go to Legal next.
            self._raise_po_stage(ctx, opp, stage="legal", chain=opp.po_approval_chain, remarks=None)
            updates["locked"] = True
        elif action == "reject_po_finance":
            updates["po_finance_status"] = "rejected"
            updates["po_finance_by"] = ctx.user_id
            updates["po_finance_at"] = utcnow()
            updates["po_finance_remark"] = payload.get("remark")
            updates["locked"] = False
        elif action == "approve_po_terms":
            updates["po_terms_status"] = "approved"
            updates["po_terms_by"] = ctx.user_id
            updates["po_terms_at"] = utcnow()
            updates["po_terms_remark"] = payload.get("remark")
            self._raise_po_stage(
                ctx, opp, stage="management", chain=opp.po_approval_chain, remarks=None
            )
            updates["locked"] = True
        elif action == "reject_po_terms":
            # T&C need revision - the PO stays attached so Sales can send the
            # amended terms back through the chain without re-uploading.
            updates["po_terms_status"] = "rejected"
            updates["po_terms_by"] = ctx.user_id
            updates["po_terms_at"] = utcnow()
            updates["po_terms_remark"] = payload.get("remark")
            updates["locked"] = False
        elif action == "approve_po":
            if opp.po_finance_status != "approved" or opp.po_terms_status != "approved":
                raise ConflictException(
                    "Customer PO needs Finance and Legal (terms & conditions) validation "
                    "before Management approval"
                )
            updates["customer_po_approved"] = True
            updates["locked"] = False
            self._notify_operations_of_service_scope(ctx, opp)
            self._spawn_service_po_from_opportunity(ctx, opp)
        elif action == "reject_po":
            self._clear_approval_attachment(ctx, opp.id, "customer_po")
            updates["customer_po_approved"] = False
            updates["customer_po_attached"] = False
            updates["po_finance_status"] = "not_required"
            updates["po_terms_status"] = "not_required"
            updates["locked"] = False
        elif action in _GATED_OPPORTUNITY_ACTIONS:
            # These transitions are driven exclusively by QuoteService /
            # OvfService as a side effect of their own lifecycle (create a
            # quote, accept a quote, create an OVF, mark deal won). They are
            # only listed in allowed_actions for UI affordance - invoking them
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
        if action == "lost" and row is not None:
            self._notify_deal_lost_emails(ctx, row)
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

    def _default_doc_approver_ids(self, ctx: TenantContext, doc: str) -> list[UUID]:
        """Resolve Default task owners for BOQ/SOW approval steps."""
        from modules.crm.service.approval_step_owner_service import ApprovalStepOwnerService
        from modules.crm.service.approval_task_service import ApprovalTaskService
        from modules.crm.service.crm_settings_service import CrmSettingsService

        step_key = "boq_approval" if doc == "boq" else "sow_approval"

        settings = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
        label, _ = CrmSettingsService.approval_step_meta(settings, step_key)
        owners = ApprovalStepOwnerService(self._db).list_user_ids(ctx, step_key)
        if not owners:
            owners = ApprovalTaskService(self._db)._admin_recipient_ids(ctx)
        if not owners:
            raise ConflictException(
                f"No {label} owners configured. "
                "Set them under CRM → Users → Default task owners, then attach again."
            )
        return owners

    def _services_sow_assignee_ids(self, ctx: TenantContext, opp: CrmOpportunity) -> list[UUID]:
        """When Services is on the deal, SOW attach/approve goes only to the owner."""
        from modules.crm.service.crm_notification_service import resolve_employee_user_id

        owner_uid = resolve_employee_user_id(
            self._db, ctx.tenant_id, getattr(opp, "owner_employee_id", None)
        )
        if owner_uid is None:
            raise ConflictException(
                "Opportunity owner must have a user login to receive SOW tasks "
                "when Services is selected on the lead."
            )
        return [owner_uid]

    def _sow_assignee_ids(
        self,
        ctx: TenantContext,
        opp: CrmOpportunity,
        payload: dict[str, Any] | None = None,
    ) -> list[UUID]:
        """SOW recipients: owner-only for Services deals when Settings policy allows."""
        from modules.crm.domain.product_types import entity_has_services
        from modules.crm.service.crm_settings_service import CrmSettingsService

        settings = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
        route_to_owner = CrmSettingsService.policy_flag(
            settings, "sow_route_to_owner_when_services", True
        )
        if entity_has_services(opp) and route_to_owner:
            return self._services_sow_assignee_ids(ctx, opp)
        payload = payload or {}
        if payload.get("assigned_user_ids") or payload.get("assigned_user_id"):
            return _require_assigned_users(payload)
        return self._default_doc_approver_ids(ctx, "sow")

    def _auto_raise_doc_approval(
        self, ctx: TenantContext, opp: CrmOpportunity, *, doc: str
    ) -> None:
        """After BOQ/SOW attach, route study approval to Default task owners.

        Services deals: SOW approval goes only to the opportunity owner (lead assignee).
        """
        from modules.crm.service.approval_task_service import ApprovalTaskService
        from modules.crm.service.crm_settings_service import CrmSettingsService

        action = "approve_boq" if doc == "boq" else "approve_sow"
        step_key = "boq_approval" if doc == "boq" else "sow_approval"
        settings = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
        _, team_role = CrmSettingsService.approval_step_meta(settings, step_key)
        pending = ApprovalTaskService(self._db).list(
            ctx,
            company_id=opp.company_id,
            entity_type="opportunity",
            entity_id=opp.id,
            status="pending",
        )
        if any(task.action == action for task in pending):
            return
        from modules.crm.domain.product_types import entity_has_services
        from modules.crm.service.crm_settings_service import CrmSettingsService

        settings = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
        route_to_owner = CrmSettingsService.policy_flag(
            settings, "sow_route_to_owner_when_services", True
        )
        services_sow = doc == "sow" and entity_has_services(opp) and route_to_owner
        assigned = (
            self._sow_assignee_ids(ctx, opp)
            if doc == "sow"
            else self._default_doc_approver_ids(ctx, doc)
        )
        self._raise_approval(
            ctx,
            opp,
            action=action,
            team_role=team_role,
            title=f"Approve {doc.upper()} - {opp.opportunity_name}",
            remarks=(
                "Auto-routed to opportunity owner (Services selected on lead)"
                if services_sow
                else "Auto-routed after document attachment"
            ),
            assigned_user_ids=assigned,
        )

    def _advance_after_doc_approval(
        self,
        ctx: TenantContext,
        opp: CrmOpportunity,
        *,
        approved_doc: str,
        updates: dict[str, Any],
    ) -> tuple[str, bool]:
        """After one doc is approved, either raise the peer or advance past Deal Reg."""
        boq_ok = bool(updates.get("boq_approved", opp.boq_approved))
        sow_ok = bool(updates.get("sow_approved", opp.sow_approved)) or bool(
            updates.get("sow_skipped", opp.sow_skipped)
        )
        sow_attached = bool(updates.get("sow_attached", opp.sow_attached))
        boq_attached = bool(updates.get("boq_attached", opp.boq_attached))
        has_dr = is_deal_reg_number(opp.deal_reg_number or opp.opportunity_code)

        if approved_doc == "boq" and sow_attached and not sow_ok:
            self._auto_raise_doc_approval(ctx, opp, doc="sow")
            return "sow_approval", True
        if approved_doc == "sow" and boq_attached and not boq_ok:
            self._auto_raise_doc_approval(ctx, opp, doc="boq")
            return "boq_approval", True
        if boq_ok or sow_ok:
            return ("oem_pending" if has_dr else "deal_reg"), False
        return ("oem_pending" if has_dr else "deal_reg"), False

    def _raise_approval(
        self,
        ctx: TenantContext,
        opp: CrmOpportunity,
        *,
        action: str,
        team_role: str,
        title: str,
        remarks: str | None,
        assigned_user_ids: list[UUID],
        email_attachments: list[dict] | None = None,
    ) -> None:
        from modules.crm.service.approval_task_service import ApprovalTaskService

        ApprovalTaskService(self._db).route_approval(
            ctx,
            assigned_user_ids=assigned_user_ids,
            title=title,
            entity_type="opportunity",
            entity_id=opp.id,
            team_role=team_role,
            action=action,
            company_id=opp.company_id,
            branch_id=opp.branch_id,
            remarks=remarks,
            email_attachments=email_attachments or None,
        )

    # Stored under allowed category ``other`` (ck_crm_attachment_category).
    _ACCEPTED_QUOTE_PRINT_FILENAME = "Accepted_Quote_Print.pdf"

    def _store_accepted_quote_print(
        self,
        ctx: TenantContext,
        opp: CrmOpportunity,
        payload: dict[str, Any],
    ) -> None:
        """Persist accepted-quote PDF so later PO stages can re-attach it to email."""
        content = str(payload.get("quotation_pdf_base64") or "").strip()
        if not content:
            return
        for row in self._attachments.list_for_entity(ctx, "opportunity", opp.id):
            if row.category == "other" and (row.file_name or "") == self._ACCEPTED_QUOTE_PRINT_FILENAME:
                self._attachments.delete(ctx, row.id)
        self._attachments.create(
            ctx,
            entity_type="opportunity",
            entity_id=opp.id,
            file_name=self._ACCEPTED_QUOTE_PRINT_FILENAME,
            category="other",
            branch_id=opp.branch_id,
            company_id=opp.company_id,
            content_base64=content,
            content_type="application/pdf",
        )

    def _attachment_email_dict(
        self,
        ctx: TenantContext,
        *,
        entity_type: str,
        entity_id: UUID,
        category: str,
        file_name: str | None = None,
    ) -> dict[str, str] | None:
        import base64

        rows = [
            row
            for row in self._attachments.list_for_entity(ctx, entity_type, entity_id)
            if row.category == category and (file_name is None or (row.file_name or "") == file_name)
        ]
        if not rows:
            return None
        row = rows[-1]
        try:
            download = self._attachments.resolve_download(ctx, row.id)
        except Exception:  # noqa: BLE001
            return None
        raw = download.content
        if raw is None and download.path is not None:
            raw = download.path.read_bytes()
        if not raw:
            return None
        return {
            "filename": row.file_name or f"{category}.bin",
            "content_base64": base64.b64encode(raw).decode("ascii"),
            "content_type": row.content_type or "application/octet-stream",
        }

    def _po_approval_email_attachments(
        self,
        ctx: TenantContext,
        opp: CrmOpportunity,
        payload: dict[str, Any] | None = None,
    ) -> list[dict[str, str]]:
        """Accepted quote print PDF + customer PO for PO approval emails."""
        payload = payload or {}
        attachments: list[dict[str, str]] = []

        quote_b64 = str(payload.get("quotation_pdf_base64") or "").strip()
        if quote_b64:
            filename = str(payload.get("quotation_pdf_filename") or "").strip() or "Accepted_Quote.pdf"
            if not filename.lower().endswith(".pdf"):
                filename = f"{filename}.pdf"
            attachments.append(
                {
                    "filename": filename,
                    "content_base64": quote_b64,
                    "content_type": "application/pdf",
                }
            )
        else:
            stored_quote = self._attachment_email_dict(
                ctx,
                entity_type="opportunity",
                entity_id=opp.id,
                category="other",
                file_name=self._ACCEPTED_QUOTE_PRINT_FILENAME,
            )
            if stored_quote:
                attachments.append(stored_quote)

        po_b64 = str(payload.get("content_base64") or "").strip()
        po_name = str(payload.get("file_name") or "").strip()
        if po_b64 and po_name:
            attachments.append(
                {
                    "filename": po_name,
                    "content_base64": po_b64,
                    "content_type": str(payload.get("content_type") or "application/octet-stream"),
                }
            )
        else:
            stored_po = self._attachment_email_dict(
                ctx, entity_type="opportunity", entity_id=opp.id, category="customer_po"
            )
            if stored_po:
                attachments.append(stored_po)

        return attachments

    def _build_po_approval_updates(
        self,
        ctx: TenantContext,
        opp: CrmOpportunity,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Confirm PO terms and start Finance → Legal → Management My Jobs chain."""
        if payload.get("terms_accepted") is not True:
            raise ConflictException(
                "Confirm \"I have checked and verified all terms & conditions of the customer PO\" "
                "before sending it to Finance"
            )
        from modules.crm.service.approval_step_owner_service import ApprovalStepOwnerService
        from modules.crm.service.approval_task_service import ApprovalTaskService

        owners = ApprovalStepOwnerService(self._db)
        admin_fallback = ApprovalTaskService(self._db)._admin_recipient_ids(ctx)
        chain: dict[str, list[str]] = {}
        for stage, _team, _stage_action in PO_VALIDATION_STAGES:
            ids = _po_stage_user_ids(payload, stage)
            if not ids:
                ids = owners.list_user_ids(ctx, PO_STAGE_TO_STEP_KEY[stage])
            if not ids and stage == "management":
                ids = owners.list_user_ids(ctx, "quote_send_for_approval") or owners.list_user_ids(
                    ctx, "ovf_send_for_approval"
                )
            if not ids:
                ids = list(admin_fallback)
            if not ids:
                raise ConflictException(
                    f"No {stage} owners configured. Set them under CRM Users → Default task owners."
                )
            chain[stage] = [str(uid) for uid in ids]
        ops_ids = _po_stage_user_ids(payload, OPERATIONS_STAGE)
        if not ops_ids:
            ops_ids = owners.list_user_ids(ctx, PO_STAGE_TO_STEP_KEY[OPERATIONS_STAGE])
        chain[OPERATIONS_STAGE] = [str(uid) for uid in ops_ids]
        self._store_accepted_quote_print(ctx, opp, payload)
        email_attachments = self._po_approval_email_attachments(ctx, opp, payload)
        self._raise_po_stage(
            ctx,
            opp,
            stage="finance",
            chain=chain,
            remarks=payload.get("remarks"),
            email_attachments=email_attachments,
        )
        return {
            "sales_terms_accepted": True,
            "sales_terms_accepted_at": utcnow(),
            "sales_terms_accepted_by": ctx.user_id,
            "po_approval_chain": chain,
            "po_finance_status": "pending",
            "po_terms_status": "not_required",
            "po_finance_remark": None,
            "po_terms_remark": None,
            "locked": True,
        }

    def _raise_po_stage(
        self,
        ctx: TenantContext,
        opp: CrmOpportunity,
        *,
        stage: str,
        chain: dict[str, Any] | None,
        remarks: str | None,
        email_attachments: list[dict] | None = None,
    ) -> None:
        """Raise the My Jobs task for one stage of the customer PO chain."""
        team_role, stage_action = next(
            (team, stage_action)
            for name, team, stage_action in PO_VALIDATION_STAGES
            if name == stage
        )
        raw_ids = (chain or {}).get(stage) or []
        assigned_user_ids: list[UUID] = []
        seen: set[UUID] = set()
        for item in raw_ids:
            uid = UUID(str(item))
            if uid in seen:
                continue
            seen.add(uid)
            assigned_user_ids.append(uid)
        if not assigned_user_ids:
            raise ConflictException(
                f"No {stage} owners configured for this customer PO. "
                "Set them under CRM Users → Default task owners, then send the PO again."
            )
        attachments = email_attachments
        if attachments is None:
            attachments = self._po_approval_email_attachments(ctx, opp)
        self._raise_approval(
            ctx,
            opp,
            action=stage_action,
            team_role=team_role,
            title=f"{_PO_STAGE_TITLES[stage]} - {opp.opportunity_name}",
            remarks=remarks,
            assigned_user_ids=assigned_user_ids,
            email_attachments=attachments or None,
        )

    def _service_scope_summary(
        self, ctx: TenantContext, opp: CrmOpportunity
    ) -> tuple[Decimal, list[str]] | None:
        """Value and product names of the SAC (service) lines on the accepted quote."""
        from modules.crm.domain.tax_codes import is_service_code
        from modules.crm.repository.quote_repository import QuoteLineRepository, QuoteRepository

        quotes = QuoteRepository(self._db).list_quotes(
            ctx, opp.company_id, opportunity_id=opp.id
        )
        accepted = next((q for q in quotes if q.quote_stage == "accepted"), None)
        if accepted is None:
            return None

        lines = QuoteLineRepository(self._db).list_for_quote(ctx, accepted.id)
        service_lines = [ln for ln in lines if is_service_code(getattr(ln, "hsn_sac", None))]
        if not service_lines:
            return None

        total = Decimal("0")
        names: list[str] = []
        for line in service_lines:
            qty = Decimal(str(getattr(line, "qty", 0) or 0))
            unit = Decimal(str(getattr(line, "unit_sell", 0) or 0))
            total += qty * unit
            name = (getattr(line, "product_name", None) or "").strip()
            if name and name not in names:
                names.append(name)
        return total, names

    def _notify_deal_lost_emails(self, ctx: TenantContext, opp: CrmOpportunity) -> None:
        try:
            from modules.crm.models.company import CrmCompany
            from modules.crm.service.crm_email_notification_service import CrmEmailNotificationService
            from modules.crm.service.crm_notification_service import resolve_employee_user_id
            from modules.foundation.models.security import SecUser

            customer = "—"
            if opp.company_account_id is not None:
                account = self._db.get(CrmCompany, opp.company_account_id)
                if account is not None:
                    customer = account.customer_name or "—"
            salesperson = "—"
            owner_uid = resolve_employee_user_id(self._db, ctx.tenant_id, opp.owner_employee_id)
            if owner_uid is not None:
                user = self._db.get(SecUser, owner_uid)
                if user is not None:
                    salesperson = user.display_name or user.email or "—"
            CrmEmailNotificationService(self._db).notify_deal_lost(
                tenant_id=ctx.tenant_id,
                opportunity_id=opp.id,
                opportunity_name=opp.opportunity_name or "Opportunity",
                customer_name=customer,
                salesperson_name=salesperson,
                loss_reason=opp.lost_reason,
                owner_employee_id=opp.owner_employee_id,
                created_by=ctx.user_id,
            )
        except Exception:  # noqa: BLE001
            pass

    def _notify_operations_of_service_scope(
        self, ctx: TenantContext, opp: CrmOpportunity
    ) -> None:
        """Hand the services/installation scope to Operations at PO approval.

        Services do not wait for the hardware: site survey and other onsite work
        can start the moment the customer PO clears, so Operations gets an open
        task now rather than after the material lands.
        """
        raw_ids = (opp.po_approval_chain or {}).get(OPERATIONS_STAGE) or []
        if not raw_ids:
            return
        summary = self._service_scope_summary(ctx, opp)
        if summary is None:
            return
        service_value, product_names = summary

        scope = ", ".join(product_names[:5])
        if len(product_names) > 5:
            scope = f"{scope}, +{len(product_names) - 5} more"
        remarks = (
            f"Customer PO approved. Service / installation scope worth {service_value} "
            f"is yours to start now - do not wait for the hardware delivery. Scope: {scope}."
        )

        from modules.crm.service.approval_task_service import ApprovalTaskService

        ApprovalTaskService(self._db).route_approval(
            ctx,
            assigned_user_ids=[UUID(str(uid)) for uid in raw_ids],
            title=f"Start service / installation scope - {opp.opportunity_name}",
            entity_type=SERVICE_SCOPE_ENTITY,
            entity_id=opp.id,
            team_role="project",
            action="acknowledge_service_scope",
            company_id=opp.company_id,
            branch_id=opp.branch_id,
            remarks=remarks,
        )

    def _spawn_service_po_from_opportunity(
        self, ctx: TenantContext, opp: CrmOpportunity
    ) -> None:
        """Create Vendor/Internal Service PO from lead Service Sourcing Channel."""
        # Late import: procurement → crm models; avoid import cycle at module load.
        from modules.procurement.service.service_po_service import ServicePoService

        ServicePoService(self._db).ensure_service_po_after_customer_po_approved(ctx, opp)

    def _clear_approval_attachment(
        self,
        ctx: TenantContext,
        opportunity_id: UUID,
        category: str,
    ) -> None:
        AttachmentService(self._db).remove_entity_attachments_by_category(
            ctx,
            "opportunity",
            opportunity_id,
            category,
        )

    def _validate_cloud_discount_fields(self, opp: CrmOpportunity) -> None:
        if not is_cloud_opportunity(opp):
            raise ConflictException("Cloud discount approval is only for cloud opportunities")
        if opp.customer_mrr is None or opp.customer_arr is None:
            raise ConflictException("Set customer MRR and ARR before sending for approval")
        if opp.customer_discount_percent is None:
            raise ConflictException("Set customer discount % before sending for approval")
        if opp.distributor_discount_percent is None:
            raise ConflictException("Distributor discount % is required")

    def _cloud_approval_summary(self, opp: CrmOpportunity) -> str:
        return (
            f"MRR: {opp.customer_mrr}; ARR: {opp.customer_arr}; "
            f"Customer discount: {opp.customer_discount_percent}%; "
            f"Distributor discount: {opp.distributor_discount_percent}%; "
            f"Profitability: {opp.profitability_percent}%"
        )
