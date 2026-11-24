"""Create SCM service POs from CRM opportunities (Outsourced / Cache Service)."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, ValidationException
from modules.crm.domain.lead_sourcing_channels import (
    SERVICE_CHANNEL_CACHE,
    SERVICE_CHANNEL_OUTSOURCED,
    normalize_service_sourcing_channel,
)
from modules.crm.domain.tax_codes import is_service_code
from modules.crm.models.opportunity import CrmOpportunity
from modules.crm.repository.quote_repository import QuoteLineRepository, QuoteRepository
from modules.crm.repository.selling_entity_repository import SellingEntityRepository
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.setting_repository import SettingRepository
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.procurement.adapters.master_data_adapter import (
    ProcurementMasterDataAdapter,
    scm_line_product_code,
)
from modules.procurement.domain.enums import OrderStatus
from modules.procurement.domain.service_po import (
    ORDER_KIND_INTERNAL_SERVICE,
    ORDER_KIND_VENDOR_SERVICE,
    SETTING_INTERNAL_SERVICE_VENDOR_ID,
    SETTING_OUTSOURCED_SERVICE_VENDOR_ID,
    SOURCE_DOC_TYPE_OPPORTUNITY_SERVICE,
    map_selling_entity_to_po_code,
)
from modules.procurement.models.order import ProcOrderHeader
from modules.procurement.repository.order_repository import OrderRepository
from modules.procurement.service.company_po_number_service import (
    peek_next_company_po_number,
)
from modules.procurement.service.order_service import OrderService


class ServicePoService:
    SOURCE_MODULE = "crm"

    def __init__(self, db: Session) -> None:
        self._db = db
        self._orders = OrderRepository(db)
        self._order_service = OrderService(db)
        self._master = ProcurementMasterDataAdapter(db)
        self._settings = SettingRepository(db)
        self._audit = PlatformAuditFacade(db)

    def ensure_service_po_after_customer_po_approved(
        self, ctx: TenantContext, opp: CrmOpportunity
    ) -> ProcOrderHeader | None:
        """Idempotently create a draft service PO when CRM Management approves customer PO."""
        if not getattr(opp, "has_services", False):
            return None
        channel = normalize_service_sourcing_channel(
            getattr(opp, "service_sourcing_channel", None)
        )
        if channel is None:
            return None

        service_lines = self._accepted_service_lines(ctx, opp)
        if not service_lines:
            return None

        order_kind = (
            ORDER_KIND_INTERNAL_SERVICE
            if channel == SERVICE_CHANNEL_CACHE
            else ORDER_KIND_VENDOR_SERVICE
        )
        existing = self._open_service_po(ctx, opp.id, order_kind)
        if existing is not None:
            return existing

        vendor_id = self._resolve_vendor_id(ctx, opp, channel=channel)
        entity_code = self._resolve_entity_code(ctx, opp.company_id)
        company_po_number = peek_next_company_po_number(
            self._db, company_id=opp.company_id, entity_code=entity_code
        )

        order = self._order_service.create(
            ctx,
            branch_id=opp.branch_id,
            document_date=date.today(),
            vendor_id=vendor_id,
            currency_code="INR",
            company_id=opp.company_id,
            payment_terms=None,
            expected_delivery_date=None,
            source_module=self.SOURCE_MODULE,
            source_document_type=SOURCE_DOC_TYPE_OPPORTUNITY_SERVICE,
            source_document_id=opp.id,
            entity_code=entity_code,
            company_po_number=company_po_number,
            order_ref_cache=(opp.opportunity_code or "")[:100] or None,
            order_kind=order_kind,
        )

        line_payloads = self._line_payloads(
            ctx,
            company_id=opp.company_id,
            branch_id=opp.branch_id,
            service_lines=service_lines,
        )
        created_lines, order = self._order_service.add_lines(ctx, order.id, line_payloads)
        if not created_lines:
            raise ConflictException("Failed to create service purchase order lines")

        scope_names = [
            (getattr(ln, "product_name", None) or "").strip()
            for ln in service_lines
            if (getattr(ln, "product_name", None) or "").strip()
        ]
        order.order_ref_cache = (order.order_ref_cache or "").strip() or None
        order.baseline_amount = float(order.total_amount or 0)
        self._db.flush()

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_header",
            entity_id=order.id,
            operation="create_service_po_from_opportunity",
            performed_by=ctx.user_id,
            new_value={
                "opportunity_id": str(opp.id),
                "order_kind": order_kind,
                "channel": channel,
                "vendor_id": str(vendor_id),
                "service_lines": scope_names[:20],
            },
        )
        return order

    def _open_service_po(
        self, ctx: TenantContext, opportunity_id: UUID, order_kind: str
    ) -> ProcOrderHeader | None:
        linked = self._orders.list_by_source(
            ctx,
            source_module=self.SOURCE_MODULE,
            source_document_type=SOURCE_DOC_TYPE_OPPORTUNITY_SERVICE,
            source_document_id=opportunity_id,
        )
        for row in linked:
            if getattr(row, "order_kind", None) != order_kind:
                continue
            if row.status == OrderStatus.CANCELLED.value:
                continue
            return row
        return None

    def _accepted_service_lines(self, ctx: TenantContext, opp: CrmOpportunity) -> list:
        quotes = QuoteRepository(self._db).list_quotes(
            ctx, opp.company_id, opportunity_id=opp.id
        )
        accepted = next((q for q in quotes if q.quote_stage == "accepted"), None)
        if accepted is None:
            return []
        lines = QuoteLineRepository(self._db).list_for_quote(ctx, accepted.id)
        out = []
        for ln in lines:
            line_type = (getattr(ln, "line_type", None) or "").strip().lower()
            if line_type == "services" or is_service_code(getattr(ln, "hsn_sac", None)):
                out.append(ln)
        return out

    def _resolve_vendor_id(
        self, ctx: TenantContext, opp: CrmOpportunity, *, channel: str
    ) -> UUID:
        if channel == SERVICE_CHANNEL_CACHE:
            raw = self._setting_value(ctx.tenant_id, SETTING_INTERNAL_SERVICE_VENDOR_ID)
            if not raw:
                raise ValidationException(
                    "Configure tenant setting scm.internal_service_vendor_id "
                    "(master vendor UUID) before Cache Service POs can be created."
                )
            try:
                vendor_id = UUID(str(raw).strip())
            except ValueError as exc:
                raise ValidationException(
                    "scm.internal_service_vendor_id must be a valid vendor UUID"
                ) from exc
            self._master.get_vendor(ctx, vendor_id)
            return vendor_id

        raw = self._setting_value(ctx.tenant_id, SETTING_OUTSOURCED_SERVICE_VENDOR_ID)
        if raw:
            try:
                vendor_id = UUID(str(raw).strip())
            except ValueError as exc:
                raise ValidationException(
                    "scm.outsourced_service_vendor_id must be a valid vendor UUID"
                ) from exc
            self._master.get_vendor(ctx, vendor_id)
            return vendor_id

        vendors = self._master.list_vendors(
            ctx, company_id=opp.company_id, branch_scoped=False
        )
        if not vendors:
            vendors = self._master.list_vendors(ctx, company_id=None, branch_scoped=False)
        if not vendors:
            raise ValidationException(
                "No vendor available for Outsourced service PO. "
                "Set scm.outsourced_service_vendor_id or create a master vendor."
            )
        return vendors[0].id

    def _setting_value(self, tenant_id: UUID, key: str) -> str | None:
        row = self._settings.get_by_key(tenant_id, key)
        if row is None:
            return None
        value = getattr(row, "setting_value", None)
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    def _resolve_entity_code(self, ctx: TenantContext, company_id: UUID) -> str:
        """Map CRM selling-entity name → SCM company PO prefix (CDT / CT / CMT).

        CRM ``entity_code`` values are document numbers (ENT-000001), not the
        PO numbering prefixes used by :mod:`company_po_number_service`.
        """
        entities = SellingEntityRepository(self._db).list_entities(ctx, company_id)
        for ent in entities:
            mapped = map_selling_entity_to_po_code(
                getattr(ent, "entity_name", None),
                getattr(ent, "entity_code", None),
            )
            if mapped is not None:
                return mapped
        return "CDT"

    def _line_payloads(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        service_lines: list,
    ) -> list[dict]:
        uom_id = self._master.resolve_default_uom_id(ctx, company_id)
        names = [
            str(getattr(ln, "product_name", None) or "").strip() or "Service line"
            for ln in service_lines
        ]
        product_map = self._master.resolve_products_by_names(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            product_names=names,
            uom_id=uom_id,
        )
        payloads: list[dict] = []
        for idx, ln in enumerate(service_lines, start=1):
            product_name = str(getattr(ln, "product_name", None) or "").strip() or "Service line"
            product = product_map[product_name.strip().lower() or "scm line item"]
            qty = float(getattr(ln, "qty", 0) or 0)
            unit_cost = float(getattr(ln, "unit_cost", 0) or 0)
            if unit_cost <= 0:
                unit_cost = float(getattr(ln, "unit_sell", 0) or 0)
            if qty <= 0:
                qty = 1.0
            if unit_cost <= 0:
                raise ConflictException(
                    f"Service line '{product_name}' needs unit cost or sell price > 0"
                )
            tax_rate = float(getattr(ln, "gst_pct", 0) or 0)
            payloads.append(
                {
                    "line_number": idx,
                    "product_id": product.id,
                    "product_code": scm_line_product_code(product),
                    "product_name": product_name[:255],
                    "quantity": qty,
                    "uom_id": getattr(product, "uom_id", None) or uom_id,
                    "unit_cost": unit_cost,
                    "rate_currency": "INR",
                    "tax_rate": tax_rate,
                }
            )
        return payloads
