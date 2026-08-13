"""SCM handoff service — Finance-approved OVF queue → vendor PO → GRN tracking."""

from collections import defaultdict
from datetime import date, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import inspect, select
from sqlalchemy.orm import Session, load_only

from core.exceptions import ConflictException, NotFoundException
from modules.crm.service.ovf_service import resolve_scm_hold_started_at
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.procurement.adapters.crm_adapter import ProcurementCrmAdapter
from modules.procurement.adapters.master_data_adapter import (
    ProcurementMasterDataAdapter,
    scm_line_product_code,
)
from modules.procurement.domain.enums import OrderStatus
from modules.procurement.domain.exceptions import InvalidDocumentState
from modules.procurement.models.inventory_import import ProcInventoryImportLine
from modules.procurement.models.inventory_stock import ProcInventoryStockUnit
from modules.procurement.models.order import ProcOrderHeader, ProcOrderLine
from modules.procurement.models.receipt_batch import (
    ProcOrderReceiptBatch,
    ProcOrderReceiptBatchLine,
)
from modules.procurement.repository.base import ProcScopedRepository, utcnow
from modules.procurement.repository.order_repository import OrderRepository
from modules.procurement.service.company_po_number_service import (
    normalize_entity_code,
    peek_next_company_po_number,
)
from modules.procurement.service.order_service import OrderService
from modules.procurement.service.procurement_scope_validator import ProcurementScopeValidator
from modules.procurement.service.scm_commercial import scm_total_margin_amount

# Receipts saved within this window share one GRN PDF "batch".
_RECEIPT_BATCH_WINDOW = timedelta(minutes=15)

def _grn_badge(*, quantity: float, quantity_received: float, line_status: str) -> str:
    if line_status in {"received", "closed"} or (
        quantity > 0 and quantity_received >= quantity
    ):
        return "delivered"
    if quantity_received > 0:
        return "partial"
    return "pending"


def _header_grn_badge(lines: list[ProcOrderLine]) -> str:
    active = [ln for ln in lines if not getattr(ln, "is_deleted", False)]
    if not active:
        return "pending"
    badges = {
        _grn_badge(
            quantity=float(ln.quantity),
            quantity_received=float(ln.quantity_received or 0),
            line_status=ln.status,
        )
        for ln in active
    }
    if badges == {"delivered"}:
        return "closed"
    if "partial" in badges or "delivered" in badges:
        return "partial"
    return "pending"


def _queue_po_status(order: ProcOrderHeader | None) -> str | None:
    """Raw PO status for SCM queue OVF status (not GRN delivery)."""
    if order is None:
        return None
    return order.status


