"""CRM sales Quote application service.

Product rules enforced here:
  3. Quote ONLY after opp has OEM quote attached + state allows.
  6. Margin gate (HW/SW >=7%, Services >=20%, mixed => stricter) drives
     internal-approval routing to Management via My Jobs.
  8. "Send for approval" creates a My Jobs task + notification stub and can
     lock the record.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, ForbiddenException, NotFoundException
from modules.crm.domain.enums import CrmEntityType
from modules.crm.domain.quote_terms import DEFAULT_GENERAL_TERMS
from modules.crm.models import CrmOpportunity, CrmQuote, CrmQuoteLine
from modules.crm.repository.company_repository import CompanyRepository
from modules.crm.repository.contact_repository import ContactRepository
from modules.crm.repository.lead_repository import LeadRepository
from modules.crm.repository.base import utcnow
from modules.crm.repository.opportunity_repository import OpportunityRepository
from modules.crm.repository.quote_repository import QuoteLineRepository, QuoteRepository
from modules.crm.repository.quote_revision_repository import QuoteRevisionRepository
from modules.crm.service.blueprint_service import log_state_history
from modules.crm.service.crm_module_admin import CrmModuleAdminService
from modules.crm.service.crm_record_visibility import CrmRecordVisibility
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import DocumentNumberService
from modules.crm.service.engines import margin_engine, sales_blueprint_engine
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.master_data.service.employee_service import EmployeeService


_MONEY = Decimal("0.0001")
_MARGIN_PCT = Decimal("0.0000000001")


def _first(*values: Any) -> Any:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


def _quantize_margin_pct(value: Decimal | str | float | int | None) -> Decimal:
    return Decimal(str(value or 0)).quantize(_MARGIN_PCT, rounding=ROUND_HALF_UP)


def _apply_entered_margin(fields: dict[str, Any]) -> dict[str, Any]:
    """When margin_pct is provided with unit_cost, derive unit_sell and keep the entered %."""
    if "margin_pct" not in fields or fields.get("margin_pct") is None:
        return fields
    margin_pct = _quantize_margin_pct(fields["margin_pct"])
    fields["margin_pct"] = margin_pct
    if "unit_cost" in fields and fields.get("unit_cost") is not None:
        unit_cost = Decimal(str(fields["unit_cost"] or 0))
        fields["unit_sell"] = (unit_cost * (Decimal("1") + margin_pct / Decimal("100"))).quantize(
            _MONEY, rounding=ROUND_HALF_UP
        )
    return fields


class QuoteService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = QuoteRepository(db)
        self._lines = QuoteLineRepository(db)
        self._revisions = QuoteRevisionRepository(db)
        self._opportunities = OpportunityRepository(db)
        self._leads = LeadRepository(db)
        self._companies = CompanyRepository(db)
        self._contacts = ContactRepository(db)
        self._employees = EmployeeService(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._crm_admin = CrmModuleAdminService(db)
        self._visibility = CrmRecordVisibility(db)
        self._audit = PlatformAuditFacade(db)

    # -- reads -----------------------------------------------------------
    def peek_next_quote_no(
        self, ctx: TenantContext, company_id: UUID | None = None, opportunity_id: UUID | None = None
    ) -> str:
        cid = self._scope.resolve_company_id(ctx, company_id)
        deal_number = None
        if opportunity_id is not None:
            opp = self._get_opportunity(ctx, opportunity_id)
            cid, deal_number = opp.company_id, opp.deal_reg_number
        return self._numbers.generate_for_deal(
            CrmEntityType.QUOTE, cid, CrmQuote, "quote_no", deal_number=deal_number, tag="Q"
        )

    def list(self, ctx: TenantContext, company_id: UUID | None = None, opportunity_id: UUID | None = None):
        cid = self._scope.resolve_list_company_id(ctx, company_id)
        if opportunity_id is not None:
            opp = self._opportunities.get(ctx, opportunity_id)
            if opp is None:
                raise NotFoundException("Opportunity not found")
            self._visibility.ensure_opportunity_access(ctx, opp)
            return self._repo.list_quotes(ctx, cid, opportunity_id=opportunity_id)

        opp_ids, created_by, approval_ids = self._visibility.filter_quote_scope(ctx, cid)
        if opp_ids is None:
            return self._repo.list_quotes(ctx, cid)

        by_id: dict = {}
        if opp_ids:
            for row in self._repo.list_quotes(ctx, cid, opportunity_ids=opp_ids):
                by_id[row.id] = row
        if created_by is not None:
            for row in self._repo.list_quotes(ctx, cid, created_by=created_by):
                by_id[row.id] = row
        for qid in approval_ids:
            if qid in by_id:
                continue
            row = self._repo.get(ctx, qid)
            if row is not None and row.company_id == cid:
                by_id[row.id] = row
        return sorted(by_id.values(), key=lambda r: r.created_at or r.id, reverse=True)

    def get(self, ctx: TenantContext, quote_id: UUID) -> CrmQuote:
        row = self._repo.get(ctx, quote_id)
        if row is None:
            raise NotFoundException("Quote not found")
        self._visibility.ensure_quote_access(ctx, row)
        self._ensure_display_snapshot(ctx, row)
        return row
    def list_lines(self, ctx: TenantContext, quote_id: UUID):
        self.get(ctx, quote_id)
        return self._lines.list_for_quote(ctx, quote_id)

    def update(self, ctx: TenantContext, quote_id: UUID, **fields) -> CrmQuote:
        quote = self.get(ctx, quote_id)
        sales_blueprint_engine.assert_not_locked(quote)
        if "custom_fields" in fields:
            from modules.crm.service.crm_settings_service import CrmSettingsService

            effective = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
            fields["custom_fields"] = CrmSettingsService.sanitize_custom_fields(
                effective, "quote", fields.get("custom_fields")
            )
        row = self._repo.update(ctx, quote_id, **fields)
        if row is None:
            raise NotFoundException("Quote not found")
        if "freight" in fields:
            row = self._recompute(ctx, quote_id)
        return row

    def delete(self, ctx: TenantContext, quote_id: UUID) -> None:
        self._crm_admin.ensure_admin(ctx)
        quote = self.get(ctx, quote_id)
        if quote.locked:
            raise ConflictException("Quote is locked pending approval")
        if not self._repo.soft_delete(ctx, quote_id):
            raise NotFoundException("Quote not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="crm_quote",
            entity_id=quote_id,
            operation="delete",
            performed_by=ctx.user_id,
        )

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

    def _default_contact_id(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        company_account_id: UUID | None,
        lead: Any | None = None,
        account: Any | None = None,
    ) -> UUID | None:
        if company_account_id is None:
            return None
        contacts = self._contacts.list_contacts(ctx, company_id, company_account_id)
        preferred_first = _first(
            getattr(lead, "first_name", None) if lead is not None else None,
            getattr(account, "first_name", None) if account is not None else None,
        )
        preferred_last = _first(
            getattr(lead, "last_name", None) if lead is not None else None,
            getattr(account, "last_name", None) if account is not None else None,
        )
        preferred_name = " ".join(
            str(part).strip() for part in (preferred_first, preferred_last) if part
        ).strip().lower()
        if preferred_name and contacts:
            for row in contacts:
                row_name = f"{(row.first_name or '').strip()} {(row.last_name or '').strip()}".strip().lower()
                if row_name == preferred_name:
                    return row.id
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
                    lead=lead,
                    account=account,
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
            "amc_warranty": _first(current.get("amc_warranty"), "none"),
            "billing_street": _first(
                current.get("billing_street"),
                lead.street if lead is not None else None,
                account.billing_street if account is not None else None,
            ),
            "billing_city": _first(
                current.get("billing_city"),
                lead.city if lead is not None else None,
                account.billing_city if account is not None else None,
            ),
            "billing_state": _first(
                current.get("billing_state"),
                lead.state if lead is not None else None,
                account.billing_state if account is not None else None,
            ),
            "billing_zip": _first(
                current.get("billing_zip"),
                lead.zip if lead is not None else None,
                account.billing_code if account is not None else None,
            ),
            "billing_country": _first(
                current.get("billing_country"),
                lead.country if lead is not None else None,
                account.billing_country if account is not None else None,
            ),
            "shipping_street": _first(
                current.get("shipping_street"),
                account.shipping_street if account is not None else None,
            ),
            "shipping_city": _first(
                current.get("shipping_city"),
                account.shipping_city if account is not None else None,
            ),
            "shipping_state": _first(
                current.get("shipping_state"),
                account.shipping_state if account is not None else None,
            ),
            "shipping_zip": _first(
                current.get("shipping_zip"),
                account.shipping_code if account is not None else None,
            ),
            "shipping_country": _first(
                current.get("shipping_country"),
                account.shipping_country if account is not None else None,
                account.billing_country if account is not None else None,
                lead.country if lead is not None else None,
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
            "amc_warranty",
            "billing_street",
            "billing_city",
            "billing_state",
            "billing_zip",
            "billing_country",
            "shipping_street",
            "shipping_city",
            "shipping_state",
            "shipping_zip",
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
            # VersionMixin uses version_id_generator=False — must bump before flush.
            quote.version = int(quote.version or 1) + 1
            quote.updated_at = utcnow()
            quote.updated_by = ctx.user_id
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

        code = self._numbers.generate_for_deal(
            CrmEntityType.QUOTE,
            opp.company_id,
            CrmQuote,
            "quote_no",
            deal_number=getattr(opp, "deal_reg_number", None),
            tag="Q",
        )
        fields.setdefault("valid_until", None)
        fields.setdefault("quote_stage", "draft")
        fields.setdefault("approval_status", "not_required")
        if not (fields.get("terms") or "").strip():
            fields["terms"] = DEFAULT_GENERAL_TERMS
        if "custom_fields" in fields:
            from modules.crm.service.crm_settings_service import CrmSettingsService

            effective = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
            fields["custom_fields"] = CrmSettingsService.sanitize_custom_fields(
                effective, "quote", fields.get("custom_fields")
            )
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

    def _lock_quote_for_lines(self, ctx: TenantContext, quote_id: UUID) -> CrmQuote:
        """Serialize line mutations that recompute quote totals (avoids version 409 races)."""
        row = self._repo.get_for_update(ctx, quote_id)
        if row is None:
            raise NotFoundException("Quote not found")
        self._visibility.ensure_quote_access(ctx, row)
        self._ensure_display_snapshot(ctx, row)
        sales_blueprint_engine.assert_not_locked(row)
        return row

    # -- lines ---------------------------------------------------------
    def add_line(self, ctx: TenantContext, quote_id: UUID, **fields) -> CrmQuoteLine:
        quote = self._lock_quote_for_lines(ctx, quote_id)
        existing = self._lines.list_for_quote(ctx, quote_id)
        fields.setdefault("line_no", len(existing) + 1)
        fields = _apply_entered_margin(dict(fields))
        line = self._lines.create(ctx, company_id=quote.company_id, branch_id=quote.branch_id, quote_id=quote_id, **fields)
        self._recompute(ctx, quote_id)
        return line

    def update_line(self, ctx: TenantContext, line_id: UUID, **fields) -> CrmQuoteLine:
        line = self._lines.get(ctx, line_id)
        if line is None:
            raise NotFoundException("Quote line not found")
        self._lock_quote_for_lines(ctx, line.quote_id)
        fields = dict(fields)
        if "margin_pct" in fields and fields.get("margin_pct") is not None and "unit_cost" not in fields:
            fields["unit_cost"] = line.unit_cost
        if "unit_cost" in fields and fields.get("unit_cost") is not None and "margin_pct" not in fields:
            # Cost changed without a new margin — re-apply the stored markup %.
            fields["margin_pct"] = line.margin_pct
        fields = _apply_entered_margin(fields)
        if "qty" in fields and fields["qty"] is not None:
            self._assert_qty_within_balance(ctx, line, Decimal(str(fields["qty"])))
        updated = self._lines.update(ctx, line_id, **fields)
        self._recompute(ctx, line.quote_id)
        return updated

    def delete_line(self, ctx: TenantContext, line_id: UUID) -> None:
        line = self._lines.get(ctx, line_id)
        if line is None:
            raise NotFoundException("Quote line not found")
        self._lock_quote_for_lines(ctx, line.quote_id)
        if self._child_lines(ctx, line.id):
            raise ConflictException(
                f"{line.product_name} is split into other quotes - remove those splits first"
            )
        self._lines.delete(ctx, line_id)
        self._recompute(ctx, line.quote_id)

    # -- split one vendor-backed quote into several customer quotes -------
    def _child_lines(self, ctx: TenantContext, source_line_id: UUID) -> list[CrmQuoteLine]:
        from sqlalchemy import select

        stmt = (
            select(CrmQuoteLine)
            .join(CrmQuote, CrmQuote.id == CrmQuoteLine.quote_id)
            .where(
                CrmQuoteLine.tenant_id == ctx.tenant_id,
                CrmQuoteLine.source_line_id == source_line_id,
                CrmQuoteLine.is_deleted.is_(False),
                CrmQuote.is_deleted.is_(False),
                CrmQuote.quote_stage != "lost",
            )
        )
        return list(self._db.scalars(stmt).all())

    def _allocated_qty(self, ctx: TenantContext, source_line_id: UUID, *, exclude_line_id: UUID | None = None) -> Decimal:
        return sum(
            (Decimal(str(ln.qty)) for ln in self._child_lines(ctx, source_line_id) if ln.id != exclude_line_id),
            Decimal("0"),
        )

    def _assert_qty_within_balance(self, ctx: TenantContext, line: CrmQuoteLine, new_qty: Decimal) -> None:
        if line.source_line_id is not None:
            parent = self._lines.get(ctx, line.source_line_id)
            if parent is not None:
                others = self._allocated_qty(ctx, parent.id, exclude_line_id=line.id)
                balance = Decimal(str(parent.qty)) - others
                if new_qty - balance > Decimal("0.0001"):
                    raise ConflictException(
                        f"Only {balance.normalize():f} of {parent.product_name} is left on the source quote"
                    )
        allocated = self._allocated_qty(ctx, line.id)
        if allocated - new_qty > Decimal("0.0001"):
            raise ConflictException(
                f"{allocated.normalize():f} of {line.product_name} is already split into other quotes"
            )

    def split_balance(self, ctx: TenantContext, quote_id: UUID) -> list[dict[str, Any]]:
        """Per line: quoted quantity, quantity split into child quotes, and what is left."""
        self.get(ctx, quote_id)
        rows = []
        for line in self._lines.list_for_quote(ctx, quote_id):
            allocated = self._allocated_qty(ctx, line.id)
            rows.append(
                {
                    "line_id": line.id,
                    "line_no": line.line_no,
                    "product_name": line.product_name,
                    "qty": Decimal(str(line.qty)),
                    "allocated_qty": allocated,
                    "balance_qty": Decimal(str(line.qty)) - allocated,
                }
            )
        return rows

    def split_quote(self, ctx: TenantContext, quote_id: UUID, *, splits: list[dict[str, Any]]) -> list[CrmQuote]:
        """Break one quote into N customer quotes (entities / locations / GSTINs).

        Quantities are drawn down from the source quote so 100 licences can
        never be quoted as 3 x 100 - unlike a clone, which copies them.
        """
        source = self.get(ctx, quote_id)
        if source.quote_stage == "lost":
            raise ConflictException("A lost quote cannot be split")
        if source.parent_quote_id is not None:
            raise ConflictException("Split the original quote, not a quote that was already split from it")
        if len(splits) < 2:
            raise ConflictException("Choose at least two quotes to split into")
        opp = self._get_opportunity(ctx, source.opportunity_id)
        sales_blueprint_engine.assert_not_locked(opp)
        # One OVF covers the whole opportunity — split before raising it.
        from modules.crm.repository.ovf_repository import OvfRepository

        existing_ovfs = OvfRepository(self._db).list_ovfs(
            ctx, source.company_id, opportunity_id=source.opportunity_id
        )
        if existing_ovfs:
            raise ConflictException(
                "This opportunity already has an OVF. Split the quote before "
                "creating the OVF so all split quantities land on one form."
            )

        source_lines = {ln.id: ln for ln in self._lines.list_for_quote(ctx, quote_id)}
        requested: dict[UUID, Decimal] = {}
        for split in splits:
            if not split.get("lines"):
                raise ConflictException("Every split quote needs at least one line with a quantity")
            for alloc in split["lines"]:
                line_id = alloc["source_line_id"]
                if line_id not in source_lines:
                    raise ConflictException("Split lines must come from the source quote")
                qty = Decimal(str(alloc["qty"]))
                if qty <= 0:
                    raise ConflictException("Split quantities must be greater than zero")
                requested[line_id] = requested.get(line_id, Decimal("0")) + qty
        for line_id, qty in requested.items():
            line = source_lines[line_id]
            balance = Decimal(str(line.qty)) - self._allocated_qty(ctx, line_id)
            if qty - balance > Decimal("0.0001"):
                raise ConflictException(
                    f"{line.product_name}: splitting {qty.normalize():f} but only "
                    f"{balance.normalize():f} of {Decimal(str(line.qty)).normalize():f} is left"
                )

        copy_fields = (
            "subject", "project_title", "account_name", "service_type", "owner_name", "valid_until",
            "entity_name", "entity_email", "entity_address", "entity_gst", "entity_contact",
            "amc_warranty", "amc_start_date", "amc_end_date",
            "billing_street", "billing_city", "billing_state", "billing_zip", "billing_country",
            "shipping_street", "shipping_city", "shipping_state", "shipping_zip", "shipping_country",
            "terms", "description",
        )
        created: list[CrmQuote] = []
        for index, split in enumerate(splits, start=1):
            fields = {key: getattr(source, key) for key in copy_fields}
            fields["contact_id"] = split.get("contact_id") or source.contact_id
            for key in ("entity_name", "entity_gst", "entity_address", "shipping_street",
                        "shipping_city", "shipping_state", "shipping_zip"):
                if split.get(key):
                    fields[key] = split[key]
            code = self._numbers.generate_for_deal(
                CrmEntityType.QUOTE,
                source.company_id,
                CrmQuote,
                "quote_no",
                deal_number=opp.deal_reg_number,
                tag="Q",
            )
            # Parent already cleared customer acceptance (and often PO/OVF-ready).
            # Split children inherit that stage so the opportunity OVF can combine
            # broken quantities without re-walking send/accept.
            child_stage = "accepted" if source.quote_stage == "accepted" else "draft"
            child_approval = (
                "approved" if source.quote_stage == "accepted" else "not_required"
            )
            child = self._repo.create(
                ctx,
                company_id=source.company_id,
                branch_id=source.branch_id,
                opportunity_id=source.opportunity_id,
                company_account_id=source.company_account_id,
                quote_no=code,
                quote_stage=child_stage,
                approval_status=child_approval,
                freight=Decimal("0"),
                parent_quote_id=source.id,
                **fields,
            )
            for line_no, alloc in enumerate(split["lines"], start=1):
                parent_line = source_lines[alloc["source_line_id"]]
                self._lines.create(
                    ctx,
                    company_id=source.company_id,
                    branch_id=source.branch_id,
                    quote_id=child.id,
                    line_no=line_no,
                    product_id=parent_line.product_id,
                    product_name=parent_line.product_name,
                    hsn_sac=parent_line.hsn_sac,
                    description=parent_line.description,
                    sub_product_category=parent_line.sub_product_category,
                    line_type=parent_line.line_type,
                    qty=Decimal(str(alloc["qty"])),
                    unit_cost=parent_line.unit_cost,
                    unit_sell=parent_line.unit_sell,
                    gst_pct=parent_line.gst_pct,
                    source_line_id=parent_line.id,
                )
            self._recompute(ctx, child.id)
            self._log(
                ctx,
                child,
                child_stage,
                child_stage,
                "split_from_quote",
                f"Split {index}/{len(splits)} of {source.quote_no}",
            )
            created.append(self.get(ctx, child.id))
        self._log(
            ctx,
            source,
            source.quote_stage,
            source.quote_stage,
            "split_into_quotes",
            ", ".join(q.quote_no for q in created),
        )
        return created

    def _recompute(self, ctx: TenantContext, quote_id: UUID) -> CrmQuote:
        # Prefer the locked/identity-mapped row when present so version stays in sync
        # after get_for_update from add/update/delete line.
        quote = self._repo.get(ctx, quote_id)
        if quote is None:
            raise NotFoundException("Quote not found")
        lines = self._lines.list_for_quote(ctx, quote_id)
        computed_lines: list[CrmQuoteLine] = []
        stored_margins: list[Decimal] = []
        for line in lines:
            result = margin_engine.compute_line_margin(line.qty, line.unit_cost, line.unit_sell)
            gst_amount = (result.line_total * Decimal(str(line.gst_pct or 0)) / Decimal("100")).quantize(
                _MONEY
            )
            # Keep an explicitly entered margin % (up to 10 d.p.); only backfill
            # from cost/sell when the line has no stored markup yet.
            stored_pct = _quantize_margin_pct(line.margin_pct)
            margin_pct = stored_pct if stored_pct != 0 else result.margin_pct
            self._lines.update(
                ctx,
                line.id,
                margin_pct=margin_pct,
                margin_amount=result.margin_amount,
                gst_amount=gst_amount,
                line_total=result.line_total,
            )
            stored_margins.append(margin_pct)
            computed_lines.append(line)

        margin_result = margin_engine.evaluate_quote_margin(
            (line.line_type, line.qty, line.unit_cost, line.unit_sell) for line in computed_lines
        )
        if stored_margins:
            avg_margin_pct = (sum(stored_margins, Decimal("0")) / Decimal(len(stored_margins))).quantize(
                _MARGIN_PCT, rounding=ROUND_HALF_UP
            )
        else:
            avg_margin_pct = margin_result.avg_margin_pct
        grand_total = margin_result.total_sell_amount + Decimal(str(quote.freight or 0))
        return self._repo.update(
            ctx,
            quote_id,
            avg_margin_pct=avg_margin_pct,
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

    def _quotation_pdf_filename(self, quote: CrmQuote) -> str:
        code = (quote.quote_no or "Quote").replace("/", "_").replace("\\", "_").strip() or "Quote"
        title = (quote.project_title or quote.subject or "").strip()
        if title and title.lower() not in {"test", "test1"} and title.lower() != code.lower().replace("_", "/"):
            safe_title = "".join(ch if ch.isalnum() or ch in {" ", "-", "_"} else " " for ch in title)
            safe_title = "_".join(safe_title.split())[:60]
            if safe_title:
                return f"Quotation_{code}_{safe_title}.pdf"
        return f"Quotation_{code}.pdf"

    def _quotation_email_attachments(
        self,
        quote: CrmQuote,
        *,
        quotation_pdf_base64: str | None,
        quotation_pdf_filename: str | None,
    ) -> list[dict]:
        content = (quotation_pdf_base64 or "").strip()
        if not content:
            return []
        filename = (quotation_pdf_filename or "").strip() or self._quotation_pdf_filename(quote)
        if not filename.lower().endswith(".pdf"):
            filename = f"{filename}.pdf"
        return [
            {
                "filename": filename,
                "content_base64": content,
                "content_type": "application/pdf",
            }
        ]

    # -- blueprint / approval workflow ---------------------------------
    def send_for_approval(
        self,
        ctx: TenantContext,
        quote_id: UUID,
        *,
        team_role: str = "management",
        assigned_user_id: UUID | None = None,
        assigned_user_ids: list[UUID] | None = None,
        remarks: str | None = None,
        quotation_pdf_base64: str | None = None,
        quotation_pdf_filename: str | None = None,
    ) -> CrmQuote:
        quote = self.get(ctx, quote_id)
        sales_blueprint_engine.assert_not_locked(quote)
        revision = max(1, int(quote.quote_revision or 1))
        if revision <= 1 and (
            str(quote.approval_status or "") == "approved"
            or str(quote.quote_stage or "")
            in {"approved_internal", "sent_to_customer", "negotiation", "follow_up", "accepted"}
        ):
            raise ConflictException(
                "Version V1 was already sent for approval. Move to negotiation to open V2 before sending again."
            )
        self._recompute(ctx, quote_id)
        quote = self.get(ctx, quote_id)
        # Freeze printable payload for this revision so Versions can re-download it later.
        self._snapshot_revision(ctx, quote, remark=remarks)
        next_state = sales_blueprint_engine.transition("quote", quote.quote_stage, "send_for_approval")

        from modules.crm.service.approval_task_service import ApprovalTaskService

        ApprovalTaskService(self._db).route_approval(
            ctx,
            assigned_user_id=assigned_user_id,
            assigned_user_ids=assigned_user_ids,
            title=f"Approve Quote {quote.quote_no} - margin review",
            entity_type="quote",
            entity_id=quote.id,
            team_role=team_role,
            action="approve_internally",
            company_id=quote.company_id,
            branch_id=quote.branch_id,
            remarks=remarks,
            email_attachments=self._quotation_email_attachments(
                quote,
                quotation_pdf_base64=quotation_pdf_base64,
                quotation_pdf_filename=quotation_pdf_filename,
            )
            or None,
        )
        row = self._repo.update(ctx, quote_id, quote_stage=next_state, approval_status="pending", locked=True)
        self._log(ctx, quote, quote.quote_stage, next_state, "send_for_approval", remarks)
        return row

    def approve_internally(self, ctx: TenantContext, quote_id: UUID, *, remark: str | None = None, force: bool = False) -> CrmQuote:
        """Approve directly when margin is healthy; otherwise requires ``force``
        (set only by the My Jobs management decision path)."""
        quote = self.get(ctx, quote_id)
        self._recompute(ctx, quote_id)
        if not force:
            sales_blueprint_engine.assert_not_locked(quote)
            summary = self.margin_summary(ctx, quote_id)
            if summary["requires_management_approval"]:
                raise ConflictException(
                    f"Margin {summary['avg_margin_pct']}% is at/below the required "
                    f"{summary['required_threshold_pct']}% threshold - send for Management "
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
            from modules.crm.service.attachment_service import AttachmentService

            AttachmentService(self._db).remove_entity_attachments_by_category(
                ctx,
                "quote",
                quote_id,
                "vendor_quote",
            )
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

    def list_revisions(self, ctx: TenantContext, quote_id: UUID) -> list[dict[str, Any]]:
        quote = self.get(ctx, quote_id)
        snapshots = self._revisions.list_for_quote(ctx, quote_id)
        rows: list[dict[str, Any]] = []
        seen: set[int] = set()
        for snap in snapshots:
            seen.add(int(snap.revision_no))
            payload = snap.payload_json if isinstance(snap.payload_json, dict) else None
            rows.append(
                {
                    "revision_no": int(snap.revision_no),
                    "avg_margin_pct": snap.avg_margin_pct,
                    "grand_total": snap.grand_total,
                    "total_margin_amount": snap.total_margin_amount,
                    "is_current": False,
                    "snapshotted_at": snap.created_at,
                    "remark": snap.remark,
                    "has_print_payload": bool(payload and payload.get("lines") is not None),
                }
            )
        current_rev = max(1, int(quote.quote_revision or 1))
        if current_rev not in seen:
            # Live draft stub — do NOT stamp snapshotted_at. The quote detail UI
            # treats a V1 snapshotted_at as "already sent for approval" and would
            # hide Send for Approval on brand-new drafts.
            rows.append(
                {
                    "revision_no": current_rev,
                    "avg_margin_pct": quote.avg_margin_pct,
                    "grand_total": quote.grand_total,
                    "total_margin_amount": quote.total_margin_amount,
                    "is_current": True,
                    "snapshotted_at": None,
                    "remark": None,
                    "has_print_payload": True,
                }
            )
        else:
            # Prefer live totals for the active revision when it matches a snapshot key.
            for row in rows:
                if int(row["revision_no"]) == current_rev:
                    row["avg_margin_pct"] = quote.avg_margin_pct
                    row["grand_total"] = quote.grand_total
                    row["total_margin_amount"] = quote.total_margin_amount
                    row["is_current"] = True
                    row["has_print_payload"] = True
                    break

        rows.sort(key=lambda item: int(item["revision_no"]))
        baseline = Decimal(str(rows[0]["grand_total"])) if rows else Decimal("0")
        for row in rows:
            total = Decimal(str(row["grand_total"] or 0))
            if baseline == 0:
                row["negotiation_pct"] = Decimal("0")
            else:
                row["negotiation_pct"] = ((total - baseline) / baseline * Decimal("100")).quantize(
                    Decimal("0.01")
                )
        return rows

    def discard_current_revision(self, ctx: TenantContext, quote_id: UUID) -> CrmQuote:
        """Remove the unapproved current revision and restore the prior approved version.

        After negotiate/edit opens Vn as a draft (or pending/rejected approval), Sales can
        discard Vn and return to Vn-1 so Create Quote Vn+1 / Deal Won / Deal Lost reappear.
        """
        quote = self.get(ctx, quote_id)
        current_rev = max(1, int(quote.quote_revision or 1))
        if current_rev <= 1:
            raise ConflictException("Version V1 cannot be removed — there is no prior approved quote.")

        stage = str(quote.quote_stage or "")
        approval = str(quote.approval_status or "")
        approved_stages = {
            "approved_internal",
            "sent_to_customer",
            "negotiation",
            "follow_up",
            "accepted",
        }
        if stage in approved_stages or (approval == "approved" and stage not in {"draft", "internal_approval"}):
            raise ConflictException(
                f"V{current_rev} is already approved. Create the next version via negotiation before removing a draft."
            )
        if stage in {"accepted", "lost"}:
            raise ConflictException("Cannot remove a quote version after the deal is closed.")

        prior_rev = current_rev - 1
        prior = self._revisions.get_for_revision(ctx, quote_id, prior_rev)
        if prior is None:
            raise ConflictException(f"Prior approved version V{prior_rev} was not found — cannot restore.")
        payload = prior.payload_json if isinstance(prior.payload_json, dict) else None
        header = payload.get("quote") if payload and isinstance(payload.get("quote"), dict) else None
        lines_payload = payload.get("lines") if payload and isinstance(payload.get("lines"), list) else None
        if not header or lines_payload is None:
            raise ConflictException(
                f"V{prior_rev} has no frozen line detail — cannot restore. Keep editing V{current_rev} or contact support."
            )
        if any(str(item.get("id") or "").startswith("archive-") for item in lines_payload if isinstance(item, dict)):
            raise ConflictException(
                f"V{prior_rev} only has archived totals — cannot restore line items."
            )

        # Cancel pending My Jobs approval for the discarded draft/pending revision.
        from modules.crm.service.approval_task_service import ApprovalTaskService

        tasks = ApprovalTaskService(self._db)
        pending = tasks.list(
            ctx,
            company_id=quote.company_id,
            entity_type="quote",
            entity_id=quote_id,
            status="pending",
        )
        now = datetime.now(timezone.utc)
        for task in pending:
            if task.action == "approve_internally" and task.status == "pending":
                tasks._repo.update(
                    ctx,
                    task.id,
                    status="cancelled",
                    decision_remark=f"Quote V{current_rev} discarded; restored V{prior_rev}",
                    decided_at=now,
                    decided_by=ctx.user_id,
                )

        # Soft-delete live lines for the discarded revision, then rebuild from Vn-1.
        for line in list(self._lines.list_for_quote(ctx, quote_id)):
            self._lines.delete(ctx, line.id)

        for index, item in enumerate(lines_payload):
            if not isinstance(item, dict):
                continue
            product_id = None
            raw_product_id = item.get("product_id")
            if raw_product_id:
                try:
                    product_id = UUID(str(raw_product_id))
                except (TypeError, ValueError):
                    product_id = None
            source_line_id = None
            raw_source = item.get("source_line_id")
            if raw_source:
                try:
                    source_line_id = UUID(str(raw_source))
                except (TypeError, ValueError):
                    source_line_id = None
            self._lines.create(
                ctx,
                company_id=quote.company_id,
                branch_id=quote.branch_id,
                quote_id=quote_id,
                line_no=int(item.get("line_no") or index + 1),
                product_id=product_id,
                product_name=str(item.get("product_name") or "Line item"),
                hsn_sac=item.get("hsn_sac"),
                description=item.get("description"),
                sub_product_category=item.get("sub_product_category"),
                line_type=str(item.get("line_type") or "hardware"),
                qty=Decimal(str(item.get("qty") or 0)),
                unit_cost=Decimal(str(item.get("unit_cost") or 0)),
                unit_sell=Decimal(str(item.get("unit_sell") or 0)),
                gst_pct=Decimal(str(item.get("gst_pct") or 0)),
                source_line_id=source_line_id,
            )

        restored_stage = str(header.get("quote_stage") or "")
        if restored_stage not in (approved_stages - {"accepted"}):
            # Prefer customer-facing stage when known; otherwise post-approval internal.
            restored_stage = "approved_internal"
        valid_until = quote.valid_until
        raw_valid = header.get("valid_until")
        if isinstance(raw_valid, str) and raw_valid.strip():
            try:
                valid_until = date.fromisoformat(raw_valid[:10])
            except ValueError:
                pass

        header_updates: dict[str, Any] = {
            "quote_revision": prior_rev,
            "quote_stage": restored_stage,
            "approval_status": "approved",
            "locked": False,
            "freight": Decimal(str(header.get("freight") or quote.freight or 0)),
            "valid_until": valid_until,
        }
        for field in (
            "subject",
            "project_title",
            "account_name",
            "owner_name",
            "entity_name",
            "entity_email",
            "entity_address",
            "entity_gst",
            "entity_contact",
            "reason_for_discount",
            "terms",
            "description",
            "billing_country",
            "shipping_country",
        ):
            if field in header and header.get(field) is not None:
                header_updates[field] = header.get(field)

        from_state = quote.quote_stage
        self._revisions.soft_delete_revision(ctx, quote_id, current_rev)
        row = self._repo.update(ctx, quote_id, **header_updates)
        self._recompute(ctx, quote_id)
        row = self.get(ctx, quote_id)
        self._log(
            ctx,
            quote,
            from_state,
            restored_stage,
            "discard_current_revision",
            f"Discarded V{current_rev}; restored approved V{prior_rev}",
        )
        return row

    def revision_print_payload(self, ctx: TenantContext, quote_id: UUID, revision_no: int) -> dict[str, Any]:
        """Return quote + lines frozen for ``revision_no`` (live data when current)."""
        quote = self.get(ctx, quote_id)
        rev = max(1, int(revision_no))
        current_rev = max(1, int(quote.quote_revision or 1))
        if rev == current_rev:
            return {
                "revision_no": current_rev,
                "is_current": True,
                "quote": self._quote_print_header(quote, revision_no=current_rev),
                "lines": [self._line_print_dict(line) for line in self._lines.list_for_quote(ctx, quote_id)],
            }

        snap = self._revisions.get_for_revision(ctx, quote_id, rev)
        if snap is None:
            raise NotFoundException(f"Quote version V{rev} was not found")
        payload = snap.payload_json if isinstance(snap.payload_json, dict) else None
        if payload and isinstance(payload.get("quote"), dict) and isinstance(payload.get("lines"), list):
            header = dict(payload["quote"])
            header["quote_revision"] = rev
            return {
                "revision_no": rev,
                "is_current": False,
                "quote": header,
                "lines": list(payload["lines"]),
            }
        # Legacy snapshots without line payload: still printable as a totals archive.
        header = self._quote_print_header(quote, revision_no=rev)
        header["grand_total"] = str(snap.grand_total or 0)
        header["avg_margin_pct"] = str(snap.avg_margin_pct or 0)
        header["total_margin_amount"] = str(snap.total_margin_amount or 0)
        total = Decimal(str(snap.grand_total or 0))
        return {
            "revision_no": rev,
            "is_current": False,
            "quote": header,
            "lines": [
                {
                    "id": f"archive-{rev}",
                    "quote_id": str(quote.id),
                    "line_no": 1,
                    "product_id": None,
                    "product_name": f"Version V{rev} archived total",
                    "hsn_sac": None,
                    "description": "Line detail was not frozen for this version; grand total only.",
                    "line_type": "hardware",
                    "qty": "1",
                    "unit_cost": "0",
                    "unit_sell": str(total),
                    "margin_pct": str(snap.avg_margin_pct or 0),
                    "margin_amount": str(snap.total_margin_amount or 0),
                    "gst_pct": "0",
                    "gst_amount": "0",
                    "line_total": str(total),
                    "source_line_id": None,
                    "version": 1,
                }
            ],
        }

    def _quote_print_header(self, quote: CrmQuote, *, revision_no: int) -> dict[str, Any]:
        return {
            "id": str(quote.id),
            "company_id": str(quote.company_id),
            "branch_id": str(quote.branch_id),
            "opportunity_id": str(quote.opportunity_id),
            "company_account_id": str(quote.company_account_id) if quote.company_account_id else None,
            "contact_id": str(quote.contact_id) if quote.contact_id else None,
            "subject": quote.subject,
            "project_title": quote.project_title,
            "account_name": quote.account_name,
            "owner_name": quote.owner_name,
            "entity_name": quote.entity_name,
            "entity_email": quote.entity_email,
            "entity_address": quote.entity_address,
            "entity_gst": quote.entity_gst,
            "entity_contact": quote.entity_contact,
            "quote_no": quote.quote_no,
            "quote_revision": revision_no,
            "quote_stage": quote.quote_stage,
            "approval_status": quote.approval_status,
            "locked": bool(quote.locked),
            "valid_until": quote.valid_until.isoformat() if quote.valid_until else None,
            "freight": str(quote.freight or 0),
            "grand_total": str(quote.grand_total or 0),
            "avg_margin_pct": str(quote.avg_margin_pct or 0),
            "total_margin_amount": str(quote.total_margin_amount or 0),
            "reason_for_discount": quote.reason_for_discount,
            "terms": quote.terms,
            "description": quote.description,
            "billing_country": quote.billing_country,
            "shipping_country": quote.shipping_country,
            "sales_order_id": str(quote.sales_order_id) if quote.sales_order_id else None,
            "parent_quote_id": str(quote.parent_quote_id) if quote.parent_quote_id else None,
            "version": int(quote.version or 1),
            "created_at": quote.created_at.isoformat() if quote.created_at else None,
        }

    @staticmethod
    def _line_print_dict(line: Any) -> dict[str, Any]:
        return {
            "id": str(line.id),
            "quote_id": str(line.quote_id),
            "line_no": int(line.line_no or 1),
            "product_id": str(line.product_id) if line.product_id else None,
            "product_name": line.product_name,
            "hsn_sac": line.hsn_sac,
            "description": line.description,
            "sub_product_category": line.sub_product_category,
            "line_type": line.line_type or "hardware",
            "qty": str(line.qty or 0),
            "unit_cost": str(line.unit_cost or 0),
            "unit_sell": str(line.unit_sell or 0),
            "margin_pct": str(line.margin_pct or 0),
            "margin_amount": str(line.margin_amount or 0),
            "gst_pct": str(line.gst_pct or 0),
            "gst_amount": str(line.gst_amount or 0),
            "line_total": str(line.line_total or 0),
            "source_line_id": str(line.source_line_id) if line.source_line_id else None,
            "version": int(line.version or 1),
        }

    def _snapshot_revision(
        self,
        ctx: TenantContext,
        quote: CrmQuote,
        *,
        remark: str | None = None,
    ) -> None:
        revision_no = max(1, int(quote.quote_revision or 1))
        lines = self._lines.list_for_quote(ctx, quote.id)
        payload_json = {
            "quote": self._quote_print_header(quote, revision_no=revision_no),
            "lines": [self._line_print_dict(line) for line in lines],
        }
        self._revisions.upsert_snapshot(
            ctx,
            quote_id=quote.id,
            company_id=quote.company_id,
            branch_id=quote.branch_id,
            revision_no=revision_no,
            avg_margin_pct=quote.avg_margin_pct or Decimal("0"),
            grand_total=quote.grand_total or Decimal("0"),
            total_margin_amount=quote.total_margin_amount or Decimal("0"),
            remark=remark,
            payload_json=payload_json,
        )

    def _customer_action(self, ctx: TenantContext, quote_id: UUID, action: str, payload: dict[str, Any]) -> CrmQuote:
        quote = self.get(ctx, quote_id)
        if action != "lost":
            sales_blueprint_engine.assert_not_locked(quote)
        from_state = quote.quote_stage
        next_state = sales_blueprint_engine.transition("quote", quote.quote_stage, action)
        updates: dict[str, Any] = {"quote_stage": next_state}
        if action == "lost":
            updates["locked"] = False
        if action == "negotiate":
            # Freeze current revision totals, then open the next revision in draft
            # so Sales re-runs approval → customer send for the negotiated quote.
            self._recompute(ctx, quote_id)
            quote = self.get(ctx, quote_id)
            self._snapshot_revision(ctx, quote, remark=payload.get("remark"))
            updates["quote_revision"] = max(1, int(quote.quote_revision or 1)) + 1
            updates["quote_stage"] = "draft"
            updates["approval_status"] = "not_required"
            updates["locked"] = False
            next_state = "draft"
        row = self._repo.update(ctx, quote_id, **updates)
        self._log(ctx, quote, from_state, next_state, action, payload.get("remark"))

        if action == "accept":
            self._mark_opportunity_won_on_quote_accept(ctx, quote)
        return row

    def _mark_opportunity_won_on_quote_accept(self, ctx: TenantContext, quote: CrmQuote) -> None:
        """Customer quote acceptance wins the deal; PO/OVF continue as fulfilment."""
        opp = self._opportunities.get(ctx, quote.opportunity_id)
        if opp is None:
            return
        from_opp_state = opp.blueprint_state
        already_won = str(opp.status or "").lower() == "won"
        won_amount = Decimal(str(quote.grand_total or opp.deal_won_amount or 0))
        opp_updates: dict[str, Any] = {
            "status": "won",
            "current_stage": "won",
            "probability_percent": 100,
            "deal_won_amount": won_amount,
            "forecast_amount": won_amount,
            "won_at": opp.won_at or utcnow(),
        }
        next_opp_state = from_opp_state
        if from_opp_state == "quote_in_progress":
            next_opp_state = sales_blueprint_engine.transition(
                "opportunity", from_opp_state, "quote_accepted"
            )
            opp_updates["blueprint_state"] = next_opp_state
            log_state_history(
                self._db,
                ctx,
                company_id=opp.company_id,
                branch_id=opp.branch_id,
                entity_type="opportunity",
                entity_id=opp.id,
                from_state=from_opp_state,
                to_state=next_opp_state,
                action="quote_accepted",
                remark=f"Quote {quote.quote_no} accepted by customer",
            )

        self._opportunities.update(ctx, opp.id, **opp_updates)
        if already_won:
            return
        log_state_history(
            self._db,
            ctx,
            company_id=opp.company_id,
            branch_id=opp.branch_id,
            entity_type="opportunity",
            entity_id=opp.id,
            from_state=next_opp_state,
            to_state=next_opp_state,
            action="deal_won",
            remark=f"Deal won on quote {quote.quote_no} acceptance at {won_amount}",
        )
        self._notify_deal_won_on_quote_accept(ctx, opp, won_amount)

    def _notify_deal_won_on_quote_accept(self, ctx: TenantContext, opp: CrmOpportunity, amount: Decimal) -> None:
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
            CrmEmailNotificationService(self._db).notify_deal_won(
                tenant_id=ctx.tenant_id,
                opportunity_id=opp.id,
                opportunity_name=opp.opportunity_name or "Opportunity",
                customer_name=customer,
                salesperson_name=salesperson,
                final_value=amount,
                owner_employee_id=opp.owner_employee_id,
                created_by=ctx.user_id,
            )
        except Exception:  # noqa: BLE001
            pass

    def _log(self, ctx: TenantContext, quote: CrmQuote, from_state: str, to_state: str, action: str, remark: str | None) -> None:
        log_state_history(
            self._db, ctx, company_id=quote.company_id, branch_id=quote.branch_id,
            entity_type="quote", entity_id=quote.id,
            from_state=from_state, to_state=to_state, action=action, remark=remark,
        )
