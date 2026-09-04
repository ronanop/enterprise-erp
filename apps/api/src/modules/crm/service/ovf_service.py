"""CRM OVF (Order Value Form) application service.

Product rules enforced here:
  4. OVF ONLY after customer PO is approved on the opportunity.
  7. Finance cost ~0.5% per 15 days of payment gap.
  8. "Send for approval" creates a My Jobs task + notification stub and can
     lock the record.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Sequence
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, ForbiddenException, NotFoundException
from modules.crm.domain.enums import CrmEntityType
from modules.crm.models import CrmOpportunity, CrmOvf, CrmOvfLine, CrmQuote
from modules.crm.repository.company_repository import CompanyRepository
from modules.crm.repository.lead_repository import LeadRepository
from modules.crm.repository.opportunity_repository import OpportunityRepository
from modules.crm.repository.attachment_repository import AttachmentRepository
from modules.crm.repository.ovf_repository import OvfLineRepository, OvfRepository
from modules.crm.repository.quote_repository import QuoteLineRepository, QuoteRepository
from modules.crm.service.blueprint_service import log_state_history
from modules.crm.service.crm_module_admin import CrmModuleAdminService
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import DocumentNumberService
from modules.crm.service.engines import margin_engine, sales_blueprint_engine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.master_data.service.employee_service import EmployeeService


def _first(*values: Any) -> Any:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


def _aggregate_distributor_names(vendor_dtos: list[dict[str, Any]]) -> str | None:
    """Unique distributor labels from OVF vendor charge lines (comma-separated)."""
    names: list[str] = []
    seen: set[str] = set()
    for dto in vendor_dtos:
        raw = (dto.get("distributor_name") or "").strip()
        if not raw:
            continue
        for part in raw.replace(";", ",").split(","):
            name = part.strip()
            if not name:
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            names.append(name)
    return ", ".join(names) if names else None


def resolve_scm_hold_started_at(ovf: CrmOvf) -> datetime | None:
    """When hold started; falls back to updated_at for legacy rows without scm_on_hold_at."""
    if not bool(getattr(ovf, "scm_on_hold", False)):
        return None
    explicit = getattr(ovf, "scm_on_hold_at", None)
    if explicit is not None:
        return explicit
    return getattr(ovf, "updated_at", None)


def _scm_hold_event_payload(
    started: datetime,
    released: datetime,
    remark: str | None = None,
) -> dict[str, str]:
    payload: dict[str, str] = {
        "started_at": started.isoformat(),
        "released_at": released.isoformat(),
    }
    text = (remark or "").strip()
    if text:
        payload["remark"] = text
    return payload


def serialize_scm_hold_history(ovf: CrmOvf) -> list[dict[str, Any]]:
    """Completed SCM hold cycles for SCM OVF preview."""
    events: list[dict[str, Any]] = []
    raw = getattr(ovf, "scm_hold_history", None) or []
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            started = item.get("started_at")
            released = item.get("released_at")
            if started and released:
                entry: dict[str, Any] = {"started_at": started, "released_at": released}
                remark = item.get("remark")
                if isinstance(remark, str) and remark.strip():
                    entry["remark"] = remark.strip()
                events.append(entry)
    if not events:
        since = getattr(ovf, "scm_last_hold_since", None)
        released = getattr(ovf, "scm_last_hold_released_at", None)
        if since and released:
            events.append({"started_at": since, "released_at": released})
    return events


class OvfService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = OvfRepository(db)
        self._lines = OvfLineRepository(db)
        self._companies = CompanyRepository(db)
        self._opportunities = OpportunityRepository(db)
        self._leads = LeadRepository(db)
        self._quotes = QuoteRepository(db)
        self._quote_lines = QuoteLineRepository(db)
        self._employees = EmployeeService(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._attachments = AttachmentRepository(db)
        self._crm_admin = CrmModuleAdminService(db)
        self._audit = AuditService(db)

    def resolve_customer_po_display_date(self, ctx: TenantContext, ovf: CrmOvf) -> date | None:
        """PO date on the OVF, or when the customer PO file was attached on the opportunity."""
        return self._resolve_customer_po_display_date(ctx, ovf)

    def _resolve_customer_po_display_date(self, ctx: TenantContext, ovf: CrmOvf) -> date | None:
        """PO date on the OVF, or when the customer PO file was attached on the opportunity."""
        if ovf.po_date is not None:
            return ovf.po_date
        attachments = self._attachments.list_for_entity(ctx, "opportunity", ovf.opportunity_id)
        po_files = [
            row
            for row in attachments
            if row.category == "customer_po" and getattr(row, "created_at", None) is not None
        ]
        if not po_files:
            return None
        latest = max(po_files, key=lambda row: row.created_at)
        created = latest.created_at
        if isinstance(created, datetime):
            return created.date()
        return None

    def list(self, ctx: TenantContext, company_id: UUID | None = None, opportunity_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_ovfs(ctx, cid, opportunity_id=opportunity_id)

    def list_shared_for_scm(self, ctx: TenantContext, company_id: UUID | None = None):
        """OVFs shared to SCM after Finance/management commercial lock."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_shared_to_scm(ctx, cid)

    def list_display_meta_by_ids(
        self, ctx: TenantContext, ovf_ids: Sequence[UUID]
    ) -> dict[UUID, dict[str, str | date | None]]:
        """Lightweight OVF fields for Procurement list enrichment (no ORM leak)."""
        rows = self._repo.list_by_ids(ctx, list(ovf_ids))
        return {
            row.id: {
                "ovf_no": row.ovf_no,
                "po_number": row.po_number,
                "customer_name": row.customer_name,
                "po_date": self._resolve_customer_po_display_date(ctx, row),
            }
            for row in rows
        }

    def get(self, ctx: TenantContext, ovf_id: UUID) -> CrmOvf:
        row = self._repo.get(ctx, ovf_id)
        if row is None:
            raise NotFoundException("OVF not found")
        self._ensure_display_snapshot(ctx, row)
        return row

    def list_lines(self, ctx: TenantContext, ovf_id: UUID):
        self.get(ctx, ovf_id)
        return self._lines.list_for_ovf(ctx, ovf_id)

    def delete(self, ctx: TenantContext, ovf_id: UUID) -> None:
        self._crm_admin.ensure_admin(ctx)
        ovf = self.get(ctx, ovf_id)
        if ovf.locked:
            raise ConflictException("OVF is locked pending approval")
        if not self._repo.soft_delete(ctx, ovf_id):
            raise NotFoundException("OVF not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="crm_ovf",
            entity_id=ovf_id,
            operation="delete",
            performed_by=ctx.user_id,
        )

    def get_scm_handoff(self, ctx: TenantContext, ovf_id: UUID) -> dict[str, Any]:
        """Full CRM OVF DTO for SCM — queue preview, Create PO, and View OVF."""
        ovf = self.get(ctx, ovf_id)
        if not ovf.shared_to_scm:
            raise ConflictException("OVF has not been shared to SCM")
        lines = self.list_lines(ctx, ovf_id)
        customer_lines = [ln for ln in lines if ln.side == "customer_po"]
        vendor_lines = [ln for ln in lines if ln.side == "vendor"]
        quote = self._get_quote(ctx, ovf.quote_id)
        quote_lines = self._quote_lines.list_for_quote(ctx, quote.id)
        quote_by_name = {
            (ql.product_name or "").strip().lower(): ql
            for ql in quote_lines
            if (ql.product_name or "").strip()
        }
        gst_values = [float(ln.gst_pct or 0) for ln in quote_lines if float(ln.gst_pct or 0) > 0]
        tax_pct = (sum(gst_values) / len(gst_values)) if gst_values else 18.0
        if tax_pct <= 0:
            tax_pct = 18.0

        oem = self._resolve_lead_scm_context(ctx, ovf.opportunity_id)

        def charge_dto(ln: Any) -> dict[str, Any]:
            key = (ln.product_name or "").strip().lower()
            ql = quote_by_name.get(key)
            stored_desc = (getattr(ln, "description", None) or "").strip()
            quote_desc = (getattr(ql, "description", None) if ql else None) or None
            desc = stored_desc or quote_desc or ln.product_name
            line_gst = float(getattr(ln, "gst_pct", 0) or 0)
            if line_gst <= 0:
                quote_gst = float(getattr(ql, "gst_pct", 0) or 0) if ql else 0.0
                gst_pct = quote_gst if quote_gst > 0 else tax_pct
            else:
                gst_pct = line_gst
            qty = float(ln.qty)
            unit = float(ln.unit_price)
            total = float(ln.line_total) if ln.line_total is not None else qty * unit
            gst_amount = (total * gst_pct / 100.0)
            return {
                "line_id": ln.id,
                "line_no": ln.line_no,
                "product_name": ln.product_name,
                "description": desc,
                "distributor_name": getattr(ln, "distributor_name", None),
                "contact_person": getattr(ln, "contact_person", None),
                "contact_number": getattr(ln, "contact_number", None),
                "qty": qty,
                "unit_price": unit,
                "line_total": total,
                "gst_pct": gst_pct,
                "gst_amount": round(gst_amount, 4),
                "total_with_gst": round(total + gst_amount, 4),
            }

        customer_dtos = [charge_dto(ln) for ln in customer_lines]
        vendor_dtos = [charge_dto(ln) for ln in vendor_lines]

        quote_rank = {
            (ql.product_name or "").strip().lower(): i
            for i, ql in enumerate(quote_lines)
            if (ql.product_name or "").strip()
        }

        def _crm_line_sort_key(
            dto: dict[str, Any],
            *,
            follow: dict[str, int] | None = None,
        ) -> tuple[int, int, int]:
            name = (dto.get("product_name") or "").strip().lower()
            follow_pos = follow.get(name, 10_000) if follow is not None else 0
            return (
                follow_pos,
                quote_rank.get(name, 10_000),
                int(dto.get("line_no") or 0),
            )

        # Same sequence as CRM Order Lines (quote / customer charges, then extras).
        customer_dtos.sort(key=lambda d: _crm_line_sort_key(d))
        customer_rank = {
            (c.get("product_name") or "").strip().lower(): i
            for i, c in enumerate(customer_dtos)
            if (c.get("product_name") or "").strip() and c["product_name"] != "—"
        }
        vendor_dtos.sort(key=lambda d: _crm_line_sort_key(d, follow=customer_rank))

        vendor_by_no = {int(v["line_no"]): v for v in vendor_dtos}
        vendor_by_name = {(v["product_name"] or "").strip().lower(): v for v in vendor_dtos}
        margin_lines: list[dict[str, Any]] = []
        products_margin = 0.0
        customer_sell_total = 0.0
        for cust in customer_dtos:
            # OVF line_no is not globally unique across sides, so use product name first
            # to avoid mismatching asus↔macbook.
            cust_key = (cust["product_name"] or "").strip().lower()
            vend = vendor_by_name.get(cust_key) or vendor_by_no.get(int(cust["line_no"]))
            cust_total = float(cust["line_total"])
            vend_total = float(vend["line_total"]) if vend else 0.0
            margin_amt = cust_total - vend_total
            margin_pct = (margin_amt / cust_total * 100.0) if cust_total else 0.0
            products_margin += margin_amt
            customer_sell_total += cust_total
            margin_lines.append(
                {
                    "line_no": cust["line_no"],
                    "product_name": cust["product_name"],
                    "description": cust["description"],
                    "qty": cust["qty"],
                    "margin_amount": round(margin_amt, 4),
                    "margin_pct": round(margin_pct, 3),
                }
            )

        freight = float(ovf.freight or 0)
        additional = float(ovf.additional_charges or 0)
        finance_pct = float(ovf.finance_cost_pct or 0)
        vendor_sell_total = sum(float(v["line_total"]) for v in vendor_dtos)
        finance_amount = vendor_sell_total * finance_pct / 100.0
        margin_net = products_margin - freight - additional - finance_amount
        margin_pct_header = float(ovf.total_margin_pct or 0)
        if not margin_pct_header and customer_sell_total:
            display_margin = float(ovf.total_margin_amount or margin_net)
            margin_pct_header = round(display_margin / customer_sell_total * 100.0, 3)

        billing_parts = [ovf.billing_address, ovf.billing_state, ovf.billing_country]
        shipping_parts = [ovf.shipping_address, ovf.shipping_state, ovf.shipping_country]

        distributor_name = (oem.get("distributor_name") or "").strip() or None
        if not distributor_name:
            distributor_name = _aggregate_distributor_names(vendor_dtos)

        return {
            "ovf_id": ovf.id,
            "ovf_no": ovf.ovf_no,
            "company_id": ovf.company_id,
            "branch_id": ovf.branch_id,
            "quote_id": ovf.quote_id,
            "opportunity_id": ovf.opportunity_id,
            "quote_no": getattr(quote, "quote_no", None),
            "po_number": ovf.po_number,
            "po_date": self._resolve_customer_po_display_date(ctx, ovf),
            "delivery_period": ovf.delivery_period,
            "customer_name": ovf.customer_name,
            "quote_name": ovf.quote_name,
            "account_name": ovf.account_name,
            "owner_name": ovf.owner_name,
            "oem_name": oem.get("oem_name"),
            "oem_contact_person": oem.get("oem_contact_person"),
            "oem_contact_email": oem.get("oem_contact_email"),
            "oem_contact_number": oem.get("oem_contact_number"),
            "distributor_name": distributor_name,
            "project_title": oem.get("project_title"),
            "blueprint_state": ovf.blueprint_state,
            "approval_status": ovf.approval_status,
            "scm_on_hold": bool(getattr(ovf, "scm_on_hold", False)),
            "scm_on_hold_at": resolve_scm_hold_started_at(ovf),
            "scm_hold_blocked": False,
            "scm_last_hold_since": getattr(ovf, "scm_last_hold_since", None),
            "scm_last_hold_released_at": getattr(ovf, "scm_last_hold_released_at", None),
            "scm_hold_history": serialize_scm_hold_history(ovf),
            "scm_on_hold_remark": getattr(ovf, "scm_on_hold_remark", None),
            "freight": freight,
            "additional_charges": float(ovf.additional_charges or 0),
            "vendor_payment_days": int(ovf.vendor_payment_days or 0),
            "customer_payment_days": int(ovf.customer_payment_days or 0),
            "finance_cost_pct": float(ovf.finance_cost_pct or 0),
            "total_margin_amount": float(ovf.total_margin_amount or margin_net),
            "total_margin_pct": margin_pct_header,
            "products_margin_amount": round(products_margin, 4),
            "billing_address": ", ".join(str(p) for p in billing_parts if p) or None,
            "shipping_address": ", ".join(str(p) for p in shipping_parts if p) or None,
            "billing_state": ovf.billing_state,
            "shipping_state": ovf.shipping_state,
            "billing_contact_person": ovf.billing_contact_person,
            "shipping_contact_person": ovf.shipping_contact_person,
            "customer_gst": getattr(quote, "entity_gst", None),
            "tax_percentage": tax_pct,
            "ovf_approver": ovf.owner_name,
            "vendor_lines": vendor_dtos,
            "customer_lines": customer_dtos,
            "margin_lines": margin_lines,
        }

    def get_scm_commercial_totals(self, ctx: TenantContext, ovf_id: UUID) -> dict[str, float]:
        """Lightweight vendor/customer/margin totals for PO & GRN lists (no quote/handoff DTO)."""
        ovf = self.get(ctx, ovf_id)

        def _line_total(ln: Any) -> float:
            if ln.line_total is not None:
                return float(ln.line_total)
            return float(ln.qty or 0) * float(ln.unit_price or 0)

        lines = self.list_lines(ctx, ovf_id)
        vendor_lines = [ln for ln in lines if ln.side == "vendor"]
        customer_lines = [ln for ln in lines if ln.side == "customer_po"]
        vendor_total = sum(_line_total(ln) for ln in vendor_lines)
        customer_total = sum(_line_total(ln) for ln in customer_lines)
        vendor_by_name = {
            (ln.product_name or "").strip().lower(): _line_total(ln) for ln in vendor_lines
        }
        products_margin = 0.0
        for ln in customer_lines:
            key = (ln.product_name or "").strip().lower()
            cust = _line_total(ln)
            vend = vendor_by_name.get(key, 0.0)
            products_margin += cust - vend
        freight = float(ovf.freight or 0)
        additional = float(ovf.additional_charges or 0)
        finance_pct = float(ovf.finance_cost_pct or 0)
        margin_amount = (
            products_margin
            - freight
            - additional
            - (vendor_total * finance_pct / 100.0)
        )
        return {
            "vendor_total": vendor_total,
            "customer_total": customer_total,
            "products_margin_amount": round(products_margin, 4),
            "total_margin_amount": round(margin_amount, 4),
            "freight": freight,
            "additional_charges": additional,
            "finance_cost_pct": finance_pct,
        }

    def get_scm_commercial_export(self, ctx: TenantContext, ovf_id: UUID) -> dict[str, Any]:
        """Tax-aware commercial snapshot for procurement PO Excel export."""
        handoff = self.get_scm_handoff(ctx, ovf_id)
        customer_lines = handoff.get("customer_lines") or []
        vendor_lines = handoff.get("vendor_lines") or []
        customer_sub = sum(float(ln["line_total"]) for ln in customer_lines)
        customer_tax = sum(float(ln["gst_amount"]) for ln in customer_lines)
        customer_with_tax = sum(float(ln["total_with_gst"]) for ln in customer_lines)
        vendor_sub = sum(float(ln["line_total"]) for ln in vendor_lines)
        vendor_tax = sum(float(ln["gst_amount"]) for ln in vendor_lines)
        vendor_with_tax = sum(float(ln["total_with_gst"]) for ln in vendor_lines)
        desc_parts: list[str] = []
        for ln in customer_lines:
            label = (ln.get("description") or ln.get("product_name") or "").strip()
            if label and label not in desc_parts:
                desc_parts.append(label)
        ovf = self.get(ctx, ovf_id)
        customer_total = customer_sub
        margin_amount = float(handoff.get("total_margin_amount") or 0)
        margin_pct = (margin_amount / customer_total * 100.0) if customer_total else 0.0
        return {
            "vendor_total": vendor_sub,
            "customer_total": customer_sub,
            "customer_tax_amount": round(customer_tax, 4),
            "customer_total_with_tax": round(customer_with_tax, 4),
            "vendor_tax_amount": round(vendor_tax, 4),
            "vendor_total_with_tax": round(vendor_with_tax, 4),
            "total_margin_amount": margin_amount,
            "margin_pct": round(margin_pct, 3),
            "description": "; ".join(desc_parts) if desc_parts else None,
            "customer_po_number": ovf.po_number,
            "customer_po_date": self._resolve_customer_po_display_date(ctx, ovf),
        }

    def _resolve_lead_scm_context(self, ctx: TenantContext, opportunity_id: UUID) -> dict[str, str | None]:
        """Lead fields surfaced to SCM (OEM, distributor, project title)."""
        empty: dict[str, str | None] = {
            "oem_name": None,
            "oem_contact_person": None,
            "oem_contact_email": None,
            "oem_contact_number": None,
            "distributor_name": None,
            "project_title": None,
        }
        opp = self._opportunities.get(ctx, opportunity_id)
        if opp is None:
            return empty
        project_title = (opp.project_title or "").strip() or None
        if opp.lead_id is None:
            return {**empty, "project_title": project_title}
        lead = self._leads.get(ctx, opp.lead_id)
        if lead is None:
            return {**empty, "project_title": project_title}
        return {
            "oem_name": (lead.oem_name or "").strip() or None,
            "oem_contact_person": (lead.oem_contact_person or "").strip() or None,
            "oem_contact_email": (lead.oem_contact_email or "").strip() or None,
            "oem_contact_number": (lead.oem_contact_number or "").strip() or None,
            "distributor_name": (lead.distributor_name or "").strip() or None,
            "project_title": _first(project_title, lead.project_title),
        }

    def _resolve_oem_context(self, ctx: TenantContext, opportunity_id: UUID) -> dict[str, str | None]:
        """OEM + contact from the originating lead (for SCM vendor context)."""
        lead_ctx = self._resolve_lead_scm_context(ctx, opportunity_id)
        return {
            "oem_name": lead_ctx["oem_name"],
            "oem_contact_person": lead_ctx["oem_contact_person"],
            "oem_contact_email": lead_ctx["oem_contact_email"],
            "oem_contact_number": lead_ctx["oem_contact_number"],
        }

    def _resolve_oem_name(self, ctx: TenantContext, opportunity_id: UUID) -> str | None:
        """OEM is captured on the lead; surface it for SCM vendor matching."""
        return self._resolve_oem_context(ctx, opportunity_id).get("oem_name")

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

    def _owner_label(self, ctx: TenantContext, owner_employee_id: UUID | None) -> str | None:
        if owner_employee_id is None:
            return None
        try:
            employee = self._employees.get_employee(ctx, owner_employee_id)
        except (NotFoundException, ForbiddenException):
            return None
        name = f"{employee.first_name} {employee.last_name}".strip()
        return name or None

    def _snapshot_fields_from_related(
        self,
        ctx: TenantContext,
        *,
        quote: CrmQuote,
        opp: CrmOpportunity,
        account: Any | None,
        current: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        current = current or {}
        billing_address = None
        shipping_address = None
        if account is not None:
            billing_address = ", ".join(
                str(value)
                for value in (account.billing_street, account.billing_city, account.billing_code)
                if value
            ) or None
            shipping_address = ", ".join(
                str(value)
                for value in (account.shipping_street, account.shipping_city, account.shipping_code)
                if value
            ) or None

        return {
            "customer_name": _first(
                current.get("customer_name"),
                account.customer_name if account is not None else None,
                quote.entity_name,
                quote.account_name,
            ),
            "quote_name": _first(current.get("quote_name"), quote.subject, quote.project_title),
            "billing_address": _first(
                current.get("billing_address"),
                quote.entity_address,
                billing_address,
            ),
            "billing_state": _first(
                current.get("billing_state"),
                account.billing_state if account is not None else None,
            ),
            "billing_country": _first(
                current.get("billing_country"),
                quote.billing_country,
                account.billing_country if account is not None else None,
            ),
            "owner_name": _first(
                current.get("owner_name"),
                quote.owner_name,
                self._owner_label(ctx, getattr(opp, "owner_employee_id", None)),
            ),
            "billing_contact_person": _first(
                current.get("billing_contact_person"),
                quote.entity_contact,
            ),
            "shipping_address": _first(current.get("shipping_address"), shipping_address, billing_address),
            "shipping_state": _first(
                current.get("shipping_state"),
                account.shipping_state if account is not None else None,
                account.billing_state if account is not None else None,
            ),
            "shipping_country": _first(
                current.get("shipping_country"),
                quote.shipping_country,
                account.shipping_country if account is not None else None,
                account.billing_country if account is not None else None,
            ),
            "shipping_contact_person": _first(
                current.get("shipping_contact_person"),
                quote.entity_contact,
            ),
            "account_name": _first(
                current.get("account_name"),
                account.customer_name if account is not None else None,
                quote.account_name,
                quote.entity_name,
            ),
        }

    def _ensure_display_snapshot(self, ctx: TenantContext, ovf: CrmOvf) -> None:
        snapshot_keys = (
            "customer_name",
            "quote_name",
            "billing_address",
            "billing_state",
            "billing_country",
            "owner_name",
            "billing_contact_person",
            "shipping_address",
            "shipping_state",
            "shipping_country",
            "shipping_contact_person",
            "account_name",
        )
        if not any(_first(getattr(ovf, key, None)) is None for key in snapshot_keys):
            return

        quote = self._quotes.get(ctx, ovf.quote_id)
        opp = self._opportunities.get(ctx, ovf.opportunity_id)
        if quote is None or opp is None:
            return
        account = (
            self._companies.get(ctx, opp.company_account_id) if opp.company_account_id else None
        )
        resolved = self._snapshot_fields_from_related(
            ctx,
            quote=quote,
            opp=opp,
            account=account,
            current={key: getattr(ovf, key, None) for key in snapshot_keys},
        )
        patched = False
        for key, value in resolved.items():
            if _first(getattr(ovf, key, None)) is None and value is not None:
                setattr(ovf, key, value)
                patched = True
        if patched:
            self._db.flush()

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
        if quote.quote_stage != "accepted":
            raise ConflictException(
                f"Quote is in stage '{quote.quote_stage}'; OVF can only be created "
                "from an accepted customer quote."
            )
        existing = self._repo.list_ovfs(ctx, opp.company_id, opportunity_id=opp.id)
        if existing:
            raise ConflictException(
                "An OVF already exists for this opportunity. Open the existing OVF "
                "to continue approval, SCM share, or Deal Won."
            )
        sales_blueprint_engine.assert_not_locked(opp)

        account = (
            self._companies.get(ctx, opp.company_account_id)
            if opp.company_account_id
            else None
        )
        fields.update(
            self._snapshot_fields_from_related(
                ctx,
                quote=quote,
                opp=opp,
                account=account,
                current=fields,
            )
        )

        fields["freight"] = fields.get("freight") if fields.get("freight") is not None else (quote.freight or Decimal("0"))
        if fields.get("total_margin_pct") is None:
            fields["total_margin_pct"] = quote.avg_margin_pct
        if fields.get("total_margin_amount") is None:
            fields["total_margin_amount"] = quote.total_margin_amount
        vendor_days = int(fields.get("vendor_payment_days", 0) or 0)
        customer_days = int(fields.get("customer_payment_days", 0) or 0)
        if fields.get("finance_cost_pct") is None:
            fields["finance_cost_pct"] = margin_engine.compute_finance_cost_pct(vendor_days, customer_days)

        code = self._numbers.generate(CrmEntityType.OVF, opp.company_id, CrmOvf, "ovf_no")
        approval_status = fields.pop("approval_status", None) or "not_required"
        if approval_status not in ("not_required", "pending", "approved", "rejected"):
            approval_status = "not_required"
        row = self._repo.create(
            ctx,
            company_id=opp.company_id,
            branch_id=opp.branch_id,
            ovf_no=code,
            quote_id=quote_id,
            opportunity_id=opp.id,
            company_account_id=opp.company_account_id,
            approval_status=approval_status,
            blueprint_state="draft",
            **fields,
        )

        for quote_line in self._quote_lines.list_for_quote(ctx, quote.id):
            for side, unit_price in (
                ("customer_po", quote_line.unit_sell),
                ("vendor", quote_line.unit_cost),
            ):
                self._lines.create(
                    ctx,
                    company_id=opp.company_id,
                    branch_id=opp.branch_id,
                    ovf_id=row.id,
                    side=side,
                    line_no=quote_line.line_no,
                    product_name=quote_line.product_name,
                    description=(quote_line.description or None),
                    qty=quote_line.qty,
                    unit_price=unit_price,
                    gst_pct=Decimal(str(quote_line.gst_pct or 18)),
                    line_total=(quote_line.qty * unit_price).quantize(Decimal("0.0001")),
                )

        self._recompute_margin(ctx, row.id)

        from_opp_state = opp.blueprint_state or "ovf_ready"
        next_state = sales_blueprint_engine.transition("opportunity", from_opp_state, "create_ovf")
        self._opportunities.update(ctx, opp.id, blueprint_state=next_state)
        log_state_history(
            self._db, ctx, company_id=opp.company_id, branch_id=opp.branch_id,
            entity_type="opportunity", entity_id=opp.id,
            from_state=from_opp_state, to_state=next_state, action="create_ovf",
            remark=f"OVF {code} created",
        )
        return row

    def update(self, ctx: TenantContext, ovf_id: UUID, **fields) -> CrmOvf:
        ovf = self.get(ctx, ovf_id)
        sales_blueprint_engine.assert_not_locked(ovf)
        if ovf.deal_won or ovf.shared_to_scm:
            raise ConflictException("OVF cannot be edited after it is shared to SCM or marked Deal Won")

        vendor_days = int(fields.get("vendor_payment_days", ovf.vendor_payment_days) or 0)
        customer_days = int(fields.get("customer_payment_days", ovf.customer_payment_days) or 0)
        if "vendor_payment_days" in fields or "customer_payment_days" in fields:
            if fields.get("finance_cost_pct") is None:
                fields["finance_cost_pct"] = margin_engine.compute_finance_cost_pct(vendor_days, customer_days)

        approval_status = fields.get("approval_status")
        if approval_status is not None and approval_status not in (
            "not_required",
            "pending",
            "approved",
            "rejected",
        ):
            fields.pop("approval_status", None)

        row = self._repo.update(ctx, ovf_id, **fields)
        if row is None:
            raise NotFoundException("OVF not found")
        if any(key in fields for key in ("freight", "vendor_payment_days", "customer_payment_days", "finance_cost_pct")):
            if fields.get("total_margin_amount") is None and fields.get("total_margin_pct") is None:
                self._recompute_margin(ctx, ovf_id)
                row = self.get(ctx, ovf_id)
        return row

    # -- lines -----------------------------------------------------------
    def add_line(self, ctx: TenantContext, ovf_id: UUID, **fields) -> CrmOvfLine:
        ovf = self.get(ctx, ovf_id)
        sales_blueprint_engine.assert_not_locked(ovf)
        existing = self._lines.list_for_ovf(ctx, ovf_id)
        side = fields.get("side", "customer_po")
        fields.setdefault("line_no", len([ln for ln in existing if ln.side == side]) + 1)
        qty = Decimal(str(fields.get("qty", 1)))
        unit_price = Decimal(str(fields.get("unit_price", 0)))
        if fields.get("line_total") is None:
            fields["line_total"] = (qty * unit_price).quantize(Decimal("0.0001"))
        else:
            fields["line_total"] = Decimal(str(fields["line_total"])).quantize(Decimal("0.0001"))
        if fields.get("gst_pct") is None:
            fields["gst_pct"] = Decimal("18")
        else:
            fields["gst_pct"] = Decimal(str(fields["gst_pct"]))
        line = self._lines.create(ctx, company_id=ovf.company_id, branch_id=ovf.branch_id, ovf_id=ovf_id, **fields)
        self._recompute_margin(ctx, ovf_id)
        return line

    def update_line(self, ctx: TenantContext, line_id: UUID, **fields) -> CrmOvfLine:
        line = self._lines.get(ctx, line_id)
        if line is None:
            raise NotFoundException("OVF line not found")
        ovf = self.get(ctx, line.ovf_id)
        sales_blueprint_engine.assert_not_locked(ovf)
        qty = Decimal(str(fields.get("qty", line.qty)))
        unit_price = Decimal(str(fields.get("unit_price", line.unit_price)))
        if "line_total" in fields and fields["line_total"] is not None:
            fields["line_total"] = Decimal(str(fields["line_total"])).quantize(Decimal("0.0001"))
        else:
            fields["line_total"] = (qty * unit_price).quantize(Decimal("0.0001"))
        if "gst_pct" in fields and fields["gst_pct"] is not None:
            fields["gst_pct"] = Decimal(str(fields["gst_pct"]))
        row = self._lines.update(ctx, line_id, **fields)
        if row is None:
            raise NotFoundException("OVF line not found")
        self._recompute_margin(ctx, ovf.id)
        return row

    def _recompute_margin(self, ctx: TenantContext, ovf_id: UUID) -> None:
        ovf = self.get(ctx, ovf_id)
        lines = self._lines.list_for_ovf(ctx, ovf_id)
        customer_total = sum((Decimal(str(ln.line_total)) for ln in lines if ln.side == "customer_po"), Decimal("0"))
        vendor_total = sum((Decimal(str(ln.line_total)) for ln in lines if ln.side == "vendor"), Decimal("0"))
        freight = Decimal(str(ovf.freight or 0))
        additional = Decimal(str(ovf.additional_charges or 0))
        finance_pct = Decimal(str(ovf.finance_cost_pct or 0))
        finance_amount = (vendor_total * finance_pct / Decimal("100")).quantize(Decimal("0.0001"))
        margin_amount = (
            customer_total - vendor_total - freight - additional - finance_amount
        ).quantize(Decimal("0.0001"))
        margin_pct = (
            (margin_amount / customer_total * Decimal("100")).quantize(Decimal("0.001"))
            if customer_total
            else Decimal("0")
        )
        self._repo.update(ctx, ovf_id, total_margin_amount=margin_amount, total_margin_pct=margin_pct)

    # -- blueprint / approval workflow ------------------------------------
    def send_for_approval(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        team_role: str = "management",
        remarks: str | None = None,
        assigned_user_id: UUID | None = None,
        assigned_user_ids: list[UUID] | None = None,
    ) -> CrmOvf:
        ovf = self.get(ctx, ovf_id)
        sales_blueprint_engine.assert_not_locked(ovf)
        next_state = sales_blueprint_engine.transition("ovf", ovf.blueprint_state, "send_for_approval")

        from modules.crm.service.approval_task_service import ApprovalTaskService

        ApprovalTaskService(self._db).route_approval(
            ctx,
            title=f"Approve OVF {ovf.ovf_no}",
            entity_type="ovf",
            entity_id=ovf.id,
            team_role=team_role,
            action="approve",
            company_id=ovf.company_id,
            branch_id=ovf.branch_id,
            remarks=remarks,
            assigned_user_id=assigned_user_id,
            assigned_user_ids=assigned_user_ids,
        )
        row = self._repo.update(ctx, ovf_id, blueprint_state=next_state, approval_status="pending", locked=True)
        self._log(ctx, ovf, ovf.blueprint_state, next_state, "send_for_approval", remarks)
        return row

    def apply_blueprint_action(self, ctx: TenantContext, ovf_id: UUID, action: str, payload: dict[str, Any]) -> CrmOvf:
        ovf = self.get(ctx, ovf_id)
        if action == "approve":
            if not (ovf.locked and ovf.blueprint_state == "approval"):
                raise ConflictException(
                    "Approve is only available for OVFs pending Management approval via My Jobs"
                )
            next_state = sales_blueprint_engine.transition("ovf", ovf.blueprint_state, "approve")
            row = self._repo.update(ctx, ovf_id, blueprint_state=next_state, approval_status="approved", locked=False)
            self._log(ctx, ovf, ovf.blueprint_state, next_state, "approve", payload.get("remark"))
            return row
        if action == "reject":
            if not (ovf.locked and ovf.blueprint_state == "approval"):
                raise ConflictException(
                    "Reject is only available for OVFs pending Management approval via My Jobs"
                )
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
        row = self._repo.update(
            ctx,
            ovf_id,
            blueprint_state=next_state,
            shared_to_scm=True,
            shared_to_scm_at=datetime.now(timezone.utc),
        )
        self._log(ctx, ovf, ovf.blueprint_state, next_state, "share_to_scm", None)
        return row

    def set_scm_on_hold(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        on_hold: bool,
        remark: str | None = None,
    ) -> CrmOvf:
        """SCM may park an OVF without creating a vendor PO (no vendor required)."""
        ovf = self.get(ctx, ovf_id)
        if not ovf.shared_to_scm:
            raise ConflictException("OVF has not been shared to SCM")
        now = datetime.now(timezone.utc)
        if on_hold:
            if bool(ovf.scm_on_hold):
                raise ConflictException("OVF is already on SCM hold")
            remark_text = (remark or "").strip()
            if not remark_text:
                raise ConflictException("Hold remark is required")
            hold_at = now
            row = self._repo.update(
                ctx,
                ovf_id,
                scm_on_hold=True,
                scm_on_hold_at=hold_at,
                scm_on_hold_remark=remark_text,
            )
        else:
            was_on_hold = bool(ovf.scm_on_hold)
            update_fields: dict[str, Any] = {
                "scm_on_hold": False,
                "scm_on_hold_at": None,
                "scm_on_hold_remark": None,
            }
            if was_on_hold:
                hold_since = resolve_scm_hold_started_at(ovf) or now
                hold_remark = getattr(ovf, "scm_on_hold_remark", None)
                history = list(getattr(ovf, "scm_hold_history", None) or [])
                history.append(_scm_hold_event_payload(hold_since, now, hold_remark))
                update_fields["scm_hold_history"] = history
                update_fields["scm_last_hold_since"] = hold_since
                update_fields["scm_last_hold_released_at"] = now
            row = self._repo.update(ctx, ovf_id, **update_fields)
        self._log(
            ctx,
            ovf,
            ovf.blueprint_state,
            ovf.blueprint_state,
            "scm_hold" if on_hold else "scm_release_hold",
            None,
        )
        return row

    def update_scm_charges(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        freight: Decimal | float | str | None = None,
        additional_charges: Decimal | float | str | None = None,
        finance_cost_pct: Decimal | float | str | None = None,
    ) -> CrmOvf:
        """SCM may adjust freight / finance / additional charges after share-to-SCM.

        Values are stored on the CRM OVF so Sales sees the updated figures on detail.
        """
        ovf = self.get(ctx, ovf_id)
        if not ovf.shared_to_scm:
            raise ConflictException("OVF has not been shared to SCM")
        if bool(getattr(ovf, "scm_on_hold", False)):
            raise ConflictException(
                "Freight and finance cannot be changed while the OVF is on SCM hold. Unhold first."
            )

        fields: dict[str, Decimal] = {}
        if freight is not None:
            value = Decimal(str(freight))
            if value < 0:
                raise ConflictException("Freight cannot be negative")
            fields["freight"] = value.quantize(Decimal("0.0001"))
        if additional_charges is not None:
            value = Decimal(str(additional_charges))
            if value < 0:
                raise ConflictException("Additional charges cannot be negative")
            fields["additional_charges"] = value.quantize(Decimal("0.0001"))
        if finance_cost_pct is not None:
            value = Decimal(str(finance_cost_pct))
            if value < 0:
                raise ConflictException("Finance cost % cannot be negative")
            fields["finance_cost_pct"] = value.quantize(Decimal("0.001"))

        if not fields:
            return ovf

        row = self._repo.update(ctx, ovf_id, **fields)
        if row is None:
            raise NotFoundException("OVF not found")
        self._recompute_margin(ctx, ovf_id)
        row = self.get(ctx, ovf_id)
        self._log(
            ctx,
            ovf,
            ovf.blueprint_state,
            ovf.blueprint_state,
            "scm_update_charges",
            (
                f"freight={fields.get('freight', ovf.freight)}, "
                f"additional_charges={fields.get('additional_charges', ovf.additional_charges)}, "
                f"finance_cost_pct={fields.get('finance_cost_pct', ovf.finance_cost_pct)}"
            ),
        )
        return row

    def update_scm_item_plan_vendor(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        product_name: str,
        line_index: int,
        distributor_name: str,
    ) -> CrmOvfLine:
        """SCM item-plan vendor selection — updates CRM vendor line distributor_name.

        Allowed after share-to-SCM even when the OVF blueprint is locked.
        """
        ovf = self.get(ctx, ovf_id)
        if not ovf.shared_to_scm:
            raise ConflictException("OVF has not been shared to SCM")
        if bool(getattr(ovf, "scm_on_hold", False)):
            raise ConflictException(
                "Distributor cannot be changed while the OVF is on SCM hold. Unhold first."
            )

        handoff = self.get_scm_handoff(ctx, ovf_id)
        vendor_lines = list(handoff.get("vendor_lines") or [])
        if line_index < 0 or line_index >= len(vendor_lines):
            raise NotFoundException("OVF vendor line not found for item plan index")

        matched = vendor_lines[line_index]
        needle = " ".join((product_name or "").strip().lower().split())
        matched_name = " ".join(str(matched.get("product_name") or "").strip().lower().split())
        if needle and matched_name and needle != matched_name:
            # Prefer exact product+index; fall back to first matching product name.
            fallback = next(
                (
                    ln
                    for ln in vendor_lines
                    if " ".join(str(ln.get("product_name") or "").strip().lower().split()) == needle
                ),
                None,
            )
            if fallback is None:
                raise ConflictException(
                    f"Item plan line product '{product_name}' does not match vendor line at index {line_index}"
                )
            matched = fallback

        line_id = matched.get("line_id")
        if line_id is None:
            raise NotFoundException("OVF vendor line id missing")

        dist = (distributor_name or "").strip() or None
        row = self._lines.update(ctx, UUID(str(line_id)), distributor_name=dist)
        if row is None:
            raise NotFoundException("OVF line not found")
        self._recompute_margin(ctx, ovf_id)
        self._log(
            ctx,
            ovf,
            ovf.blueprint_state,
            ovf.blueprint_state,
            "scm_update_item_plan_vendor",
            f"line_id={line_id}, product={product_name}, distributor_name={dist}",
        )
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
        from_opp_state = opp.blueprint_state
        opp_next_state = sales_blueprint_engine.transition("opportunity", from_opp_state, "deal_won")

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
            from_state=from_opp_state, to_state=opp_next_state, action="deal_won",
            remark=f"OVF {ovf.ovf_no} deal won at {amount}",
        )
        return row

    def _log(self, ctx: TenantContext, ovf: CrmOvf, from_state: str, to_state: str, action: str, remark: str | None) -> None:
        log_state_history(
            self._db, ctx, company_id=ovf.company_id, branch_id=ovf.branch_id,
            entity_type="ovf", entity_id=ovf.id,
            from_state=from_state, to_state=to_state, action=action, remark=remark,
        )