class ScmHandoffService:
    SOURCE_MODULE = "crm"
    SOURCE_DOC_TYPE = "ovf"

    def __init__(self, db: Session) -> None:
        self._db = db
        self._receipt_batch_storage_ready: bool | None = None
        self._inventory_import_table_ready: bool | None = None
        self._inventory_stock_table_ready: bool | None = None
        self._batch_line_billing_quantity_ready: bool | None = None
        self._crm = ProcurementCrmAdapter(db)
        self._master = ProcurementMasterDataAdapter(db)
        self._orders = OrderRepository(db)
        self._order_service = OrderService(db)
        self._scope = ProcurementScopeValidator(db)
        self._audit = AuditService(db)

    def _receipt_batch_tables_exist(self) -> bool:
        if self._receipt_batch_storage_ready is None:
            self._receipt_batch_storage_ready = inspect(self._db.get_bind()).has_table(
                "proc_order_receipt_batch",
                schema="procurement",
            )
        return self._receipt_batch_storage_ready

    def _inventory_import_table_exists(self) -> bool:
        if self._inventory_import_table_ready is None:
            self._inventory_import_table_ready = inspect(self._db.get_bind()).has_table(
                "proc_inventory_import_line",
                schema="procurement",
            )
        return self._inventory_import_table_ready

    def _inventory_stock_table_exists(self) -> bool:
        if self._inventory_stock_table_ready is None:
            self._inventory_stock_table_ready = inspect(self._db.get_bind()).has_table(
                "proc_inventory_stock_unit",
                schema="procurement",
            )
        return self._inventory_stock_table_ready

    def _receipt_batch_line_has_billing_quantity(self) -> bool:
        if self._batch_line_billing_quantity_ready is None:
            bind = self._db.get_bind()
            cols = {
                c["name"]
                for c in inspect(bind).get_columns(
                    "proc_order_receipt_batch_line",
                    schema="procurement",
                )
            }
            self._batch_line_billing_quantity_ready = "billing_quantity" in cols
        return self._batch_line_billing_quantity_ready

    def list_scm_queue(self, ctx: TenantContext, company_id: UUID | None = None) -> list[dict]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        ovfs = self._crm.list_shared_ovfs(ctx, cid)
        # One vendor load for the whole queue — used for OEM suggestions when no PO yet.
        vendor_pool = self._master.list_vendors(ctx, company_id=cid, branch_scoped=False)
        if not vendor_pool:
            vendor_pool = self._master.list_vendors(ctx, company_id=None, branch_scoped=False)
        items: list[dict] = []
        for ovf in ovfs:
            existing = self._orders.find_by_source(
                ctx,
                source_module=self.SOURCE_MODULE,
                source_document_type=self.SOURCE_DOC_TYPE,
                source_document_id=ovf.id,
            )
            vendor_total = 0.0
            vendor_qty = 0.0
            customer_total = 0.0
            customer_total_with_tax = 0.0
            margin_amount = 0.0
            vendor_payment_days = 0
            customer_payment_days = 0
            vendor_name: str | None = None
            oem_name: str | None = None
            handoff: dict = {}
            try:
                handoff = self._crm.get_handoff(ctx, ovf.id)
                oem_name = (handoff.get("oem_name") or "").strip() or None
                vendor_lines = handoff.get("vendor_lines") or []
                customer_lines = handoff.get("customer_lines") or []

                def _handoff_line_total(ln: dict) -> float:
                    if ln.get("line_total") is not None:
                        return float(ln["line_total"])
                    return float(ln.get("qty") or 0) * float(ln.get("unit_price") or 0)

                vendor_total = sum(_handoff_line_total(ln) for ln in vendor_lines)
                vendor_qty = sum(float(ln.get("qty") or 0) for ln in vendor_lines)
                customer_total = sum(_handoff_line_total(ln) for ln in customer_lines)
                customer_total_with_tax = sum(
                    float(ln.get("total_with_gst") or 0) for ln in customer_lines
                )
                if customer_total_with_tax <= 0 and customer_total > 0:
                    customer_total_with_tax = customer_total
                margin_amount = scm_total_margin_amount(
                    handoff,
                    customer_total=customer_total,
                    vendor_total=vendor_total,
                )
                vendor_payment_days = int(handoff.get("vendor_payment_days") or 0)
                customer_payment_days = int(handoff.get("customer_payment_days") or 0)
            except ConflictException:
                continue
            except Exception:
                handoff = {}
            if existing is not None:
                try:
                    vendor = self._master.get_vendor(ctx, existing.vendor_id)
                    vendor_name = (
                        getattr(vendor, "vendor_name", None)
                        or getattr(vendor, "name", None)
                        or getattr(vendor, "display_name", None)
                    )
                except Exception:
                    vendor_name = None
            if not vendor_name:
                # Suggested vendor from OVF OEM — shown before Create PO; replaced once PO exists.
                vendor_name = self._master.match_vendor_name_by_oem(
                    ctx,
                    company_id=ovf.company_id,
                    oem_name=oem_name,
                    vendors=vendor_pool,
                )
            is_cancelled = (
                existing is not None and existing.status == OrderStatus.CANCELLED.value
            )
            scm_on_hold = bool(getattr(ovf, "scm_on_hold", False)) or is_cancelled
            can_create = existing is None or is_cancelled
            items.append(
                {
                    "ovf_id": ovf.id,
                    "ovf_no": ovf.ovf_no,
                    "customer_name": ovf.customer_name,
                    "quote_name": ovf.quote_name,
                    "account_name": ovf.account_name,
                    "po_number": ovf.po_number,
                    "company_po_number": (
                        existing.company_po_number
                        if existing is not None
                        and existing.status != OrderStatus.CANCELLED.value
                        and existing.company_po_number
                        else None
                    ),
                    "owner_name": ovf.owner_name,
                    "blueprint_state": ovf.blueprint_state or "shared_scm",
                    "company_id": ovf.company_id,
                    "branch_id": ovf.branch_id,
                    "oem_name": oem_name,
                    "vendor_line_count": len(handoff.get("vendor_lines", [])),
                    "vendor_qty": vendor_qty,
                    "vendor_total": vendor_total,
                    "customer_total": customer_total,
                    "customer_total_with_tax": customer_total_with_tax,
                    "margin_amount": margin_amount,
                    "vendor_payment_days": vendor_payment_days,
                    "customer_payment_days": customer_payment_days,
                    "vendor_name": vendor_name,
                    "received_at": getattr(ovf, "shared_to_scm_at", None)
                    or getattr(ovf, "updated_at", None)
                    or getattr(ovf, "created_at", None),
                    "delivery_period": getattr(ovf, "delivery_period", None),
                    "expected_delivery_date": (
                        existing.expected_delivery_date
                        if existing is not None and not is_cancelled
                        else None
                    ),
                    "purchase_order_id": (
                        None if is_cancelled else (existing.id if existing else None)
                    ),
                    "purchase_order_number": (
                        None
                        if is_cancelled
                        else (existing.document_number if existing else None)
                    ),
                    "purchase_order_status": (
                        "hold" if scm_on_hold and (existing is None or is_cancelled)
                        else _queue_po_status(existing)
                    ),
                    "scm_on_hold": scm_on_hold,
                    "scm_on_hold_at": resolve_scm_hold_started_at(ovf),
                    "can_create_po": can_create,
                }
            )
        def _queue_received_sort_key(row: dict) -> str:
            value = row.get("received_at")
            if value is None:
                return ""
            if hasattr(value, "isoformat"):
                return value.isoformat()
            return str(value)

        items.sort(key=_queue_received_sort_key, reverse=True)
        return items

    def hold_ovf(self, ctx: TenantContext, ovf_id: UUID, *, remark: str) -> dict:
        """Put OVF on Hold without creating a vendor PO (vendor not required)."""
        self._crm.set_scm_on_hold(ctx, ovf_id, on_hold=True, remark=remark)
        return self.get_ovf_preview(ctx, ovf_id)

    def release_ovf_hold(self, ctx: TenantContext, ovf_id: UUID) -> dict:
        """Remove SCM hold without creating a PO (one-time hold cycle)."""
        self._crm.set_scm_on_hold(ctx, ovf_id, on_hold=False)
        return self.get_ovf_preview(ctx, ovf_id)

    def update_ovf_charges(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        freight: float = 0,
        additional_charges: float = 0,
        finance_cost_pct: float = 0,
    ) -> dict:
        """SCM edits freight / finance on the shared OVF; Sales sees the same CRM fields."""
        existing = self._orders.find_by_source(
            ctx,
            source_module=self.SOURCE_MODULE,
            source_document_type=self.SOURCE_DOC_TYPE,
            source_document_id=ovf_id,
        )
        if existing is not None and existing.status != OrderStatus.CANCELLED.value:
            raise ConflictException(
                "Freight and finance cannot be changed after a vendor purchase order is created"
            )
        self._crm.update_scm_charges(
            ctx,
            ovf_id,
            freight=freight,
            additional_charges=additional_charges,
            finance_cost_pct=finance_cost_pct,
        )
        return self.get_ovf_preview(ctx, ovf_id)

    def get_ovf_preview(self, ctx: TenantContext, ovf_id: UUID) -> dict:
        handoff = self._crm.get_handoff(ctx, ovf_id)
        existing = self._orders.find_by_source(
            ctx,
            source_module=self.SOURCE_MODULE,
            source_document_type=self.SOURCE_DOC_TYPE,
            source_document_id=ovf_id,
        )
        is_cancelled = (
            existing is not None and existing.status == OrderStatus.CANCELLED.value
        )
        handoff["purchase_order_id"] = None if is_cancelled else (existing.id if existing else None)
        handoff["purchase_order_number"] = (
            None if is_cancelled else (existing.document_number if existing else None)
        )
        handoff["can_create_po"] = (
            existing is None
            or is_cancelled
            or (existing is not None and existing.status == OrderStatus.DRAFT.value)
        )
        handoff["purchase_order_status"] = _queue_po_status(existing)
        handoff["scm_on_hold"] = bool(handoff.get("scm_on_hold")) or is_cancelled
        handoff["company_po_number"] = (
            existing.company_po_number
            if existing is not None
            and existing.status != OrderStatus.CANCELLED.value
            and existing.company_po_number
            else None
        )
        vendor_name: str | None = None
        if existing is not None:
            try:
                vendor = self._master.get_vendor(ctx, existing.vendor_id)
                vendor_name = getattr(vendor, "vendor_name", None)
            except Exception:
                vendor_name = None
        if not vendor_name:
            vendor_name = self._master.match_vendor_name_by_oem(
                ctx,
                company_id=handoff["company_id"],
                oem_name=handoff.get("oem_name"),
            )
        handoff["vendor_name"] = vendor_name
        return handoff

    def peek_next_company_po(
        self,
        ctx: TenantContext,
        *,
        entity_code: str,
        company_id: UUID | None = None,
    ) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        code = normalize_entity_code(entity_code)
        return {
            "entity_code": code,
            "company_po_number": peek_next_company_po_number(
                self._db, company_id=cid, entity_code=code
            ),
        }

    def create_po_from_inventory(
        self,
        ctx: TenantContext,
        *,
        vendor_id: UUID,
        entity_code: str,
        document_date: date | None = None,
        currency_code: str = "INR",
        payment_terms: str | None = None,
        expected_delivery_date: date | None = None,
        company_id: UUID | None = None,
        lines: list[dict] | None = None,
        approved_by_name: str | None = None,
        stock_unit_ids: list[UUID] | None = None,
        import_line_ids: list[UUID] | None = None,
    ) -> ProcOrderHeader:
        """Draft PO with the next company PO number for the entity (e.g. PO/CDT/007)."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        branch_id = ctx.branch_id
        if branch_id is None:
            raise ConflictException("Select a branch in your session before creating a purchase order")
        code = normalize_entity_code(entity_code)
        self._master.get_vendor(ctx, vendor_id)
        approver = (approved_by_name or "").strip() or None
        company_po_number = peek_next_company_po_number(
            self._db, company_id=cid, entity_code=code
        )
        order = self._order_service.create(
            ctx,
            branch_id=branch_id,
            document_date=document_date or date.today(),
            vendor_id=vendor_id,
            currency_code=currency_code,
            company_id=cid,
            payment_terms=payment_terms,
            expected_delivery_date=expected_delivery_date,
            source_module="procurement",
            source_document_type="inventory_initiated",
            source_document_id=None,
            entity_code=code,
            company_po_number=company_po_number,
            approved_by_name=approver,
        )
        line_rows = list(lines or [])
        if line_rows:
            uom_id = self._master.resolve_default_uom_id(ctx, cid)
            product_map = self._master.resolve_products_by_names(
                ctx,
                company_id=cid,
                branch_id=branch_id,
                product_names=[str(row.get("product_name") or "") for row in line_rows],
                uom_id=uom_id,
            )
            line_payloads: list[dict] = []
            for idx, raw in enumerate(line_rows, start=1):
                product_name = str(raw.get("product_name") or "").strip()
                qty = float(raw.get("quantity") or 0)
                if qty <= 0:
                    continue
                unit_cost = float(raw.get("unit_cost") or 0)
                product = product_map[(product_name or "").strip().lower() or "scm line item"]
                line_payloads.append(
                    {
                        "line_number": idx,
                        "product_id": product.id,
                        "product_code": scm_line_product_code(product),
                        "product_name": product_name[:255],
                        "quantity": qty,
                        "uom_id": getattr(product, "uom_id", None) or uom_id,
                        "unit_cost": unit_cost,
                    }
                )
            if not line_payloads:
                raise ConflictException("Select at least one stock line with quantity > 0")
            self._order_service.add_lines(ctx, order.id, line_payloads)

        consumed_units = self._consume_inventory_stock_units(
            ctx,
            cid,
            list(stock_unit_ids or []),
        )
        consumed_imports = self._consume_inventory_import_lines(
            ctx,
            cid,
            list(import_line_ids or []),
        )

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_header",
            entity_id=order.id,
            operation="create_from_inventory",
            performed_by=ctx.user_id,
            new_value={
                "company_po_number": company_po_number,
                "entity_code": code,
                "vendor_id": str(vendor_id),
                "line_count": len(line_rows),
                "stock_units_consumed": consumed_units,
                "import_lines_consumed": consumed_imports,
            },
        )
        return self._order_service.get_order(ctx, order.id)

    def _consume_inventory_stock_units(
        self,
        ctx: TenantContext,
        company_id: UUID,
        stock_unit_ids: list[UUID],
    ) -> int:
        """Soft-delete selected on-hand stock units (deduct from inventory)."""
        ids = list({uid for uid in stock_unit_ids if uid is not None})
        if not ids:
            return 0
        if not self._inventory_stock_table_exists():
            raise ConflictException("Inventory stock is not available on this database.")
        now = utcnow()
        units = (
            self._db.query(ProcInventoryStockUnit)
            .filter(
                ProcInventoryStockUnit.id.in_(ids),
                ProcInventoryStockUnit.tenant_id == ctx.tenant_id,
                ProcInventoryStockUnit.company_id == company_id,
                ProcInventoryStockUnit.is_deleted.is_(False),
            )
            .all()
        )
        found = {unit.id for unit in units}
        missing = [str(uid) for uid in ids if uid not in found]
        if missing:
            raise ConflictException(
                "Some selected stock units are no longer available. Refresh inventory and try again."
            )
        for unit in units:
            unit.is_deleted = True
            unit.deleted_at = now
            unit.deleted_by = ctx.user_id
            unit.updated_by = ctx.user_id
            unit.updated_at = now
        return len(units)

    def _consume_inventory_import_lines(
        self,
        ctx: TenantContext,
        company_id: UUID,
        import_line_ids: list[UUID],
    ) -> int:
        """Soft-delete selected Excel-import inventory lines."""
        ids = list({uid for uid in import_line_ids if uid is not None})
        if not ids:
            return 0
        if not self._inventory_import_table_exists():
            raise ConflictException("Inventory import is not available on this database.")
        now = utcnow()
        rows = (
            self._db.query(ProcInventoryImportLine)
            .filter(
                ProcInventoryImportLine.id.in_(ids),
                ProcInventoryImportLine.tenant_id == ctx.tenant_id,
                ProcInventoryImportLine.company_id == company_id,
                ProcInventoryImportLine.is_deleted.is_(False),
            )
            .all()
        )
        found = {row.id for row in rows}
        missing = [str(uid) for uid in ids if uid not in found]
        if missing:
            raise ConflictException(
                "Some selected import lines are no longer available. Refresh inventory and try again."
            )
        for row in rows:
            row.is_deleted = True
            row.deleted_at = now
            row.deleted_by = ctx.user_id
            row.updated_by = ctx.user_id
            row.updated_at = now
        return len(rows)

    def create_po_from_ovf(
        self,
        ctx: TenantContext,
        *,
        ovf_id: UUID,
        vendor_id: UUID,
        document_date: date | None = None,
        currency_code: str = "INR",
        payment_terms: str | None = None,
        expected_delivery_date: date | None = None,
        entity_code: str,
        finalize: bool = False,
        hold: bool = False,
    ) -> ProcOrderHeader:
        if finalize and hold:
            raise ConflictException("Cannot finalize and hold a purchase order at the same time")
        handoff = self._crm.get_handoff(ctx, ovf_id)
        existing = self._orders.find_by_source(
            ctx,
            source_module=self.SOURCE_MODULE,
            source_document_type=self.SOURCE_DOC_TYPE,
            source_document_id=ovf_id,
        )
        if existing is not None and existing.status != OrderStatus.CANCELLED.value:
            if existing.status != OrderStatus.DRAFT.value:
                raise ConflictException(
                    f"Vendor PO already exists for this OVF ({existing.document_number})"
                )
            # Re-edit draft (e.g. after approval reject) — keep company PO number.
            code = normalize_entity_code(entity_code)
            self._master.get_vendor(ctx, vendor_id)
            company_id = handoff["company_id"]
            branch_id = handoff["branch_id"]
            self._scope.validate_company_access(ctx, company_id)
            self._scope.validate_branch_access(ctx, branch_id)

            terms = payment_terms
            if not terms and handoff.get("vendor_payment_days"):
                terms = f"Net {int(handoff['vendor_payment_days'])} days"

            updated = self._orders.update_order(
                ctx,
                existing.id,
                vendor_id=vendor_id,
                document_date=document_date or existing.document_date,
                payment_terms=terms,
                expected_delivery_date=expected_delivery_date,
                entity_code=code,
            )
            if updated is None:
                raise ConflictException("Failed to update draft purchase order")
            order = updated

            if not order.company_po_number:
                order.company_po_number = peek_next_company_po_number(
                    self._db, company_id=company_id, entity_code=code
                )
                self._db.flush()

            self._crm.set_scm_on_hold(ctx, ovf_id, on_hold=False)

            if hold:
                held = self._orders.update_order(
                    ctx, order.id, status=OrderStatus.CANCELLED.value
                )
                if held is None:
                    raise ConflictException("Failed to put purchase order on hold")
                order = held
            elif finalize:
                order = self.finalize_scm_po(ctx, order.id, order=order)

            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name="proc_order_header",
                entity_id=order.id,
                operation="update_draft_from_ovf",
                performed_by=ctx.user_id,
                new_value={
                    "ovf_id": str(ovf_id),
                    "vendor_id": str(vendor_id),
                    "entity_code": code,
                    "company_po_number": order.company_po_number,
                    "hold": hold,
                    "finalize": finalize,
                },
            )
            return order

        # Creating a PO releases any SCM Hold on the OVF.
        self._crm.set_scm_on_hold(ctx, ovf_id, on_hold=False)

        vendor_lines = handoff.get("vendor_lines") or []
        if not vendor_lines:
            raise ConflictException("OVF has no vendor-side lines to purchase")

        code = normalize_entity_code(entity_code)
        self._master.get_vendor(ctx, vendor_id)
        company_id = handoff["company_id"]
        branch_id = handoff["branch_id"]
        self._scope.validate_company_access(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)

        terms = payment_terms
        if not terms and handoff.get("vendor_payment_days"):
            terms = f"Net {int(handoff['vendor_payment_days'])} days"

        # Assign company PO number on draft create (same as inventory-initiated POs).
        # Finalize keeps the existing number when already set.
        company_po_number = peek_next_company_po_number(
            self._db, company_id=company_id, entity_code=code
        )

        order = self._order_service.create(
            ctx,
            branch_id=branch_id,
            document_date=document_date or date.today(),
            vendor_id=vendor_id,
            currency_code=currency_code,
            company_id=company_id,
            payment_terms=terms,
            expected_delivery_date=expected_delivery_date,
            source_module=self.SOURCE_MODULE,
            source_document_type=self.SOURCE_DOC_TYPE,
            source_document_id=ovf_id,
            entity_code=code,
            company_po_number=company_po_number,
        )

        uom_id = self._master.resolve_default_uom_id(ctx, company_id)
        product_map = self._master.resolve_products_by_names(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            product_names=[str(line["product_name"]) for line in vendor_lines],
            uom_id=uom_id,
        )

        line_payloads: list[dict] = []
        for idx, line in enumerate(vendor_lines, start=1):
            product_name = str(line["product_name"])
            product = product_map[(product_name or "").strip().lower() or "scm line item"]
            qty = float(line["qty"])
            unit_cost = float(line["unit_price"])
            if qty <= 0 or unit_cost <= 0:
                raise ConflictException(
                    f"Vendor line '{product_name}' needs qty and unit cost > 0"
                )
            line_payloads.append(
                {
                    "line_number": idx,
                    "product_id": product.id,
                    "product_code": scm_line_product_code(product),
                    "product_name": product_name[:255],
                    "quantity": qty,
                    "uom_id": getattr(product, "uom_id", None) or uom_id,
                    "unit_cost": unit_cost,
                }
            )

        created_lines, order = self._order_service.add_lines(ctx, order.id, line_payloads)
        if not created_lines:
            raise ConflictException("Failed to create purchase order lines from OVF")

        if hold:
            updated = self._orders.update_order(
                ctx, order.id, status=OrderStatus.CANCELLED.value
            )
            if updated is None:
                raise ConflictException("Failed to put purchase order on hold")
            order = updated
        elif finalize:
            order = self.finalize_scm_po(ctx, order.id, order=order)

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_header",
            entity_id=order.id,
            operation="create_from_ovf_hold" if hold else "create_from_ovf",
            performed_by=ctx.user_id,
            new_value={
                "ovf_id": str(ovf_id),
                "vendor_id": str(vendor_id),
                "entity_code": code,
                "company_po_number": order.company_po_number,
                "hold": hold,
                "finalize": finalize,
            },
        )
        return order

    def finalize_scm_po(
        self,
        ctx: TenantContext,
        order_id: UUID,
        order: ProcOrderHeader | None = None,
    ) -> ProcOrderHeader:
        """Issue vendor PO after OVF commercial lock — draft → sent (CRM-sourced only)."""
        if order is None or order.id != order_id:
            order = self._order_service.get_order(ctx, order_id)
        if order.source_module != self.SOURCE_MODULE or order.source_document_type != self.SOURCE_DOC_TYPE:
            raise InvalidDocumentState("Only CRM OVF-sourced POs can use SCM finalize")
        if order.status != OrderStatus.DRAFT.value:
            raise InvalidDocumentState("Only draft SCM POs can be finalized")
        active_lines = [ln for ln in (order.lines or []) if not getattr(ln, "is_deleted", False)]
        if not active_lines:
            raise InvalidDocumentState("Cannot finalize a PO with no lines")
        if not order.entity_code:
            raise InvalidDocumentState("Entity code is required to assign company PO number")
        if not order.company_po_number:
            order.company_po_number = peek_next_company_po_number(
                self._db,
                company_id=order.company_id,
                entity_code=order.entity_code,
            )
        # In-place status flip — avoid a second locked reload of the same draft.
        order.status = OrderStatus.SENT.value
        order.updated_at = utcnow()
        order.updated_by = ctx.user_id
        order.version = int(getattr(order, "version", 0) or 0) + 1
        self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_header",
            entity_id=order_id,
            operation="scm_finalize",
            performed_by=ctx.user_id,
            new_value={"company_po_number": order.company_po_number},
        )
        return order

    def list_vendor_pos(self, ctx: TenantContext, company_id: UUID | None = None) -> list[dict]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        orders = self._orders.list_orders_with_lines(ctx, cid)
        result: list[dict] = []
        handoff_cache: dict[UUID, dict] = {}
        for order in orders:
            lines = [ln for ln in (order.lines or []) if not getattr(ln, "is_deleted", False)]
            grn = _header_grn_badge(lines)
            received_lines = [ln for ln in lines if float(ln.quantity_received or 0) > 0]
            receipt_saved_at = None
            if received_lines:
                receipt_saved_at = max(
                    (ln.updated_at for ln in received_lines if getattr(ln, "updated_at", None)),
                    default=None,
                )
            vendor_total = float(order.total_amount or 0)
            customer_total = 0.0
            margin_amount = 0.0
            if (
                order.source_module == self.SOURCE_MODULE
                and order.source_document_type == self.SOURCE_DOC_TYPE
                and order.source_document_id is not None
            ):
                ovf_id = order.source_document_id
                try:
                    if ovf_id not in handoff_cache:
                        handoff_cache[ovf_id] = self._crm.get_commercial_totals(ctx, ovf_id)
                    summary = handoff_cache[ovf_id]
                    vendor_total = float(summary.get("vendor_total") or vendor_total)
                    customer_total = float(summary.get("customer_total") or 0)
                    margin_amount = scm_total_margin_amount(
                        summary,
                        customer_total=customer_total,
                        vendor_total=vendor_total,
                    )
                except Exception:
                    pass
            result.append(
                {
                    "id": order.id,
                    "document_number": order.document_number,
                    "document_date": order.document_date,
                    "vendor_id": order.vendor_id,
                    "status": order.status,
                    "currency_code": order.currency_code,
                    "total_amount": float(order.total_amount or 0),
                    "source_module": order.source_module,
                    "source_document_type": order.source_document_type,
                    "source_document_id": order.source_document_id,
                    "company_po_number": order.company_po_number,
                    "vendor_total": vendor_total,
                    "customer_total": customer_total,
                    "margin_amount": margin_amount,
                    "grn_status": grn,
                    "receipt_saved_at": receipt_saved_at,
                    "current_receipt_batch_id": order.current_receipt_batch_id,
                    "current_grn_number": getattr(order, "current_grn_number", None),
                    "grn_sequence": int(getattr(order, "grn_sequence", 0) or 0),
                    "line_count": len(lines),
                    "lines": [
                        {
                            "id": ln.id,
                            "line_number": ln.line_number,
                            "product_name": ln.product_name,
                            "quantity": float(ln.quantity),
                            "quantity_received": float(ln.quantity_received or 0),
                            "last_receipt_qty": float(getattr(ln, "last_receipt_qty", 0) or 0),
                            "last_receipt_batch_id": getattr(ln, "last_receipt_batch_id", None),
                            "last_receipt_serial_numbers": getattr(
                                ln, "last_receipt_serial_numbers", None
                            ),
                            "last_receipt_billing": bool(
                                getattr(ln, "last_receipt_billing", True)
                            ),
                            "last_receipt_billing_quantity": float(
                                getattr(ln, "last_receipt_billing_quantity", 0) or 0
                            ),
                            "unit_cost": float(ln.unit_cost),
                            "line_total": float(ln.line_total),
                            "status": ln.status,
                            "grn_status": _grn_badge(
                                quantity=float(ln.quantity),
                                quantity_received=float(ln.quantity_received or 0),
                                line_status=ln.status,
                            ),
                        }
                        for ln in lines
                    ],
                }
            )
        return result

    def update_line_receipt(
        self,
        ctx: TenantContext,
        order_id: UUID,
        line_id: UUID,
        *,
        quantity_received: float,
        grn_status: str | None = None,
        serial_numbers: list[str] | None = None,
        billing: bool = True,
        billing_quantity: float | None = None,
    ) -> ProcOrderHeader:
        order = self._order_service.get_order(ctx, order_id)
        if order.status in {
            OrderStatus.CANCELLED.value,
            OrderStatus.DRAFT.value,
            OrderStatus.SUBMITTED.value,
        }:
            raise InvalidDocumentState("Receipt can only be recorded on issued purchase orders")

        line = next((ln for ln in order.lines if ln.id == line_id and not ln.is_deleted), None)
        if line is None:
            raise NotFoundException("Order line not found")

        qty = Decimal(str(line.quantity))
        previous_received = Decimal(str(line.quantity_received or 0))
        received = Decimal(str(quantity_received))
        if received < 0:
            raise ConflictException("quantity_received cannot be negative")
        if received > qty:
            raise ConflictException("quantity_received cannot exceed ordered quantity")

        status_hint = (grn_status or "").lower().strip()
        if status_hint == "delivered":
            received = qty
            line_status = "received"
        elif status_hint == "pending":
            received = Decimal("0")
            line_status = "open"
        elif status_hint == "partial" or received > 0:
            if received <= 0:
                raise ConflictException("partial receipt requires quantity_received > 0")
            if received >= qty:
                line_status = "received"
            else:
                line_status = "partially_received"
        else:
            line_status = "open" if received == 0 else (
                "received" if received >= qty else "partially_received"
            )

        delta = received - previous_received
        line.quantity_received = float(received)
        line.status = line_status
        line.updated_by = ctx.user_id
        now = utcnow()
        line.updated_at = now
        order.updated_at = now
        order.updated_by = ctx.user_id

        if delta > 0:
            # Whole units need serials/stock rows; fractional remainder is qty-only.
            unit_count = int(delta)
            normalized_serials: list[str] = []
            if unit_count > 0:
                if serial_numbers is None or len(serial_numbers) != unit_count:
                    raise ConflictException(
                        f"Provide {unit_count} serial number(s) for this receipt "
                        "(use NA if not applicable)"
                    )
                for raw in serial_numbers:
                    value = (raw or "").strip()
                    if not value:
                        raise ConflictException(
                            "Each received unit needs a serial number or NA"
                        )
                    normalized_serials.append(value)
            elif serial_numbers:
                # Ignore leftover serial payloads on pure fractional receipts.
                normalized_serials = []

            if billing_quantity is not None:
                bill_qty = float(billing_quantity)
            else:
                bill_qty = float(delta) if billing else 0.0
            if bill_qty < 0:
                raise ConflictException("billing_quantity cannot be negative")
            if bill_qty > float(delta):
                raise ConflictException(
                    f"billing_quantity cannot exceed units received ({float(delta)})"
                )
            line_billing = bill_qty > 0

            batch_at = getattr(order, "current_receipt_batch_at", None)
            batch_id = getattr(order, "current_receipt_batch_id", None)
            if batch_at is not None and batch_at.tzinfo is None:
                batch_at = batch_at.replace(tzinfo=timezone.utc)
            starting_new_batch = (
                batch_id is None
                or batch_at is None
                or (now - batch_at) > _RECEIPT_BATCH_WINDOW
            )
            if starting_new_batch:
                batch_id = uuid4()
                next_seq = int(getattr(order, "grn_sequence", 0) or 0) + 1
                order.grn_sequence = next_seq
                po_base = (order.company_po_number or order.document_number or "PO").strip()
                order.current_grn_number = f"{po_base}/{next_seq:03d}"
            order.current_receipt_batch_id = batch_id
            order.current_receipt_batch_at = now
            line.last_receipt_qty = float(delta)
            line.last_receipt_at = now
            line.last_receipt_batch_id = batch_id
            if hasattr(line, "last_receipt_serial_numbers"):
                line.last_receipt_serial_numbers = normalized_serials or None
            if hasattr(line, "last_receipt_billing"):
                line.last_receipt_billing = line_billing
            if hasattr(line, "last_receipt_billing_quantity"):
                line.last_receipt_billing_quantity = float(bill_qty)
            if self._receipt_batch_tables_exist():
                if not starting_new_batch and self._db.get(ProcOrderReceiptBatch, batch_id) is None:
                    starting_new_batch = True
                self._upsert_receipt_batch_line(
                    ctx,
                    order=order,
                    batch_id=batch_id,
                    line=line,
                    receipt_at=now,
                    starting_new_batch=starting_new_batch,
                    sequence=int(getattr(order, "grn_sequence", 0) or 0),
                    grn_number=str(order.current_grn_number or ""),
                    serial_numbers=normalized_serials or None,
                    billing=line_billing,
                    billing_quantity=bill_qty,
                )
        else:
            line.last_receipt_qty = 0
            line.last_receipt_at = None
            line.last_receipt_batch_id = None
            if hasattr(line, "last_receipt_serial_numbers"):
                line.last_receipt_serial_numbers = None
            if hasattr(line, "last_receipt_billing"):
                line.last_receipt_billing = True
            if hasattr(line, "last_receipt_billing_quantity"):
                line.last_receipt_billing_quantity = 0.0

        active = [ln for ln in order.lines if not ln.is_deleted]
        orderable = [ln for ln in active if float(ln.quantity or 0) > 0]
        all_delivered = bool(orderable) and all(
            float(ln.quantity_received or 0) >= float(ln.quantity or 0) for ln in orderable
        )
        any_received = any(float(ln.quantity_received or 0) > 0 for ln in active)
        if all_delivered:
            order.status = OrderStatus.RECEIVED.value
            order.received_amount = float(order.total_amount or 0)
        elif any_received:
            order.status = OrderStatus.PARTIALLY_RECEIVED.value
            order.received_amount = float(
                sum(
                    Decimal(str(ln.quantity_received or 0)) * Decimal(str(ln.unit_cost))
                    for ln in active
                )
            )
        elif order.status in {
            OrderStatus.PARTIALLY_RECEIVED.value,
            OrderStatus.RECEIVED.value,
        }:
            order.status = OrderStatus.SENT.value
            order.received_amount = 0

        self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_line",
            entity_id=line_id,
            operation="grn_update",
            performed_by=ctx.user_id,
            new_value={
                "quantity_received": float(received),
                "status": line_status,
            },
        )
        return self._order_service.get_order(ctx, order_id)

    def _upsert_receipt_batch_line(
        self,
        ctx: TenantContext,
        *,
        order: ProcOrderHeader,
        batch_id: UUID,
        line: ProcOrderLine,
        receipt_at,
        starting_new_batch: bool,
        sequence: int,
        grn_number: str,
        serial_numbers: list[str] | None = None,
        billing: bool = True,
        billing_quantity: float = 0,
    ) -> None:
        if starting_new_batch:
            header = ProcOrderReceiptBatch(
                id=batch_id,
                order_header_id=order.id,
                sequence=sequence,
                grn_number=grn_number,
                receipt_at=receipt_at,
                tenant_id=order.tenant_id,
                company_id=order.company_id,
                branch_id=order.branch_id,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
            )
            self._db.add(header)

        batch_line = (
            self._db.query(ProcOrderReceiptBatchLine)
            .filter(
                ProcOrderReceiptBatchLine.receipt_batch_id == batch_id,
                ProcOrderReceiptBatchLine.order_line_id == line.id,
                ProcOrderReceiptBatchLine.is_deleted.is_(False),
            )
            .first()
        )
        qty = float(line.last_receipt_qty or 0)
        if batch_line is None:
            batch_line = ProcOrderReceiptBatchLine(
                receipt_batch_id=batch_id,
                order_line_id=line.id,
                quantity=qty,
                serial_numbers=serial_numbers,
                billing=billing_quantity > 0,
                billing_quantity=float(billing_quantity),
                tenant_id=order.tenant_id,
                company_id=order.company_id,
                branch_id=order.branch_id,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
            )
            self._db.add(batch_line)
        else:
            batch_line.quantity = float(batch_line.quantity or 0) + qty
            if serial_numbers:
                existing = list(batch_line.serial_numbers or [])
                batch_line.serial_numbers = existing + serial_numbers
            batch_line.billing_quantity = float(batch_line.billing_quantity or 0) + float(
                billing_quantity
            )
            batch_line.billing = batch_line.billing_quantity > 0
            batch_line.updated_by = ctx.user_id
            batch_line.updated_at = receipt_at

        if self._inventory_stock_table_exists():
            # Stock units FK receipt_batch_id — persist batch header/line before insert.
            self._db.flush()

        self._append_stock_units_for_receipt(
            ctx,
            order=order,
            line=line,
            batch_id=batch_id,
            grn_number=grn_number,
            receipt_at=receipt_at,
            receive_qty=qty,
            billing_quantity=billing_quantity,
            serial_numbers=serial_numbers,
        )

    RECEIPT_BATCH_ATTACHMENT_ENTITY = "procurement_receipt_batch"
    OVF_ATTACHMENT_ENTITY = "ovf"
    PO_ATTACHMENT_ENTITY = "purchase_order"

    @staticmethod
    def _attachment_summary(row) -> dict:
        return {
            "id": row.id,
            "file_name": row.file_name,
            "content_type": row.content_type,
            "size": row.size,
            "category": getattr(row, "category", None) or "other",
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
        }

    def list_ovf_attachments(self, ctx: TenantContext, ovf_id: UUID) -> list[dict]:
        from modules.crm.models import CrmAttachment
        from sqlalchemy import or_, select

        preview = self.get_ovf_preview(ctx, ovf_id)
        # Access already gated by OVF preview — include OVF + related sales
        # quote / opportunity files (sales attachments) for SCM + approval.
        entity_filters = [
            (CrmAttachment.entity_type == self.OVF_ATTACHMENT_ENTITY)
            & (CrmAttachment.entity_id == ovf_id)
        ]
        quote_id = preview.get("quote_id")
        opportunity_id = preview.get("opportunity_id")
        if quote_id is not None:
            entity_filters.append(
                (CrmAttachment.entity_type == "quote")
                & (CrmAttachment.entity_id == quote_id)
            )
        if opportunity_id is not None:
            entity_filters.append(
                (CrmAttachment.entity_type == "opportunity")
                & (CrmAttachment.entity_id == opportunity_id)
            )
        stmt = select(CrmAttachment).where(
            CrmAttachment.tenant_id == ctx.tenant_id,
            CrmAttachment.is_deleted.is_(False),
            or_(*entity_filters),
        )
        rows = list(self._db.scalars(stmt).all())
        seen: set = set()
        out: list[dict] = []
        for row in rows:
            if row.id in seen:
                continue
            seen.add(row.id)
            out.append(self._attachment_summary(row))
        return out

    def attach_ovf_document(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        file_name: str,
        content_base64: str,
        content_type: str | None,
        branch_id: UUID,
        company_id: UUID | None,
        category: str = "other",
    ):
        from modules.crm.service.attachment_service import AttachmentService

        preview = self.get_ovf_preview(ctx, ovf_id)
        return AttachmentService(self._db).create(
            ctx,
            entity_type=self.OVF_ATTACHMENT_ENTITY,
            entity_id=ovf_id,
            file_name=file_name,
            category=category or "other",
            branch_id=branch_id,
            company_id=company_id or preview.get("company_id"),
            content_base64=content_base64,
            content_type=content_type,
        )

    def list_po_attachments(self, ctx: TenantContext, order_id: UUID) -> list[dict]:
        from modules.crm.models import CrmAttachment
        from sqlalchemy import select

        order = self._order_service.get_order(ctx, order_id)
        stmt = select(CrmAttachment).where(
            CrmAttachment.tenant_id == ctx.tenant_id,
            CrmAttachment.entity_type == self.PO_ATTACHMENT_ENTITY,
            CrmAttachment.entity_id == order_id,
            CrmAttachment.is_deleted.is_(False),
        )
        if getattr(order, "company_id", None) is not None:
            stmt = stmt.where(CrmAttachment.company_id == order.company_id)
        return [self._attachment_summary(row) for row in self._db.scalars(stmt).all()]

    def attach_po_document(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        file_name: str,
        content_base64: str,
        content_type: str | None,
        branch_id: UUID,
        company_id: UUID | None,
        category: str = "other",
    ):
        from modules.crm.service.attachment_service import AttachmentService

        order = self._order_service.get_order(ctx, order_id)
        return AttachmentService(self._db).create(
            ctx,
            entity_type=self.PO_ATTACHMENT_ENTITY,
            entity_id=order_id,
            file_name=file_name,
            category=category or "other",
            branch_id=branch_id,
            company_id=company_id or order.company_id,
            content_base64=content_base64,
            content_type=content_type,
        )

    def list_commercial_documents_for_order(
        self, ctx: TenantContext, order_id: UUID
    ) -> list[dict]:
        """OVF pack + PO-specific files for approval / SCM review."""
        order = self._order_service.get_order(ctx, order_id)
        docs: list[dict] = []
        source_module = (getattr(order, "source_module", None) or "").strip().lower()
        source_id = getattr(order, "source_document_id", None)
        if source_module == "crm" and source_id is not None:
            try:
                docs.extend(self.list_ovf_attachments(ctx, source_id))
            except Exception:
                pass
        docs.extend(self.list_po_attachments(ctx, order_id))
        return docs

    def resolve_commercial_attachment_file(
        self, ctx: TenantContext, attachment_id: UUID
    ) -> tuple:
        from pathlib import Path

        from modules.crm.models import CrmAttachment
        from modules.crm.service.attachment_service import UPLOAD_ROOT
        from sqlalchemy import select

        # Load by tenant only — then authorize via OVF/PO ownership checks.
        row = self._db.scalar(
            select(CrmAttachment).where(
                CrmAttachment.id == attachment_id,
                CrmAttachment.tenant_id == ctx.tenant_id,
                CrmAttachment.is_deleted.is_(False),
            )
        )
        if row is None:
            raise NotFoundException("Attachment not found")
        if row.entity_type == self.OVF_ATTACHMENT_ENTITY:
            self.get_ovf_preview(ctx, row.entity_id)
        elif row.entity_type == self.PO_ATTACHMENT_ENTITY:
            self._order_service.get_order(ctx, row.entity_id)
        elif row.entity_type in {"quote", "opportunity"}:
            # Sales pack files — authorize via any OVF handoff that references them.
            from modules.crm.models.ovf import CrmOvf
            from sqlalchemy import select as sa_select

            ovf_stmt = sa_select(CrmOvf.id).where(
                CrmOvf.tenant_id == ctx.tenant_id,
                CrmOvf.is_deleted.is_(False),
            )
            if row.entity_type == "quote":
                ovf_stmt = ovf_stmt.where(CrmOvf.quote_id == row.entity_id)
            else:
                ovf_stmt = ovf_stmt.where(CrmOvf.opportunity_id == row.entity_id)
            linked_ovf_id = self._db.scalar(ovf_stmt.limit(1))
            if linked_ovf_id is None:
                raise NotFoundException("Attachment not found")
            self.get_ovf_preview(ctx, linked_ovf_id)
        else:
            raise NotFoundException("Attachment not found")
        path = Path(row.file_path)
        if not path.is_file():
            candidate = UPLOAD_ROOT / path.name
            if candidate.is_file():
                path = candidate
            else:
                raise NotFoundException("Attachment file is missing on disk")
        return path, row.file_name, row.content_type

    def get_receipt_batch(self, ctx: TenantContext, batch_id: UUID) -> ProcOrderReceiptBatch:
        cid = self._scope.resolve_company_id(ctx, None)
        batch = (
            self._db.query(ProcOrderReceiptBatch)
            .filter(
                ProcOrderReceiptBatch.id == batch_id,
                ProcOrderReceiptBatch.tenant_id == ctx.tenant_id,
                ProcOrderReceiptBatch.company_id == cid,
                ProcOrderReceiptBatch.is_deleted.is_(False),
            )
            .first()
        )
        if batch is None:
            raise NotFoundException("Receipt batch not found")
        return batch

    def attach_receipt_batch_document(
        self,
        ctx: TenantContext,
        batch_id: UUID,
        *,
        file_name: str,
        content_base64: str,
        content_type: str | None,
        branch_id: UUID,
        company_id: UUID | None,
        category: str = "other",
    ):
        from modules.crm.service.attachment_service import AttachmentService

        self.get_receipt_batch(ctx, batch_id)
        return AttachmentService(self._db).create(
            ctx,
            entity_type=self.RECEIPT_BATCH_ATTACHMENT_ENTITY,
            entity_id=batch_id,
            file_name=file_name,
            category=category,
            branch_id=branch_id,
            company_id=company_id,
            content_base64=content_base64,
            content_type=content_type,
        )

    def extract_vendor_invoice(
        self, *, file_name: str, content_base64: str
    ) -> dict:
        from modules.procurement.service.vendor_invoice_extract import (
            extract_vendor_invoice_fields,
        )

        fields = extract_vendor_invoice_fields(content_base64, file_name)
        raw_date = fields.get("vendor_invoice_date")
        if isinstance(raw_date, str):
            from datetime import date as date_cls

            try:
                fields["vendor_invoice_date"] = date_cls.fromisoformat(raw_date)
            except ValueError:
                fields["vendor_invoice_date"] = None
        return fields

    def update_receipt_batch_vendor_invoice(
        self,
        ctx: TenantContext,
        batch_id: UUID,
        *,
        vendor_invoice_number: str | None,
        vendor_invoice_date,
        vendor_invoice_quantity: float | None,
        vendor_invoice_subtotal: float | None,
        file_name: str | None,
        content_base64: str | None,
        content_type: str | None,
        branch_id: UUID,
        company_id: UUID | None,
    ) -> ProcOrderReceiptBatch:
        batch = self.get_receipt_batch(ctx, batch_id)
        batch.vendor_invoice_number = (
            vendor_invoice_number.strip() if vendor_invoice_number else None
        ) or None
        batch.vendor_invoice_date = vendor_invoice_date
        batch.vendor_invoice_quantity = vendor_invoice_quantity
        batch.vendor_invoice_subtotal = vendor_invoice_subtotal
        if content_base64 and file_name:
            self.attach_receipt_batch_document(
                ctx,
                batch_id,
                file_name=file_name,
                content_base64=content_base64,
                content_type=content_type,
                branch_id=branch_id,
                company_id=company_id,
                category="vendor_invoice",
            )
        self._db.flush()
        return batch

    @staticmethod
    def _vendor_invoice_batch_fields(batch: ProcOrderReceiptBatch | None) -> dict:
        if batch is None:
            return {
                "vendor_invoice_number": None,
                "vendor_invoice_date": None,
                "vendor_invoice_quantity": None,
                "vendor_invoice_subtotal": None,
            }
        qty = batch.vendor_invoice_quantity
        sub = batch.vendor_invoice_subtotal
        return {
            "vendor_invoice_number": batch.vendor_invoice_number,
            "vendor_invoice_date": batch.vendor_invoice_date,
            "vendor_invoice_quantity": float(qty) if qty is not None else None,
            "vendor_invoice_subtotal": float(sub) if sub is not None else None,
        }

    def list_receipt_batch_attachments(self, ctx: TenantContext, batch_id: UUID):
        from modules.crm.service.attachment_service import AttachmentService

        self.get_receipt_batch(ctx, batch_id)
        return AttachmentService(self._db).list_for_entity(
            ctx,
            self.RECEIPT_BATCH_ATTACHMENT_ENTITY,
            batch_id,
        )

    def resolve_receipt_batch_attachment_file(
        self, ctx: TenantContext, attachment_id: UUID
    ) -> tuple:
        from modules.crm.service.attachment_service import AttachmentService

        service = AttachmentService(self._db)
        row = service.get(ctx, attachment_id)
        if row.entity_type != self.RECEIPT_BATCH_ATTACHMENT_ENTITY:
            raise NotFoundException("Attachment not found")
        self.get_receipt_batch(ctx, row.entity_id)
        return service.resolve_file_path(ctx, attachment_id)

    def _receipt_batch_attachment_summaries(
        self,
        ctx: TenantContext,
        batch_ids: list[UUID],
    ) -> dict[UUID, list[dict]]:
        if not batch_ids:
            return {}
        try:
            from modules.crm.models import CrmAttachment
            from modules.crm.repository.attachment_repository import AttachmentRepository
            from sqlalchemy import select

            repo = AttachmentRepository(self._db)
            stmt = select(CrmAttachment).where(
                CrmAttachment.entity_type == self.RECEIPT_BATCH_ATTACHMENT_ENTITY,
                CrmAttachment.entity_id.in_(batch_ids),
                CrmAttachment.is_deleted.is_(False),
            )
            stmt = repo.apply_crm_filter(stmt, CrmAttachment, ctx, branch_scoped=True)
            out: dict[UUID, list[dict]] = defaultdict(list)
            for row in self._db.scalars(stmt).all():
                out[row.entity_id].append(
                    {
                        "id": row.id,
                        "file_name": row.file_name,
                        "content_type": row.content_type,
                        "size": row.size,
                    }
                )
            return dict(out)
        except Exception:
            # GRN list must still load if attachment metadata query fails.
            return {}

    def list_receipt_batches(self, ctx: TenantContext, order_id: UUID) -> list[dict]:
        order = self._order_service.get_order(ctx, order_id)
        line_by_id = {
            ln.id: ln for ln in (order.lines or []) if not getattr(ln, "is_deleted", False)
        }
        batches = (
            self._db.query(ProcOrderReceiptBatch)
            .filter(
                ProcOrderReceiptBatch.order_header_id == order_id,
                ProcOrderReceiptBatch.is_deleted.is_(False),
            )
            .order_by(ProcOrderReceiptBatch.sequence.asc())
            .all()
        )
        if batches:
            sorted_batches = sorted(batches, key=lambda b: int(b.sequence))
            batch_ids = [b.id for b in sorted_batches]
            all_batch_lines = (
                self._db.query(ProcOrderReceiptBatchLine)
                .filter(
                    ProcOrderReceiptBatchLine.receipt_batch_id.in_(batch_ids),
                    ProcOrderReceiptBatchLine.is_deleted.is_(False),
                )
                .all()
            )
            lines_by_batch: dict[UUID, list[ProcOrderReceiptBatchLine]] = defaultdict(list)
            for bl in all_batch_lines:
                lines_by_batch[bl.receipt_batch_id].append(bl)
            attachments_by_batch = self._receipt_batch_attachment_summaries(ctx, batch_ids)
            result: list[dict] = []
            for batch in sorted_batches:
                batch_lines = lines_by_batch.get(batch.id, [])
                result.append(
                    {
                        "id": batch.id,
                        "sequence": int(batch.sequence),
                        "grn_number": batch.grn_number,
                        "receipt_at": batch.receipt_at,
                        "lines": self._receipt_batch_line_payload(batch_lines, line_by_id),
                        "attachments": attachments_by_batch.get(batch.id, []),
                        **self._vendor_invoice_batch_fields(batch),
                    }
                )
            return result

        seq = int(getattr(order, "grn_sequence", 0) or 0)
        if seq <= 0:
            return []
        po_base = (order.company_po_number or order.document_number or "PO").strip()
        batch_id = getattr(order, "current_receipt_batch_id", None)
        current_batch: ProcOrderReceiptBatch | None = None
        if batch_id is not None:
            current_batch = (
                self._db.query(ProcOrderReceiptBatch)
                .filter(
                    ProcOrderReceiptBatch.id == batch_id,
                    ProcOrderReceiptBatch.is_deleted.is_(False),
                )
                .first()
            )
        attachments_by_batch = (
            self._receipt_batch_attachment_summaries(ctx, [batch_id])
            if batch_id is not None
            else {}
        )
        fallback: list[dict] = []
        for s in range(1, seq + 1):
            grn_number = (
                str(order.current_grn_number or "").strip()
                if s == seq
                else f"{po_base}/{s:03d}"
            )
            lines_payload: list[dict] = []
            if s == seq and batch_id is not None:
                for ln in line_by_id.values():
                    if (getattr(ln, "last_receipt_batch_id", None)) != batch_id:
                        continue
                    qty = float(getattr(ln, "last_receipt_qty", 0) or 0)
                    if qty <= 0:
                        continue
                    lines_payload.append(
                        {
                            "order_line_id": ln.id,
                            "line_number": ln.line_number,
                            "product_name": ln.product_name,
                            "quantity": qty,
                            "serial_numbers": None,
                            "billing": bool(getattr(ln, "last_receipt_billing", True)),
                            "billing_quantity": float(
                                getattr(ln, "last_receipt_billing_quantity", 0) or 0
                            ),
                        }
                    )
            row_batch_id = batch_id if s == seq else None
            fallback.append(
                {
                    "id": row_batch_id,
                    "sequence": s,
                    "grn_number": grn_number,
                    "receipt_at": getattr(order, "current_receipt_batch_at", None),
                    "lines": lines_payload,
                    "attachments": (
                        attachments_by_batch.get(batch_id, [])
                        if s == seq and batch_id is not None
                        else []
                    ),
                    **self._vendor_invoice_batch_fields(
                        current_batch if s == seq else None
                    ),
                }
            )
        return fallback

    @staticmethod
    def _receipt_batch_line_payload(
        batch_lines: list[ProcOrderReceiptBatchLine],
        line_by_id: dict[UUID, ProcOrderLine],
    ) -> list[dict]:
        rows: list[dict] = []
        for bl in batch_lines:
            qty = float(bl.quantity or 0)
            if qty <= 0:
                continue
            ol = line_by_id.get(bl.order_line_id)
            if ol is None:
                continue
            rows.append(
                {
                    "order_line_id": bl.order_line_id,
                    "line_number": ol.line_number,
                    "product_name": ol.product_name,
                    "quantity": qty,
                    "serial_numbers": list(bl.serial_numbers or []) or None,
                    "billing": bool(getattr(bl, "billing", True)),
                    "billing_quantity": float(getattr(bl, "billing_quantity", 0) or 0),
                }
            )
        rows.sort(key=lambda r: r["line_number"])
        return rows

    @staticmethod
    def _inventory_stock_units_from_batch_line(
        batch_line: ProcOrderReceiptBatchLine,
    ) -> list[tuple[int, str]]:
        """Units not yet billed on vendor invoice — available in procurement stock."""
        qty = int(float(batch_line.quantity or 0))
        if qty <= 0:
            return []
        bill_qty = int(float(getattr(batch_line, "billing_quantity", 0) or 0))
        bill_qty = max(0, min(bill_qty, qty))
        stock_count = qty - bill_qty
        if stock_count <= 0:
            return []
        serials = [str(s).strip() for s in (batch_line.serial_numbers or []) if str(s).strip()]
        units: list[tuple[int, str]] = []
        for i in range(stock_count):
            global_index = bill_qty + i
            unit_index = global_index + 1
            serial = serials[global_index] if global_index < len(serials) else "—"
            units.append((unit_index, serial))
        return units

    def _append_stock_units_for_receipt(
        self,
        ctx: TenantContext,
        *,
        order: ProcOrderHeader,
        line: ProcOrderLine,
        batch_id: UUID,
        grn_number: str,
        receipt_at,
        receive_qty: float,
        billing_quantity: float,
        serial_numbers: list[str] | None,
    ) -> None:
        if not self._inventory_stock_table_exists():
            return
        unit_count = int(receive_qty)
        if unit_count <= 0:
            return
        bill_delta = int(billing_quantity)
        stock_delta = unit_count - bill_delta
        if stock_delta <= 0:
            return
        serials = [str(s).strip() for s in (serial_numbers or []) if str(s).strip()]
        grn_label = (grn_number or "").strip() or "—"
        product = (line.product_name or "").strip() or "Unnamed product"
        for i in range(stock_delta):
            serial_idx = bill_delta + i
            serial = serials[serial_idx] if serial_idx < len(serials) else "—"
            unit_index = int(float(line.quantity_received or 0)) - stock_delta + i + 1
            self._db.add(
                ProcInventoryStockUnit(
                    order_header_id=order.id,
                    order_line_id=line.id,
                    receipt_batch_id=batch_id,
                    product_name=product,
                    grn_number=grn_label,
                    receipt_at=receipt_at,
                    unit_index=unit_index,
                    serial_number=serial,
                    tenant_id=order.tenant_id,
                    company_id=order.company_id,
                    branch_id=order.branch_id,
                    created_by=ctx.user_id,
                    updated_by=ctx.user_id,
                )
            )

    def clear_procurement_inventory_stock(
        self, ctx: TenantContext, company_id: UUID | None = None
    ) -> int:
        """Soft-delete explicit stock units (GRN not-billed ledger). Does not change GRN receipts."""
        if not self._inventory_stock_table_exists():
            return 0
        cid = self._scope.resolve_company_id(ctx, company_id)
        now = utcnow()
        units = (
            self._db.query(ProcInventoryStockUnit)
            .filter(
                ProcInventoryStockUnit.tenant_id == ctx.tenant_id,
                ProcInventoryStockUnit.company_id == cid,
                ProcInventoryStockUnit.is_deleted.is_(False),
            )
            .all()
        )
        for unit in units:
            unit.is_deleted = True
            unit.deleted_at = now
            unit.deleted_by = ctx.user_id
            unit.updated_by = ctx.user_id
            unit.updated_at = now
        return len(units)

    def update_inventory_stock_serial(
        self,
        ctx: TenantContext,
        stock_unit_id: UUID,
        *,
        serial_number: str,
    ) -> None:
        if not self._inventory_stock_table_exists():
            raise ConflictException("Inventory stock is not available on this database.")
        serial = str(serial_number or "").strip()
        if not serial:
            raise ConflictException("Serial number is required")
        unit = self._db.get(ProcInventoryStockUnit, stock_unit_id)
        if unit is None or unit.is_deleted:
            raise NotFoundException("Stock unit not found")
        if unit.tenant_id != ctx.tenant_id:
            raise NotFoundException("Stock unit not found")
        cid = self._scope.resolve_company_id(ctx, None)
        if unit.company_id != cid:
            raise NotFoundException("Stock unit not found")

        unit.serial_number = serial
        unit.updated_by = ctx.user_id
        unit.updated_at = utcnow()

        batch_line = (
            self._db.query(ProcOrderReceiptBatchLine)
            .filter(
                ProcOrderReceiptBatchLine.receipt_batch_id == unit.receipt_batch_id,
                ProcOrderReceiptBatchLine.order_line_id == unit.order_line_id,
                ProcOrderReceiptBatchLine.is_deleted.is_(False),
            )
            .first()
        )
        if batch_line is not None:
            serials = [str(s).strip() for s in (batch_line.serial_numbers or [])]
            idx = max(0, int(unit.unit_index) - 1)
            while len(serials) <= idx:
                serials.append("—")
            serials[idx] = serial
            batch_line.serial_numbers = serials
            batch_line.updated_by = ctx.user_id
            batch_line.updated_at = utcnow()

        line = self._db.get(ProcOrderLine, unit.order_line_id)
        if line is not None and not line.is_deleted:
            if line.last_receipt_batch_id == unit.receipt_batch_id:
                last_serials = [str(s).strip() for s in (line.last_receipt_serial_numbers or [])]
                idx = max(0, int(unit.unit_index) - 1)
                while len(last_serials) <= idx:
                    last_serials.append("—")
                last_serials[idx] = serial
                line.last_receipt_serial_numbers = last_serials
                line.updated_by = ctx.user_id
                line.updated_at = utcnow()

    def update_inventory_order_line_description(
        self,
        ctx: TenantContext,
        order_line_id: UUID,
        *,
        description: str,
    ) -> None:
        """Update inventory Description column (stored as PO line product_code)."""
        line = self._db.get(ProcOrderLine, order_line_id)
        if line is None or line.is_deleted:
            raise NotFoundException("Order line not found")
        if line.tenant_id != ctx.tenant_id:
            raise NotFoundException("Order line not found")
        cid = self._scope.resolve_company_id(ctx, None)
        if line.company_id != cid:
            raise NotFoundException("Order line not found")
        next_value = str(description or "").strip()[:50] or None
        line.product_code = next_value
        line.updated_by = ctx.user_id
        line.updated_at = utcnow()

    def update_inventory_import_serial(
        self,
        ctx: TenantContext,
        import_line_id: UUID,
        *,
        serial_number: str,
    ) -> None:
        if not self._inventory_import_table_exists():
            raise ConflictException("Inventory import is not available on this database.")
        serial = str(serial_number or "").strip()
        if not serial:
            raise ConflictException("Serial number is required")
        row = self._db.get(ProcInventoryImportLine, import_line_id)
        if row is None or row.is_deleted:
            raise NotFoundException("Import line not found")
        if row.tenant_id != ctx.tenant_id:
            raise NotFoundException("Import line not found")
        cid = self._scope.resolve_company_id(ctx, None)
        if row.company_id != cid:
            raise NotFoundException("Import line not found")
        row.serial_number = serial
        row.updated_by = ctx.user_id
        row.updated_at = utcnow()

    def _inventory_order_headers(
        self,
        ctx: TenantContext,
        company_id: UUID,
        order_ids: list[UUID],
    ) -> dict[UUID, ProcOrderHeader]:
        if not order_ids:
            return {}
        stmt = select(ProcOrderHeader).where(
            ProcOrderHeader.company_id == company_id,
            ProcOrderHeader.is_deleted.is_(False),
            ProcOrderHeader.id.in_(order_ids),
        )
        stmt = ProcScopedRepository.apply_proc_filter(stmt, ProcOrderHeader, ctx, branch_scoped=True)
        stmt = stmt.options(
            load_only(
                ProcOrderHeader.id,
                ProcOrderHeader.vendor_id,
                ProcOrderHeader.company_po_number,
                ProcOrderHeader.document_number,
                ProcOrderHeader.tenant_id,
                ProcOrderHeader.company_id,
                ProcOrderHeader.branch_id,
            )
        )
        rows = list(self._db.scalars(stmt).all())
        return {row.id: row for row in rows}

    def _inventory_order_lines(
        self,
        ctx: TenantContext,
        line_ids: list[UUID],
    ) -> dict[UUID, ProcOrderLine]:
        if not line_ids:
            return {}
        stmt = select(ProcOrderLine).where(
            ProcOrderLine.is_deleted.is_(False),
            ProcOrderLine.id.in_(line_ids),
        )
        stmt = ProcScopedRepository.apply_proc_filter(stmt, ProcOrderLine, ctx, branch_scoped=True)
        stmt = stmt.options(
            load_only(
                ProcOrderLine.id,
                ProcOrderLine.product_name,
                ProcOrderLine.product_code,
                ProcOrderLine.line_number,
                ProcOrderLine.unit_cost,
                ProcOrderLine.tenant_id,
                ProcOrderLine.company_id,
                ProcOrderLine.branch_id,
                ProcOrderLine.is_deleted,
            )
        )
        rows = list(self._db.scalars(stmt).all())
        return {row.id: row for row in rows}

    def list_procurement_inventory(
        self, ctx: TenantContext, company_id: UUID | None = None
    ) -> list[dict]:
        """One row per stock unit on hand (ledger) plus optional Excel import lines."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        order_cache: dict[UUID, ProcOrderHeader] = {}
        result: list[dict] = []

        if self._inventory_stock_table_exists():
            stock_rows = (
                self._db.query(ProcInventoryStockUnit)
                .filter(
                    ProcInventoryStockUnit.tenant_id == ctx.tenant_id,
                    ProcInventoryStockUnit.company_id == cid,
                    ProcInventoryStockUnit.is_deleted.is_(False),
                )
                .order_by(
                    ProcInventoryStockUnit.receipt_at.desc(),
                    ProcInventoryStockUnit.grn_number.desc(),
                )
                .all()
            )
            order_ids = list({row.order_header_id for row in stock_rows})
            order_cache = self._inventory_order_headers(ctx, cid, order_ids)
            line_by_id = self._inventory_order_lines(
                ctx,
                list({row.order_line_id for row in stock_rows}),
            )
            for stock in stock_rows:
                order = order_cache.get(stock.order_header_id)
                if order is None:
                    continue
                ol = line_by_id.get(stock.order_line_id)
                po_number = (order.company_po_number or order.document_number or "").strip() or "—"
                unit_cost = float(getattr(ol, "unit_cost", 0) or 0) if ol else 0.0
                line_number = int(ol.line_number) if ol else 0
                product_code = (getattr(ol, "product_code", None) or "").strip() if ol else ""
                result.append(
                    {
                        "order_id": order.id,
                        "order_line_id": stock.order_line_id,
                        "receipt_batch_id": stock.receipt_batch_id,
                        "grn_number": stock.grn_number,
                        "receipt_at": stock.receipt_at,
                        "company_po_number": po_number,
                        "vendor_id": order.vendor_id,
                        "product_name": stock.product_name,
                        "line_number": line_number,
                        "unit_index": stock.unit_index,
                        "serial_number": stock.serial_number,
                        "source": "grn",
                        "received_quantity": 1,
                        "billing_quantity": 0,
                        "unit_cost": unit_cost,
                        "description": product_code or None,
                        "stock_unit_id": stock.id,
                        "import_line_id": None,
                    }
                )
        else:
            batches = (
                self._db.query(ProcOrderReceiptBatch)
                .join(ProcOrderHeader, ProcOrderReceiptBatch.order_header_id == ProcOrderHeader.id)
                .filter(
                    ProcOrderReceiptBatch.tenant_id == ctx.tenant_id,
                    ProcOrderReceiptBatch.company_id == cid,
                    ProcOrderReceiptBatch.is_deleted.is_(False),
                    ProcOrderHeader.is_deleted.is_(False),
                )
                .order_by(
                    ProcOrderReceiptBatch.receipt_at.desc(),
                    ProcOrderReceiptBatch.grn_number.desc(),
                )
                .all()
            )

            batch_ids = [batch.id for batch in batches]
            all_batch_lines: list[ProcOrderReceiptBatchLine] = []
            lines_by_batch: dict[UUID, list[ProcOrderReceiptBatchLine]] = defaultdict(list)
            if batch_ids:
                batch_line_load = [
                    ProcOrderReceiptBatchLine.id,
                    ProcOrderReceiptBatchLine.receipt_batch_id,
                    ProcOrderReceiptBatchLine.order_line_id,
                    ProcOrderReceiptBatchLine.quantity,
                    ProcOrderReceiptBatchLine.serial_numbers,
                    ProcOrderReceiptBatchLine.is_deleted,
                ]
                if self._receipt_batch_line_has_billing_quantity():
                    batch_line_load.append(ProcOrderReceiptBatchLine.billing_quantity)
                all_batch_lines = (
                    self._db.query(ProcOrderReceiptBatchLine)
                    .options(load_only(*batch_line_load))
                    .filter(
                        ProcOrderReceiptBatchLine.receipt_batch_id.in_(batch_ids),
                        ProcOrderReceiptBatchLine.is_deleted.is_(False),
                    )
                    .all()
                )
                for bl in all_batch_lines:
                    lines_by_batch[bl.receipt_batch_id].append(bl)

            order_ids = list({batch.order_header_id for batch in batches})
            order_cache = self._inventory_order_headers(ctx, cid, order_ids)
            line_by_id = self._inventory_order_lines(
                ctx,
                list({bl.order_line_id for bl in all_batch_lines}),
            )

            for batch in batches:
                order_id = batch.order_header_id
                order = order_cache.get(order_id)
                if order is None:
                    continue
                po_number = (order.company_po_number or order.document_number or "").strip() or "—"
                grn_label = (batch.grn_number or "").strip() or "—"

                for bl in lines_by_batch.get(batch.id, []):
                    qty = float(bl.quantity or 0)
                    if qty <= 0:
                        continue
                    ol = line_by_id.get(bl.order_line_id)
                    if ol is None:
                        continue
                    bill_qty = float(getattr(bl, "billing_quantity", 0) or 0)
                    unit_cost = float(getattr(ol, "unit_cost", 0) or 0)
                    product_code = (getattr(ol, "product_code", None) or "").strip()
                    stock_units = self._inventory_stock_units_from_batch_line(bl)
                    for unit_index, serial in stock_units:
                        result.append(
                            {
                                "order_id": order.id,
                                "order_line_id": ol.id,
                                "receipt_batch_id": batch.id,
                                "grn_number": grn_label,
                                "receipt_at": batch.receipt_at,
                                "company_po_number": po_number,
                                "vendor_id": order.vendor_id,
                                "product_name": ol.product_name,
                                "line_number": int(ol.line_number),
                                "unit_index": unit_index,
                                "serial_number": serial,
                                "source": "grn",
                                "received_quantity": qty,
                                "billing_quantity": bill_qty,
                                "unit_cost": unit_cost,
                                "description": product_code or None,
                                "stock_unit_id": None,
                                "import_line_id": None,
                            }
                        )

        if self._inventory_import_table_exists():
            imports = (
                self._db.query(ProcInventoryImportLine)
                .filter(
                    ProcInventoryImportLine.tenant_id == ctx.tenant_id,
                    ProcInventoryImportLine.company_id == cid,
                    ProcInventoryImportLine.is_deleted.is_(False),
                )
                .order_by(ProcInventoryImportLine.created_at.desc())
                .all()
            )
            for row in imports:
                vendor_id = None
                po_label = (row.company_po_number or "").strip() or "Without PO"
                if row.order_header_id:
                    linked_order = order_cache.get(row.order_header_id)
                    if linked_order is None:
                        extra = self._inventory_order_headers(
                            ctx,
                            cid,
                            [row.order_header_id],
                        )
                        linked_order = extra.get(row.order_header_id)
                        if linked_order is not None:
                            order_cache[row.order_header_id] = linked_order
                    if linked_order:
                        vendor_id = linked_order.vendor_id
                        po_label = (
                            linked_order.company_po_number or linked_order.document_number or po_label
                        ).strip()
                result.append(
                    {
                        "order_id": row.order_header_id,
                        "order_line_id": None,
                        "receipt_batch_id": None,
                        "grn_number": "Imported",
                        "receipt_at": row.created_at,
                        "company_po_number": po_label,
                        "vendor_id": vendor_id,
                        "product_name": row.product_name,
                        "line_number": 0,
                        "unit_index": 1,
                        "serial_number": row.serial_number,
                        "source": "import",
                        "received_quantity": 1,
                        "billing_quantity": 0,
                        "unit_cost": 0,
                        "description": None,
                        "stock_unit_id": None,
                        "import_line_id": row.id,
                    }
                )

        result.sort(
            key=lambda r: (
                r["grn_number"] or "",
                r["company_po_number"] or "",
                r["line_number"],
                r["unit_index"],
            ),
            reverse=True,
        )
        return result

    def import_inventory_lines(
        self,
        ctx: TenantContext,
        lines: list[dict],
        *,
        company_id: UUID | None = None,
    ) -> int:
        if not self._inventory_import_table_exists():
            raise ConflictException(
                "Inventory import is not available. Run database migration 0466."
            )
        cid = company_id or ctx.company_id
        created = 0
        for raw in lines:
            product = str(raw.get("product_name") or "").strip()
            serial = str(raw.get("serial_number") or "").strip()
            if not product or not serial:
                continue
            order_id = raw.get("order_id")
            po_number: str | None = None
            if order_id is not None:
                order = self._order_service.get_order(ctx, order_id)
                if order.company_id != cid:
                    raise ConflictException("Purchase order does not belong to this company")
                po_number = (order.company_po_number or order.document_number or "").strip() or None
            else:
                order_id = None
            row = ProcInventoryImportLine(
                product_name=product,
                serial_number=serial,
                order_header_id=order_id,
                company_po_number=po_number,
                tenant_id=ctx.tenant_id,
                company_id=cid,
                branch_id=ctx.branch_id,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
            )
            self._db.add(row)
            created += 1
        if created == 0:
            raise ConflictException("No valid product / serial rows to import")
        return created
