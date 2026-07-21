"""CRM OVF (Order Value Form) application service.

Product rules enforced here:
  4. OVF ONLY after customer PO is approved on the opportunity.
  7. Finance cost ~0.5% per 15 days of payment gap.
  8. "Send for approval" creates a My Jobs task + notification stub and can
     lock the record.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.crm.domain.enums import CrmEntityType
from modules.crm.models import CrmOpportunity, CrmOvf, CrmOvfLine, CrmQuote
from modules.crm.repository.opportunity_repository import OpportunityRepository
from modules.crm.repository.ovf_repository import OvfLineRepository, OvfRepository
from modules.crm.repository.quote_repository import QuoteRepository
from modules.crm.service.blueprint_service import log_state_history
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import DocumentNumberService
from modules.crm.service.engines import margin_engine, sales_blueprint_engine
from modules.foundation.domain.value_objects import TenantContext


class OvfService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = OvfRepository(db)
        self._lines = OvfLineRepository(db)
        self._opportunities = OpportunityRepository(db)
        self._quotes = QuoteRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None, opportunity_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_ovfs(ctx, cid, opportunity_id=opportunity_id)

    def get(self, ctx: TenantContext, ovf_id: UUID) -> CrmOvf:
        row = self._repo.get(ctx, ovf_id)
        if row is None:
            raise NotFoundException("OVF not found")
        return row

    def list_lines(self, ctx: TenantContext, ovf_id: UUID):
        self.get(ctx, ovf_id)
        return self._lines.list_for_ovf(ctx, ovf_id)

    def _get_quote(self, ctx: TenantContext, quote_id: UUID) -> CrmQuote:
        quote = self._quotes.get(ctx, quote_id)
        if quote is None:
            raise NotFoundException("Quote not found")
        return quote

    def _get_opportunity(self, ctx: TenantContext, opportunity_id: UUID) -> CrmOpportunity:
        opp = self._opportunities.get(ctx, opportunity_id)
        if opp is None:
            raise NotFoundException("Opportunity not found")
        return opp

    # -- create ------------------------------------------------------------
    def create(self, ctx: TenantContext, *, quote_id: UUID, branch_id: UUID, **fields) -> CrmOvf:
        quote = self._get_quote(ctx, quote_id)
        opp = self._get_opportunity(ctx, quote.opportunity_id)

        if opp.blueprint_state != "ovf_ready":
            raise ConflictException(
                f"Opportunity is in state '{opp.blueprint_state}'; OVF can only be "
                "created once it reaches 'ovf_ready' (customer PO approved)."
            )
        if not opp.customer_po_approved:
            raise ConflictException("OVF can only be created after the customer PO is approved")
        sales_blueprint_engine.assert_not_locked(opp)

        vendor_days = int(fields.get("vendor_payment_days", 0))
        customer_days = int(fields.get("customer_payment_days", 0))
        fields["finance_cost_pct"] = margin_engine.compute_finance_cost_pct(vendor_days, customer_days)

        code = self._numbers.generate(CrmEntityType.OVF, opp.company_id, CrmOvf, "ovf_no")
        row = self._repo.create(
            ctx,
            company_id=opp.company_id,
            branch_id=branch_id,
            ovf_no=code,
            quote_id=quote_id,
            opportunity_id=opp.id,
            company_account_id=opp.company_account_id,
            approval_status=fields.pop("approval_status", "not_required"),
            blueprint_state="draft",
            **fields,
        )

        next_state = sales_blueprint_engine.transition("opportunity", opp.blueprint_state, "create_ovf")
        self._opportunities.update(ctx, opp.id, blueprint_state=next_state)
        log_state_history(
            self._db, ctx, company_id=opp.company_id, branch_id=opp.branch_id,
            entity_type="opportunity", entity_id=opp.id,
            from_state="ovf_ready", to_state=next_state, action="create_ovf",
            remark=f"OVF {code} created",
        )
        return row

    # -- lines -----------------------------------------------------------
    def add_line(self, ctx: TenantContext, ovf_id: UUID, **fields) -> CrmOvfLine:
        ovf = self.get(ctx, ovf_id)
        sales_blueprint_engine.assert_not_locked(ovf)
        existing = self._lines.list_for_ovf(ctx, ovf_id)
        side = fields.get("side", "customer_po")
        fields.setdefault("line_no", len([ln for ln in existing if ln.side == side]) + 1)
        fields["line_total"] = (Decimal(str(fields.get("qty", 1))) * Decimal(str(fields.get("unit_price", 0)))).quantize(
            Decimal("0.0001")
        )
        line = self._lines.create(ctx, company_id=ovf.company_id, branch_id=ovf.branch_id, ovf_id=ovf_id, **fields)
        self._recompute_margin(ctx, ovf_id)
        return line

    def _recompute_margin(self, ctx: TenantContext, ovf_id: UUID) -> None:
        ovf = self.get(ctx, ovf_id)
        lines = self._lines.list_for_ovf(ctx, ovf_id)
        customer_total = sum((Decimal(str(ln.line_total)) for ln in lines if ln.side == "customer_po"), Decimal("0"))
        vendor_total = sum((Decimal(str(ln.line_total)) for ln in lines if ln.side == "vendor"), Decimal("0"))
        margin_amount = (customer_total - vendor_total).quantize(Decimal("0.0001"))
        margin_pct = (margin_amount / customer_total * Decimal("100")).quantize(Decimal("0.001")) if customer_total else Decimal("0")
        self._repo.update(ctx, ovf_id, total_margin_amount=margin_amount, total_margin_pct=margin_pct)

    # -- blueprint / approval workflow ------------------------------------
    def send_for_approval(self, ctx: TenantContext, ovf_id: UUID, *, team_role: str = "management", remarks: str | None = None) -> CrmOvf:
        ovf = self.get(ctx, ovf_id)
        sales_blueprint_engine.assert_not_locked(ovf)
        next_state = sales_blueprint_engine.transition("ovf", ovf.blueprint_state, "send_for_approval")

        from modules.crm.service.approval_task_service import ApprovalTaskService

        ApprovalTaskService(self._db).create_task(
            ctx,
            title=f"Approve OVF {ovf.ovf_no}",
            entity_type="ovf",
            entity_id=ovf.id,
            team_role=team_role,
            action="approve",
            company_id=ovf.company_id,
            branch_id=ovf.branch_id,
            remarks=remarks,
        )
        row = self._repo.update(ctx, ovf_id, blueprint_state=next_state, approval_status="pending", locked=True)
        self._log(ctx, ovf, ovf.blueprint_state, next_state, "send_for_approval", remarks)
        return row

    def apply_blueprint_action(self, ctx: TenantContext, ovf_id: UUID, action: str, payload: dict[str, Any]) -> CrmOvf:
        ovf = self.get(ctx, ovf_id)
        if action == "approve":
            next_state = sales_blueprint_engine.transition("ovf", ovf.blueprint_state, "approve")
            row = self._repo.update(ctx, ovf_id, blueprint_state=next_state, approval_status="approved", locked=False)
            self._log(ctx, ovf, ovf.blueprint_state, next_state, "approve", payload.get("remark"))
            return row
        if action == "reject":
            next_state = sales_blueprint_engine.transition("ovf", ovf.blueprint_state, "reject")
            row = self._repo.update(ctx, ovf_id, blueprint_state=next_state, approval_status="rejected", locked=False)
            self._log(ctx, ovf, ovf.blueprint_state, next_state, "reject", payload.get("remark"))
            return row
        if action == "share_to_scm":
            return self.share_to_scm(ctx, ovf_id)
        if action == "deal_won":
            return self.mark_deal_won(ctx, ovf_id, deal_won_amount=payload.get("deal_won_amount"))
        raise ConflictException(f"Unsupported OVF blueprint action '{action}'")

    def share_to_scm(self, ctx: TenantContext, ovf_id: UUID) -> CrmOvf:
        ovf = self.get(ctx, ovf_id)
        sales_blueprint_engine.assert_not_locked(ovf)
        next_state = sales_blueprint_engine.transition("ovf", ovf.blueprint_state, "share_to_scm")
        row = self._repo.update(ctx, ovf_id, blueprint_state=next_state, shared_to_scm=True)
        self._log(ctx, ovf, ovf.blueprint_state, next_state, "share_to_scm", None)
        return row

    def mark_deal_won(self, ctx: TenantContext, ovf_id: UUID, *, deal_won_amount: Decimal | float | str | None) -> CrmOvf:
        ovf = self.get(ctx, ovf_id)
        sales_blueprint_engine.assert_not_locked(ovf)
        if deal_won_amount is None:
            raise ConflictException("deal_won_amount is required to mark the deal won")
        next_state = sales_blueprint_engine.transition("ovf", ovf.blueprint_state, "deal_won")
        amount = Decimal(str(deal_won_amount))
        row = self._repo.update(
            ctx, ovf_id, blueprint_state=next_state, deal_won=True, deal_won_amount=amount
        )
        self._log(ctx, ovf, ovf.blueprint_state, next_state, "deal_won", None)

        opp = self._get_opportunity(ctx, ovf.opportunity_id)
        opp_next_state = sales_blueprint_engine.transition("opportunity", opp.blueprint_state, "deal_won")

        self._opportunities.update(
            ctx,
            opp.id,
            blueprint_state=opp_next_state,
            status="won",
            current_stage="won",
            probability_percent=100,
            deal_won_amount=amount,
            forecast_amount=amount,
            won_at=datetime.now(timezone.utc),
        )
        log_state_history(
            self._db, ctx, company_id=opp.company_id, branch_id=opp.branch_id,
            entity_type="opportunity", entity_id=opp.id,
            from_state="ovf_ready", to_state=opp_next_state, action="deal_won",
            remark=f"OVF {ovf.ovf_no} deal won at {amount}",
        )
        return row

    def _log(self, ctx: TenantContext, ovf: CrmOvf, from_state: str, to_state: str, action: str, remark: str | None) -> None:
        log_state_history(
            self._db, ctx, company_id=ovf.company_id, branch_id=ovf.branch_id,
            entity_type="ovf", entity_id=ovf.id,
            from_state=from_state, to_state=to_state, action=action, remark=remark,
        )
