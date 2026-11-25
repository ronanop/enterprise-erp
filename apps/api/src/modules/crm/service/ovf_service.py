"""CRM OVF (Order Value Form) application service.

Product rules enforced here:
  4. OVF ONLY after customer PO is approved on the opportunity.
  7. Finance cost: IF customer > vendor then (0.5/15)*(customer-vendor), else 0.
  8. "Send for approval" creates a My Jobs task + notification stub and can
     lock the record.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Sequence
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, ForbiddenException, NotFoundException
from modules.crm.domain import delivery_timeline
from modules.crm.domain.enums import CrmEntityType
from modules.crm.domain.tax_codes import classify_hsn_sac
from modules.crm.models import CrmOpportunity, CrmOvf, CrmOvfLine, CrmQuote
from modules.crm.repository.company_repository import CompanyRepository
from modules.crm.repository.lead_repository import LeadRepository
from modules.crm.repository.opportunity_repository import OpportunityRepository
from modules.crm.repository.attachment_repository import AttachmentRepository
from modules.crm.repository.ovf_repository import OvfLineRepository, OvfRepository
from modules.crm.repository.quote_repository import QuoteLineRepository, QuoteRepository
from modules.crm.service.blueprint_service import log_state_history
from modules.crm.service.crm_module_admin import CrmModuleAdminService
from modules.crm.service.crm_record_visibility import CrmRecordVisibility
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import DocumentNumberService
from modules.crm.service.engines import margin_engine, sales_blueprint_engine
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.master_data.service.employee_service import EmployeeService


def _is_supporting_charge_line(description: str | None) -> bool:
    return (description or "").lstrip().startswith("[supporting]")


def _is_service_charge_line(description: str | None, product_name: str | None = None) -> bool:
    """Service-visit costs count as Additional Charges, not Vendor PO purchase."""
    desc = (description or "").lstrip()
    if desc.startswith("[service]"):
        return True
    name = (product_name or "").strip().lower()
    if " visits - " in name:
        return True
    if name.startswith("service consumables"):
        return True
    return False


def _is_additional_charge_line(description: str | None, product_name: str | None = None) -> bool:
    return _is_supporting_charge_line(description) or _is_service_charge_line(
        description, product_name
    )

FREIGHT_MEDIUMS = ("air", "road", "sea", "courier")
NEGOTIATED_BY_OPTIONS = ("sales", "management", "scm", "presales", "finance", "other")


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
        self._visibility = CrmRecordVisibility(db)
        self._audit = PlatformAuditFacade(db)

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
        cid = self._scope.resolve_list_company_id(ctx, company_id)
        if opportunity_id is not None:
            opp = self._opportunities.get(ctx, opportunity_id)
            if opp is None:
                raise NotFoundException("Opportunity not found")
            self._visibility.ensure_opportunity_access(ctx, opp)
            return self._repo.list_ovfs(ctx, cid, opportunity_id=opportunity_id)

        opp_ids, created_by, approval_ids = self._visibility.filter_ovf_scope(ctx, cid)
        if opp_ids is None:
            return self._repo.list_ovfs(ctx, cid)

        by_id: dict = {}
        if opp_ids:
            for row in self._repo.list_ovfs(ctx, cid, opportunity_ids=opp_ids):
                by_id[row.id] = row
        if created_by is not None:
            for row in self._repo.list_ovfs(ctx, cid, created_by=created_by):
                by_id[row.id] = row
        for oid in approval_ids:
            if oid in by_id:
                continue
            row = self._repo.get(ctx, oid)
            if row is not None and row.company_id == cid:
                by_id[row.id] = row
        return sorted(by_id.values(), key=lambda r: r.created_at or r.id, reverse=True)

    def list_shared_for_scm(self, ctx: TenantContext, company_id: UUID | None = None):
        """OVFs shared to SCM after Finance/management commercial lock.

        Do not pin to the session company alone - Procurement must see shared OVFs
        across every company the user can access (platform / procurement-wide /
        multi-entity scope). Explicit ``company_id`` still narrows the queue.
        """
        from modules.foundation.domain.org_data_scope import (
            effective_company_ids,
            has_module_wide_data_access,
        )

        if company_id is not None:
            self._scope.resolve_list_company_id(ctx, company_id)
            return self._repo.list_shared_to_scm(ctx, company_id)

        if has_module_wide_data_access(ctx, "procurement"):
            return self._repo.list_shared_to_scm(ctx, None)

        ids = effective_company_ids(ctx, module_key="procurement")
        if ids is None:
            return self._repo.list_shared_to_scm(ctx, None)
        if len(ids) == 0:
            if ctx.company_id is None:
                return []
            return self._repo.list_shared_to_scm(ctx, ctx.company_id)
        if len(ids) == 1:
            return self._repo.list_shared_to_scm(ctx, ids[0])
        # Multiple assigned companies - repository applies IN (...); do not pin to session.
        return self._repo.list_shared_to_scm(ctx, None)

    def list_display_meta_by_ids(
        self, ctx: TenantContext, ovf_ids: Sequence[UUID]
    ) -> dict[UUID, dict[str, str | date | int | None]]:
        """Lightweight OVF fields for Procurement list enrichment (no ORM leak)."""
        rows = self._repo.list_by_ids(ctx, list(ovf_ids))
        return {
            row.id: {
                "ovf_no": row.ovf_no,
                "po_number": row.po_number,
                "customer_name": row.customer_name,
                "po_date": self._resolve_customer_po_display_date(ctx, row),
                "customer_payment_days": int(row.customer_payment_days or 0),
                "vendor_payment_days": int(row.vendor_payment_days or 0),
            }
            for row in rows
        }

    def get(self, ctx: TenantContext, ovf_id: UUID) -> CrmOvf:
        row = self._repo.get(ctx, ovf_id)
        if row is None:
            raise NotFoundException("OVF not found")
        # Procurement/SCM module-wide access still uses list_shared_for_scm;
        # CRM users are creator-scoped unless admin or approval assignee.
        # Shared OVFs are readable by Procurement so SCM can open the handoff.
        if not self._visibility.is_admin(ctx):
            if not (
                bool(row.shared_to_scm)
                and self._visibility.can_procurement_read_shared_ovf(ctx, row)
            ):
                self._visibility.ensure_ovf_access(ctx, row)
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
        """Full CRM OVF DTO for SCM - queue preview, Create PO, and View OVF."""
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
            if (c.get("product_name") or "").strip() and c["product_name"] != "-"
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
                    "margin_pct": round(margin_pct, 10),
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
            margin_pct_header = round(display_margin / customer_sell_total * 100.0, 10)

        billing_parts = [ovf.billing_address, ovf.billing_state, ovf.billing_country]
        shipping_parts = [ovf.shipping_address, ovf.shipping_state, ovf.shipping_country]

        distributor_name = (oem.get("distributor_name") or "").strip() or None
        if not distributor_name:
            distributor_name = _aggregate_distributor_names(vendor_dtos)

        customer_account_number = None
        if ovf.company_account_id:
            try:
                account = self._companies.get(ctx, ovf.company_account_id)
            except (NotFoundException, ForbiddenException):
                account = None
            if account is not None:
                customer_account_number = (getattr(account, "account_number", None) or "").strip() or None

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
            "customer_account_number": customer_account_number,
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
            "scm_hold_request_status": getattr(ovf, "scm_hold_request_status", None),
            "scm_hold_request_remark": getattr(ovf, "scm_hold_request_remark", None),
            "scm_hold_requested_at": getattr(ovf, "scm_hold_requested_at", None),
            "scm_hold_requested_by": getattr(ovf, "scm_hold_requested_by", None),
            "scm_charge_request_status": getattr(ovf, "scm_charge_request_status", None),
            "scm_charge_request_freight": (
                float(ovf.scm_charge_request_freight)
                if getattr(ovf, "scm_charge_request_freight", None) is not None
                else None
            ),
            "scm_charge_request_finance_pct": (
                float(ovf.scm_charge_request_finance_pct)
                if getattr(ovf, "scm_charge_request_finance_pct", None) is not None
                else None
            ),
            "scm_charge_requested_at": getattr(ovf, "scm_charge_requested_at", None),
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
            "margin_pct": round(margin_pct, 10),
            "description": "; ".join(desc_parts) if desc_parts else None,
            "customer_po_number": ovf.po_number,
            "customer_po_date": self._resolve_customer_po_display_date(ctx, ovf),
            "customer_payment_days": int(ovf.customer_payment_days or 0),
            "vendor_payment_days": int(ovf.vendor_payment_days or 0),
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

    @staticmethod
    def _ovf_source_quotes(quotes: list[Any]) -> list[Any]:
        """Accepted quotes that carry fulfillable qty (exclude split parents)."""
        parent_ids = {
            q.parent_quote_id for q in quotes if getattr(q, "parent_quote_id", None)
        }
        sources = [
            q
            for q in quotes
            if q.quote_stage == "accepted" and q.id not in parent_ids
        ]
        return sorted(
            sources,
            key=lambda q: (str(getattr(q, "quote_no", "") or ""), str(q.id)),
        )

    # -- create ------------------------------------------------------------
    def create(self, ctx: TenantContext, *, quote_id: UUID, branch_id: UUID, **fields) -> CrmOvf:
        """Create the single OVF for an opportunity.

        Lines are merged from every accepted split quote (or the one accepted
        quote when the deal was not split). ``quote_id`` is the split-source
        (parent) when present so Quote No shows the source quote; otherwise the
        sole accepted quote.
        """
        quote = self._get_quote(ctx, quote_id)
        opp = self._get_opportunity(ctx, quote.opportunity_id)

        if opp.blueprint_state != "ovf_ready":
            raise ConflictException(
                f"Opportunity is in state '{opp.blueprint_state}'; OVF can only be "
                "created once it reaches 'ovf_ready' (customer PO approved)."
            )
        if not opp.customer_po_approved:
            raise ConflictException("OVF can only be created after the customer PO is approved")

        opp_quotes = self._quotes.list_quotes(ctx, opp.company_id, opportunity_id=opp.id)
        source_quotes = self._ovf_source_quotes(opp_quotes)
        if not source_quotes:
            raise ConflictException(
                "No accepted quote is available for OVF. Accept the customer quote "
                "(or its split quotes) first."
            )

        source_ids = {q.id for q in source_quotes}
        is_split_parent = any(
            getattr(q, "parent_quote_id", None) == quote.id for q in opp_quotes
        )
        if quote.id not in source_ids and not is_split_parent:
            if quote.quote_stage != "accepted":
                raise ConflictException(
                    f"Quote is in stage '{quote.quote_stage}'; OVF can only be created "
                    "from an accepted customer quote."
                )
            raise ConflictException(
                "This quote is not eligible for OVF. Use an accepted split quote "
                "or create the opportunity OVF from the deal."
            )

        existing = self._repo.list_ovfs(ctx, opp.company_id, opportunity_id=opp.id)
        if existing:
            raise ConflictException(
                "An OVF already exists for this opportunity. Open that OVF to continue."
            )
        sales_blueprint_engine.assert_not_locked(opp)

        # Prefer the split-source (parent) as the OVF's quote_id so Quote No
        # shows DR-…/Q1; lines still come from all accepted children.
        split_parent = next(
            (q for q in opp_quotes if any(getattr(c, "parent_quote_id", None) == q.id for c in opp_quotes)),
            None,
        )
        if is_split_parent:
            anchor = quote
        elif split_parent is not None:
            anchor = split_parent
        elif quote.id in source_ids:
            anchor = quote
        else:
            anchor = source_quotes[0]
        account = (
            self._companies.get(ctx, opp.company_account_id)
            if opp.company_account_id
            else None
        )
        fields.update(
            self._snapshot_fields_from_related(
                ctx,
                quote=anchor,
                opp=opp,
                account=account,
                current=fields,
            )
        )

        # Freight is SCM-owned (Ask SCM / post-share charges). Do not take Sales input.
        fields["freight"] = Decimal("0")
        margin_amount = sum(
            (Decimal(str(getattr(q, "total_margin_amount", 0) or 0)) for q in source_quotes),
            Decimal("0"),
        )
        if fields.get("total_margin_amount") is None:
            fields["total_margin_amount"] = margin_amount
        if fields.get("total_margin_pct") is None:
            # Prefer recompute from merged lines; seed from anchor until then.
            fields["total_margin_pct"] = getattr(anchor, "avg_margin_pct", None)
        vendor_days = int(fields.get("vendor_payment_days", 0) or 0)
        customer_days = int(fields.get("customer_payment_days", 0) or 0)
        fields["finance_cost_pct"] = margin_engine.compute_finance_cost_pct(
            vendor_days, customer_days
        )
        self._normalize_commercial_fields(fields)
        fields.update(self._delivery_fields(None, fields))

        code = self._numbers.generate_for_deal(
            CrmEntityType.OVF,
            opp.company_id,
            CrmOvf,
            "ovf_no",
            deal_number=getattr(opp, "deal_reg_number", None),
            tag="OVF",
        )
        approval_status = fields.pop("approval_status", None) or "not_required"
        if approval_status not in ("not_required", "pending", "approved", "rejected"):
            approval_status = "not_required"
        if "custom_fields" in fields:
            from modules.crm.service.crm_settings_service import CrmSettingsService

            effective = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
            fields["custom_fields"] = CrmSettingsService.sanitize_custom_fields(
                effective, "ovf", fields.get("custom_fields")
            )
        row = self._repo.create(
            ctx,
            company_id=opp.company_id,
            branch_id=opp.branch_id,
            ovf_no=code,
            quote_id=anchor.id,
            opportunity_id=opp.id,
            company_account_id=opp.company_account_id,
            approval_status=approval_status,
            blueprint_state="draft",
            **fields,
        )

        # Customer PO = split-source (parent) lines; Vendor = all accepted split
        # children (or the sole quote when never split). Quote No is tagged on
        # vendor descriptions as [quote:…] for round-trip without a schema column.
        customer_quotes = [anchor] if split_parent is not None or is_split_parent else source_quotes
        if not customer_quotes:
            customer_quotes = source_quotes
        vendor_quotes = source_quotes

        line_no = 1
        original_vendor_total = Decimal("0")
        for src in customer_quotes:
            for quote_line in self._quote_lines.list_for_quote(ctx, src.id):
                unit_price = quote_line.unit_sell
                self._lines.create(
                    ctx,
                    company_id=opp.company_id,
                    branch_id=opp.branch_id,
                    ovf_id=row.id,
                    side="customer_po",
                    line_no=line_no,
                    product_name=quote_line.product_name,
                    description=(quote_line.description or None),
                    qty=quote_line.qty,
                    unit_price=unit_price,
                    gst_pct=Decimal(str(quote_line.gst_pct or 18)),
                    line_total=(quote_line.qty * unit_price).quantize(Decimal("0.0001")),
                    source_line_id=quote_line.id,
                )
                line_no += 1

        vendor_line_no = 1
        for src in vendor_quotes:
            quote_tag = (getattr(src, "quote_no", None) or "").strip()
            for quote_line in self._quote_lines.list_for_quote(ctx, src.id):
                unit_price = quote_line.unit_cost
                desc = (quote_line.description or "").strip()
                if quote_tag:
                    desc = f"[quote:{quote_tag}] {desc}".strip() if desc else f"[quote:{quote_tag}]"
                self._lines.create(
                    ctx,
                    company_id=opp.company_id,
                    branch_id=opp.branch_id,
                    ovf_id=row.id,
                    side="vendor",
                    line_no=vendor_line_no,
                    product_name=quote_line.product_name,
                    description=desc or None,
                    qty=quote_line.qty,
                    unit_price=unit_price,
                    gst_pct=Decimal(str(quote_line.gst_pct or 18)),
                    line_total=(quote_line.qty * unit_price).quantize(Decimal("0.0001")),
                    source_line_id=quote_line.id,
                )
                original_vendor_total += (
                    Decimal(str(quote_line.qty)) * Decimal(str(quote_line.unit_cost))
                ).quantize(Decimal("0.0001"))
                vendor_line_no += 1

        row.original_vendor_total = original_vendor_total
        self._recompute_margin(ctx, row.id)

        from_opp_state = opp.blueprint_state or "ovf_ready"
        next_state = sales_blueprint_engine.transition("opportunity", from_opp_state, "create_ovf")
        self._opportunities.update(ctx, opp.id, blueprint_state=next_state)
        log_state_history(
            self._db, ctx, company_id=opp.company_id, branch_id=opp.branch_id,
            entity_type="opportunity", entity_id=opp.id,
            from_state=from_opp_state, to_state=next_state, action="create_ovf",
            remark=(
                f"OVF {code} created "
                f"(customer from {len(customer_quotes)} quote(s), "
                f"vendor from {len(vendor_quotes)} quote(s))"
            ),
        )
        return row

    def update(self, ctx: TenantContext, ovf_id: UUID, **fields) -> CrmOvf:
        ovf = self.get(ctx, ovf_id)
        sales_blueprint_engine.assert_not_locked(ovf)
        if ovf.deal_won or ovf.shared_to_scm:
            raise ConflictException("OVF cannot be edited after it is shared to SCM or marked Deal Won")

        # Freight is written only via Ask SCM / SCM charges — ignore Sales payload.
        fields.pop("freight", None)
        if "custom_fields" in fields:
            from modules.crm.service.crm_settings_service import CrmSettingsService

            effective = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
            fields["custom_fields"] = CrmSettingsService.sanitize_custom_fields(
                effective, "ovf", fields.get("custom_fields")
            )

        vendor_days = int(fields.get("vendor_payment_days", ovf.vendor_payment_days) or 0)
        customer_days = int(fields.get("customer_payment_days", ovf.customer_payment_days) or 0)
        fields["finance_cost_pct"] = margin_engine.compute_finance_cost_pct(
            vendor_days, customer_days
        )
        self._normalize_commercial_fields(fields)
        if any(k in fields for k in ("delivery_weeks_min", "delivery_weeks_max", "delivery_period", "po_date")):
            fields.update(self._delivery_fields(ovf, fields))

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
        if any(
            key in fields
            for key in (
                "freight",
                "vendor_payment_days",
                "customer_payment_days",
                "finance_cost_pct",
                "additional_charges",
                "early_payment_discount_pct",
            )
        ):
            if fields.get("total_margin_amount") is None and fields.get("total_margin_pct") is None:
                self._recompute_margin(ctx, ovf_id)
                row = self.get(ctx, ovf_id)
        return row

    @staticmethod
    def _normalize_commercial_fields(fields: dict[str, Any]) -> None:
        negotiated_by = fields.get("negotiated_by")
        if negotiated_by is not None:
            value = negotiated_by.strip().lower()
            if value and value not in NEGOTIATED_BY_OPTIONS:
                raise ConflictException(
                    f"Negotiated by must be one of {', '.join(NEGOTIATED_BY_OPTIONS)}"
                )
            fields["negotiated_by"] = value or None
            if value == "other" and not (fields.get("negotiation_remark") or "").strip():
                raise ConflictException("Add a remark saying who negotiated the price")
        discount = fields.get("early_payment_discount_pct")
        if discount is None:
            fields.pop("early_payment_discount_pct", None)
        else:
            value = Decimal(str(discount))
            if value < 0 or value > 100:
                raise ConflictException("Early payment discount must be between 0 and 100%")
            fields["early_payment_discount_pct"] = value

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
        """Planned margin (what Management approves); the live margin is derived from it."""
        ovf = self.get(ctx, ovf_id)
        lines = self._lines.list_for_ovf(ctx, ovf_id)
        customer_total = sum(
            (Decimal(str(ln.line_total)) for ln in lines if ln.side == "customer_po"),
            Decimal("0"),
        )
        # Supporting / service-visit lines count as additional charges, not purchase.
        vendor_total = Decimal("0")
        supporting_total = Decimal("0")
        service_total = Decimal("0")
        for ln in lines:
            if ln.side != "vendor":
                continue
            amount = Decimal(str(ln.line_total))
            if _is_supporting_charge_line(ln.description):
                supporting_total += amount
            elif _is_service_charge_line(ln.description, ln.product_name):
                service_total += amount
            else:
                vendor_total += amount
        charge_verticals = supporting_total + service_total
        additional = Decimal(str(ovf.additional_charges or 0))
        if charge_verticals > 0:
            # Prefer the live supporting + service sum when those lines exist.
            additional = charge_verticals
            if Decimal(str(ovf.additional_charges or 0)) != charge_verticals.quantize(
                Decimal("0.0001")
            ):
                self._repo.update(
                    ctx,
                    ovf_id,
                    additional_charges=charge_verticals.quantize(Decimal("0.0001")),
                )
                ovf = self.get(ctx, ovf_id)
        margin = margin_engine.compute_ovf_margin(
            customer_total=customer_total,
            vendor_total=vendor_total,
            freight=ovf.freight,
            additional_charges=additional,
            finance_cost_pct=ovf.finance_cost_pct,
            early_payment_discount_pct=ovf.early_payment_discount_pct,
        )
        self._repo.update(
            ctx, ovf_id, total_margin_amount=margin.margin_amount, total_margin_pct=margin.margin_pct
        )
        if ovf.margin_at_approval_amount is not None and ovf.closed_at is None:
            from modules.crm.service.ovf_finance_service import OvfFinanceService

            OvfFinanceService(self._db).refresh_live_margin(ctx, ovf_id)

    def _ovf_pdf_filename(self, ovf: CrmOvf) -> str:
        code = (ovf.ovf_no or "OVF").replace("/", "_").replace("\\", "_").strip() or "OVF"
        label = (ovf.customer_name or ovf.quote_name or "").strip()
        if label:
            safe = "".join(ch if ch.isalnum() or ch in {" ", "-", "_"} else " " for ch in label)
            safe = "_".join(safe.split())[:60]
            if safe:
                return f"OVF_{code}_{safe}.pdf"
        return f"OVF_{code}.pdf"

    def _ovf_email_attachments(
        self,
        ovf: CrmOvf,
        *,
        ovf_pdf_base64: str | None,
        ovf_pdf_filename: str | None,
    ) -> list[dict]:
        content = (ovf_pdf_base64 or "").strip()
        if not content:
            return []
        filename = (ovf_pdf_filename or "").strip() or self._ovf_pdf_filename(ovf)
        if not filename.lower().endswith(".pdf"):
            filename = f"{filename}.pdf"
        return [
            {
                "filename": filename,
                "content_base64": content,
                "content_type": "application/pdf",
            }
        ]

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
        ovf_pdf_base64: str | None = None,
        ovf_pdf_filename: str | None = None,
    ) -> CrmOvf:
        ovf = self.get(ctx, ovf_id)
        sales_blueprint_engine.assert_not_locked(ovf)
        if self._has_pending_freight_task(ctx, ovf):
            raise ConflictException(
                "Freight is still pending from SCM. Wait for My Jobs to complete before sending for approval."
            )
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
            email_attachments=self._ovf_email_attachments(
                ovf,
                ovf_pdf_base64=ovf_pdf_base64,
                ovf_pdf_filename=ovf_pdf_filename,
            )
            or None,
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
            self._repo.update(ctx, ovf_id, blueprint_state=next_state, approval_status="approved", locked=False)
            self._log(ctx, ovf, "approval", next_state, "approve", payload.get("remark"))
            from modules.crm.service.ovf_finance_service import OvfFinanceService

            OvfFinanceService(self._db).snapshot_margin_at_approval(ctx, ovf_id)
            # Saved + approved OVFs go straight to SCM - no manual share step.
            return self.share_to_scm(ctx, ovf_id)
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
        from modules.crm.service.crm_settings_service import CrmSettingsService

        ovf = self.get(ctx, ovf_id)
        if ovf.shared_to_scm:
            return ovf
        settings = CrmSettingsService(self._db).get_effective(ctx, require_erp_admin=False)
        if CrmSettingsService.policy_flag(
            settings, "share_to_scm_requires_approved_ovf", True
        ):
            status = (ovf.approval_status or "").strip().lower()
            state = (ovf.blueprint_state or "").strip().lower()
            if status not in {"approved", "auto_approved"} and state not in {
                "approved",
                "shared_scm",
            }:
                raise ConflictException(
                    "OVF must be approved before sharing to SCM "
                    "(CRM Settings → Policies → share to scm requires approved ovf)."
                )
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

    def request_scm_hold(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        remark: str,
    ) -> CrmOvf:
        """Queue a hold. The OVF stays open until a Hold approver accepts it."""
        ovf = self.get(ctx, ovf_id)
        if not ovf.shared_to_scm:
            raise ConflictException("OVF has not been shared to SCM")
        if bool(ovf.scm_on_hold):
            raise ConflictException("OVF is already on SCM hold")
        if (getattr(ovf, "scm_hold_request_status", None) or "") == "pending":
            raise ConflictException("A hold request is already waiting for approval")
        remark_text = (remark or "").strip()
        if not remark_text:
            raise ConflictException("Hold remark is required")
        now = datetime.now(timezone.utc)
        row = self._repo.update(
            ctx,
            ovf_id,
            scm_hold_request_status="pending",
            scm_hold_request_remark=remark_text,
            scm_hold_requested_at=now,
            scm_hold_requested_by=ctx.user_id,
        )
        self._log(ctx, ovf, ovf.blueprint_state, ovf.blueprint_state, "scm_hold_requested", remark_text)
        return row

    def decide_scm_hold(self, ctx: TenantContext, ovf_id: UUID, *, accept: bool) -> CrmOvf:
        """A Hold approver accepts (places on hold) or rejects a pending hold request."""
        ovf = self.get(ctx, ovf_id)
        if (getattr(ovf, "scm_hold_request_status", None) or "") != "pending":
            raise ConflictException("This OVF has no pending hold request")
        remark = (getattr(ovf, "scm_hold_request_remark", None) or "").strip()
        if accept:
            self.set_scm_on_hold(ctx, ovf_id, on_hold=True, remark=remark or "Approved hold")
            row = self._repo.update(ctx, ovf_id, scm_hold_request_status="accepted")
            self._log(ctx, ovf, ovf.blueprint_state, ovf.blueprint_state, "scm_hold_accepted", remark)
            return row
        row = self._repo.update(ctx, ovf_id, scm_hold_request_status="rejected")
        self._log(ctx, ovf, ovf.blueprint_state, ovf.blueprint_state, "scm_hold_rejected", remark)
        return row

    def list_scm_hold_requests(self, ctx: TenantContext) -> list[CrmOvf]:
        rows = self._repo.list_shared_to_scm(ctx, None)
        return [
            row
            for row in rows
            if (getattr(row, "scm_hold_request_status", None) or "") in {"pending", "accepted", "rejected"}
        ]

    def request_freight_from_scm(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        medium: str | None = None,
        weight_kg: Decimal | float | str | None = None,
        insurance: bool | None = None,
        remarks: str | None = None,
    ) -> CrmOvf:
        """Ask configured SCM step owners to provide freight via My Jobs.

        SCM gets what it needs to price the shipment: ship-to location, items and
        quantities, expected weight, medium (air/road/...) and whether to insure.
        OVF remains in ``draft`` until SCM submits freight (and Sales continues editing).
        """
        ovf = self.get(ctx, ovf_id)
        if ovf.deal_won:
            raise ConflictException("Cannot request freight after Deal Won")
        if ovf.blueprint_state not in {"draft", "approved", "shared_scm"}:
            raise ConflictException(
                f"Cannot request freight while OVF is in '{ovf.blueprint_state}'"
            )
        freight_fields: dict[str, Any] = {}
        if medium is not None:
            medium = medium.strip().lower()
            if medium not in FREIGHT_MEDIUMS:
                raise ConflictException(f"Freight medium must be one of {', '.join(FREIGHT_MEDIUMS)}")
            freight_fields["freight_medium"] = medium
        if weight_kg is not None:
            weight = Decimal(str(weight_kg))
            if weight < 0:
                raise ConflictException("Weight cannot be negative")
            freight_fields["freight_weight_kg"] = weight.quantize(Decimal("0.001"))
        if insurance is not None:
            freight_fields["freight_insurance"] = bool(insurance)
        if freight_fields:
            ovf = self._repo.update(ctx, ovf_id, **freight_fields) or ovf

        from modules.crm.service.approval_step_owner_service import ApprovalStepOwnerService
        from modules.crm.service.approval_task_service import ApprovalTaskService

        pending = ApprovalTaskService(self._db).list(
            ctx,
            company_id=ovf.company_id,
            status="pending",
            entity_type="ovf",
            entity_id=ovf.id,
        )
        if any(task.action == "provide_freight" for task in pending):
            raise ConflictException("A freight request is already pending for this OVF")

        owner_ids = ApprovalStepOwnerService(self._db).list_user_ids(ctx, "ovf_provide_freight")
        if not owner_ids:
            raise ConflictException(
                "No SCM freight step owners configured. Set them under CRM → Users → Default task owners."
            )

        ApprovalTaskService(self._db).route_approval(
            ctx,
            title=f"Provide freight for OVF {ovf.ovf_no}",
            entity_type="ovf",
            entity_id=ovf.id,
            team_role="scm",
            action="provide_freight",
            company_id=ovf.company_id,
            branch_id=ovf.branch_id,
            assigned_user_ids=owner_ids,
            remarks=self._freight_brief(ctx, ovf, remarks),
        )
        # Keep draft while waiting - Sales can still edit other fields.
        if ovf.blueprint_state == "draft":
            self._repo.update(ctx, ovf_id, blueprint_state="draft")
        self._log(ctx, ovf, ovf.blueprint_state, ovf.blueprint_state, "request_freight", None)
        return self.get(ctx, ovf_id)

    def request_supporting_items_from_ops(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        remarks: str | None = None,
    ) -> CrmOvf:
        """Ask Operations (project) step owners to add supporting items via My Jobs."""
        ovf = self.get(ctx, ovf_id)
        if ovf.deal_won:
            raise ConflictException("Cannot request supporting items after Deal Won")
        if ovf.blueprint_state not in {"draft", "approved", "shared_scm"}:
            raise ConflictException(
                f"Cannot request supporting items while OVF is in '{ovf.blueprint_state}'"
            )

        from modules.crm.service.approval_step_owner_service import ApprovalStepOwnerService
        from modules.crm.service.approval_task_service import ApprovalTaskService

        pending = ApprovalTaskService(self._db).list(
            ctx,
            company_id=ovf.company_id,
            status="pending",
            entity_type="ovf",
            entity_id=ovf.id,
        )
        if any(task.action == "provide_supporting_items" for task in pending):
            raise ConflictException("A supporting-items request is already pending for this OVF")

        owner_ids = ApprovalStepOwnerService(self._db).list_user_ids(
            ctx, "ovf_provide_supporting_items"
        )
        if not owner_ids:
            raise ConflictException(
                "No Operations supporting-items step owners configured. "
                "Set them under CRM → Users → Default task owners."
            )

        note = (remarks or "").strip()
        brief = (
            f"Sales requested supporting items (outside the main PO) for OVF {ovf.ovf_no}.\n"
            "Submit each item name, qty and distributor in My Jobs. SCM prices them separately."
            + (f"\nNote: {note}" if note else "")
        )
        ApprovalTaskService(self._db).route_approval(
            ctx,
            title=f"Provide supporting items for OVF {ovf.ovf_no}",
            entity_type="ovf",
            entity_id=ovf.id,
            team_role="project",
            action="provide_supporting_items",
            company_id=ovf.company_id,
            branch_id=ovf.branch_id,
            assigned_user_ids=owner_ids,
            remarks=brief,
        )
        self._log(
            ctx, ovf, ovf.blueprint_state, ovf.blueprint_state, "request_supporting_items", None
        )
        return self.get(ctx, ovf_id)

    def request_supporting_item_prices_from_scm(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        remarks: str | None = None,
    ) -> CrmOvf:
        """Ask SCM to price Ops-provided supporting items via My Jobs."""
        ovf = self.get(ctx, ovf_id)
        if ovf.deal_won:
            raise ConflictException("Cannot request supporting item prices after Deal Won")
        if ovf.blueprint_state not in {"draft", "approved", "shared_scm"}:
            raise ConflictException(
                f"Cannot request supporting item prices while OVF is in '{ovf.blueprint_state}'"
            )

        supporting = [
            ln
            for ln in self._lines.list_for_ovf(ctx, ovf.id)
            if ln.side == "vendor"
            and str(ln.description or "").strip().startswith("[supporting]")
        ]
        if not supporting:
            raise ConflictException(
                "Add supporting items first (Ask Operations), then request SCM pricing."
            )

        from modules.crm.service.approval_step_owner_service import ApprovalStepOwnerService
        from modules.crm.service.approval_task_service import ApprovalTaskService

        pending = ApprovalTaskService(self._db).list(
            ctx,
            company_id=ovf.company_id,
            status="pending",
            entity_type="ovf",
            entity_id=ovf.id,
        )
        if any(task.action == "price_supporting_items" for task in pending):
            raise ConflictException(
                "A supporting-items pricing request is already pending for this OVF"
            )

        owner_ids = ApprovalStepOwnerService(self._db).list_user_ids(
            ctx, "ovf_price_supporting_items"
        )
        if not owner_ids:
            # Fall back to freight SCM owners when pricing owners are not configured yet.
            owner_ids = ApprovalStepOwnerService(self._db).list_user_ids(
                ctx, "ovf_provide_freight"
            )
        if not owner_ids:
            raise ConflictException(
                "No SCM supporting-item pricing owners configured. "
                "Set them under CRM → Users → Default task owners "
                "(OVF — Price supporting items, or OVF — Provide freight)."
            )

        note = (remarks or "").strip()
        lines_brief = "\n".join(
            f"- {ln.product_name} × {Decimal(str(ln.qty)).normalize():f}"
            + (f" ({ln.distributor_name})" if ln.distributor_name else "")
            for ln in supporting
        )
        brief = (
            f"Sales requested unit purchase prices for supporting items on OVF {ovf.ovf_no}.\n"
            f"{lines_brief}\n"
            "Enter unit purchase (₹) for each item in My Jobs."
            + (f"\nNote: {note}" if note else "")
        )
        ApprovalTaskService(self._db).route_approval(
            ctx,
            title=f"Price supporting items for OVF {ovf.ovf_no}",
            entity_type="ovf",
            entity_id=ovf.id,
            team_role="scm",
            action="price_supporting_items",
            company_id=ovf.company_id,
            branch_id=ovf.branch_id,
            assigned_user_ids=owner_ids,
            remarks=brief,
        )
        self._log(
            ctx,
            ovf,
            ovf.blueprint_state,
            ovf.blueprint_state,
            "request_supporting_item_prices",
            f"items={len(supporting)}",
        )
        return self.get(ctx, ovf_id)

    def request_service_visits_from_ops(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        remarks: str | None = None,
    ) -> CrmOvf:
        """Ask Operations step owners to set up a service visit plan via My Jobs."""
        ovf = self.get(ctx, ovf_id)
        if ovf.deal_won:
            raise ConflictException("Cannot request service visits after Deal Won")
        if ovf.blueprint_state not in {"draft", "approved", "shared_scm"}:
            raise ConflictException(
                f"Cannot request service visits while OVF is in '{ovf.blueprint_state}'"
            )

        from modules.crm.service.approval_step_owner_service import ApprovalStepOwnerService
        from modules.crm.service.approval_task_service import ApprovalTaskService
        from modules.procurement.service.service_contract_service import ServiceContractService

        pending = ApprovalTaskService(self._db).list(
            ctx,
            company_id=ovf.company_id,
            status="pending",
            entity_type="ovf",
            entity_id=ovf.id,
        )
        if any(task.action == "provide_service_visits" for task in pending):
            raise ConflictException("A service-visits request is already pending for this OVF")

        existing_plans = ServiceContractService(self._db).list_plans(ctx, ovf_id=ovf_id)
        if existing_plans:
            raise ConflictException(
                "A service visit plan already exists for this OVF. "
                "Ask Operations again only after the existing plan is removed."
            )

        owner_ids = ApprovalStepOwnerService(self._db).list_user_ids(
            ctx, "ovf_provide_service_visits"
        )
        if not owner_ids:
            raise ConflictException(
                "No Operations service-visits step owners configured. "
                "Set them under CRM → Users → Default task owners."
            )

        note = (remarks or "").strip()
        brief = (
            f"Sales requested service visit planning for OVF {ovf.ovf_no}.\n"
            "Pick a rate contract, projected visits and consumables in My Jobs. "
            "Planned cost is added to Additional Charges on the OVF."
            + (f"\nNote: {note}" if note else "")
        )
        ApprovalTaskService(self._db).route_approval(
            ctx,
            title=f"Provide service visits for OVF {ovf.ovf_no}",
            entity_type="ovf",
            entity_id=ovf.id,
            team_role="project",
            action="provide_service_visits",
            company_id=ovf.company_id,
            branch_id=ovf.branch_id,
            assigned_user_ids=owner_ids,
            remarks=brief,
        )
        self._log(
            ctx, ovf, ovf.blueprint_state, ovf.blueprint_state, "request_service_visits", None
        )
        return self.get(ctx, ovf_id)

    def apply_service_plan_from_ops(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        plan: dict[str, Any],
    ) -> CrmOvf:
        """Create a service plan from a completed My Jobs Ops task (cost → additional charges)."""
        ovf = self.get(ctx, ovf_id)
        rate_contract_id = plan.get("rate_contract_id")
        if rate_contract_id is None:
            raise ConflictException("Rate contract is required")
        projected = int(plan.get("projected_visits") or 0)
        if projected <= 0:
            raise ConflictException("Projected visits must be greater than zero")
        consumables = Decimal(str(plan.get("consumables_amount") or 0))
        description = plan.get("description")
        if isinstance(description, str):
            description = description.strip() or None

        from modules.procurement.service.service_contract_service import ServiceContractService

        ServiceContractService(self._db).create_plan(
            ctx,
            ovf_id=ovf_id,
            rate_contract_id=UUID(str(rate_contract_id)),
            projected_visits=projected,
            consumables_amount=consumables,
            description=description,
            add_to_ovf=True,
        )
        self._log(
            ctx,
            ovf,
            ovf.blueprint_state,
            ovf.blueprint_state,
            "ops_provide_service_visits",
            f"visits={projected}",
        )
        return self.get(ctx, ovf_id)

    def apply_supporting_items_from_ops(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        items: list[dict[str, Any]],
    ) -> CrmOvf:
        """Write supporting vendor lines from a completed My Jobs Ops task."""
        ovf = self.get(ctx, ovf_id)
        if not items:
            raise ConflictException("Add at least one supporting item")
        created = 0
        for raw in items:
            name = str(raw.get("product_name") or "").strip()
            qty = Decimal(str(raw.get("qty") or 0))
            unit_price = Decimal(str(raw.get("unit_price") or 0))
            if not name or qty <= 0:
                raise ConflictException("Each supporting item needs a name and qty greater than zero")
            if unit_price < 0:
                raise ConflictException("Unit price cannot be negative")
            distributor = (raw.get("distributor_name") or None)
            if isinstance(distributor, str):
                distributor = distributor.strip() or None
            description = raw.get("description")
            if isinstance(description, str):
                description = description.strip() or None
            # Tag without a schema column so the create-OVF form can show these
            # in a separate Supporting Items table.
            tagged = (
                f"[supporting] {description}" if description else "[supporting]"
            )
            self.add_line(
                ctx,
                ovf_id,
                side="vendor",
                product_name=name,
                description=tagged,
                distributor_name=distributor,
                qty=qty,
                unit_price=unit_price,
            )
            created += 1
        self._log(
            ctx,
            ovf,
            ovf.blueprint_state,
            ovf.blueprint_state,
            "ops_provide_supporting_items",
            f"items={created}",
        )
        return self.get(ctx, ovf_id)

    def apply_supporting_item_prices_from_scm(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        items: list[dict[str, Any]],
    ) -> CrmOvf:
        """Update unit purchase on existing supporting lines from an SCM My Jobs task."""
        ovf = self.get(ctx, ovf_id)
        if not items:
            raise ConflictException("Price at least one supporting item")

        supporting = [
            ln
            for ln in self._lines.list_for_ovf(ctx, ovf.id)
            if ln.side == "vendor"
            and str(ln.description or "").strip().startswith("[supporting]")
        ]
        by_id = {str(ln.id): ln for ln in supporting}
        by_name = {(ln.product_name or "").strip().lower(): ln for ln in supporting}
        updated = 0
        for raw in items:
            line_id = str(raw.get("line_id") or "").strip()
            name = str(raw.get("product_name") or "").strip()
            unit_price = Decimal(str(raw.get("unit_price") or 0))
            if unit_price < 0:
                raise ConflictException("Unit price cannot be negative")
            line = by_id.get(line_id) if line_id else None
            if line is None and name:
                line = by_name.get(name.lower())
            if line is None:
                raise ConflictException(
                    f"Supporting item not found for pricing: {name or line_id or 'unknown'}"
                )
            self.update_line(ctx, line.id, unit_price=unit_price)
            updated += 1

        self._log(
            ctx,
            ovf,
            ovf.blueprint_state,
            ovf.blueprint_state,
            "scm_price_supporting_items",
            f"items={updated}",
        )
        return self.get(ctx, ovf_id)

    def _freight_brief(self, ctx: TenantContext, ovf: CrmOvf, remarks: str | None) -> str:
        items = [
            f"{ln.product_name} x {Decimal(str(ln.qty)).normalize():f}"
            for ln in self._lines.list_for_ovf(ctx, ovf.id)
            if ln.side == "customer_po"
        ]
        ship_to = ", ".join(
            part for part in (ovf.shipping_address, ovf.shipping_state, ovf.shipping_country) if part
        )
        parts = [
            "Sales requested freight charges.",
            f"Ship to: {ship_to or 'not captured on OVF'}",
            f"Items: {'; '.join(items) or 'no customer lines'}",
            "Choose medium, weight and insurance when submitting the freight amount.",
        ]
        note = (remarks or "").strip()
        if note:
            parts.append(f"Note: {note}")
        return "\n".join(parts)

    # -- delivery timeline -------------------------------------------------
    def _delivery_fields(self, ovf: CrmOvf | None, fields: dict[str, Any]) -> dict[str, Any]:
        """Derive weeks range + expected delivery date from the committed lead time."""
        weeks_min = fields.get("delivery_weeks_min", getattr(ovf, "delivery_weeks_min", None))
        weeks_max = fields.get("delivery_weeks_max", getattr(ovf, "delivery_weeks_max", None))
        if weeks_min is None and weeks_max is None and fields.get("delivery_period"):
            parsed = delivery_timeline.parse_delivery_weeks(fields["delivery_period"])
            if parsed is not None:
                weeks_min, weeks_max = parsed
        if weeks_min is None and weeks_max is None:
            return {}
        weeks_min = int(weeks_min if weeks_min is not None else weeks_max)
        weeks_max = int(weeks_max if weeks_max is not None else weeks_min)
        if weeks_min <= 0 or weeks_max <= 0:
            raise ConflictException("Delivery weeks must be greater than zero")
        if weeks_min > weeks_max:
            raise ConflictException("Delivery 'from' weeks cannot be more than 'to' weeks")
        start = fields.get("po_date", getattr(ovf, "po_date", None)) or date.today()
        label = f"{weeks_min} weeks" if weeks_min == weeks_max else f"{weeks_min}-{weeks_max} weeks"
        derived = {
            "delivery_weeks_min": weeks_min,
            "delivery_weeks_max": weeks_max,
            "delivery_period": label,
        }
        # SCM-revised dates win over the recomputed commitment.
        if not (ovf is not None and ovf.delivery_date_history):
            derived["expected_delivery_date"] = delivery_timeline.expected_delivery_date(start, weeks_max)
        return derived

    def update_delivery_dates(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        expected_delivery_date: date | None = None,
        actual_delivery_date: date | None = None,
        reason: str | None = None,
    ) -> CrmOvf:
        """SCM revises the expected date (with a reason) or records the actual delivery."""
        ovf = self.get(ctx, ovf_id)
        if not ovf.shared_to_scm:
            raise ConflictException("Delivery dates are managed by SCM after the OVF is shared")
        fields: dict[str, Any] = {}
        history = list(ovf.delivery_date_history or [])
        if expected_delivery_date is not None and expected_delivery_date != ovf.expected_delivery_date:
            text = (reason or "").strip()
            if not text:
                raise ConflictException("Give a reason for changing the expected delivery date")
            history.append(
                {
                    "from": ovf.expected_delivery_date.isoformat() if ovf.expected_delivery_date else None,
                    "to": expected_delivery_date.isoformat(),
                    "reason": text,
                    "changed_by": str(ctx.user_id) if ctx.user_id else None,
                    "changed_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            fields["expected_delivery_date"] = expected_delivery_date
            fields["delivery_date_history"] = history
        if actual_delivery_date is not None:
            fields["actual_delivery_date"] = actual_delivery_date
        if not fields:
            return ovf
        row = self._repo.update(ctx, ovf_id, **fields)
        self._log(
            ctx,
            ovf,
            ovf.blueprint_state,
            ovf.blueprint_state,
            "delivery_date_updated",
            (reason or "").strip() or None,
        )
        if "expected_delivery_date" in fields:
            self._notify_owner_delivery_change(ctx, ovf, expected_delivery_date, reason)
        return row

    def _notify_owner_delivery_change(
        self, ctx: TenantContext, ovf: CrmOvf, new_date: date | None, reason: str | None
    ) -> None:
        from modules.crm.service.crm_notification_service import notify_crm_user, resolve_employee_user_id

        opp = self._opportunities.get(ctx, ovf.opportunity_id)
        user_id = resolve_employee_user_id(self._db, ctx.tenant_id, opp.owner_employee_id if opp else None)
        if user_id is None:
            return
        notify_crm_user(
            self._db,
            tenant_id=ctx.tenant_id,
            recipient_user_id=user_id,
            event_type="crm.ovf.delivery_date_changed",
            title=f"Delivery date changed - OVF {ovf.ovf_no}",
            body=(
                f"SCM moved the expected delivery for OVF {ovf.ovf_no} "
                f"to {new_date.isoformat() if new_date else '-'}. Reason: {(reason or '').strip() or '-'}"
            ),
            entity_type="ovf",
            entity_id=ovf.id,
            href=f"/crm/ovf/{ovf.id}",
            created_by=ctx.user_id,
        )

    # -- vendor PO summary break ----------------------------------------------
    def split_vendor_line(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        customer_line_id: UUID,
        splits: Sequence[dict[str, Any]],
    ) -> list[CrmOvfLine]:
        """Break one customer PO line across several distributors (e.g. 80 + 20).

        Replaces the vendor lines currently mirroring that customer line.
        Extra supporting items (cables, SFPs) are still added as normal vendor rows.
        """
        ovf = self.get(ctx, ovf_id)
        sales_blueprint_engine.assert_not_locked(ovf)
        if ovf.shared_to_scm or ovf.deal_won:
            raise ConflictException("Vendor lines cannot be changed after the OVF is shared to SCM")
        lines = self._lines.list_for_ovf(ctx, ovf_id)
        customer_line = next(
            (ln for ln in lines if ln.id == customer_line_id and ln.side == "customer_po"), None
        )
        if customer_line is None:
            raise NotFoundException("Customer PO line not found on this OVF")
        if not splits:
            raise ConflictException("Add at least one distributor split")
        total_qty = Decimal("0")
        for split in splits:
            qty = Decimal(str(split.get("qty") or 0))
            if qty <= 0:
                raise ConflictException("Each split needs a quantity greater than zero")
            if Decimal(str(split.get("unit_price") or 0)) < 0:
                raise ConflictException("Unit price cannot be negative")
            if not (split.get("distributor_name") or "").strip():
                raise ConflictException("Each split needs a distributor")
            total_qty += qty
        if total_qty - Decimal(str(customer_line.qty)) > Decimal("0.0001"):
            raise ConflictException(
                f"Split quantity {total_qty.normalize():f} exceeds the customer PO quantity "
                f"{Decimal(str(customer_line.qty)).normalize():f} for {customer_line.product_name}"
            )

        for ln in lines:
            if ln.side != "vendor":
                continue
            mirrors_default = (
                ln.source_line_id is None
                and ln.line_no == customer_line.line_no
                and (ln.product_name or "").strip().lower() == (customer_line.product_name or "").strip().lower()
            )
            if ln.source_line_id == customer_line.id or mirrors_default:
                self._lines.soft_delete(ctx, ln)

        created: list[CrmOvfLine] = []
        for split in splits:
            qty = Decimal(str(split["qty"]))
            unit_price = Decimal(str(split.get("unit_price") or 0))
            created.append(
                self._lines.create(
                    ctx,
                    company_id=ovf.company_id,
                    branch_id=ovf.branch_id,
                    ovf_id=ovf.id,
                    side="vendor",
                    line_no=customer_line.line_no,
                    product_name=customer_line.product_name,
                    description=split.get("description") or customer_line.description,
                    distributor_name=split["distributor_name"].strip(),
                    contact_person=split.get("contact_person"),
                    contact_number=split.get("contact_number"),
                    qty=qty,
                    unit_price=unit_price,
                    gst_pct=Decimal(str(split.get("gst_pct") or customer_line.gst_pct or 18)),
                    line_total=(qty * unit_price).quantize(Decimal("0.0001")),
                    source_line_id=customer_line.id,
                )
            )
        self._recompute_margin(ctx, ovf_id)
        return created

    def delete_line(self, ctx: TenantContext, line_id: UUID) -> None:
        line = self._lines.get(ctx, line_id)
        if line is None:
            raise NotFoundException("OVF line not found")
        ovf = self.get(ctx, line.ovf_id)
        sales_blueprint_engine.assert_not_locked(ovf)
        if ovf.shared_to_scm or ovf.deal_won:
            raise ConflictException("OVF lines cannot be removed after the OVF is shared to SCM")
        self._lines.soft_delete(ctx, line)
        self._recompute_margin(ctx, ovf.id)

    def _has_pending_freight_task(self, ctx: TenantContext, ovf: CrmOvf) -> bool:
        from modules.crm.service.approval_task_service import ApprovalTaskService

        pending = ApprovalTaskService(self._db).list(
            ctx,
            company_id=ovf.company_id,
            status="pending",
            entity_type="ovf",
            entity_id=ovf.id,
        )
        return any(task.action == "provide_freight" for task in pending)

    def apply_freight_from_scm(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        freight: Decimal | float | str | None,
        medium: str | None = None,
        weight_kg: Decimal | float | str | None = None,
        insurance: bool | None = None,
    ) -> CrmOvf:
        """Write freight from a completed My Jobs provide_freight task (pre- or post-share)."""
        ovf = self.get(ctx, ovf_id)
        if freight is None:
            raise ConflictException("Freight amount is required")
        value = Decimal(str(freight))
        if value < 0:
            raise ConflictException("Freight cannot be negative")
        fields: dict[str, Any] = {"freight": value.quantize(Decimal("0.0001"))}
        if medium is not None:
            medium_norm = medium.strip().lower()
            if medium_norm not in FREIGHT_MEDIUMS:
                raise ConflictException(f"Freight medium must be one of {', '.join(FREIGHT_MEDIUMS)}")
            fields["freight_medium"] = medium_norm
        if weight_kg is not None and str(weight_kg).strip() != "":
            weight = Decimal(str(weight_kg))
            if weight < 0:
                raise ConflictException("Weight cannot be negative")
            fields["freight_weight_kg"] = weight.quantize(Decimal("0.001"))
        if insurance is not None:
            fields["freight_insurance"] = bool(insurance)
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
            "scm_provide_freight",
            f"freight={row.freight}",
        )
        return row

    def request_scm_charge_change(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        freight: Decimal | float | str,
        finance_cost_pct: Decimal | float | str,
    ) -> CrmOvf:
        """Queue freight and finance. Live values stay until a Freight approver accepts."""
        ovf = self.get(ctx, ovf_id)
        if not ovf.shared_to_scm:
            raise ConflictException("OVF has not been shared to SCM")
        if bool(getattr(ovf, "scm_on_hold", False)):
            raise ConflictException(
                "Freight and finance cannot be changed while the OVF is on SCM hold. Unhold first."
            )
        next_freight = Decimal(str(freight))
        next_finance = Decimal(str(finance_cost_pct))
        if next_freight < 0:
            raise ConflictException("Freight cannot be negative")
        if next_finance < 0:
            raise ConflictException("Finance cost % cannot be negative")
        next_freight = next_freight.quantize(Decimal("0.0001"))
        next_finance = next_finance.quantize(Decimal("0.001"))
        current_freight = Decimal(str(ovf.freight or 0)).quantize(Decimal("0.0001"))
        current_finance = Decimal(str(ovf.finance_cost_pct or 0)).quantize(Decimal("0.001"))
        if next_freight == current_freight and next_finance == current_finance:
            raise ConflictException("Freight and finance are already these values")
        now = datetime.now(timezone.utc)
        row = self._repo.update(
            ctx,
            ovf_id,
            scm_charge_request_status="pending",
            scm_charge_request_freight=next_freight,
            scm_charge_request_finance_pct=next_finance,
            scm_charge_requested_at=now,
            scm_charge_requested_by=ctx.user_id,
        )
        self._log(
            ctx,
            ovf,
            ovf.blueprint_state,
            ovf.blueprint_state,
            "scm_charge_change_requested",
            f"freight={next_freight}; finance_cost_pct={next_finance}",
        )
        return row

    def decide_scm_charge_change(self, ctx: TenantContext, ovf_id: UUID, *, accept: bool) -> CrmOvf:
        """Accept applies the queued freight and finance. Reject leaves the live values."""
        ovf = self.get(ctx, ovf_id)
        if (getattr(ovf, "scm_charge_request_status", None) or "") != "pending":
            raise ConflictException("This OVF has no pending freight and finance request")
        if not accept:
            row = self._repo.update(ctx, ovf_id, scm_charge_request_status="rejected")
            self._log(
                ctx,
                ovf,
                ovf.blueprint_state,
                ovf.blueprint_state,
                "scm_charge_change_rejected",
                None,
            )
            return row
        freight = getattr(ovf, "scm_charge_request_freight", None)
        finance = getattr(ovf, "scm_charge_request_finance_pct", None)
        if freight is None or finance is None:
            raise ConflictException("The freight and finance request is incomplete")
        # Apply live values; then mark accepted (overrides any notified flag from update).
        self.update_scm_charges(
            ctx,
            ovf_id,
            freight=freight,
            additional_charges=ovf.additional_charges,
            finance_cost_pct=finance,
        )
        row = self._repo.update(ctx, ovf_id, scm_charge_request_status="accepted")
        self._log(
            ctx,
            ovf,
            ovf.blueprint_state,
            ovf.blueprint_state,
            "scm_charge_change_accepted",
            f"freight={freight}; finance_cost_pct={finance}",
        )
        return row

    def list_scm_charge_requests(self, ctx: TenantContext) -> list[CrmOvf]:
        rows = self._repo.list_shared_to_scm(ctx, None)
        return [
            row
            for row in rows
            if (getattr(row, "scm_charge_request_status", None) or "")
            in {"pending", "accepted", "rejected", "notified"}
        ]

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

        previous_freight = Decimal(str(ovf.freight or 0)).quantize(Decimal("0.0001"))
        freight_changed = (
            "freight" in fields and fields["freight"] != previous_freight
        )

        row = self._repo.update(ctx, ovf_id, **fields)
        if row is None:
            raise NotFoundException("OVF not found")
        self._recompute_margin(ctx, ovf_id)

        # Informational Approvals inbox row (status=notified). No Accept/Reject.
        if freight_changed:
            self._repo.update(
                ctx,
                ovf_id,
                scm_charge_request_status="notified",
                scm_charge_request_freight=fields["freight"],
                scm_charge_request_finance_pct=Decimal(
                    str(
                        fields.get(
                            "finance_cost_pct",
                            ovf.finance_cost_pct or 0,
                        )
                    )
                ),
                scm_charge_requested_at=datetime.now(timezone.utc),
                scm_charge_requested_by=ctx.user_id,
            )

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

    # -- SCM savings visibility -------------------------------------------
    def can_view_scm_savings(self, ctx: TenantContext) -> bool:
        """Supply-chain savings are visible to Management/SCM, never to Sales."""
        from modules.foundation.repository.user_module_repository import UserModuleRepository

        if self._crm_admin.is_admin(ctx):
            return True
        if ctx.user_id is None:
            return False
        return ctx.user_id in UserModuleRepository(self._db).list_user_ids_for_module(
            ctx.tenant_id, "procurement"
        )

    def get_scm_savings(self, ctx: TenantContext, ovf_id: UUID) -> dict[str, Any]:
        if not self.can_view_scm_savings(ctx):
            raise ForbiddenException(
                "Supply-chain negotiation savings are visible to Management and Supply Chain only"
            )
        ovf = self.get(ctx, ovf_id)
        return {
            "ovf_id": ovf.id,
            "ovf_no": ovf.ovf_no,
            "scm_savings_amount": Decimal(str(ovf.scm_savings_amount or 0)),
            "scm_negotiated_vendor_total": ovf.scm_negotiated_vendor_total,
        }

    # -- invoice routing + AR follow-up -----------------------------------
    def _invoice_line_mix(self, ctx: TenantContext, ovf: CrmOvf) -> tuple[int, int]:
        """(hsn_line_count, sac_line_count) from the source quote lines."""
        hsn = sac = 0
        for line in self._quote_lines.list_for_quote(ctx, ovf.quote_id):
            kind = classify_hsn_sac(getattr(line, "hsn_sac", None))
            if kind == "sac":
                sac += 1
            elif kind == "hsn":
                hsn += 1
        return hsn, sac

    @staticmethod
    def _invoice_channel(hsn_count: int, sac_count: int) -> str | None:
        if hsn_count and sac_count:
            return "mixed"
        if sac_count:
            return "portal"
        if hsn_count:
            return "physical"
        return None

    def get_invoice_status(self, ctx: TenantContext, ovf_id: UUID) -> dict[str, Any]:
        """Invoice routing (HSN vs SAC) plus the payment follow-up state."""
        ovf = self.get(ctx, ovf_id)
        hsn_count, sac_count = self._invoice_line_mix(ctx, ovf)
        channel = ovf.invoice_channel or self._invoice_channel(hsn_count, sac_count)

        today = date.today()
        delay_days = 0
        if ovf.payment_received_date and ovf.payment_due_date:
            delay_days = max((ovf.payment_received_date - ovf.payment_due_date).days, 0)
        elif ovf.payment_due_date and ovf.payment_received_date is None:
            delay_days = max((today - ovf.payment_due_date).days, 0)

        if ovf.payment_received_date is not None:
            payment_status = "delayed" if delay_days else "received"
        elif not ovf.invoice_submitted_at:
            payment_status = "not_invoiced"
        elif ovf.payment_due_date and today > ovf.payment_due_date:
            payment_status = "overdue"
        else:
            payment_status = "awaiting_payment"

        return {
            "ovf_id": ovf.id,
            "ovf_no": ovf.ovf_no,
            "customer_name": ovf.customer_name,
            "invoice_channel": channel,
            "portal_submission_required": channel in {"portal", "mixed"},
            "physical_delivery_invoice": channel in {"physical", "mixed"},
            "hsn_line_count": hsn_count,
            "sac_line_count": sac_count,
            "invoice_submitted_portal": bool(ovf.invoice_submitted_portal),
            "invoice_submitted_at": ovf.invoice_submitted_at,
            "invoice_reference": ovf.invoice_reference,
            "payment_due_date": ovf.payment_due_date,
            "payment_received_date": ovf.payment_received_date,
            "payment_delay_reason": ovf.payment_delay_reason,
            "payment_delay_days": delay_days,
            "payment_status": payment_status,
        }

    def record_invoice_submission(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        invoice_reference: str | None = None,
        submitted_on_portal: bool = True,
        payment_due_date: date | None = None,
    ) -> dict[str, Any]:
        """Log who submitted the customer invoice and when (portal or physical)."""
        ovf = self.get(ctx, ovf_id)
        hsn_count, sac_count = self._invoice_line_mix(ctx, ovf)
        channel = self._invoice_channel(hsn_count, sac_count)

        due = payment_due_date
        if due is None and ovf.payment_due_date is None:
            terms_days = int(ovf.customer_payment_days or 0)
            if terms_days > 0:
                due = date.today() + timedelta(days=terms_days)

        fields: dict[str, Any] = {
            "invoice_submitted_portal": bool(submitted_on_portal),
            "invoice_submitted_at": datetime.now(timezone.utc),
            "invoice_submitted_by": ctx.user_id,
        }
        if channel is not None:
            fields["invoice_channel"] = channel
        if invoice_reference is not None:
            fields["invoice_reference"] = invoice_reference.strip() or None
        if due is not None:
            fields["payment_due_date"] = due

        if self._repo.update(ctx, ovf_id, **fields) is None:
            raise NotFoundException("OVF not found")
        self._log(
            ctx,
            ovf,
            ovf.blueprint_state,
            ovf.blueprint_state,
            "invoice_submitted",
            f"channel={channel or 'unknown'}, portal={bool(submitted_on_portal)}",
        )
        return self.get_invoice_status(ctx, ovf_id)

    def update_payment(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        payment_received_date: date | None = None,
        payment_due_date: date | None = None,
        payment_delay_reason: str | None = None,
    ) -> dict[str, Any]:
        """Accounts Receivable follow-up. A late payment needs a reason on record."""
        ovf = self.get(ctx, ovf_id)
        fields: dict[str, Any] = {}
        if payment_due_date is not None:
            fields["payment_due_date"] = payment_due_date
        if payment_received_date is not None:
            fields["payment_received_date"] = payment_received_date
        if payment_delay_reason is not None:
            fields["payment_delay_reason"] = payment_delay_reason.strip() or None

        due = fields.get("payment_due_date", ovf.payment_due_date)
        received = fields.get("payment_received_date", ovf.payment_received_date)
        reason = fields.get("payment_delay_reason", ovf.payment_delay_reason)
        if received is not None and due is not None and received > due and not reason:
            raise ConflictException(
                "Payment landed after the due date - record why before closing it off"
            )

        if not fields:
            return self.get_invoice_status(ctx, ovf_id)
        if self._repo.update(ctx, ovf_id, **fields) is None:
            raise NotFoundException("OVF not found")
        if ovf.margin_at_approval_amount is not None and ovf.closed_at is None:
            from modules.crm.service.ovf_finance_service import OvfFinanceService

            OvfFinanceService(self._db).refresh_live_margin(ctx, ovf_id)
        return self.get_invoice_status(ctx, ovf_id)

    def record_scm_savings(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        savings_amount: Decimal | float | str,
        negotiated_vendor_total: Decimal | float | str | None = None,
    ) -> CrmOvf:
        """Store the supply-chain negotiation savings against the OVF.

        The saving belongs to Supply Chain, not to the sales incentive, so it is
        stripped from every Sales-facing OVF payload (see ``can_view_scm_savings``).
        """
        ovf = self.get(ctx, ovf_id)
        if not ovf.shared_to_scm:
            raise ConflictException("OVF has not been shared to SCM")
        amount = Decimal(str(savings_amount)).quantize(Decimal("0.0001"))
        if amount < 0:
            raise ConflictException("Negotiation savings cannot be negative")
        fields: dict[str, Any] = {"scm_savings_amount": amount}
        if negotiated_vendor_total is not None:
            fields["scm_negotiated_vendor_total"] = Decimal(
                str(negotiated_vendor_total)
            ).quantize(Decimal("0.0001"))
        row = self._repo.update(ctx, ovf_id, **fields)
        if row is None:
            raise NotFoundException("OVF not found")
        self._log(
            ctx,
            ovf,
            ovf.blueprint_state,
            ovf.blueprint_state,
            "scm_record_savings",
            f"scm_savings_amount={amount}",
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
        """SCM item-plan vendor selection - updates CRM vendor line distributor_name.

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
        already_won = str(opp.status or "").lower() == "won" or from_opp_state == "won"
        # Deal is won at quote acceptance; OVF deal_won closes fulfilment blueprint.
        if from_opp_state == "won":
            opp_next_state = "won"
        elif from_opp_state == "ovf_ready":
            opp_next_state = sales_blueprint_engine.transition(
                "opportunity", from_opp_state, "deal_won"
            )
        else:
            raise ConflictException(
                f"Cannot close OVF deal won while opportunity is in '{from_opp_state}'"
            )

        self._opportunities.update(
            ctx,
            opp.id,
            blueprint_state=opp_next_state,
            status="won",
            current_stage="won",
            probability_percent=100,
            deal_won_amount=amount,
            forecast_amount=amount,
            won_at=opp.won_at or datetime.now(timezone.utc),
        )
        log_state_history(
            self._db, ctx, company_id=opp.company_id, branch_id=opp.branch_id,
            entity_type="opportunity", entity_id=opp.id,
            from_state=from_opp_state, to_state=opp_next_state, action="deal_won",
            remark=f"OVF {ovf.ovf_no} fulfilment closed at {amount}",
        )
        if not already_won:
            self._notify_deal_won_emails(ctx, opp, amount)
        return row

    def _notify_deal_won_emails(self, ctx: TenantContext, opp, amount) -> None:
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

    def _log(self, ctx: TenantContext, ovf: CrmOvf, from_state: str, to_state: str, action: str, remark: str | None) -> None:
        log_state_history(
            self._db, ctx, company_id=ovf.company_id, branch_id=ovf.branch_id,
            entity_type="ovf", entity_id=ovf.id,
            from_state=from_state, to_state=to_state, action=action, remark=remark,
        )
