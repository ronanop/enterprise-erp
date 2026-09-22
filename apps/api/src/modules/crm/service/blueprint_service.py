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
    """Approvers selected for one stage, falling back to the generic selection."""
    raw = payload.get(f"{stage}_user_ids")
    if raw:
        return _require_assigned_users({"assigned_user_ids": raw})
    return _require_assigned_users(payload)


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
        """Preview the next series DR number for Deal Registration (does not persist)."""
        opp = self.get(ctx, opportunity_id)
        if opp.deal_reg_number:
            return opp.deal_reg_number
        from modules.crm.domain.enums import CrmEntityType
        from modules.crm.service.document_number_service import DocumentNumberService

        return DocumentNumberService(self._db).generate(
            CrmEntityType.DEAL_REG, opp.company_id, CrmOpportunity, "deal_reg_number"
        )
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
        allowed = filter_opportunity_actions(opp, allowed)
        allowed = self._filter_document_step_actions(allowed, opp)
        if opp.customer_po_attached:
            allowed = [action for action in allowed if action != "attach_po"]
        if opp.customer_po_approved or not opp.customer_po_attached:
            allowed = [action for action in allowed if action != "send_po_approval"]
        if current in {"boq_approval", "sow_approval", "po_approval"} and not opp.locked:
            # Approve/reject run via My Jobs while locked; hide stale actions if unlocked.
            allowed = [action for action in allowed if action not in _UNLOCKING_ACTIONS]
        allowed = self._ensure_peer_document_actions(allowed, opp, current)
        allowed = self._filter_create_actions_when_children_exist(ctx, opp, allowed)
        return {
            "entity_type": "opportunity",
            "entity_id": opp.id,
            "state": current,
            "locked": opp.locked,
            "allowed_actions": allowed,
            "is_sales_blueprint": is_sales_blueprint,
            "po_validation": self._po_validation(opp, current),
        }

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
        """Hide Create Quote / Create OVF once those records already exist."""
        from modules.crm.repository.ovf_repository import OvfRepository
        from modules.crm.repository.quote_repository import QuoteRepository

        actions = list(allowed)
        if "create_quote" in actions:
            quotes = QuoteRepository(self._db).list_quotes(
                ctx, opp.company_id, opportunity_id=opp.id
            )
            if quotes:
                actions = [action for action in actions if action != "create_quote"]
        if "create_ovf" in actions:
            ovfs = OvfRepository(self._db).list_ovfs(ctx, opp.company_id, opportunity_id=opp.id)
            if ovfs:
                actions = [action for action in actions if action != "create_ovf"]
        return actions

    @staticmethod
    def _filter_document_step_actions(allowed: list[str], opp: CrmOpportunity) -> list[str]:
        """Gate BOQ/SOW attach, approval, and Deal Registration by document status.

        - SOW attached → Attach BOQ + Send SOW for Approval
        - BOQ attached → Attach SOW + Send BOQ for Approval
        - Either document approved → Deal Registration + peer attach (if missing)
        """
        actions = list(allowed)

        if opp.boq_attached:
            actions = [action for action in actions if action != "attach_boq"]
        if opp.sow_attached:
            actions = [action for action in actions if action != "attach_sow"]

        if opp.boq_approved or not opp.boq_attached:
            actions = [action for action in actions if action != "send_boq_approval"]
        if opp.sow_approved or not opp.sow_attached:
            actions = [action for action in actions if action != "send_sow_approval"]

        # Deal Registration only after at least one document is approved.
        if not opp.boq_approved and not opp.sow_approved:
            actions = [action for action in actions if action != "deal_reg"]

        return actions

    @staticmethod
    def _ensure_peer_document_actions(
        allowed: list[str], opp: CrmOpportunity, current: str
    ) -> list[str]:
        """After one document is approved, keep the other attach/approval path available."""
        if opp.locked or current not in {"boq_pending", "deal_reg", "boq_approval", "sow_approval"}:
            return allowed
        if not opp.boq_approved and not opp.sow_approved:
            return allowed

        actions = list(allowed)

        if opp.sow_approved and not opp.boq_attached and "attach_boq" not in actions:
            actions.append("attach_boq")
        if opp.boq_approved and not opp.sow_attached and "attach_sow" not in actions:
            actions.append("attach_sow")

        if (
            opp.sow_approved
            and opp.boq_attached
            and not opp.boq_approved
            and "send_boq_approval" not in actions
        ):
            actions.append("send_boq_approval")
        if (
            opp.boq_approved
            and opp.sow_attached
            and not opp.sow_approved
            and "send_sow_approval" not in actions
        ):
            actions.append("send_sow_approval")

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

        next_state = sales_blueprint_engine.transition("opportunity", current, action, ctx)
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
        elif action == "send_boq_approval":
            if is_cloud_opportunity(opp):
                raise ConflictException(
                    "Use Send Cloud Discount for Approval on cloud opportunities"
                )
            if not opp.boq_attached and not opp.sow_attached:
                raise ConflictException("Attach a BOQ or SOW before requesting approval")
            if opp.boq_approved:
                raise ConflictException("BOQ is already approved")
            self._raise_approval(
                ctx,
                opp,
                action="approve_boq",
                team_role=payload.get("team_role", "presales"),
                title=f"Approve BOQ - {opp.opportunity_name}",
                remarks=payload.get("remarks"),
                assigned_user_ids=_require_assigned_users(payload),
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
                assigned_user_ids=_require_assigned_users(payload),
            )
            updates["locked"] = True
        elif action == "approve_boq":
            updates["boq_approved"] = True
            updates["locked"] = False
        elif action == "reject_boq":
            self._clear_approval_attachment(ctx, opp.id, "boq")
            updates["boq_approved"] = False
            updates["boq_attached"] = False
            updates["locked"] = False
        elif action == "approve_sow":
            updates["sow_approved"] = True
            updates["locked"] = False
        elif action == "reject_sow":
            self._clear_approval_attachment(ctx, opp.id, "sow")
            updates["sow_approved"] = False
            updates["sow_attached"] = False
            updates["locked"] = False
        elif action == "attach_sow":
            self._attach(ctx, opp, payload, category="sow")
            updates["sow_attached"] = True
        elif action == "skip_sow":
            updates["sow_skipped"] = True
        elif action == "deal_reg":
            if not opp.boq_approved and not opp.sow_approved:
                raise ConflictException(
                    "Approve a BOQ or SOW before Deal Registration"
                )
            reg_no = (payload.get("deal_reg_number") or "").strip()
            if not reg_no:
                from modules.crm.domain.enums import CrmEntityType
                from modules.crm.service.document_number_service import DocumentNumberService

                reg_no = DocumentNumberService(self._db).generate(
                    CrmEntityType.DEAL_REG, opp.company_id, CrmOpportunity, "deal_reg_number"
                )
            updates["deal_reg_number"] = reg_no
        elif action == "oem_received":
            updates["oem_quotation_received"] = True
        elif action == "attach_oem_quote":
            self._attach(ctx, opp, payload, category="oem_quote")
            updates["oem_quote_attached"] = True
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
            self._attach(ctx, opp, payload, category="customer_po")
            updates["customer_po_attached"] = True
        elif action == "send_po_approval":
            if not opp.customer_po_attached:
                raise ConflictException("Attach the customer PO before requesting approval")
            chain = {
                stage: [str(uid) for uid in _po_stage_user_ids(payload, stage)]
                for stage, _team, _stage_action in PO_VALIDATION_STAGES
            }
            chain[OPERATIONS_STAGE] = [
                str(uid) for uid in (payload.get("operations_user_ids") or [])
            ]
            updates["po_approval_chain"] = chain
            updates["po_finance_status"] = "pending"
            updates["po_terms_status"] = "not_required"
            updates["po_finance_remark"] = None
            updates["po_terms_remark"] = None
            self._raise_po_stage(ctx, opp, stage="finance", chain=chain, remarks=payload.get("remarks"))
            updates["locked"] = True
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
        assigned_user_ids: list[UUID],
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
        )

    def _raise_po_stage(
        self,
        ctx: TenantContext,
        opp: CrmOpportunity,
        *,
        stage: str,
        chain: dict[str, Any] | None,
        remarks: str | None,
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
                f"No {stage} approver was selected for this customer PO. "
                "Send the PO for approval again and pick approvers for every stage."
            )
        self._raise_approval(
            ctx,
            opp,
            action=stage_action,
            team_role=team_role,
            title=f"{_PO_STAGE_TITLES[stage]} - {opp.opportunity_name}",
            remarks=remarks,
            assigned_user_ids=assigned_user_ids,
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
