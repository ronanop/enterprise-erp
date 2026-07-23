"""CRM sales Quote application service.

Product rules enforced here:
  3. Quote ONLY after opp has OEM quote attached + state allows.
  6. Margin gate (HW/SW >=7%, Services >=20%, mixed => stricter) drives
     internal-approval routing to Management via My Jobs.
  8. "Send for approval" creates a My Jobs task + notification stub and can
     lock the record.
"""

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, ForbiddenException, NotFoundException
from modules.crm.domain.enums import CrmEntityType
from modules.crm.models import CrmOpportunity, CrmQuote, CrmQuoteLine
from modules.crm.repository.company_repository import CompanyRepository
from modules.crm.repository.contact_repository import ContactRepository
from modules.crm.repository.lead_repository import LeadRepository
from modules.crm.repository.opportunity_repository import OpportunityRepository
from modules.crm.repository.quote_repository import QuoteLineRepository, QuoteRepository
from modules.crm.service.blueprint_service import log_state_history
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import DocumentNumberService
from modules.crm.service.engines import margin_engine, sales_blueprint_engine
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.service.employee_service import EmployeeService


def _first(*values: Any) -> Any:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


class QuoteService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = QuoteRepository(db)
        self._lines = QuoteLineRepository(db)
        self._opportunities = OpportunityRepository(db)
        self._leads = LeadRepository(db)
        self._companies = CompanyRepository(db)
        self._contacts = ContactRepository(db)
        self._employees = EmployeeService(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)

    # -- reads -----------------------------------------------------------
    def list(self, ctx: TenantContext, company_id: UUID | None = None, opportunity_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_quotes(ctx, cid, opportunity_id=opportunity_id)

    def get(self, ctx: TenantContext, quote_id: UUID) -> CrmQuote:
        row = self._repo.get(ctx, quote_id)
        if row is None:
            raise NotFoundException("Quote not found")
        self._ensure_display_snapshot(ctx, row)
        return row

    def list_lines(self, ctx: TenantContext, quote_id: UUID):
        self.get(ctx, quote_id)
        return self._lines.list_for_quote(ctx, quote_id)

    def update(self, ctx: TenantContext, quote_id: UUID, **fields) -> CrmQuote:
        quote = self.get(ctx, quote_id)
        sales_blueprint_engine.assert_not_locked(quote)
        row = self._repo.update(ctx, quote_id, **fields)
        if row is None:
            raise NotFoundException("Quote not found")
        if "freight" in fields:
            row = self._recompute(ctx, quote_id)
        return row

    def _get_opportunity(self, ctx: TenantContext, opportunity_id: UUID) -> CrmOpportunity:
        opp = self._opportunities.get(ctx, opportunity_id)
        if opp is None:
            raise NotFoundException("Opportunity not found")
        return opp

    def _owner_label(self, ctx: TenantContext, owner_employee_id: UUID | None) -> str | None:
        if owner_employee_id is None:
            return None
        try:
            employee = self._employees.get_employee(ctx, owner_employee_id)
        except (NotFoundException, ForbiddenException):
            return None
        name = f"{employee.first_name} {employee.last_name}".strip()
        return name or None

    def _default_contact_id(self, ctx: TenantContext, *, company_id: UUID, company_account_id: UUID | None) -> UUID | None:
        if company_account_id is None:
            return None
        contacts = self._contacts.list_contacts(ctx, company_id, company_account_id)
        if not contacts:
            return None
        primary = next((row for row in contacts if row.is_primary), None)
        return (primary or contacts[0]).id

    def _snapshot_fields_from_related(
        self,
        ctx: TenantContext,
        *,
        opp: CrmOpportunity,
        lead: Any | None,
        account: Any | None,
        current: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        current = current or {}
        billing_address = None
        if account is not None:
            billing_address = ", ".join(
                str(value)
                for value in (
                    account.billing_street,
                    account.billing_city,
                    account.billing_state,
                    account.billing_code,
                    account.billing_country,
                )
                if value
            )

        service_type = _first(
            current.get("service_type"),
            lead.product_type if lead is not None else None,
        )
        if isinstance(service_type, str):
            normalized = service_type.strip().lower()
            if normalized in {"hardware", "software", "services"}:
                service_type = normalized

        return {
            "subject": _first(
                current.get("subject"),
                opp.project_title,
                opp.opportunity_name,
            ),
            "project_title": _first(
                current.get("project_title"),
                opp.project_title,
                opp.opportunity_name,
            ),
            "account_name": _first(
                current.get("account_name"),
                account.customer_name if account is not None else None,
            ),
            "service_type": service_type,
            "owner_name": _first(
                current.get("owner_name"),
                self._owner_label(ctx, getattr(opp, "owner_employee_id", None)),
            ),
            "contact_id": _first(
                current.get("contact_id"),
                self._default_contact_id(
                    ctx,
                    company_id=opp.company_id,
                    company_account_id=opp.company_account_id,
                ),
            ),
            "entity_name": _first(
                current.get("entity_name"),
                lead.entity_name if lead is not None else None,
                account.customer_name if account is not None else None,
            ),
            "entity_email": _first(
                current.get("entity_email"),
                lead.entity_email if lead is not None else None,
                account.customer_email if account is not None else None,
            ),
            "entity_address": _first(
                current.get("entity_address"),
                lead.entity_address if lead is not None else None,
                billing_address,
            ),
            "entity_gst": _first(
                current.get("entity_gst"),
                lead.entity_gst if lead is not None else None,
            ),
            "entity_contact": _first(
                current.get("entity_contact"),
                lead.entity_contact if lead is not None else None,
                account.phone if account is not None else None,
            ),
            "billing_country": _first(
                current.get("billing_country"),
                account.billing_country if account is not None else None,
                lead.country if lead is not None else None,
            ),
            "shipping_country": _first(
                current.get("shipping_country"),
                account.shipping_country if account is not None else None,
                account.billing_country if account is not None else None,
            ),
            "description": _first(
                current.get("description"),
                lead.notes if lead is not None else None,
                account.description if account is not None else None,
            ),
        }

    def _ensure_display_snapshot(self, ctx: TenantContext, quote: CrmQuote) -> None:
        """Fill blank quote header fields from opportunity / company / lead for display.

        Missing snapshot columns are written back so older quotes keep showing the
        values that were available when the quote was created.
        """
        snapshot_keys = (
            "subject",
            "project_title",
            "account_name",
            "service_type",
            "owner_name",
            "contact_id",
            "entity_name",
            "entity_email",
            "entity_address",
            "entity_gst",
            "entity_contact",
            "billing_country",
            "shipping_country",
            "description",
        )
        if not any(_first(getattr(quote, key, None)) is None for key in snapshot_keys):
            return

        opp = self._opportunities.get(ctx, quote.opportunity_id)
        if opp is None:
            return
        lead = self._leads.get(ctx, opp.lead_id) if opp.lead_id else None
        account = self._companies.get(ctx, opp.company_account_id) if opp.company_account_id else None
        resolved = self._snapshot_fields_from_related(
            ctx,
            opp=opp,
            lead=lead,
            account=account,
            current={key: getattr(quote, key, None) for key in snapshot_keys},
        )

        patched = False
        for key, value in resolved.items():
            if _first(getattr(quote, key, None)) is None and value is not None:
                setattr(quote, key, value)
                patched = True
        if patched:
            self._db.flush()

    # -- create ------------------------------------------------------------
    def create(self, ctx: TenantContext, *, opportunity_id: UUID, branch_id: UUID, **fields) -> CrmQuote:
        opp = self._get_opportunity(ctx, opportunity_id)
        if opp.blueprint_state is None:
            raise ConflictException(
                "Opportunity is not part of the sales blueprint; quotes can only be "
                "created for opportunities created via lead-convert."
            )
        if not opp.oem_quote_attached:
            raise ConflictException("Quote can only be created after the OEM quote is attached")
        if opp.blueprint_state not in {"quote_ready", "quote_in_progress"}:
            raise ConflictException(
                f"Opportunity is in state '{opp.blueprint_state}'; it must reach "
                "'quote_ready' before a quote can be created"
            )
        sales_blueprint_engine.assert_not_locked(opp)

        lead = self._leads.get(ctx, opp.lead_id) if opp.lead_id else None
        account = self._companies.get(ctx, opp.company_account_id) if opp.company_account_id else None
        fields.update(
            self._snapshot_fields_from_related(
                ctx,
                opp=opp,
                lead=lead,
                account=account,
                current=fields,
            )
        )

        code = self._numbers.generate(CrmEntityType.QUOTE, opp.company_id, CrmQuote, "quote_no")
        fields.setdefault("valid_until", None)
        fields.setdefault("quote_stage", "draft")
        fields.setdefault("approval_status", "not_required")
        row = self._repo.create(
            ctx,
            company_id=opp.company_id,
            branch_id=opp.branch_id,
            opportunity_id=opportunity_id,
            company_account_id=opp.company_account_id,
            quote_no=code,
            **fields,
        )

        if opp.blueprint_state == "quote_ready":
            from_state = opp.blueprint_state
            next_state = sales_blueprint_engine.transition("opportunity", from_state, "create_quote")
            self._opportunities.update(ctx, opportunity_id, blueprint_state=next_state)
            log_state_history(
                self._db, ctx, company_id=opp.company_id, branch_id=opp.branch_id,
                entity_type="opportunity", entity_id=opportunity_id,
                from_state=from_state, to_state=next_state, action="create_quote",
                remark=f"Quote {code} created",
            )
        return row

    # -- lines ---------------------------------------------------------
    def add_line(self, ctx: TenantContext, quote_id: UUID, **fields) -> CrmQuoteLine:
        quote = self.get(ctx, quote_id)
        sales_blueprint_engine.assert_not_locked(quote)
        existing = self._lines.list_for_quote(ctx, quote_id)
        fields.setdefault("line_no", len(existing) + 1)
        line = self._lines.create(ctx, company_id=quote.company_id, branch_id=quote.branch_id, quote_id=quote_id, **fields)
        self._recompute(ctx, quote_id)
        return line

    def update_line(self, ctx: TenantContext, line_id: UUID, **fields) -> CrmQuoteLine:
        line = self._lines.get(ctx, line_id)
        if line is None:
            raise NotFoundException("Quote line not found")
        quote = self.get(ctx, line.quote_id)
        sales_blueprint_engine.assert_not_locked(quote)
        updated = self._lines.update(ctx, line_id, **fields)
        self._recompute(ctx, line.quote_id)
        return updated

    def delete_line(self, ctx: TenantContext, line_id: UUID) -> None:
        line = self._lines.get(ctx, line_id)
        if line is None:
            raise NotFoundException("Quote line not found")
        quote = self.get(ctx, line.quote_id)
        sales_blueprint_engine.assert_not_locked(quote)
        self._lines.delete(ctx, line_id)
        self._recompute(ctx, line.quote_id)

    def _recompute(self, ctx: TenantContext, quote_id: UUID) -> CrmQuote:
        quote = self.get(ctx, quote_id)
        lines = self._lines.list_for_quote(ctx, quote_id)
        computed_lines: list[CrmQuoteLine] = []
        for line in lines:
            result = margin_engine.compute_line_margin(line.qty, line.unit_cost, line.unit_sell)
            gst_amount = (result.line_total * Decimal(str(line.gst_pct or 0)) / Decimal("100")).quantize(
                Decimal("0.0001")
            )
            self._lines.update(
                ctx,
                line.id,
                margin_pct=result.margin_pct,
                margin_amount=result.margin_amount,
                gst_amount=gst_amount,
                line_total=result.line_total,
            )
            computed_lines.append(line)

        margin_result = margin_engine.evaluate_quote_margin(
            (line.line_type, line.qty, line.unit_cost, line.unit_sell) for line in computed_lines
        )
        grand_total = margin_result.total_sell_amount + Decimal(str(quote.freight or 0))
        return self._repo.update(
            ctx,
            quote_id,
            avg_margin_pct=margin_result.avg_margin_pct,
            total_margin_amount=margin_result.total_margin_amount,
            grand_total=grand_total,
        )

    def margin_summary(self, ctx: TenantContext, quote_id: UUID) -> dict[str, Any]:
        quote = self.get(ctx, quote_id)
        lines = self._lines.list_for_quote(ctx, quote_id)
        result = margin_engine.evaluate_quote_margin(
            (line.line_type, line.qty, line.unit_cost, line.unit_sell) for line in lines
        )
        return {
            "quote_id": quote.id,
            "avg_margin_pct": result.avg_margin_pct,
            "total_margin_amount": result.total_margin_amount,
            "total_sell_amount": result.total_sell_amount,
            "required_threshold_pct": result.required_threshold_pct,
            "requires_management_approval": result.requires_management_approval,
            "line_types_present": sorted(result.line_types_present),
        }

    # -- blueprint / approval workflow ---------------------------------
    def send_for_approval(self, ctx: TenantContext, quote_id: UUID, *, team_role: str = "management", remarks: str | None = None) -> CrmQuote:
        quote = self.get(ctx, quote_id)
        sales_blueprint_engine.assert_not_locked(quote)
        next_state = sales_blueprint_engine.transition("quote", quote.quote_stage, "send_for_approval")

        from modules.crm.service.approval_task_service import ApprovalTaskService

        ApprovalTaskService(self._db).create_task(
            ctx,
            title=f"Approve Quote {quote.quote_no} — margin review",
            entity_type="quote",
            entity_id=quote.id,
            team_role=team_role,
            action="approve_internally",
            company_id=quote.company_id,
            branch_id=quote.branch_id,
            remarks=remarks,
        )
        row = self._repo.update(ctx, quote_id, quote_stage=next_state, approval_status="pending", locked=True)
        self._log(ctx, quote, quote.quote_stage, next_state, "send_for_approval", remarks)
        return row

    def approve_internally(self, ctx: TenantContext, quote_id: UUID, *, remark: str | None = None, force: bool = False) -> CrmQuote:
        """Approve directly when margin is healthy; otherwise requires ``force``
        (set only by the My Jobs management decision path)."""
        quote = self.get(ctx, quote_id)
        if not force:
            sales_blueprint_engine.assert_not_locked(quote)
            summary = self.margin_summary(ctx, quote_id)
            if summary["requires_management_approval"]:
                raise ConflictException(
                    f"Margin {summary['avg_margin_pct']}% is at/below the required "
                    f"{summary['required_threshold_pct']}% threshold — send for Management "
                    "approval instead of approving directly."
                )
        next_state = sales_blueprint_engine.transition("quote", quote.quote_stage, "approve_internally")
        row = self._repo.update(ctx, quote_id, quote_stage=next_state, approval_status="approved", locked=False)
        self._log(ctx, quote, quote.quote_stage, next_state, "approve_internally", remark)
        return row

    def apply_blueprint_action(self, ctx: TenantContext, quote_id: UUID, action: str, payload: dict[str, Any]) -> CrmQuote:
        """Generic action entry point used by the blueprint router + My Jobs resume."""
        quote = self.get(ctx, quote_id)
        if action == "approve_internally":
            # Force only when My Jobs is deciding a locked internal-approval quote.
            # Direct public calls from draft always go through the margin gate.
            force = bool(quote.locked and quote.quote_stage == "internal_approval")
            return self.approve_internally(ctx, quote_id, remark=payload.get("remark"), force=force)
        if action == "reject_internally":
            if not (quote.locked and quote.quote_stage == "internal_approval"):
                raise ConflictException(
                    "Reject is only available for quotes pending Management approval via My Jobs"
                )
            next_state = sales_blueprint_engine.transition("quote", quote.quote_stage, "reject_internally")
            row = self._repo.update(ctx, quote_id, quote_stage=next_state, approval_status="rejected", locked=False)
            self._log(ctx, quote, quote.quote_stage, next_state, "reject_internally", payload.get("remark"))
            return row
        if action == "send_to_customer":
            sales_blueprint_engine.assert_not_locked(quote)
            next_state = sales_blueprint_engine.transition("quote", quote.quote_stage, "send_to_customer")
            row = self._repo.update(ctx, quote_id, quote_stage=next_state, valid_until=payload.get("valid_until") or quote.valid_until)
            self._log(ctx, quote, quote.quote_stage, next_state, "send_to_customer", payload.get("remark"))
            return row
        if action in {"negotiate", "follow_up", "accept", "lost"}:
            return self._customer_action(ctx, quote_id, action, payload)
        raise ConflictException(f"Unsupported quote blueprint action '{action}'")

    def _customer_action(self, ctx: TenantContext, quote_id: UUID, action: str, payload: dict[str, Any]) -> CrmQuote:
        quote = self.get(ctx, quote_id)
        if action != "lost":
            sales_blueprint_engine.assert_not_locked(quote)
        next_state = sales_blueprint_engine.transition("quote", quote.quote_stage, action)
        updates: dict[str, Any] = {"quote_stage": next_state}
        if action == "lost":
            updates["locked"] = False
        row = self._repo.update(ctx, quote_id, **updates)
        self._log(ctx, quote, quote.quote_stage, next_state, action, payload.get("remark"))

        if action == "accept":
            opp = self._opportunities.get(ctx, quote.opportunity_id)
            if opp and opp.blueprint_state == "quote_in_progress":
                next_opp_state = sales_blueprint_engine.transition("opportunity", opp.blueprint_state, "quote_accepted")
                self._opportunities.update(ctx, opp.id, blueprint_state=next_opp_state)
                log_state_history(
                    self._db, ctx, company_id=opp.company_id, branch_id=opp.branch_id,
                    entity_type="opportunity", entity_id=opp.id,
                    from_state="quote_in_progress", to_state=next_opp_state, action="quote_accepted",
                    remark=f"Quote {quote.quote_no} accepted by customer",
                )
        return row

    def _log(self, ctx: TenantContext, quote: CrmQuote, from_state: str, to_state: str, action: str, remark: str | None) -> None:
        log_state_history(
            self._db, ctx, company_id=quote.company_id, branch_id=quote.branch_id,
            entity_type="quote", entity_id=quote.id,
            from_state=from_state, to_state=to_state, action=action, remark=remark,
        )
