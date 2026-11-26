"""SCM handoff service - Finance-approved OVF queue → vendor PO → GRN tracking."""

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import inspect, select
from sqlalchemy.orm import Session, load_only

from core.exceptions import (
    ConflictException,
    ForbiddenException,
    NotFoundException,
    ValidationException,
)
from modules.crm.service.ovf_service import resolve_scm_hold_started_at
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.user_repository import UserRepository
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.procurement.adapters.crm_adapter import ProcurementCrmAdapter
from modules.procurement.adapters.master_data_adapter import (
    ProcurementMasterDataAdapter,
    scm_line_product_code,
)
from modules.crm.domain.lead_sourcing_channels import (
    SERVICE_CHANNEL_CACHE,
    normalize_service_sourcing_channel,
)
from modules.procurement.domain.approval_step_owners import APPROVAL_STEP_CATALOG, STAGE_TO_STEP_KEY
from modules.procurement.domain.enums import OrderStatus
from modules.procurement.domain.exceptions import InvalidDocumentState
from modules.procurement.domain.service_po import ORDER_KIND_PRODUCT
from modules.procurement.models.inventory_adjustment import ProcInventoryStockAdjustment
from modules.procurement.models.inventory_import import ProcInventoryImportLine
from modules.procurement.models.inventory_stock import ProcInventoryStockUnit
from modules.procurement.models.order import ProcOrderHeader, ProcOrderLine
from modules.procurement.models.ovf_stock_allocation import ProcOvfStockAllocation
from modules.procurement.models.receipt_batch import (
    ProcOrderReceiptBatch,
    ProcOrderReceiptBatchLine,
)
from modules.procurement.repository.base import ProcScopedRepository, utcnow
from modules.procurement.repository.order_repository import OrderRepository
from modules.procurement.service.approval_step_owner_service import ProcApprovalStepOwnerService
from modules.procurement.service.company_po_number_service import (
    normalize_entity_code,
    peek_next_company_po_number,
)
from modules.procurement.service.invoice_generation_task_service import (
    ProcInvoiceGenerationTaskService,
)
from modules.procurement.service.engines.receipt_reversal import (
    assert_batch_reversible,
    line_receipt_status,
    order_receipt_status,
    subtract_received,
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
        self._inventory_stock_qty_ready: bool | None = None
        self._inventory_adjustment_table_ready: bool | None = None
        self._ovf_stock_allocation_table_ready: bool | None = None
        self._batch_line_billing_quantity_ready: bool | None = None
        self._batch_line_delivery_challan_qty_ready: bool | None = None
        self._crm = ProcurementCrmAdapter(db)
        self._master = ProcurementMasterDataAdapter(db)
        self._orders = OrderRepository(db)
        self._order_service = OrderService(db)
        self._scope = ProcurementScopeValidator(db)
        self._audit = PlatformAuditFacade(db)
        self._users = UserRepository(db)
        self._approvers = ProcApprovalStepOwnerService(db)

    def _resolve_user_names(
        self, tenant_id: UUID, user_ids: set[UUID]
    ) -> dict[UUID, str]:
        names: dict[UUID, str] = {}
        for user_id in user_ids:
            if user_id is None:
                continue
            user = self._users.get_by_id(tenant_id, user_id)
            if user and user.display_name:
                names[user_id] = user.display_name
        return names

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

    def _inventory_stock_has_quantity(self) -> bool:
        if self._inventory_stock_qty_ready is None:
            if not self._inventory_stock_table_exists():
                self._inventory_stock_qty_ready = False
            else:
                cols = {
                    c["name"]
                    for c in inspect(self._db.get_bind()).get_columns(
                        "proc_inventory_stock_unit",
                        schema="procurement",
                    )
                }
                self._inventory_stock_qty_ready = "quantity" in cols
        return self._inventory_stock_qty_ready

    def _inventory_adjustment_table_exists(self) -> bool:
        if self._inventory_adjustment_table_ready is None:
            self._inventory_adjustment_table_ready = inspect(self._db.get_bind()).has_table(
                "proc_inventory_stock_adjustment",
                schema="procurement",
            )
        return self._inventory_adjustment_table_ready

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

    def _receipt_batch_line_has_delivery_challan_quantity(self) -> bool:
        if self._batch_line_delivery_challan_qty_ready is None:
            bind = self._db.get_bind()
            cols = {
                c["name"]
                for c in inspect(bind).get_columns(
                    "proc_order_receipt_batch_line",
                    schema="procurement",
                )
            }
            self._batch_line_delivery_challan_qty_ready = "delivery_challan_quantity" in cols
        return self._batch_line_delivery_challan_qty_ready

    def _ovf_stock_allocation_table_exists(self) -> bool:
        if self._ovf_stock_allocation_table_ready is None:
            self._ovf_stock_allocation_table_ready = inspect(self._db.get_bind()).has_table(
                "proc_ovf_stock_allocation",
                schema="procurement",
            )
        return self._ovf_stock_allocation_table_ready

    @staticmethod
    def _product_key(name: str | None) -> str:
        return (name or "").strip().lower()

    @staticmethod
    def _ovf_stock_source_key(ovf_id: UUID) -> str:
        return f"ovf-stock:{ovf_id}"

    @staticmethod
    def _demand_by_product(customer_lines: list, vendor_lines: list) -> dict[str, dict]:
        source = customer_lines if customer_lines else vendor_lines
        out: dict[str, dict] = {}
        for ln in source or []:
            key = ScmHandoffService._product_key(ln.get("product_name"))
            if not key:
                continue
            qty = float(ln.get("qty") or 0)
            if key not in out:
                out[key] = {
                    "product_name": (ln.get("product_name") or "").strip(),
                    "required_qty": 0.0,
                }
            out[key]["required_qty"] += qty
        return out

    def _on_hand_qty_by_product(self, ctx: TenantContext, company_id: UUID) -> dict[str, float]:
        if not self._inventory_stock_table_exists():
            return {}
        rows = (
            self._db.query(ProcInventoryStockUnit)
            .filter(
                ProcInventoryStockUnit.tenant_id == ctx.tenant_id,
                ProcInventoryStockUnit.company_id == company_id,
                ProcInventoryStockUnit.is_deleted.is_(False),
            )
            .all()
        )
        totals: dict[str, float] = defaultdict(float)
        for row in rows:
            totals[self._product_key(row.product_name)] += float(getattr(row, "quantity", None) or 1)
        return dict(totals)

    def _allocations_by_ovf(
        self,
        ctx: TenantContext,
        ovf_ids: list[UUID],
    ) -> dict[UUID, list[ProcOvfStockAllocation]]:
        if not ovf_ids or not self._ovf_stock_allocation_table_exists():
            return {}
        rows = (
            self._db.query(ProcOvfStockAllocation)
            .filter(
                ProcOvfStockAllocation.tenant_id == ctx.tenant_id,
                ProcOvfStockAllocation.ovf_id.in_(ovf_ids),
                ProcOvfStockAllocation.is_deleted.is_(False),
            )
            .all()
        )
        grouped: dict[UUID, list[ProcOvfStockAllocation]] = defaultdict(list)
        for row in rows:
            grouped[row.ovf_id].append(row)
        return dict(grouped)

    def _stock_snapshot(
        self,
        *,
        on_hand: dict[str, float],
        customer_lines: list,
        vendor_lines: list,
        allocations: list[ProcOvfStockAllocation],
    ) -> dict:
        demand = self._demand_by_product(customer_lines, vendor_lines)
        allocated_by_product: dict[str, float] = defaultdict(float)
        for row in allocations:
            allocated_by_product[self._product_key(row.product_name)] += float(row.quantity or 0)
        availability: list[dict] = []
        remaining_total = 0.0
        allocated_total = 0.0
        for item in demand.values():
            key = self._product_key(item["product_name"])
            required = float(item["required_qty"] or 0)
            allocated = float(allocated_by_product.get(key, 0) or 0)
            remaining = max(0.0, round(required - allocated, 4))
            availability.append(
                {
                    "product_name": item["product_name"],
                    "required_qty": required,
                    "on_hand_qty": float(on_hand.get(key, 0) or 0),
                    "allocated_qty": allocated,
                    "remaining_qty": remaining,
                }
            )
            remaining_total += remaining
            allocated_total += allocated
        if allocated_total <= 1e-9:
            status = "none"
        elif remaining_total <= 1e-9:
            status = "complete"
        else:
            status = "partial"
        return {
            "stock_availability": availability,
            "stock_fulfillment_status": status,
            "remaining_demand_qty": remaining_total,
            "has_demand": bool(demand),
        }

    _IN_STOCK_KEYS = frozenset({"in stock", "instock", "inventory", "from inventory", "from stock"})

    @classmethod
    def _normalize_distributor_key(cls, value: str | None) -> str:
        return " ".join(str(value or "").strip().lower().replace("-", " ").split())

    @classmethod
    def _is_in_stock_line(cls, ln: dict) -> bool:
        source = str(ln.get("fulfillment_source") or "").strip().lower()
        if source == "inventory":
            return True
        if source == "purchase_order":
            return False
        return cls._normalize_distributor_key(ln.get("distributor_name")) in cls._IN_STOCK_KEYS

    @classmethod
    def _item_plan(cls, vendor_lines: list, stock_availability: list | None = None) -> dict:
        """Per-line stock vs vendor PO plan, plus together/separate delivery."""
        avail_by = {
            cls._product_key(row.get("product_name")): row
            for row in (stock_availability or [])
            if cls._product_key(row.get("product_name"))
        }
        lines: list[dict] = []
        has_stock = False
        has_po = False
        vendor_keys: set[str] = set()
        for ln in vendor_lines or []:
            name = (ln.get("product_name") or "").strip() or "-"
            qty = float(ln.get("qty") or 0)
            dist = (ln.get("distributor_name") or "").strip() or None
            avail = avail_by.get(cls._product_key(name)) or {}
            on_hand = float(avail.get("on_hand_qty") or 0)
            allocated = float(avail.get("allocated_qty") or 0)
            is_stock = cls._is_in_stock_line(ln)
            if is_stock:
                has_stock = True
                book_qty = min(qty, max(on_hand, allocated))
                po_qty = max(0.0, round(qty - book_qty, 4))
                in_stock = book_qty + 1e-9 >= qty
                action = "book_stock" if in_stock else "stock_short"
                source = "inventory"
            else:
                has_po = True
                book_qty = 0.0
                po_qty = qty
                in_stock = False
                action = "create_po" if dist else "no_vendor"
                source = "purchase_order"
                if dist:
                    vendor_keys.add(" ".join(dist.lower().split()))
            lines.append(
                {
                    "product_name": name,
                    "qty": qty,
                    "distributor_name": dist,
                    "source": source,
                    "on_hand_qty": on_hand,
                    "allocated_qty": allocated,
                    "book_qty": book_qty,
                    "po_qty": po_qty,
                    "in_stock": in_stock,
                    "action": action,
                }
            )
        if has_stock and has_po:
            delivery = "separate"
            if len(vendor_keys) > 1:
                note = "Separate - stock and vendors"
            else:
                note = "Separate - stock and vendor"
        elif has_po and len(vendor_keys) > 1:
            delivery = "separate"
            note = "Separate - by vendor"
        elif has_stock and not has_po:
            delivery = "together"
            note = "Together - from stock"
        elif has_po:
            delivery = "together"
            note = "Together - vendor PO"
        else:
            delivery = "together"
            note = ""
        return {"lines": lines, "delivery": delivery, "delivery_note": note}

    @classmethod
    def _distributor_group_key(cls, ln: dict) -> str:
        return " ".join(str(ln.get("distributor_name") or "").strip().lower().split())

    def _active_orders_for_ovf(self, ctx: TenantContext, ovf_id: UUID) -> list:
        rows = self._orders.list_by_source(
            ctx,
            source_module=self.SOURCE_MODULE,
            source_document_type=self.SOURCE_DOC_TYPE,
            source_document_id=ovf_id,
        )
        return [row for row in rows if row.status != OrderStatus.CANCELLED.value]

    def _vendor_display_name(self, ctx: TenantContext, vendor_id) -> str | None:
        try:
            vendor = self._master.get_vendor(ctx, vendor_id)
        except Exception:
            return None
        return (
            getattr(vendor, "vendor_name", None)
            or getattr(vendor, "name", None)
            or getattr(vendor, "display_name", None)
        )

    @staticmethod
    def _order_total_qty(order) -> float:
        total = 0.0
        for ln in getattr(order, "lines", None) or []:
            if getattr(ln, "is_deleted", False):
                continue
            total += float(getattr(ln, "quantity", 0) or 0)
        return round(total, 4)

    @classmethod
    def _required_po_qty(cls, vendor_lines: list) -> float:
        total = 0.0
        for ln in vendor_lines or []:
            if cls._is_in_stock_line(ln):
                continue
            total += float(ln.get("qty") or 0)
        return round(total, 4)

    @staticmethod
    def _vendor_rejected_order(order) -> bool:
        return (getattr(order, "fulfillment_stage", None) or "") == "vendor_rejected"

    def _serialize_linked_pos(self, ctx: TenantContext, orders: list) -> list[dict]:
        out: list[dict] = []
        for order in orders:
            out.append(
                {
                    "id": order.id,
                    "vendor_id": order.vendor_id,
                    "vendor_name": self._vendor_display_name(ctx, order.vendor_id),
                    "document_number": order.document_number,
                    "company_po_number": order.company_po_number,
                    "status": order.status,
                    "fulfillment_stage": getattr(order, "fulfillment_stage", None),
                    "total_qty": self._order_total_qty(order),
                }
            )
        return out

    def _ovf_po_groups(
        self,
        ctx: TenantContext,
        vendor_lines: list,
        orders: list,
    ) -> list[dict]:
        grouped: dict[str, dict] = {}
        for ln in vendor_lines or []:
            if self._is_in_stock_line(ln):
                continue
            key = self._distributor_group_key(ln) or "__unassigned__"
            if key not in grouped:
                grouped[key] = {
                    "distributor_name": (ln.get("distributor_name") or "").strip() or None,
                    "line_count": 0,
                    "required_qty": 0.0,
                    "ordered_qty": 0.0,
                    "has_po": False,
                    "purchase_order_id": None,
                }
            grouped[key]["line_count"] += 1
            grouped[key]["required_qty"] = round(
                float(grouped[key]["required_qty"]) + float(ln.get("qty") or 0),
                4,
            )

        unused = list(orders)

        def _attach_order(group: dict, order) -> None:
            qty = self._order_total_qty(order)
            ordered = round(float(group.get("ordered_qty") or 0) + qty, 4)
            group["ordered_qty"] = ordered
            # Fully covered only when ordered qty meets required demand.
            # A partial Create PO must keep the group open for remainder rows.
            required = float(group.get("required_qty") or 0)
            if required <= 1e-9:
                group["has_po"] = ordered > 0
            else:
                group["has_po"] = ordered + 1e-9 >= required
            if not group.get("purchase_order_id"):
                group["purchase_order_id"] = order.id
                group["document_number"] = order.document_number
                group["company_po_number"] = order.company_po_number
                group["status"] = order.status

        for key, group in grouped.items():
            needle = " ".join(str(group["distributor_name"] or "").strip().lower().split())
            # Attach every matching vendor PO (supports multiple partial POs).
            still_unused: list = []
            for order in unused:
                if self._vendor_rejected_order(order):
                    continue
                name = " ".join(
                    str(self._vendor_display_name(ctx, order.vendor_id) or "").strip().lower().split()
                )
                matched = False
                if needle and name and (needle == name or needle in name or name in needle):
                    matched = True
                elif key == "__unassigned__" or needle in {"", "vendor", "unassigned"}:
                    matched = True
                if matched:
                    _attach_order(group, order)
                else:
                    still_unused.append(order)
            unused = still_unused
        # Leftover POs (name mismatch) still count toward unmatched groups' ordered qty.
        for group in grouped.values():
            if group.get("has_po") or not unused:
                continue
            while unused and self._vendor_rejected_order(unused[0]):
                unused.pop(0)
            if not unused:
                continue
            order = unused.pop(0)
            _attach_order(group, order)
        return list(grouped.values())

    def _open_distributor_names(self, groups: list[dict]) -> list[str]:
        return [
            str(g.get("distributor_name") or "").strip()
            for g in groups
            if not g.get("has_po") and str(g.get("distributor_name") or "").strip()
        ]

    def _vendor_lines_for_po(
        self,
        handoff: dict,
        *,
        distributor_name: str | None,
        lines: list[dict] | None,
    ) -> list[dict]:
        if lines is not None:
            return [
                {
                    "product_name": str(ln.get("product_name") or "").strip(),
                    "qty": float(ln.get("qty") or 0),
                    "unit_price": float(ln.get("unit_price") or 0),
                    "rate_currency": str(ln.get("rate_currency") or "INR")
                    .strip()
                    .upper()
                    or "INR",
                    "tax_rate": float(ln.get("tax_rate") or 0),
                    "description": str(ln.get("description") or "").strip() or None,
                }
                for ln in lines
                if str(ln.get("product_name") or "").strip()
            ]
        vendor_lines = [
            ln
            for ln in (handoff.get("vendor_lines") or [])
            if not self._is_in_stock_line(ln)
        ]
        needle = " ".join((distributor_name or "").strip().lower().split())
        if needle:
            vendor_lines = [
                ln for ln in vendor_lines if self._distributor_group_key(ln) == needle
            ]
        return vendor_lines

    def _ovf_vendor_baseline_amount(
        self,
        handoff: dict,
        *,
        distributor_name: str | None = None,
    ) -> float:
        """Original CRM OVF vendor total (incl. tax) for negotiation baseline.

        Uses handoff vendor lines as Sales handed them over - never the
        negotiated rates SCM may already have put on the draft PO.
        """
        vendor_lines = [
            ln
            for ln in (handoff.get("vendor_lines") or [])
            if not self._is_in_stock_line(ln)
        ]
        needle = " ".join((distributor_name or "").strip().lower().split())
        if needle:
            vendor_lines = [
                ln for ln in vendor_lines if self._distributor_group_key(ln) == needle
            ]
        total = 0.0
        for ln in vendor_lines:
            with_tax = ln.get("total_with_gst")
            if with_tax is not None:
                total += float(with_tax or 0)
                continue
            line_total = float(ln.get("line_total") or 0)
            if line_total <= 0:
                qty = float(ln.get("qty") or 0)
                unit = float(ln.get("unit_price") or 0)
                line_total = qty * unit
            gst_amount = ln.get("gst_amount")
            if gst_amount is not None:
                total += line_total + float(gst_amount or 0)
                continue
            gst_pct = float(ln.get("gst_pct") or 0)
            total += line_total * (1.0 + gst_pct / 100.0) if gst_pct > 0 else line_total
        return round(total, 4)

    def _serialize_allocations(self, rows: list[ProcOvfStockAllocation]) -> list[dict]:
        return [
            {
                "id": row.id,
                "stock_unit_id": row.stock_unit_id,
                "product_name": row.product_name,
                "quantity": float(row.quantity or 0),
                "serial_number": row.serial_number,
            }
            for row in rows
        ]

    def _challan_prefill_from_allocations(
        self,
        handoff: dict,
        allocations: list[ProcOvfStockAllocation],
        unit_cost_by_id: dict[UUID, float] | None = None,
    ) -> dict:
        ovf_id = handoff["ovf_id"]
        attn_parts = [
            (handoff.get("shipping_contact_person") or "").strip(),
            (handoff.get("billing_contact_person") or "").strip(),
        ]
        # Same product → one challan line with summed qty (serials joined).
        grouped: dict[str, dict] = {}
        for row in allocations:
            key = self._product_key(row.product_name)
            qty = float(row.quantity or 0)
            if qty <= 0:
                continue
            rate = 0.0
            if unit_cost_by_id:
                rate = float(unit_cost_by_id.get(row.stock_unit_id, 0) or 0)
            serial = (row.serial_number or "").strip()
            if key not in grouped:
                grouped[key] = {
                    "product_name": row.product_name,
                    "quantity": 0.0,
                    "rate_total": 0.0,
                    "serials": [],
                    "stock_unit_id": row.stock_unit_id,
                }
            bucket = grouped[key]
            bucket["quantity"] += qty
            bucket["rate_total"] += rate * qty
            if serial and serial not in ("-", "-") and serial not in bucket["serials"]:
                bucket["serials"].append(serial)
        lines = []
        for bucket in grouped.values():
            qty = float(bucket["quantity"])
            serials: list[str] = bucket["serials"]
            joined = ", ".join(serials) if serials else "-"
            lines.append(
                {
                    "product_name": bucket["product_name"],
                    "description": joined,
                    "quantity": qty,
                    "serial_number": joined,
                    "rate": (float(bucket["rate_total"]) / qty) if qty else 0.0,
                    "stock_unit_id": bucket["stock_unit_id"],
                }
            )
        return {
            "ovf_id": ovf_id,
            "ovf_no": handoff.get("ovf_no") or "",
            "source_key": self._ovf_stock_source_key(ovf_id),
            "customer_name": handoff.get("customer_name") or handoff.get("account_name"),
            "customer_bill_to": handoff.get("billing_address"),
            "customer_ship_to": handoff.get("shipping_address"),
            "customer_gst": handoff.get("customer_gst"),
            "po_number": handoff.get("po_number"),
            "po_date": handoff.get("po_date"),
            "kind_attn": " / ".join([p for p in attn_parts if p]) or None,
            "lines": lines,
        }


    def list_scm_queue(self, ctx: TenantContext, company_id: UUID | None = None) -> list[dict]:
        # Pass optional company filter through - do not force session company, or CT
        # OVFs shared to SCM stay invisible while the user is parked on CDPL.
        ovfs = self._crm.list_shared_ovfs(ctx, company_id)
        stock_company_id = company_id or ctx.company_id
        # One vendor load for the whole queue - used for OEM suggestions when no PO yet.
        vendor_pool = self._master.list_vendors(
            ctx, company_id=stock_company_id, branch_scoped=False
        )
        if not vendor_pool:
            vendor_pool = self._master.list_vendors(ctx, company_id=None, branch_scoped=False)
        items: list[dict] = []
        on_hand = (
            self._on_hand_qty_by_product(ctx, stock_company_id) if stock_company_id else {}
        )
        alloc_map = self._allocations_by_ovf(ctx, [ovf.id for ovf in ovfs])
        for ovf in ovfs:
            existing_orders = self._active_orders_for_ovf(ctx, ovf.id)
            existing = existing_orders[0] if existing_orders else None
            vendor_total = 0.0
            vendor_qty = 0.0
            customer_total = 0.0
            customer_total_with_tax = 0.0
            margin_amount = 0.0
            vendor_payment_days = 0
            customer_payment_days = 0
            vendor_name: str | None = None
            oem_name: str | None = None
            distributor_name: str | None = None
            project_title: str | None = None
            handoff: dict = {}
            try:
                handoff = self._crm.get_handoff(ctx, ovf.id)
                oem_name = (handoff.get("oem_name") or "").strip() or None
                distributor_name = (handoff.get("distributor_name") or "").strip() or None
                project_title = (handoff.get("project_title") or "").strip() or None
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
                # Suggested vendor from CRM distributor (distributor ≡ vendor; OEM is brand only).
                vendor_name = self._master.match_vendor_name_by_distributor(
                    ctx,
                    company_id=ovf.company_id,
                    distributor_name=distributor_name,
                    vendors=vendor_pool,
                )
            is_cancelled = (
                existing is not None and existing.status == OrderStatus.CANCELLED.value
            )
            scm_on_hold = bool(getattr(ovf, "scm_on_hold", False)) or is_cancelled
            stock = self._stock_snapshot(
                on_hand=on_hand,
                customer_lines=handoff.get("customer_lines") or [],
                vendor_lines=handoff.get("vendor_lines") or [],
                allocations=alloc_map.get(ovf.id, []),
            )
            remaining_demand = float(stock["remaining_demand_qty"] or 0)
            vendor_lines = handoff.get("vendor_lines") or []
            required_po_qty = self._required_po_qty(vendor_lines)
            po_groups = self._ovf_po_groups(ctx, vendor_lines, existing_orders)
            open_distributors = self._open_distributor_names(po_groups)
            has_draft = any(
                order.status == OrderStatus.DRAFT.value for order in existing_orders
            )
            item_plan = self._item_plan(
                vendor_lines,
                stock["stock_availability"],
            )
            has_plan_actions = any(
                str(ln.get("action") or "") in {"book_stock", "stock_short", "create_po"}
                for ln in (item_plan.get("lines") or [])
            )
            ordered_po_qty = round(
                sum(
                    self._order_total_qty(order)
                    for order in existing_orders
                    if not self._vendor_rejected_order(order)
                ),
                4,
            )
            # Keep Create PO available while ordered qty is still short of demand.
            has_remaining_po_qty = required_po_qty > ordered_po_qty + 1e-9
            can_create = (
                bool(open_distributors)
                or has_draft
                or has_plan_actions
                or has_remaining_po_qty
            )
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
                    "distributor_name": distributor_name,
                    "project_title": project_title,
                    "vendor_line_count": len(vendor_lines),
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
                    "open_distributor_names": open_distributors,
                    "po_groups": po_groups,
                    "purchase_orders": self._serialize_linked_pos(ctx, existing_orders),
                    "required_po_qty": required_po_qty,
                    "stock_fulfillment_status": stock["stock_fulfillment_status"],
                    "remaining_demand_qty": remaining_demand,
                    "stock_availability": stock["stock_availability"],
                    "item_plan": item_plan,
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
        """Request a hold. The OVF stays open until a Hold approver accepts it."""
        self._crm.request_scm_hold(ctx, ovf_id, remark=remark)
        return self.get_ovf_preview(ctx, ovf_id)

    def _ensure_can_decide_step(self, ctx: TenantContext, step_key: str, message: str) -> None:
        if self._approvers.can_decide_step(ctx, step_key):
            return
        raise ForbiddenException(message)

    def accept_ovf_hold(self, ctx: TenantContext, ovf_id: UUID) -> dict:
        self._ensure_can_decide_step(
            ctx,
            "hold_decision",
            "You are not assigned to approve or reject OVF holds",
        )
        self._crm.decide_scm_hold(ctx, ovf_id, accept=True)
        return self.get_ovf_preview(ctx, ovf_id)

    def reject_ovf_hold(self, ctx: TenantContext, ovf_id: UUID) -> dict:
        self._ensure_can_decide_step(
            ctx,
            "hold_decision",
            "You are not assigned to approve or reject OVF holds",
        )
        self._crm.decide_scm_hold(ctx, ovf_id, accept=False)
        return self.get_ovf_preview(ctx, ovf_id)

    def list_hold_requests(self, ctx: TenantContext) -> list[dict]:
        rows = self._crm.list_scm_hold_requests(ctx)
        names = self._resolve_user_names(
            ctx.tenant_id,
            {row.scm_hold_requested_by for row in rows if row.scm_hold_requested_by},
        )
        payload = []
        for row in rows:
            payload.append(
                {
                    "id": row.id,
                    "ovf_id": row.id,
                    "ovf_no": row.ovf_no,
                    "customer_name": row.customer_name or row.account_name,
                    "owner_name": row.owner_name,
                    "status": row.scm_hold_request_status,
                    "remark": row.scm_hold_request_remark,
                    "requested_at": row.scm_hold_requested_at,
                    "requested_by_name": names.get(row.scm_hold_requested_by)
                    if row.scm_hold_requested_by
                    else None,
                }
            )
        payload.sort(key=lambda item: str(item.get("requested_at") or ""), reverse=True)
        return payload

    def list_charge_requests(self, ctx: TenantContext) -> list[dict]:
        rows = self._crm.list_scm_charge_requests(ctx)
        names = self._resolve_user_names(
            ctx.tenant_id,
            {row.scm_charge_requested_by for row in rows if row.scm_charge_requested_by},
        )
        payload = []
        for row in rows:
            payload.append(
                {
                    "id": row.id,
                    "ovf_id": row.id,
                    "ovf_no": row.ovf_no,
                    "customer_name": row.customer_name or row.account_name,
                    "owner_name": row.owner_name,
                    "status": row.scm_charge_request_status,
                    "freight": float(row.scm_charge_request_freight or 0),
                    "finance_cost_pct": float(row.scm_charge_request_finance_pct or 0),
                    "requested_at": row.scm_charge_requested_at,
                    "requested_by_name": names.get(row.scm_charge_requested_by)
                    if row.scm_charge_requested_by
                    else None,
                }
            )
        payload.sort(key=lambda item: str(item.get("requested_at") or ""), reverse=True)
        return payload

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
        """Apply freight on the OVF immediately. Finance % stays as stored (SCM UI is read-only)."""
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
        # Finance is display-only on the SCM OVF margin card — do not overwrite it here.
        _ = finance_cost_pct
        self._crm.update_scm_charges(
            ctx,
            ovf_id,
            freight=freight,
            additional_charges=additional_charges,
            finance_cost_pct=None,
        )
        return self.get_ovf_preview(ctx, ovf_id)

    def accept_ovf_charges(self, ctx: TenantContext, ovf_id: UUID) -> dict:
        self._ensure_can_decide_step(
            ctx,
            "freight_finance",
            "You are not assigned to approve freight and finance changes",
        )
        self._crm.decide_scm_charge_change(ctx, ovf_id, accept=True)
        return self.get_ovf_preview(ctx, ovf_id)

    def reject_ovf_charges(self, ctx: TenantContext, ovf_id: UUID) -> dict:
        self._ensure_can_decide_step(
            ctx,
            "freight_finance",
            "You are not assigned to approve freight and finance changes",
        )
        self._crm.decide_scm_charge_change(ctx, ovf_id, accept=False)
        return self.get_ovf_preview(ctx, ovf_id)

    def update_item_plan_vendor(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        product_name: str,
        line_index: int,
        distributor_name: str,
    ) -> dict:
        """Persist item-plan distributor selection onto the matching CRM vendor line."""
        self._crm.update_scm_item_plan_vendor(
            ctx,
            ovf_id,
            product_name=product_name,
            line_index=line_index,
            distributor_name=distributor_name,
        )
        return self.get_ovf_preview(ctx, ovf_id)

    def get_ovf_preview(self, ctx: TenantContext, ovf_id: UUID) -> dict:
        handoff = self._crm.get_handoff(ctx, ovf_id)
        existing_orders = self._active_orders_for_ovf(ctx, ovf_id)
        existing = existing_orders[0] if existing_orders else None
        is_cancelled = False
        company_id = handoff["company_id"]
        allocations = self._allocations_by_ovf(ctx, [ovf_id]).get(ovf_id, [])
        stock = self._stock_snapshot(
            on_hand=self._on_hand_qty_by_product(ctx, company_id),
            customer_lines=handoff.get("customer_lines") or [],
            vendor_lines=handoff.get("vendor_lines") or [],
            allocations=allocations,
        )
        remaining_demand = float(stock["remaining_demand_qty"] or 0)
        vendor_lines = handoff.get("vendor_lines") or []
        required_po_qty = self._required_po_qty(vendor_lines)
        po_groups = self._ovf_po_groups(ctx, vendor_lines, existing_orders)
        open_distributors = self._open_distributor_names(po_groups)
        ordered_po_qty = round(
            sum(
                self._order_total_qty(order)
                for order in existing_orders
                if not self._vendor_rejected_order(order)
            ),
            4,
        )
        handoff["purchase_order_id"] = existing.id if existing else None
        handoff["purchase_order_number"] = (
            None if is_cancelled else (existing.document_number if existing else None)
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
            vendor_name = self._master.match_vendor_name_by_distributor(
                ctx,
                company_id=handoff["company_id"],
                distributor_name=handoff.get("distributor_name"),
            )
        handoff["vendor_name"] = vendor_name
        handoff["stock_fulfillment_status"] = stock["stock_fulfillment_status"]
        handoff["remaining_demand_qty"] = remaining_demand
        handoff["stock_availability"] = stock["stock_availability"]
        handoff["stock_allocations"] = self._serialize_allocations(allocations)
        handoff["open_distributor_names"] = open_distributors
        handoff["po_groups"] = po_groups
        handoff["purchase_orders"] = self._serialize_linked_pos(ctx, existing_orders)
        handoff["required_po_qty"] = required_po_qty
        handoff["item_plan"] = self._item_plan(
            vendor_lines,
            stock["stock_availability"],
        )
        has_plan_actions = any(
            str(ln.get("action") or "") in {"book_stock", "stock_short", "create_po"}
            for ln in (handoff["item_plan"].get("lines") or [])
        )
        has_remaining_po_qty = required_po_qty > ordered_po_qty + 1e-9
        handoff["can_create_po"] = (
            bool(open_distributors)
            or (existing is not None and existing.status == OrderStatus.DRAFT.value)
            or has_plan_actions
            or has_remaining_po_qty
        )
        return handoff

    def fulfill_ovf_from_stock(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        lines: list[dict],
    ) -> dict:
        """Allocate on-hand GRN stock units to OVF demand and deduct them."""
        if not self._ovf_stock_allocation_table_exists():
            raise ConflictException(
                "Stock allocation is not available on this database. Run alembic upgrade head."
            )
        if not self._inventory_stock_table_exists():
            raise ConflictException("Inventory stock is not available on this database.")
        handoff = self._crm.get_handoff(ctx, ovf_id)
        company_id = handoff["company_id"]
        existing_allocs = self._allocations_by_ovf(ctx, [ovf_id]).get(ovf_id, [])
        snapshot = self._stock_snapshot(
            on_hand=self._on_hand_qty_by_product(ctx, company_id),
            customer_lines=handoff.get("customer_lines") or [],
            vendor_lines=handoff.get("vendor_lines") or [],
            allocations=existing_allocs,
        )
        remaining_by_product = {
            self._product_key(row["product_name"]): float(row["remaining_qty"] or 0)
            for row in snapshot["stock_availability"]
        }
        requested_ids: list[UUID] = []
        line_specs: list[tuple[str, str, list[UUID]]] = []
        for raw in lines or []:
            product_name = (raw.get("product_name") or "").strip()
            key = self._product_key(product_name)
            ids = list({uid for uid in (raw.get("stock_unit_ids") or []) if uid is not None})
            if not key or not ids:
                continue
            line_specs.append((product_name, key, ids))
            requested_ids.extend(ids)
        if not requested_ids:
            raise ConflictException("Select at least one stock unit to fulfill.")
        if len(set(requested_ids)) != len(requested_ids):
            raise ConflictException("The same stock unit cannot be allocated more than once.")

        already = {
            row.stock_unit_id
            for row in existing_allocs
        }
        overlap = [str(uid) for uid in requested_ids if uid in already]
        if overlap:
            raise ConflictException("Some selected stock units are already allocated to this OVF.")

        units = (
            self._db.query(ProcInventoryStockUnit)
            .filter(
                ProcInventoryStockUnit.id.in_(requested_ids),
                ProcInventoryStockUnit.tenant_id == ctx.tenant_id,
                ProcInventoryStockUnit.company_id == company_id,
                ProcInventoryStockUnit.is_deleted.is_(False),
            )
            .all()
        )
        unit_by_id = {unit.id: unit for unit in units}
        missing = [str(uid) for uid in requested_ids if uid not in unit_by_id]
        if missing:
            raise ConflictException(
                "Some selected stock units are no longer available. Refresh inventory and try again."
            )

        qty_by_product: dict[str, float] = defaultdict(float)
        for product_name, key, ids in line_specs:
            if key not in remaining_by_product:
                raise ConflictException(
                    f'"{product_name}" is not on this OVF demand. Unmatched products stay on Create PO.'
                )
            for uid in ids:
                unit = unit_by_id[uid]
                # Allow mapping inventory units whose stored product name differs from the
                # OVF demand name (spelling / alias mismatches). Qty still counts against
                # the OVF demand line named in the request.
                qty_by_product[key] += float(getattr(unit, "quantity", None) or 1)
            if qty_by_product[key] - remaining_by_product[key] > 1e-6:
                raise ConflictException(
                    f'Selected quantity for "{product_name}" exceeds remaining demand.'
                )

        created: list[ProcOvfStockAllocation] = []
        # Map each unit to the OVF demand product it was booked against.
        demand_name_by_unit: dict[UUID, str] = {}
        for product_name, _key, ids in line_specs:
            for uid in ids:
                demand_name_by_unit[uid] = product_name

        for uid in requested_ids:
            unit = unit_by_id[uid]
            demand_name = demand_name_by_unit.get(uid) or unit.product_name
            row = ProcOvfStockAllocation(
                ovf_id=ovf_id,
                stock_unit_id=unit.id,
                product_name=demand_name,
                quantity=float(getattr(unit, "quantity", None) or 1),
                serial_number=unit.serial_number or "-",
                tenant_id=ctx.tenant_id,
                company_id=company_id,
                branch_id=unit.branch_id,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
            )
            self._db.add(row)
            created.append(row)

        self._consume_inventory_stock_units(ctx, company_id, requested_ids)
        self._db.flush()

        line_by_id = self._inventory_order_lines(
            ctx,
            list({unit.order_line_id for unit in units}),
        )
        unit_cost_by_id = {
            unit.id: float(getattr(line_by_id.get(unit.order_line_id), "unit_cost", 0) or 0)
            for unit in units
        }
        all_allocs = existing_allocs + created
        preview = self.get_ovf_preview(ctx, ovf_id)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_ovf_stock_allocation",
            entity_id=ovf_id,
            operation="fulfill_from_stock",
            performed_by=ctx.user_id,
            new_value={
                "ovf_id": str(ovf_id),
                "stock_unit_ids": [str(uid) for uid in requested_ids],
                "stock_fulfillment_status": preview.get("stock_fulfillment_status"),
            },
        )
        return {
            "ovf_id": ovf_id,
            "stock_fulfillment_status": preview.get("stock_fulfillment_status") or "none",
            "remaining_demand_qty": preview.get("remaining_demand_qty") or 0,
            "stock_availability": preview.get("stock_availability") or [],
            "stock_allocations": preview.get("stock_allocations") or [],
            "challan_prefill": self._challan_prefill_from_allocations(
                handoff,
                all_allocs,
                unit_cost_by_id,
            ),
        }

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
                self._db,
                company_id=cid,
                entity_code=code,
                tenant_id=ctx.tenant_id,
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
        order_ref_cache: str | None = None,
        stock_unit_ids: list[UUID] | None = None,
        import_line_ids: list[UUID] | None = None,
    ) -> ProcOrderHeader:
        """Draft PO with the next company PO number for the entity (e.g. PO/CDT/007)."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        branch_id = ctx.branch_id
        if branch_id is None and cid is not None:
            from modules.foundation.service.org_context_service import OrgContextService

            branch_id = OrgContextService(self._db).resolve_branch_for_company(
                user_id=ctx.user_id,
                tenant_id=ctx.tenant_id,
                company_id=cid,
            )
        if branch_id is None:
            raise ConflictException("Select a branch in your session before creating a purchase order")
        code = normalize_entity_code(entity_code)
        self._master.get_vendor(ctx, vendor_id)
        approver = (approved_by_name or "").strip() or None
        order_ref = (order_ref_cache or "").strip() or None
        company_po_number = peek_next_company_po_number(
            self._db, company_id=cid, entity_code=code, tenant_id=ctx.tenant_id
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
            order_ref_cache=order_ref,
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
                tax_rate = float(raw.get("tax_rate") or 0)
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
                        "tax_rate": tax_rate,
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

    def consume_inventory_stock_units_for_document(
        self,
        ctx: TenantContext,
        stock_unit_ids: list[UUID],
        company_id: UUID | None = None,
    ) -> int:
        """Public entry: remove GRN warehouse units after billing / DC selection."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._consume_inventory_stock_units(ctx, cid, stock_unit_ids)

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

    def _order_line_payloads(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        vendor_lines: list[dict],
    ) -> list[dict]:
        uom_id = self._master.resolve_default_uom_id(ctx, company_id)
        product_map = self._master.resolve_products_by_names(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            product_names=[str(line["product_name"]) for line in vendor_lines],
            uom_id=uom_id,
        )
        payloads: list[dict] = []
        for idx, line in enumerate(vendor_lines, start=1):
            product_name = str(line["product_name"])
            product = product_map[(product_name or "").strip().lower() or "scm line item"]
            qty = float(line["qty"])
            unit_cost = float(line["unit_price"])
            rate_currency = str(line.get("rate_currency") or "INR").strip().upper() or "INR"
            if rate_currency != "USD":
                rate_currency = "INR"
            tax_rate = 0.0 if rate_currency == "USD" else float(line.get("tax_rate") or 0)
            if qty <= 0 or unit_cost <= 0:
                raise ConflictException(
                    f"Vendor line '{product_name}' needs qty and unit cost > 0"
                )
            description = str(line.get("description") or "").strip() or None
            payloads.append(
                {
                    "line_number": idx,
                    "product_id": product.id,
                    "product_code": scm_line_product_code(product),
                    "product_name": product_name[:255],
                    "description": description[:4000] if description else None,
                    "quantity": qty,
                    "uom_id": getattr(product, "uom_id", None) or uom_id,
                    "unit_cost": unit_cost,
                    "rate_currency": rate_currency,
                    "tax_rate": tax_rate,
                }
            )
        return payloads

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
        order_ref_cache: str | None = None,
        finalize: bool = False,
        hold: bool = False,
        lines: list[dict] | None = None,
        distributor_name: str | None = None,
        force_new: bool = False,
    ) -> ProcOrderHeader:
        if finalize and hold:
            raise ConflictException("Cannot finalize and hold a purchase order at the same time")
        if finalize:
            raise ConflictException(
                "PO finalization requires approval. Create the PO as a draft and have an administrator issue it from Approval."
            )
        handoff = self._crm.get_handoff(ctx, ovf_id)
        self._assert_ovf_allows_product_po(ctx, handoff)
        linked = self._orders.list_by_source(
            ctx,
            source_module=self.SOURCE_MODULE,
            source_document_type=self.SOURCE_DOC_TYPE,
            source_document_id=ovf_id,
        )
        # Reuse only an open draft for this vendor. Issued/finalized POs do not block
        # another draft. force_new skips reuse (partial qty / remainder from item plan).
        existing = None
        if not force_new:
            existing = next(
                (
                    row
                    for row in linked
                    if row.vendor_id == vendor_id and row.status == OrderStatus.DRAFT.value
                ),
                None,
            )
        order_ref = (order_ref_cache or "").strip() or None
        if existing is not None:
            # Re-edit draft (e.g. after approval reject) - reassign company PO when entity changes.
            code = normalize_entity_code(entity_code)
            self._master.get_vendor(ctx, vendor_id)
            company_id = handoff["company_id"]
            branch_id = handoff["branch_id"]
            self._scope.validate_company_access(ctx, company_id)
            self._scope.validate_branch_access(ctx, branch_id)

            terms = payment_terms
            if not terms and handoff.get("vendor_payment_days"):
                terms = f"Net {int(handoff['vendor_payment_days'])} days"

            previous_entity = (
                normalize_entity_code(existing.entity_code)
                if existing.entity_code
                else None
            )
            entity_changed = previous_entity is not None and previous_entity != code

            updated = self._orders.update_order(
                ctx,
                existing.id,
                vendor_id=vendor_id,
                document_date=document_date or existing.document_date,
                payment_terms=terms,
                expected_delivery_date=expected_delivery_date,
                entity_code=code,
                order_ref_cache=order_ref,
            )
            if updated is None:
                raise ConflictException("Failed to update draft purchase order")
            order = updated

            if lines is not None:
                vendor_lines = self._vendor_lines_for_po(
                    handoff, distributor_name=distributor_name, lines=lines
                )
                if not vendor_lines:
                    raise ConflictException("OVF has no vendor-side lines to purchase")
                line_payloads = self._order_line_payloads(
                    ctx,
                    company_id=company_id,
                    branch_id=branch_id,
                    vendor_lines=vendor_lines,
                )
                _, order = self._order_service.replace_draft_lines(
                    ctx, order.id, line_payloads
                )
                # Re-priced draft → the negotiated price must be approved again.
                # Keep baseline_amount locked to the original CRM OVF vendor total.
                order.negotiation_status = "not_required"
                order.negotiated_savings_amount = 0
                order.negotiation_decided_at = None
                order.negotiation_decided_by = None
                order.negotiation_decided_by_name = None
                self._db.flush()

            if not float(getattr(order, "baseline_amount", 0) or 0):
                order.baseline_amount = self._ovf_vendor_baseline_amount(
                    handoff, distributor_name=distributor_name
                )
                self._db.flush()

            if not order.company_po_number or entity_changed:
                order.company_po_number = peek_next_company_po_number(
                    self._db,
                    company_id=company_id,
                    entity_code=code,
                    tenant_id=ctx.tenant_id,
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
                order = self.finalize_scm_po(
                    ctx, order.id, order=order, require_management_stage=False
                )

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

        vendor_lines = self._vendor_lines_for_po(
            handoff, distributor_name=distributor_name, lines=lines
        )
        if not vendor_lines:
            raise ConflictException(
                "This OVF has no vendor lines to purchase (IN STOCK items do not create a PO)"
            )

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
            self._db,
            company_id=company_id,
            entity_code=code,
            tenant_id=ctx.tenant_id,
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
            order_ref_cache=order_ref,
        )

        line_payloads = self._order_line_payloads(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            vendor_lines=vendor_lines,
        )

        created_lines, order = self._order_service.add_lines(ctx, order.id, line_payloads)
        if not created_lines:
            raise ConflictException("Failed to create purchase order lines from OVF")

        # Lock baseline to the original CRM OVF vendor total (Sales handover),
        # not the PO total - SCM may already have negotiated rates on create.
        order.baseline_amount = self._ovf_vendor_baseline_amount(
            handoff, distributor_name=distributor_name
        )
        order.negotiation_status = "not_required"
        self._db.flush()

        if hold:
            updated = self._orders.update_order(
                ctx, order.id, status=OrderStatus.CANCELLED.value
            )
            if updated is None:
                raise ConflictException("Failed to put purchase order on hold")
            order = updated
        elif finalize:
            order = self.finalize_scm_po(
                ctx, order.id, order=order, require_management_stage=False
            )

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

    def _is_ovf_sourced(self, order: ProcOrderHeader) -> bool:
        return (
            getattr(order, "source_module", None) == self.SOURCE_MODULE
            and getattr(order, "source_document_type", None) == self.SOURCE_DOC_TYPE
        )

    def _sales_pack_linked_to_service_po(
        self,
        ctx: TenantContext,
        *,
        entity_type: str,
        entity_id: UUID,
    ) -> bool:
        """True when a CRM service PO references this opportunity (or its quote)."""
        from modules.crm.models.quote import CrmQuote
        from modules.procurement.domain.service_po import SOURCE_DOC_TYPE_OPPORTUNITY_SERVICE

        opportunity_id: UUID | None = None
        if entity_type == "opportunity":
            opportunity_id = entity_id
        elif entity_type == "quote":
            quote = self._db.get(CrmQuote, entity_id)
            if quote is not None and not getattr(quote, "is_deleted", False):
                opportunity_id = quote.opportunity_id
        if opportunity_id is None:
            return False
        linked = self._orders.list_by_source(
            ctx,
            source_module=self.SOURCE_MODULE,
            source_document_type=SOURCE_DOC_TYPE_OPPORTUNITY_SERVICE,
            source_document_id=opportunity_id,
        )
        return any(
            row.status != OrderStatus.CANCELLED.value
            for row in linked
        )

    def _negotiation_savings(self, order: ProcOrderHeader) -> float:
        """Savings SCM negotiated off the OVF vendor price on this PO."""
        baseline = float(getattr(order, "baseline_amount", 0) or 0)
        if baseline <= 0:
            return 0.0
        return max(round(baseline - float(order.total_amount or 0), 4), 0.0)

    def _sync_draft_baseline_from_ovf(self, ctx: TenantContext, order: ProcOrderHeader) -> None:
        """Keep OVF Price locked to CRM handoff totals for draft OVF POs."""
        if not self._is_ovf_sourced(order):
            return
        if order.status != OrderStatus.DRAFT.value:
            return
        ovf_id = getattr(order, "source_document_id", None)
        if ovf_id is None:
            return
        try:
            handoff = self._crm.get_handoff(ctx, ovf_id)
        except Exception:
            return
        # Prefer distributor scope from order line product match when possible.
        baseline = self._ovf_vendor_baseline_amount(handoff, distributor_name=None)
        order_products = {
            (getattr(ln, "product_name", None) or "").strip().lower()
            for ln in (order.lines or [])
            if not getattr(ln, "is_deleted", False)
        }
        if order_products:
            matched = [
                ln
                for ln in (handoff.get("vendor_lines") or [])
                if not self._is_in_stock_line(ln)
                and (ln.get("product_name") or "").strip().lower() in order_products
            ]
            if matched:
                scoped = {**handoff, "vendor_lines": matched}
                baseline = self._ovf_vendor_baseline_amount(scoped)
        if baseline > 0 and float(getattr(order, "baseline_amount", 0) or 0) != baseline:
            order.baseline_amount = baseline
            self._db.flush()

    def negotiation_summary(self, ctx: TenantContext, order_id: UUID) -> dict:
        """Baseline vs negotiated price and the Management approval state."""
        order = self._order_service.get_order(ctx, order_id)
        if not self._is_scm_finalizable(order):
            raise InvalidDocumentState(
                "Negotiation approval only applies to CRM OVF or inventory-initiated POs"
            )
        self._sync_draft_baseline_from_ovf(ctx, order)
        baseline = float(getattr(order, "baseline_amount", 0) or 0)
        negotiated = float(order.total_amount or 0)
        savings = self._negotiation_savings(order)
        return {
            "order_id": order.id,
            "document_number": order.document_number,
            "company_po_number": order.company_po_number,
            "status": order.status,
            "baseline_amount": baseline,
            "negotiated_amount": negotiated,
            "savings_amount": savings,
            "savings_pct": round(savings / baseline * 100.0, 3) if baseline else 0.0,
            "negotiation_status": getattr(order, "negotiation_status", "not_required"),
            "negotiation_remark": getattr(order, "negotiation_remark", None),
            "negotiation_submitted_at": getattr(order, "negotiation_submitted_at", None),
            "negotiation_decided_at": getattr(order, "negotiation_decided_at", None),
            "negotiation_decided_by_name": getattr(order, "negotiation_decided_by_name", None),
            "can_issue": getattr(order, "negotiation_status", "not_required")
            in {"approved", "not_required"},
        }

    def submit_negotiation(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        remark: str | None = None,
    ) -> dict:
        """Send the post-negotiation price to Management before issuing the PO."""
        order = self._order_service.get_order(ctx, order_id)
        if not self._is_scm_finalizable(order):
            raise InvalidDocumentState(
                "Negotiation approval only applies to CRM OVF or inventory-initiated POs"
            )
        if order.status != OrderStatus.DRAFT.value:
            raise InvalidDocumentState("Only draft POs can be sent for negotiation approval")
        self._sync_draft_baseline_from_ovf(ctx, order)
        if getattr(order, "negotiation_status", "not_required") == "pending":
            raise ConflictException("This PO is already awaiting Management approval")
        active_lines = [ln for ln in (order.lines or []) if not getattr(ln, "is_deleted", False)]
        if not active_lines:
            raise InvalidDocumentState("Cannot send a PO with no lines for approval")

        savings = self._negotiation_savings(order)
        order.negotiated_savings_amount = savings
        order.negotiation_status = "pending"
        order.negotiation_remark = (remark or "").strip() or None
        order.negotiation_submitted_at = utcnow()
        order.negotiation_submitted_by = ctx.user_id
        order.negotiation_decided_at = None
        order.negotiation_decided_by = None
        order.negotiation_decided_by_name = None
        self._db.flush()

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_header",
            entity_id=order.id,
            operation="negotiation_submit",
            performed_by=ctx.user_id,
            new_value={
                "baseline_amount": float(getattr(order, "baseline_amount", 0) or 0),
                "negotiated_amount": float(order.total_amount or 0),
                "savings_amount": savings,
            },
        )
        return self.negotiation_summary(ctx, order_id)

    def decide_negotiation(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        decision: str,
        remark: str | None = None,
    ) -> dict:
        """Management approves/rejects the negotiated price before the PO is issued."""
        if decision not in {"approved", "rejected"}:
            raise ConflictException("decision must be 'approved' or 'rejected'")
        order = self._order_service.get_order(ctx, order_id)
        if not self._is_scm_finalizable(order):
            raise InvalidDocumentState(
                "Negotiation approval only applies to CRM OVF or inventory-initiated POs"
            )
        if getattr(order, "negotiation_status", "not_required") != "pending":
            raise ConflictException("This PO is not awaiting negotiation approval")

        decided_by_name = None
        if ctx.user_id is not None:
            decided_by_name = self._resolve_user_names(ctx.tenant_id, {ctx.user_id}).get(ctx.user_id)

        order.negotiation_status = decision
        order.negotiation_decided_at = utcnow()
        order.negotiation_decided_by = ctx.user_id
        order.negotiation_decided_by_name = decided_by_name
        if remark and remark.strip():
            order.negotiation_remark = remark.strip()
        self._db.flush()

        # Credit the approved saving to Supply Chain on the CRM OVF. Sales never
        # sees this figure - it feeds the SCM incentive pool, not the sales one.
        if (
            decision == "approved"
            and order.source_module == self.SOURCE_MODULE
            and order.source_document_type == self.SOURCE_DOC_TYPE
            and order.source_document_id is not None
        ):
            self._crm.record_scm_savings(
                ctx,
                order.source_document_id,
                savings_amount=float(order.negotiated_savings_amount or 0),
                negotiated_vendor_total=float(order.total_amount or 0),
            )

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_header",
            entity_id=order.id,
            operation=f"negotiation_{decision}",
            performed_by=ctx.user_id,
            new_value={
                "savings_amount": float(order.negotiated_savings_amount or 0),
                "remark": order.negotiation_remark,
            },
        )
        return self.negotiation_summary(ctx, order_id)

    def _assert_ovf_allows_product_po(self, ctx: TenantContext, handoff: dict) -> None:
        """Cache Service deals use Internal Service PO only — no OVF product PO."""
        opp_id = handoff.get("opportunity_id")
        if opp_id is None:
            return
        brief = self._crm.get_opportunity_brief(ctx, opp_id)
        if brief is None:
            return
        channel = normalize_service_sourcing_channel(
            brief.get("service_sourcing_channel")
        )
        if channel != SERVICE_CHANNEL_CACHE:
            return
        raise ConflictException(
            "This opportunity uses Cache Service sourcing. "
            "Use the Internal Service purchase order created on Customer PO approval "
            "— do not create a product PO from OVF."
        )

    def _is_scm_finalizable(self, order: ProcOrderHeader) -> bool:
        """CRM OVF / service POs and inventory/manual draft POs share SCM finalize."""
        from modules.procurement.domain.service_po import (
            SERVICE_ORDER_KINDS,
            SOURCE_DOC_TYPE_OPPORTUNITY_SERVICE,
        )

        kind = (getattr(order, "order_kind", None) or ORDER_KIND_PRODUCT).strip().lower()
        if kind in SERVICE_ORDER_KINDS:
            return True
        module = (getattr(order, "source_module", None) or "").strip().lower()
        doc_type = (getattr(order, "source_document_type", None) or "").strip().lower()
        if module == self.SOURCE_MODULE and doc_type == self.SOURCE_DOC_TYPE:
            return True
        if module == self.SOURCE_MODULE and doc_type == SOURCE_DOC_TYPE_OPPORTUNITY_SERVICE:
            return True
        return module == "procurement" and doc_type == "inventory_initiated"

    def _finalize_requester_user_id(
        self, order: ProcOrderHeader, *, approval_status: str
    ):
        """Who sent the PO for approval (pending: updated_by; else PO creator)."""
        if approval_status == "pending":
            return getattr(order, "updated_by", None) or getattr(order, "created_by", None)
        return getattr(order, "created_by", None) or getattr(order, "updated_by", None)

    def _serialize_finalize_approval(
        self,
        ctx: TenantContext,
        order: ProcOrderHeader,
        *,
        approval_status: str,
        customer_name: str | None = None,
        requested_by_name: str | None = None,
    ) -> dict:
        decided_at = None
        if approval_status in {"accepted", "rejected"}:
            decided_at = getattr(order, "updated_at", None)
        stage = getattr(order, "scm_approval_stage", None) or None
        if approval_status == "pending" and not stage:
            stage = "accept_po"
        step_key = STAGE_TO_STEP_KEY.get(stage or "")
        stage_label = APPROVAL_STEP_CATALOG[step_key][0] if step_key else None
        requested_by_id = self._finalize_requester_user_id(
            order, approval_status=approval_status
        )
        return {
            "id": order.id,
            "kind": "finalize",
            "order_id": order.id,
            "document_number": order.document_number,
            "company_po_number": order.company_po_number,
            "customer_name": customer_name,
            "vendor_id": order.vendor_id,
            "vendor_name": self._vendor_display_name(ctx, order.vendor_id),
            "ovf_id": order.source_document_id if self._is_ovf_sourced(order) else None,
            "ovf_no": None,
            "status": approval_status,
            "requested_at": getattr(order, "updated_at", None)
            or getattr(order, "created_at", None),
            "decided_at": decided_at,
            "order_status": order.status,
            "workflow_status": getattr(order, "workflow_status", None),
            "scm_approval_stage": stage if approval_status == "pending" else None,
            "stage_label": stage_label if approval_status == "pending" else None,
            "requested_by_id": requested_by_id,
            "requested_by_name": requested_by_name,
        }

    def _ensure_can_decide_stage(self, ctx: TenantContext, stage: str | None) -> None:
        if self._approvers.can_decide_stage(ctx, stage):
            return
        raise ForbiddenException("You are not assigned to approve this PO stage")

    def _po_label(self, order: ProcOrderHeader) -> str:
        return (
            (getattr(order, "company_po_number", None) or "").strip()
            or (getattr(order, "document_number", None) or "").strip()
            or "Purchase Order"
        )

    def _store_po_print_pdf(
        self,
        ctx: TenantContext,
        order: ProcOrderHeader,
        *,
        po_pdf_base64: str | None,
        po_pdf_filename: str | None,
    ) -> None:
        content = (po_pdf_base64 or "").strip()
        if not content:
            return
        filename = (po_pdf_filename or "").strip() or f"PO_{self._po_label(order)}.pdf"
        if not filename.lower().endswith(".pdf"):
            filename = f"{filename}.pdf"
        branch_id = getattr(order, "branch_id", None)
        if branch_id is None:
            return
        # Nested transaction so a category/storage failure cannot poison the PO submit.
        try:
            with self._db.begin_nested():
                self.attach_po_document(
                    ctx,
                    order.id,
                    file_name=filename,
                    content_base64=content,
                    content_type="application/pdf",
                    branch_id=branch_id,
                    company_id=getattr(order, "company_id", None),
                    category="po_pdf",
                    remarks="Auto-generated PO print for approval email",
                )
        except Exception:  # noqa: BLE001
            pass

    def _po_print_email_attachments(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        po_pdf_base64: str | None = None,
        po_pdf_filename: str | None = None,
        exclude_draft: bool = False,
    ) -> list[dict]:
        """Prefer freshly supplied PDF, else stored po_pdf / first PO PDF attachment."""
        import base64

        content = (po_pdf_base64 or "").strip()
        if content:
            order = self._order_service.get_order(ctx, order_id)
            filename = (po_pdf_filename or "").strip() or f"PO_{self._po_label(order)}.pdf"
            if not filename.lower().endswith(".pdf"):
                filename = f"{filename}.pdf"
            if exclude_draft:
                lowered = filename.lower()
                if lowered.endswith("-draft.pdf"):
                    filename = f"{filename[: -len('-draft.pdf')]}.pdf"
            return [
                {
                    "filename": filename,
                    "content_base64": content,
                    "content_type": "application/pdf",
                }
            ]

        from modules.crm.service.attachment_service import AttachmentService

        attachment_svc = AttachmentService(self._db)
        rows = ProcurementCrmAdapter(self._db).list_attachments(
            ctx,
            entity_filters=[(self.PO_ATTACHMENT_ENTITY, order_id)],
        )
        preferred = sorted(
            rows,
            key=lambda row: 0 if (row.category or "").lower() == "po_pdf" else 1,
        )
        for row in preferred:
            name = (row.file_name or "").lower()
            ctype = (row.content_type or "").lower()
            if "pdf" not in ctype and not name.endswith(".pdf"):
                continue
            # Vendor issue mail must never reuse a draft-watermark print.
            if exclude_draft and "-draft" in name:
                continue
            try:
                download = attachment_svc.resolve_download(ctx, row.id)
            except Exception:  # noqa: BLE001
                continue
            raw = download.content
            if raw is None and download.path is not None:
                raw = download.path.read_bytes()
            if not raw:
                continue
            return [
                {
                    "filename": row.file_name or "Purchase_Order.pdf",
                    "content_base64": base64.b64encode(raw).decode("ascii"),
                    "content_type": row.content_type or "application/pdf",
                }
            ]
        return []

    def _notify_po_step_owners(
        self,
        ctx: TenantContext,
        order: ProcOrderHeader,
        *,
        step_key: str,
        remarks: str | None = None,
        attachments: list[dict] | None = None,
        jobs_path: str = "/procurement",
    ) -> None:
        owner_ids = self._approvers.list_user_ids(ctx, step_key)
        if not owner_ids:
            return
        label, _team = APPROVAL_STEP_CATALOG.get(step_key, (step_key, "scm"))
        po_label = self._po_label(order)
        try:
            from modules.procurement.service.proc_email_notification_service import (
                ProcEmailNotificationService,
            )

            ProcEmailNotificationService(self._db).notify_step_approvers(
                tenant_id=ctx.tenant_id,
                recipient_user_ids=owner_ids,
                approval_type=label,
                record_title=f"{label} · {po_label}",
                requested_by=ctx.user_id,
                remarks=remarks,
                jobs_path=jobs_path,
                attachments=attachments or None,
            )
        except Exception:  # noqa: BLE001
            pass

    def request_finalize_approval(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        po_pdf_base64: str | None = None,
        po_pdf_filename: str | None = None,
        remarks: str | None = None,
    ) -> ProcOrderHeader:
        """Mark a draft SCM PO as submitted for Accept PO (then Management)."""
        order = self._order_service.get_order(ctx, order_id)
        if not self._is_scm_finalizable(order):
            raise InvalidDocumentState(
                "Only CRM OVF or inventory-initiated POs can request finalize approval"
            )
        if order.status == OrderStatus.SUBMITTED.value:
            if not getattr(order, "scm_approval_stage", None):
                order.scm_approval_stage = "accept_po"
                self._db.flush()
            self._store_po_print_pdf(
                ctx,
                order,
                po_pdf_base64=po_pdf_base64,
                po_pdf_filename=po_pdf_filename,
            )
            attachments = self._po_print_email_attachments(
                ctx,
                order_id,
                po_pdf_base64=po_pdf_base64,
                po_pdf_filename=po_pdf_filename,
            )
            self._notify_po_step_owners(
                ctx,
                order,
                step_key="accept_po",
                remarks=remarks,
                attachments=attachments,
            )
            return order
        if order.status != OrderStatus.DRAFT.value:
            raise InvalidDocumentState("Only draft SCM POs can be sent for admin approval")
        active_lines = [ln for ln in (order.lines or []) if not getattr(ln, "is_deleted", False)]
        if not active_lines:
            raise InvalidDocumentState("Cannot send a PO with no lines for approval")
        if self._is_ovf_sourced(order):
            negotiation_status = getattr(order, "negotiation_status", "not_required")
            if negotiation_status == "pending":
                raise InvalidDocumentState(
                    "This PO is still awaiting Management approval of the negotiated price."
                )
            if negotiation_status == "rejected":
                raise InvalidDocumentState(
                    "Negotiated price was rejected. Re-negotiate before sending for approval."
                )
        order.status = OrderStatus.SUBMITTED.value
        order.workflow_status = WorkflowStatus.IN_PROGRESS.value
        order.scm_approval_stage = "accept_po"
        order.updated_at = utcnow()
        order.updated_by = ctx.user_id
        order.version = int(getattr(order, "version", 0) or 0) + 1
        self._db.flush()
        self._store_po_print_pdf(
            ctx,
            order,
            po_pdf_base64=po_pdf_base64,
            po_pdf_filename=po_pdf_filename,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_header",
            entity_id=order_id,
            operation="scm_request_finalize_approval",
            performed_by=ctx.user_id,
            new_value={
                "status": order.status,
                "workflow_status": order.workflow_status,
                "scm_approval_stage": order.scm_approval_stage,
            },
        )
        attachments = self._po_print_email_attachments(
            ctx,
            order_id,
            po_pdf_base64=po_pdf_base64,
            po_pdf_filename=po_pdf_filename,
        )
        self._notify_po_step_owners(
            ctx,
            order,
            step_key="accept_po",
            remarks=remarks,
            attachments=attachments,
        )
        return order

    def accept_po_approval(self, ctx: TenantContext, order_id: UUID) -> ProcOrderHeader:
        """Accept PO stage → forward to Management (does not issue)."""
        order = self._order_service.get_order(ctx, order_id)
        if not self._is_scm_finalizable(order):
            raise InvalidDocumentState(
                "Only CRM OVF or inventory-initiated POs can use Accept PO approval"
            )
        if order.status != OrderStatus.SUBMITTED.value:
            raise InvalidDocumentState("Only submitted SCM POs can be accepted")
        stage = getattr(order, "scm_approval_stage", None) or "accept_po"
        if stage != "accept_po":
            raise InvalidDocumentState("This PO is not awaiting Accept PO")
        self._ensure_can_decide_stage(ctx, "accept_po")
        order.scm_approval_stage = "management"
        order.workflow_status = WorkflowStatus.IN_PROGRESS.value
        order.updated_at = utcnow()
        order.updated_by = ctx.user_id
        order.version = int(getattr(order, "version", 0) or 0) + 1
        self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_header",
            entity_id=order_id,
            operation="scm_accept_po_approval",
            performed_by=ctx.user_id,
            new_value={"scm_approval_stage": order.scm_approval_stage},
        )
        attachments = self._po_print_email_attachments(ctx, order_id)
        self._notify_po_step_owners(
            ctx,
            order,
            step_key="management_po",
            remarks="Accepted by SCM — awaiting Management issue",
            attachments=attachments,
        )
        return order

    def reject_finalize_approval(
        self, ctx: TenantContext, order_id: UUID
    ) -> ProcOrderHeader:
        """Return a submitted SCM PO to draft after rejection at Accept or Management."""
        order = self._order_service.get_order(ctx, order_id)
        if not self._is_scm_finalizable(order):
            raise InvalidDocumentState(
                "Only CRM OVF or inventory-initiated POs can use finalize approval"
            )
        if order.status != OrderStatus.SUBMITTED.value:
            raise InvalidDocumentState("Only submitted SCM POs can be rejected")
        stage = getattr(order, "scm_approval_stage", None) or "accept_po"
        self._ensure_can_decide_stage(ctx, stage)
        order.status = OrderStatus.DRAFT.value
        order.workflow_status = WorkflowStatus.REJECTED.value
        order.scm_approval_stage = None
        order.updated_at = utcnow()
        order.updated_by = ctx.user_id
        order.version = int(getattr(order, "version", 0) or 0) + 1
        self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_header",
            entity_id=order_id,
            operation="scm_reject_finalize_approval",
            performed_by=ctx.user_id,
            new_value={
                "status": order.status,
                "workflow_status": order.workflow_status,
                "scm_approval_stage": None,
            },
        )
        return order

    def list_finalize_approvals(
        self, ctx: TenantContext, company_id: UUID | None = None
    ) -> list[dict]:
        """Shared Approval inbox: submitted / accepted / rejected SCM finalize requests."""
        # Do not pin to session company - admins parked on CDPL still see CT requests.
        cid = self._scope.resolve_list_company_id(ctx, company_id)
        orders = self._orders.list_orders_with_lines(ctx, cid)
        ovf_ids = [
            order.source_document_id
            for order in orders
            if self._is_ovf_sourced(order) and order.source_document_id is not None
        ]
        ovf_meta = self._crm.get_ovf_display_meta(ctx, ovf_ids) if ovf_ids else {}
        candidates: list[tuple[ProcOrderHeader, str, str | None]] = []
        requester_ids: set = set()
        for order in orders:
            if not self._is_scm_finalizable(order):
                continue
            workflow = (getattr(order, "workflow_status", None) or "").strip().lower()
            approval_status: str | None = None
            if order.status == OrderStatus.SUBMITTED.value:
                approval_status = "pending"
            elif (
                order.status == OrderStatus.SENT.value
                and workflow == WorkflowStatus.APPROVED.value
            ):
                approval_status = "accepted"
            elif (
                order.status == OrderStatus.DRAFT.value
                and workflow == WorkflowStatus.REJECTED.value
            ):
                approval_status = "rejected"
            if approval_status is None:
                continue
            customer_name = None
            if self._is_ovf_sourced(order) and order.source_document_id is not None:
                customer_name = (ovf_meta.get(order.source_document_id) or {}).get(
                    "customer_name"
                )
            requester_id = self._finalize_requester_user_id(
                order, approval_status=approval_status
            )
            if requester_id is not None:
                requester_ids.add(requester_id)
            candidates.append((order, approval_status, customer_name))

        requester_names = self._resolve_user_names(ctx.tenant_id, requester_ids)
        result: list[dict] = []
        for order, approval_status, customer_name in candidates:
            requester_id = self._finalize_requester_user_id(
                order, approval_status=approval_status
            )
            result.append(
                self._serialize_finalize_approval(
                    ctx,
                    order,
                    approval_status=approval_status,
                    customer_name=customer_name,
                    requested_by_name=(
                        requester_names.get(requester_id) if requester_id else None
                    ),
                )
            )
        result.sort(
            key=lambda row: str(row.get("requested_at") or ""),
            reverse=True,
        )
        return result

    def finalize_scm_po(
        self,
        ctx: TenantContext,
        order_id: UUID,
        order: ProcOrderHeader | None = None,
        *,
        require_management_stage: bool = True,
        po_pdf_base64: str | None = None,
        po_pdf_filename: str | None = None,
    ) -> ProcOrderHeader:
        """Issue vendor PO - submitted (management stage) → sent."""
        if order is None or order.id != order_id:
            order = self._order_service.get_order(ctx, order_id)
        if not self._is_scm_finalizable(order):
            raise InvalidDocumentState(
                "Only CRM OVF or inventory-initiated POs can use SCM finalize"
            )
        if order.status not in {
            OrderStatus.DRAFT.value,
            OrderStatus.SUBMITTED.value,
        }:
            raise InvalidDocumentState("Only draft or submitted SCM POs can be finalized")
        active_lines = [ln for ln in (order.lines or []) if not getattr(ln, "is_deleted", False)]
        if not active_lines:
            raise InvalidDocumentState("Cannot finalize a PO with no lines")
        # Block only while Management negotiation is open or was rejected.
        # not_required (no price change) and approved may issue.
        if self._is_ovf_sourced(order):
            negotiation_status = getattr(order, "negotiation_status", "not_required")
            if negotiation_status == "pending":
                raise InvalidDocumentState(
                    "This PO is still awaiting Management approval of the negotiated price."
                )
            if negotiation_status == "rejected":
                raise InvalidDocumentState(
                    "Negotiated price was rejected. Re-negotiate before issuing this PO."
                )
        stage = getattr(order, "scm_approval_stage", None)
        if require_management_stage and order.status == OrderStatus.SUBMITTED.value:
            # Approval inbox path: must be at Management stage.
            effective = stage or "accept_po"
            if effective != "management":
                raise InvalidDocumentState(
                    "Accept PO first; Management approval issues the PO."
                )
            self._ensure_can_decide_stage(ctx, "management")
        if not order.entity_code:
            raise InvalidDocumentState("Entity code is required to assign company PO number")
        if not order.company_po_number:
            order.company_po_number = peek_next_company_po_number(
                self._db,
                company_id=order.company_id,
                entity_code=order.entity_code,
                tenant_id=ctx.tenant_id,
            )
        # In-place status flip - avoid a second locked reload of the same draft.
        order.status = OrderStatus.SENT.value
        order.workflow_status = WorkflowStatus.APPROVED.value
        order.scm_approval_stage = None
        order.updated_at = utcnow()
        order.updated_by = ctx.user_id
        order.version = int(getattr(order, "version", 0) or 0) + 1
        # CRM product/OVF and outsourced service POs enter the fulfillment wizard.
        from modules.procurement.domain.service_po import (
            ORDER_KIND_INTERNAL_SERVICE,
            ORDER_KIND_VENDOR_SERVICE,
        )

        order_kind = (getattr(order, "order_kind", None) or "product").strip().lower()
        if self._is_ovf_sourced(order) or order_kind == ORDER_KIND_VENDOR_SERVICE:
            from modules.procurement.service.scm_fulfillment_service import ScmFulfillmentService

            ScmFulfillmentService(self._db).initialize_on_issue(order)
        self._db.flush()
        # Prefer the issued (non-draft) PDF for vendor mail; replace any draft print.
        self._store_po_print_pdf(
            ctx,
            order,
            po_pdf_base64=po_pdf_base64,
            po_pdf_filename=po_pdf_filename,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_header",
            entity_id=order_id,
            operation="scm_finalize",
            performed_by=ctx.user_id,
            new_value={
                "company_po_number": order.company_po_number,
                "order_kind": order_kind,
            },
        )
        # Cache Service internal POs go straight to Projects PO Queue (manual Create Project).
        if order_kind == ORDER_KIND_INTERNAL_SERVICE:
            self._share_internal_service_po_to_projects(ctx, order)
        # Non-CRM inventory POs still get the best-effort vendor issue mail.
        # CRM OVF / vendor_service POs use the fulfillment "Send PO to vendor" step instead.
        elif not self._is_ovf_sourced(order) and order_kind != ORDER_KIND_VENDOR_SERVICE:
            self._notify_vendor_po_issued(
                ctx,
                order,
                po_pdf_base64=po_pdf_base64,
                po_pdf_filename=po_pdf_filename,
            )
        return order

    def _share_internal_service_po_to_projects(
        self, ctx: TenantContext, order: ProcOrderHeader
    ) -> None:
        """After Management issues a Cache Service PO, enqueue Projects PO Queue."""
        from modules.project.adapters.crm_port import ProjectCrmAdapter
        from modules.project.schemas import ProjectPoQueueShareCreate
        from modules.project.service.project_po_queue_service import ProjectPoQueueService

        remarks_parts = ["Internal Service PO (Cache Service) — create project in PM."]
        project_name = "Service project"
        circle_name = "TBD"
        site_name = "TBD"
        opp_id = getattr(order, "source_document_id", None)
        if opp_id is not None:
            crm_ctx = ProjectCrmAdapter(self._db).resolve_opportunity_project_context(
                ctx, opp_id
            )
            project_name = (
                (crm_ctx.get("project_title") or "").strip() or project_name
            )
            circle_name = (crm_ctx.get("circle_name") or "").strip() or circle_name
            site_name = (crm_ctx.get("site_name") or "").strip() or site_name
            customer_hint = (crm_ctx.get("customer_name") or "").strip()
            customer_po = (crm_ctx.get("customer_po_number") or "").strip()
            channel = (crm_ctx.get("service_sourcing_channel") or "").strip()
            remarks_parts.append(f"Opportunity: {opp_id}")
            if channel:
                remarks_parts.append(f"Channel: {channel}")
            if customer_hint:
                remarks_parts.append(f"Customer: {customer_hint}")
            if customer_po:
                remarks_parts.append(f"Customer PO: {customer_po}")

        line_names = [
            (getattr(ln, "product_name", None) or "").strip()
            for ln in (order.lines or [])
            if not getattr(ln, "is_deleted", False)
            and (getattr(ln, "product_name", None) or "").strip()
        ]
        if line_names:
            remarks_parts.append("Services: " + ", ".join(line_names[:10]))

        payload = ProjectPoQueueShareCreate(
            order_id=order.id,
            challan_id=None,
            project_name=project_name[:255],
            circle_name=circle_name[:255],
            site_name=site_name[:255],
            contact_person="TBD",
            contact_number="TBD",
            # Leave qty editable for SCM/Projects — digitsOnly treats non-digits as empty.
            rack_quantity="-",
            server_quantity="-",
            server_type="-",
            remarks="\n".join(remarks_parts),
        )
        try:
            ProjectPoQueueService(self._db).share_to_queue(ctx, payload)
        except Exception:  # noqa: BLE001
            # Do not roll back PO issue if queue share races (already shared / already linked).
            existing = ProjectPoQueueService(self._db).get_handoff(ctx, order.id)
            if existing is None:
                raise

    def _notify_vendor_po_issued(
        self,
        ctx: TenantContext,
        order: ProcOrderHeader,
        *,
        po_pdf_base64: str | None = None,
        po_pdf_filename: str | None = None,
    ) -> None:
        """Email the vendor master contact with the issued PO PDF (best-effort)."""
        try:
            vendor = self._master.get_vendor(ctx, order.vendor_id)
        except Exception:  # noqa: BLE001
            return
        to_address = (getattr(vendor, "email", None) or "").strip()
        if not to_address:
            return
        vendor_name = (getattr(vendor, "vendor_name", None) or "").strip() or "Vendor"
        attachments = self._po_print_email_attachments(
            ctx,
            order.id,
            po_pdf_base64=po_pdf_base64,
            po_pdf_filename=po_pdf_filename,
            exclude_draft=True,
        )
        customer_ref = None
        if self._is_ovf_sourced(order) and order.source_document_id is not None:
            try:
                meta = self._crm.get_ovf_display_meta(ctx, [order.source_document_id])
                customer_ref = (meta.get(order.source_document_id) or {}).get("customer_name")
            except Exception:  # noqa: BLE001
                customer_ref = None
        try:
            from modules.procurement.service.proc_email_notification_service import (
                ProcEmailNotificationService,
            )

            ProcEmailNotificationService(self._db).notify_vendor_po_issued(
                tenant_id=ctx.tenant_id,
                to_address=to_address,
                vendor_name=str(vendor_name),
                po_number=self._po_label(order),
                document_date=str(order.document_date or "") or None,
                customer_reference=customer_ref,
                order_id=order.id,
                created_by=ctx.user_id,
                attachments=attachments or None,
            )
        except Exception:  # noqa: BLE001
            pass

    def list_vendor_pos(self, ctx: TenantContext, company_id: UUID | None = None) -> list[dict]:
        cid = self._scope.resolve_list_company_id(ctx, company_id)
        orders = self._orders.list_orders_with_lines(ctx, cid)
        result: list[dict] = []
        handoff_cache: dict[UUID, dict] = {}
        ovf_ids = [
            order.source_document_id
            for order in orders
            if order.source_module == self.SOURCE_MODULE
            and order.source_document_type == self.SOURCE_DOC_TYPE
            and order.source_document_id is not None
        ]
        ovf_meta = self._crm.get_ovf_display_meta(ctx, ovf_ids) if ovf_ids else {}
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
            customer_name = None
            customer_po_number = None
            if (
                order.source_module == self.SOURCE_MODULE
                and order.source_document_type == self.SOURCE_DOC_TYPE
                and order.source_document_id is not None
            ):
                ovf_id = order.source_document_id
                ovf = ovf_meta.get(ovf_id) or {}
                customer_name = ovf.get("customer_name")
                customer_po_number = ovf.get("po_number")
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
                    "created_at": getattr(order, "created_at", None),
                    "vendor_id": order.vendor_id,
                    "status": order.status,
                    "currency_code": order.currency_code,
                    "total_amount": float(order.total_amount or 0),
                    "source_module": order.source_module,
                    "source_document_type": order.source_document_type,
                    "source_document_id": order.source_document_id,
                    "company_po_number": order.company_po_number,
                    "customer_name": customer_name,
                    "customer_po_number": customer_po_number,
                    "vendor_total": vendor_total,
                    "customer_total": customer_total,
                    "margin_amount": margin_amount,
                    "grn_status": grn,
                    "baseline_amount": float(getattr(order, "baseline_amount", 0) or 0),
                    "negotiated_savings_amount": float(
                        getattr(order, "negotiated_savings_amount", 0) or 0
                    ),
                    "negotiation_status": getattr(order, "negotiation_status", "not_required"),
                    "negotiation_decided_by_name": getattr(
                        order, "negotiation_decided_by_name", None
                    ),
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
                            "last_receipt_delivery_challan_quantity": float(
                                getattr(ln, "last_receipt_delivery_challan_quantity", 0) or 0
                            ),
                            "unit_cost": float(ln.unit_cost),
                            "rate_currency": getattr(ln, "rate_currency", None) or "INR",
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
        delivery_challan_quantity: float | None = None,
        vendor_dispatch_id: UUID | None = None,
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

        if received > previous_received:
            from modules.procurement.service.scm_fulfillment_service import ScmFulfillmentService

            ScmFulfillmentService(self._db).assert_grn_allowed(
                ctx,
                order,
                line_id=line_id,
                target_received_qty=received,
                previous_received_qty=previous_received,
                vendor_dispatch_id=vendor_dispatch_id,
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
                    from shared.text_safety import contains_unsafe_markup

                    if contains_unsafe_markup(value):
                        raise ConflictException(
                            "Serial numbers cannot contain HTML or script content"
                        )
                    normalized_serials.append(value)
            elif serial_numbers:
                # Ignore leftover serial payloads on pure fractional receipts.
                normalized_serials = []

            if billing_quantity is not None:
                bill_qty = float(billing_quantity)
            else:
                bill_qty = float(delta) if billing else 0.0
            if delivery_challan_quantity is not None:
                dc_qty = float(delivery_challan_quantity)
            else:
                dc_qty = 0.0
            if bill_qty < 0:
                raise ConflictException("billing_quantity cannot be negative")
            if dc_qty < 0:
                raise ConflictException("delivery_challan_quantity cannot be negative")
            if bill_qty + dc_qty > float(delta) + 1e-9:
                raise ConflictException(
                    f"billing_quantity + delivery_challan_quantity cannot exceed units received ({float(delta)})"
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
            if not starting_new_batch and batch_id is not None:
                existing_batch = self._db.get(ProcOrderReceiptBatch, batch_id)
                if existing_batch is None or (
                    getattr(existing_batch, "reversal_status", "posted") == "reversed"
                ):
                    starting_new_batch = True
                elif vendor_dispatch_id is not None and getattr(
                    existing_batch, "vendor_dispatch_id", None
                ) != vendor_dispatch_id:
                    # Different dispatch wave → always open a dedicated GRN batch.
                    starting_new_batch = True
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
            if hasattr(line, "last_receipt_delivery_challan_quantity"):
                line.last_receipt_delivery_challan_quantity = float(dc_qty)
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
                    delivery_challan_quantity=dc_qty,
                    vendor_dispatch_id=vendor_dispatch_id,
                )
                if float(bill_qty) > 1e-9 and batch_id is not None:
                    # Fan out Accounts My Jobs for invoice generation (idempotent per
                    # batch+assignee). Soft-fail when no Invoice generation owners exist.
                    try:
                        ProcInvoiceGenerationTaskService(self._db).create_for_billing_receipt(
                            ctx,
                            order_id=order_id,
                            receipt_batch_id=batch_id,
                            vendor_name="",
                            customer_name=str(getattr(order, "customer_name", "") or ""),
                        )
                    except (ConflictException, NotFoundException, ValidationException):
                        pass
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
            if hasattr(line, "last_receipt_delivery_challan_quantity"):
                line.last_receipt_delivery_challan_quantity = 0.0

        active = [ln for ln in order.lines if not ln.is_deleted]
        header_status, received_amount = order_receipt_status(active)
        if header_status == OrderStatus.SENT.value and order.status not in {
            OrderStatus.PARTIALLY_RECEIVED.value,
            OrderStatus.RECEIVED.value,
            OrderStatus.CLOSED.value,
        }:
            # Keep issued/approved when there were never any receipts to roll back.
            pass
        else:
            order.status = header_status
            order.received_amount = float(received_amount)

        self._db.flush()
        from modules.procurement.service.scm_fulfillment_service import ScmFulfillmentService

        ScmFulfillmentService(self._db).mark_grn_progress(ctx, order)
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
        delivery_challan_quantity: float = 0,
        vendor_dispatch_id: UUID | None = None,
    ) -> None:
        if starting_new_batch:
            header = ProcOrderReceiptBatch(
                id=batch_id,
                order_header_id=order.id,
                sequence=sequence,
                grn_number=grn_number,
                receipt_at=receipt_at,
                vendor_dispatch_id=vendor_dispatch_id,
                tenant_id=order.tenant_id,
                company_id=order.company_id,
                branch_id=order.branch_id,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
            )
            self._db.add(header)
        elif vendor_dispatch_id is not None:
            existing = self._db.get(ProcOrderReceiptBatch, batch_id)
            if existing is not None and getattr(existing, "vendor_dispatch_id", None) is None:
                existing.vendor_dispatch_id = vendor_dispatch_id

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
            if self._receipt_batch_line_has_delivery_challan_quantity():
                batch_line.delivery_challan_quantity = float(delivery_challan_quantity)
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
            if self._receipt_batch_line_has_delivery_challan_quantity():
                batch_line.delivery_challan_quantity = float(
                    getattr(batch_line, "delivery_challan_quantity", 0) or 0
                ) + float(delivery_challan_quantity)
            batch_line.updated_by = ctx.user_id
            batch_line.updated_at = receipt_at

        if self._inventory_stock_table_exists():
            # Stock units FK receipt_batch_id - persist batch header/line before insert.
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
            delivery_challan_quantity=delivery_challan_quantity,
            serial_numbers=serial_numbers,
        )

    RECEIPT_BATCH_ATTACHMENT_ENTITY = "procurement_receipt_batch"
    OVF_ATTACHMENT_ENTITY = "ovf"
    PO_ATTACHMENT_ENTITY = "purchase_order"

    @staticmethod
    def _attachment_summary(row) -> dict:
        path = (getattr(row, "file_path", None) or "").strip()
        source = (getattr(row, "source", None) or "upload").strip().lower() or "upload"
        external_url = path if path.lower().startswith(("http://", "https://")) else None
        return {
            "id": row.id,
            "file_name": row.file_name,
            "content_type": row.content_type,
            "size": row.size,
            "category": getattr(row, "category", None) or "other",
            "remarks": getattr(row, "remarks", None),
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
            "source": source,
            "external_url": external_url,
        }

    def list_ovf_attachments(self, ctx: TenantContext, ovf_id: UUID) -> list[dict]:
        preview = self.get_ovf_preview(ctx, ovf_id)
        # Access already gated by OVF preview - include OVF + related sales
        # quote / opportunity files (sales attachments) for SCM + approval.
        entity_filters: list[tuple[str, UUID]] = [
            (self.OVF_ATTACHMENT_ENTITY, ovf_id),
        ]
        quote_id = preview.get("quote_id")
        opportunity_id = preview.get("opportunity_id")
        if quote_id is not None:
            entity_filters.append(("quote", quote_id))
        if opportunity_id is not None:
            entity_filters.append(("opportunity", opportunity_id))
        rows = ProcurementCrmAdapter(self._db).list_attachments(
            ctx, entity_filters=entity_filters
        )
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
        remarks: str | None = None,
    ):
        from modules.crm.service.attachment_service import AttachmentService

        _ = remarks  # reserved for future metadata; CRM attachment model has no remarks column
        preview = self.get_ovf_preview(ctx, ovf_id)
        category_key = (category or "other").strip().lower() or "other"
        return AttachmentService(self._db).create(
            ctx,
            entity_type=self.OVF_ATTACHMENT_ENTITY,
            entity_id=ovf_id,
            file_name=file_name,
            category=category_key,
            branch_id=branch_id,
            company_id=company_id or preview.get("company_id"),
            content_base64=content_base64,
            content_type=content_type,
            # Keep a single auto-generated OVF PDF slot (Download PDF / approval pack).
            replace_existing_category=category_key == "ovf_pdf",
        )

    def list_po_attachments(self, ctx: TenantContext, order_id: UUID) -> list[dict]:
        order = self._order_service.get_order(ctx, order_id)
        rows = ProcurementCrmAdapter(self._db).list_attachments(
            ctx,
            entity_filters=[(self.PO_ATTACHMENT_ENTITY, order_id)],
            company_id=getattr(order, "company_id", None),
        )
        return [self._attachment_summary(row) for row in rows]

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
        remarks: str | None = None,
    ):
        from modules.crm.service.attachment_service import AttachmentService
        from shared.upload_safety import PO_MAX_ATTACHMENTS

        _ = remarks  # reserved for future metadata; CRM attachment model has no remarks column
        order = self._order_service.get_order(ctx, order_id)
        # Preset document slots (Customer PO / Vendor Quote / print PDF) replace prior file.
        category_key = (category or "other").strip().lower() or "other"
        replace = category_key in {"customer_po", "vendor_quote", "po_pdf"}
        if not replace:
            existing = self.list_po_attachments(ctx, order_id)
            if len(existing) >= PO_MAX_ATTACHMENTS:
                raise ValidationException(
                    f"Purchase Order allows at most {PO_MAX_ATTACHMENTS} attachments. "
                    "Remove a file before adding another."
                )
        return AttachmentService(self._db).create(
            ctx,
            entity_type=self.PO_ATTACHMENT_ENTITY,
            entity_id=order_id,
            file_name=file_name,
            category=category_key,
            branch_id=branch_id,
            company_id=company_id or order.company_id,
            content_base64=content_base64,
            content_type=content_type,
            replace_existing_category=replace,
        )

    def list_opportunity_service_attachments(
        self, ctx: TenantContext, opportunity_id: UUID
    ) -> list[dict]:
        """CRM quote + opportunity files for Cache/Outsourced service POs (no OVF)."""
        from modules.crm.repository.quote_repository import QuoteRepository

        entity_filters: list[tuple[str, UUID]] = [("opportunity", opportunity_id)]
        quotes = QuoteRepository(self._db).list_quotes(
            ctx, None, opportunity_id=opportunity_id
        )
        accepted = next((q for q in quotes if q.quote_stage == "accepted"), None)
        if accepted is not None:
            entity_filters.append(("quote", accepted.id))
        elif quotes:
            entity_filters.append(("quote", quotes[0].id))
        rows = ProcurementCrmAdapter(self._db).list_attachments(
            ctx, entity_filters=entity_filters
        )
        seen: set = set()
        out: list[dict] = []
        for row in rows:
            if row.id in seen:
                continue
            seen.add(row.id)
            out.append(self._attachment_summary(row))
        return out

    def list_commercial_documents_for_order(
        self, ctx: TenantContext, order_id: UUID
    ) -> list[dict]:
        """OVF/sales pack + PO-specific files for approval / SCM review."""
        from modules.procurement.domain.service_po import (
            SOURCE_DOC_TYPE_OPPORTUNITY_SERVICE,
            SERVICE_ORDER_KINDS,
        )

        order = self._order_service.get_order(ctx, order_id)
        docs: list[dict] = []
        source_module = (getattr(order, "source_module", None) or "").strip().lower()
        source_type = (getattr(order, "source_document_type", None) or "").strip().lower()
        source_id = getattr(order, "source_document_id", None)
        order_kind = (getattr(order, "order_kind", None) or ORDER_KIND_PRODUCT).strip().lower()
        if source_module == "crm" and source_id is not None:
            try:
                if (
                    source_type == SOURCE_DOC_TYPE_OPPORTUNITY_SERVICE
                    or order_kind in SERVICE_ORDER_KINDS
                ):
                    docs.extend(self.list_opportunity_service_attachments(ctx, source_id))
                else:
                    docs.extend(self.list_ovf_attachments(ctx, source_id))
            except Exception:
                pass
        docs.extend(self.list_po_attachments(ctx, order_id))
        return docs

    def resolve_commercial_attachment_file(
        self, ctx: TenantContext, attachment_id: UUID
    ) -> tuple:
        """Return (path|None, file_name, content_type, external_url|None, content|None).

        Uploaded files resolve from S3 (``s3://``) or ``CRM_UPLOAD_ROOT``.
        Link/cloud attachments return an external URL and no local path.
        """
        from pathlib import Path

        from core import object_storage
        from core.config import settings

        crm = ProcurementCrmAdapter(self._db)
        # Load by tenant only - then authorize via OVF/PO ownership checks.
        row = crm.get_attachment(ctx, attachment_id)
        if row is None:
            raise NotFoundException("Attachment not found")
        if row.entity_type == self.OVF_ATTACHMENT_ENTITY:
            self.get_ovf_preview(ctx, row.entity_id)
        elif row.entity_type == self.PO_ATTACHMENT_ENTITY:
            self._order_service.get_order(ctx, row.entity_id)
        elif row.entity_type in {"quote", "opportunity"}:
            linked_ovf_id = crm.find_ovf_id_for_sales_pack(
                ctx, entity_type=row.entity_type, entity_id=row.entity_id
            )
            if linked_ovf_id is not None:
                self.get_ovf_preview(ctx, linked_ovf_id)
            elif not self._sales_pack_linked_to_service_po(
                ctx, entity_type=row.entity_type, entity_id=row.entity_id
            ):
                raise NotFoundException("Attachment not found")
        else:
            raise NotFoundException("Attachment not found")

        stored = (row.file_path or "").strip()
        source = (getattr(row, "source", None) or "upload").strip().lower()
        if source != "upload" or stored.lower().startswith(("http://", "https://")):
            if not stored.lower().startswith(("http://", "https://")):
                raise NotFoundException("Attachment link is missing")
            return None, row.file_name, row.content_type, stored, None

        if object_storage.is_object_uri(stored):
            try:
                content = object_storage.get_bytes(stored)
            except Exception as exc:
                raise NotFoundException("Attachment file is missing in object storage") from exc
            return None, row.file_name, row.content_type, None, content

        path = Path(stored)
        if not path.is_file():
            candidate = settings.resolved_crm_upload_root / path.name
            if candidate.is_file():
                path = candidate
            else:
                raise NotFoundException("Attachment file is missing on disk")
        return path, row.file_name, row.content_type, None, None

    def get_receipt_batch(self, ctx: TenantContext, batch_id: UUID) -> ProcOrderReceiptBatch:
        stmt = (
            select(ProcOrderReceiptBatch)
            .where(
                ProcOrderReceiptBatch.id == batch_id,
                ProcOrderReceiptBatch.tenant_id == ctx.tenant_id,
                ProcOrderReceiptBatch.is_deleted.is_(False),
            )
        )
        batch = self._db.scalar(stmt)
        if batch is None:
            raise NotFoundException("Receipt batch not found")
        from modules.organization.repository.base import OrgScopedRepository

        OrgScopedRepository.ensure_company_access(ctx, batch.company_id)
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

    @staticmethod
    def _batch_reversal_fields(batch: ProcOrderReceiptBatch | None) -> dict:
        if batch is None:
            return {
                "reversed": False,
                "reversal_status": "posted",
                "reversed_at": None,
                "reversed_by": None,
                "reversal_reason": None,
            }
        status = (getattr(batch, "reversal_status", None) or "posted").strip().lower()
        return {
            "reversed": status == "reversed",
            "reversal_status": status,
            "reversed_at": getattr(batch, "reversed_at", None),
            "reversed_by": getattr(batch, "reversed_by", None),
            "reversal_reason": getattr(batch, "reversal_reason", None),
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
        """Return (path|None, file_name, content_type, content|None).

        Supports both local disk and ``s3://`` object-storage uploads (My Jobs
        invoice documents land in MinIO when object storage is enabled).
        """
        from modules.crm.service.attachment_service import AttachmentService

        service = AttachmentService(self._db)
        row = service.get(ctx, attachment_id)
        if row.entity_type != self.RECEIPT_BATCH_ATTACHMENT_ENTITY:
            raise NotFoundException("Attachment not found")
        self.get_receipt_batch(ctx, row.entity_id)
        download = service.resolve_download(ctx, attachment_id)
        return download.path, download.file_name, download.content_type, download.content

    def _receipt_batch_attachment_summaries(
        self,
        ctx: TenantContext,
        batch_ids: list[UUID],
    ) -> dict[UUID, list[dict]]:
        if not batch_ids:
            return {}
        try:
            rows = ProcurementCrmAdapter(self._db).list_attachments_by_entity_ids(
                ctx,
                entity_type=self.RECEIPT_BATCH_ATTACHMENT_ENTITY,
                entity_ids=batch_ids,
            )
            out: dict[UUID, list[dict]] = defaultdict(list)
            for row in rows:
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
            creator_ids = {
                batch.created_by
                for batch in sorted_batches
                if getattr(batch, "created_by", None)
            }
            creator_names = self._resolve_user_names(ctx.tenant_id, creator_ids)
            result: list[dict] = []
            dispatch_ids = {
                getattr(batch, "vendor_dispatch_id", None)
                for batch in sorted_batches
                if getattr(batch, "vendor_dispatch_id", None)
            }
            dispatch_seq_by_id: dict[UUID, int] = {}
            if dispatch_ids:
                from modules.procurement.models.vendor_dispatch import ProcVendorDispatch

                for disp in (
                    self._db.query(ProcVendorDispatch)
                    .filter(ProcVendorDispatch.id.in_(list(dispatch_ids)))
                    .all()
                ):
                    dispatch_seq_by_id[disp.id] = int(disp.sequence)
            for batch in sorted_batches:
                batch_lines = lines_by_batch.get(batch.id, [])
                created_by = getattr(batch, "created_by", None)
                dispatch_id = getattr(batch, "vendor_dispatch_id", None)
                result.append(
                    {
                        "id": batch.id,
                        "sequence": int(batch.sequence),
                        "grn_number": batch.grn_number,
                        "receipt_at": batch.receipt_at,
                        "created_by": created_by,
                        "created_by_name": creator_names.get(created_by) if created_by else None,
                        "vendor_dispatch_id": dispatch_id,
                        "vendor_dispatch_sequence": (
                            dispatch_seq_by_id.get(dispatch_id) if dispatch_id else None
                        ),
                        "lines": self._receipt_batch_line_payload(batch_lines, line_by_id),
                        "attachments": attachments_by_batch.get(batch.id, []),
                        **self._vendor_invoice_batch_fields(batch),
                        **self._batch_reversal_fields(batch),
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
        created_by = getattr(current_batch, "created_by", None) if current_batch else None
        creator_names = (
            self._resolve_user_names(ctx.tenant_id, {created_by}) if created_by else {}
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
                            "delivery_challan_quantity": float(
                                getattr(ln, "last_receipt_delivery_challan_quantity", 0) or 0
                            ),
                        }
                    )
            row_batch_id = batch_id if s == seq else None
            row_created_by = created_by if s == seq else None
            fallback.append(
                {
                    "id": row_batch_id,
                    "sequence": s,
                    "grn_number": grn_number,
                    "receipt_at": getattr(order, "current_receipt_batch_at", None),
                    "created_by": row_created_by,
                    "created_by_name": (
                        creator_names.get(row_created_by) if row_created_by else None
                    ),
                    "lines": lines_payload,
                    "attachments": (
                        attachments_by_batch.get(batch_id, [])
                        if s == seq and batch_id is not None
                        else []
                    ),
                    **self._vendor_invoice_batch_fields(
                        current_batch if s == seq else None
                    ),
                    **self._batch_reversal_fields(
                        current_batch if s == seq else None
                    ),
                }
            )
        return fallback

    def reverse_receipt_batch(
        self,
        ctx: TenantContext,
        batch_id: UUID,
        *,
        reason: str,
    ) -> dict:
        reason_text = (reason or "").strip()
        if not reason_text:
            raise ConflictException("Reversal reason is required")
        if not self._receipt_batch_tables_exist():
            raise ConflictException("GRN receipt batches are not available on this database.")

        batch = (
            self._db.query(ProcOrderReceiptBatch)
            .filter(
                ProcOrderReceiptBatch.id == batch_id,
                ProcOrderReceiptBatch.is_deleted.is_(False),
            )
            .with_for_update()
            .first()
        )
        if batch is None:
            raise NotFoundException("GRN receipt batch not found")
        if batch.tenant_id != ctx.tenant_id:
            raise NotFoundException("GRN receipt batch not found")

        order = self._orders.get_order_for_update(ctx, batch.order_header_id)
        if order is None:
            raise NotFoundException("Purchase order not found")
        self._scope.validate_company_access(ctx, order.company_id)
        self._scope.validate_branch_access(ctx, order.branch_id)
        assert_batch_reversible(
            reversal_status=getattr(batch, "reversal_status", None),
            order_status=order.status,
        )

        batch_lines = (
            self._db.query(ProcOrderReceiptBatchLine)
            .filter(
                ProcOrderReceiptBatchLine.receipt_batch_id == batch.id,
                ProcOrderReceiptBatchLine.is_deleted.is_(False),
            )
            .all()
        )
        line_by_id = {ln.id: ln for ln in (order.lines or []) if not getattr(ln, "is_deleted", False)}
        now = utcnow()
        for bl in batch_lines:
            ol = line_by_id.get(bl.order_line_id)
            if ol is None:
                continue
            ordered = Decimal(str(ol.quantity or 0))
            current = Decimal(str(ol.quantity_received or 0))
            received = subtract_received(current, Decimal(str(bl.quantity or 0)))
            ol.quantity_received = float(received)
            ol.status = line_receipt_status(ordered, received)
            ol.updated_by = ctx.user_id
            ol.updated_at = now

        self._restore_last_receipt_after_reversal(ctx, order, exclude_batch_id=batch.id, now=now)

        header_status, received_amount = order_receipt_status(
            [ln for ln in (order.lines or []) if not getattr(ln, "is_deleted", False)]
        )
        order.status = header_status
        order.received_amount = float(received_amount)
        order.updated_by = ctx.user_id
        order.updated_at = now
        if getattr(order, "current_receipt_batch_id", None) == batch.id:
            previous = self._latest_active_receipt_batch(order.id, exclude_id=batch.id)
            order.current_receipt_batch_id = previous.id if previous is not None else None
            order.current_receipt_batch_at = None
            if previous is not None:
                order.current_grn_number = previous.grn_number

        batch.reversal_status = "reversed"
        batch.reversed_at = now
        batch.reversed_by = ctx.user_id
        batch.reversal_reason = reason_text[:2000]
        batch.updated_by = ctx.user_id
        batch.updated_at = now

        self._apply_inventory_reversal(ctx, order=order, batch=batch, reason=reason_text, now=now)
        self._db.flush()
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_order_receipt_batch",
            entity_id=batch.id,
            operation="grn_reverse",
            performed_by=ctx.user_id,
            new_value={
                "grn_number": batch.grn_number,
                "reason": reason_text,
                "order_status": order.status,
            },
        )

        attachments = self._receipt_batch_attachment_summaries(ctx, [batch.id])
        return {
            "id": batch.id,
            "sequence": int(batch.sequence),
            "grn_number": batch.grn_number,
            "receipt_at": batch.receipt_at,
            "lines": self._receipt_batch_line_payload(batch_lines, line_by_id),
            "attachments": attachments.get(batch.id, []),
            **self._vendor_invoice_batch_fields(batch),
            **self._batch_reversal_fields(batch),
        }

    def _latest_active_receipt_batch(
        self, order_id: UUID, *, exclude_id: UUID
    ) -> ProcOrderReceiptBatch | None:
        return (
            self._db.query(ProcOrderReceiptBatch)
            .filter(
                ProcOrderReceiptBatch.order_header_id == order_id,
                ProcOrderReceiptBatch.id != exclude_id,
                ProcOrderReceiptBatch.is_deleted.is_(False),
                ProcOrderReceiptBatch.reversal_status != "reversed",
            )
            .order_by(ProcOrderReceiptBatch.sequence.desc())
            .first()
        )

    def _restore_last_receipt_after_reversal(
        self,
        ctx: TenantContext,
        order: ProcOrderHeader,
        *,
        exclude_batch_id: UUID,
        now,
    ) -> None:
        remaining = (
            self._db.query(ProcOrderReceiptBatchLine, ProcOrderReceiptBatch)
            .join(
                ProcOrderReceiptBatch,
                ProcOrderReceiptBatchLine.receipt_batch_id == ProcOrderReceiptBatch.id,
            )
            .filter(
                ProcOrderReceiptBatch.order_header_id == order.id,
                ProcOrderReceiptBatch.id != exclude_batch_id,
                ProcOrderReceiptBatch.is_deleted.is_(False),
                ProcOrderReceiptBatch.reversal_status != "reversed",
                ProcOrderReceiptBatchLine.is_deleted.is_(False),
            )
            .all()
        )
        latest_by_line: dict[UUID, tuple[ProcOrderReceiptBatchLine, ProcOrderReceiptBatch]] = {}
        for bl, batch in remaining:
            current = latest_by_line.get(bl.order_line_id)
            if current is None or int(batch.sequence) > int(current[1].sequence):
                latest_by_line[bl.order_line_id] = (bl, batch)

        for ol in order.lines or []:
            if getattr(ol, "is_deleted", False):
                continue
            pair = latest_by_line.get(ol.id)
            if pair is None:
                ol.last_receipt_qty = 0
                ol.last_receipt_at = None
                ol.last_receipt_batch_id = None
                if hasattr(ol, "last_receipt_serial_numbers"):
                    ol.last_receipt_serial_numbers = None
                if hasattr(ol, "last_receipt_billing"):
                    ol.last_receipt_billing = True
                if hasattr(ol, "last_receipt_billing_quantity"):
                    ol.last_receipt_billing_quantity = 0.0
                if hasattr(ol, "last_receipt_delivery_challan_quantity"):
                    ol.last_receipt_delivery_challan_quantity = 0.0
            else:
                bl, batch = pair
                ol.last_receipt_qty = float(bl.quantity or 0)
                ol.last_receipt_at = batch.receipt_at
                ol.last_receipt_batch_id = batch.id
                if hasattr(ol, "last_receipt_serial_numbers"):
                    ol.last_receipt_serial_numbers = list(bl.serial_numbers or []) or None
                if hasattr(ol, "last_receipt_billing"):
                    ol.last_receipt_billing = bool(getattr(bl, "billing", True))
                if hasattr(ol, "last_receipt_billing_quantity"):
                    ol.last_receipt_billing_quantity = float(
                        getattr(bl, "billing_quantity", 0) or 0
                    )
                if hasattr(ol, "last_receipt_delivery_challan_quantity"):
                    ol.last_receipt_delivery_challan_quantity = float(
                        getattr(bl, "delivery_challan_quantity", 0) or 0
                    )
            ol.updated_by = ctx.user_id
            ol.updated_at = now

    def _apply_inventory_reversal(
        self,
        ctx: TenantContext,
        *,
        order: ProcOrderHeader,
        batch: ProcOrderReceiptBatch,
        reason: str,
        now,
    ) -> None:
        if not self._inventory_stock_table_exists():
            return
        units = (
            self._db.query(ProcInventoryStockUnit)
            .filter(ProcInventoryStockUnit.receipt_batch_id == batch.id)
            .all()
        )
        on_hand = [unit for unit in units if not unit.is_deleted]
        consumed = [unit for unit in units if unit.is_deleted]
        for unit in on_hand:
            unit.is_deleted = True
            unit.deleted_at = now
            unit.deleted_by = ctx.user_id
            unit.updated_by = ctx.user_id
            unit.updated_at = now

        if not consumed or not self._inventory_adjustment_table_exists():
            return
        has_qty = self._inventory_stock_has_quantity()
        for unit in consumed:
            qty = float(getattr(unit, "quantity", None) or 1) if has_qty else 1.0
            self._db.add(
                ProcInventoryStockAdjustment(
                    receipt_batch_id=batch.id,
                    order_header_id=order.id,
                    order_line_id=unit.order_line_id,
                    stock_unit_id=unit.id,
                    product_name=unit.product_name,
                    grn_number=unit.grn_number,
                    serial_number=unit.serial_number,
                    unit_index=unit.unit_index,
                    quantity=-abs(qty),
                    reason=reason[:2000],
                    tenant_id=order.tenant_id,
                    company_id=order.company_id,
                    branch_id=order.branch_id,
                    created_by=ctx.user_id,
                    updated_by=ctx.user_id,
                )
            )

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
                    "delivery_challan_quantity": float(
                        getattr(bl, "delivery_challan_quantity", 0) or 0
                    ),
                }
            )
        rows.sort(key=lambda r: r["line_number"])
        return rows

    @staticmethod
    def _clamp_receipt_split(
        receive: float,
        billing_quantity: float,
        delivery_challan_quantity: float = 0,
    ) -> tuple[float, float, float]:
        qty = max(0.0, float(receive or 0))
        bill = max(0.0, float(billing_quantity or 0))
        dc = max(0.0, float(delivery_challan_quantity or 0))
        if bill > qty:
            bill = qty
        if bill + dc > qty:
            dc = max(0.0, qty - bill)
        stock = round(qty - bill - dc, 6)
        return bill, dc, stock

    @staticmethod
    def _inventory_stock_lots_from_batch_line(
        batch_line: ProcOrderReceiptBatchLine,
    ) -> list[tuple[int, str, float]]:
        """Warehouse leftover after billed and DC units (bill, then DC, then stock)."""
        qty = float(batch_line.quantity or 0)
        if qty <= 0:
            return []
        bill, dc, stock = ScmHandoffService._clamp_receipt_split(
            qty,
            float(getattr(batch_line, "billing_quantity", 0) or 0),
            float(getattr(batch_line, "delivery_challan_quantity", 0) or 0),
        )
        if stock <= 1e-9:
            return []
        serials = [str(s).strip() for s in (batch_line.serial_numbers or []) if str(s).strip()]
        whole = int(stock)
        frac = round(stock - whole, 6)
        start = int(bill) + int(dc)
        lots: list[tuple[int, str, float]] = []
        for i in range(whole):
            global_index = start + i
            unit_index = global_index + 1
            serial = serials[global_index] if global_index < len(serials) else "-"
            lots.append((unit_index, serial, 1.0))
        if frac > 1e-9:
            lots.append((start + whole + 1, "NA", frac))
        return lots

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
        delivery_challan_quantity: float = 0,
    ) -> None:
        if not self._inventory_stock_table_exists():
            return
        receive = float(receive_qty or 0)
        _bill, _dc, stock = self._clamp_receipt_split(
            receive, billing_quantity, delivery_challan_quantity
        )
        if stock <= 1e-9:
            return
        whole = int(stock)
        frac = round(stock - whole, 6)
        row_count = whole + (1 if frac > 1e-9 else 0)
        if row_count <= 0:
            return

        serials = [str(s).strip() for s in (serial_numbers or []) if str(s).strip()]
        grn_label = (grn_number or "").strip() or "-"
        product = (line.product_name or "").strip() or "Unnamed product"
        start_serial = int(_bill) + int(_dc)
        qty_rec = float(line.quantity_received or 0)
        has_qty = self._inventory_stock_has_quantity()
        from modules.procurement.service.inventory_ownership_service import InventoryOwnershipService

        # Stock is accountable to the salesperson whose OVF ordered it.
        owner_employee_id, source_ovf_id = InventoryOwnershipService(self._db).owner_for_order(ctx, order)
        ownership = {
            "owner_employee_id": owner_employee_id,
            "owner_assigned_at": utcnow() if owner_employee_id else None,
            "source_ovf_id": source_ovf_id,
        }

        for i in range(whole):
            serial_idx = start_serial + i
            serial = serials[serial_idx] if serial_idx < len(serials) else "-"
            unit_index = max(1, int(qty_rec) - row_count + i + 1)
            unit = ProcInventoryStockUnit(
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
                **ownership,
            )
            if has_qty:
                unit.quantity = 1.0
            self._db.add(unit)

        if frac > 1e-9:
            unit_index = max(1, int(qty_rec) - row_count + whole + 1)
            unit = ProcInventoryStockUnit(
                order_header_id=order.id,
                order_line_id=line.id,
                receipt_batch_id=batch_id,
                product_name=product,
                grn_number=grn_label,
                receipt_at=receipt_at,
                unit_index=unit_index,
                serial_number="NA",
                tenant_id=order.tenant_id,
                company_id=order.company_id,
                branch_id=order.branch_id,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
                **ownership,
            )
            if has_qty:
                unit.quantity = float(frac)
            self._db.add(unit)

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
        self._scope.validate_company_access(ctx, unit.company_id)

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
                serials.append("-")
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
                    last_serials.append("-")
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
        self._scope.validate_company_access(ctx, line.company_id)
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
        self._scope.validate_company_access(ctx, row.company_id)
        row.serial_number = serial
        row.updated_by = ctx.user_id
        row.updated_at = utcnow()

    def _inventory_order_headers(
        self,
        ctx: TenantContext,
        company_id: UUID | None,
        order_ids: list[UUID],
    ) -> dict[UUID, ProcOrderHeader]:
        """Load PO headers for inventory enrichment (company optional; not branch-gated).

        On-hand stock is company/tenant ledger state (same as Aging). Branch-scoping the
        PO join dropped units whose orders lived on another branch.
        """
        if not order_ids:
            return {}
        stmt = select(ProcOrderHeader).where(
            ProcOrderHeader.tenant_id == ctx.tenant_id,
            ProcOrderHeader.is_deleted.is_(False),
            ProcOrderHeader.id.in_(order_ids),
        )
        stmt = ProcScopedRepository.apply_optional_company_filter(
            stmt, ProcOrderHeader, company_id
        )
        stmt = stmt.options(
            load_only(
                ProcOrderHeader.id,
                ProcOrderHeader.vendor_id,
                ProcOrderHeader.company_po_number,
                ProcOrderHeader.document_number,
                ProcOrderHeader.payment_terms,
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
            ProcOrderLine.tenant_id == ctx.tenant_id,
            ProcOrderLine.is_deleted.is_(False),
            ProcOrderLine.id.in_(line_ids),
        )
        stmt = stmt.options(
            load_only(
                ProcOrderLine.id,
                ProcOrderLine.product_name,
                ProcOrderLine.product_code,
                ProcOrderLine.description,
                ProcOrderLine.line_number,
                ProcOrderLine.unit_cost,
                ProcOrderLine.tax_rate,
                ProcOrderLine.tenant_id,
                ProcOrderLine.company_id,
                ProcOrderLine.branch_id,
                ProcOrderLine.is_deleted,
            )
        )
        rows = list(self._db.scalars(stmt).all())
        return {row.id: row for row in rows}

    def _inventory_receipt_batches(
        self,
        ctx: TenantContext,
        batch_ids: list[UUID],
    ) -> dict[UUID, ProcOrderReceiptBatch]:
        if not batch_ids or not self._receipt_batch_tables_exist():
            return {}
        rows = (
            self._db.query(ProcOrderReceiptBatch)
            .options(
                load_only(
                    ProcOrderReceiptBatch.id,
                    ProcOrderReceiptBatch.vendor_invoice_number,
                    ProcOrderReceiptBatch.vendor_invoice_date,
                    ProcOrderReceiptBatch.receipt_at,
                    ProcOrderReceiptBatch.grn_number,
                )
            )
            .filter(
                ProcOrderReceiptBatch.tenant_id == ctx.tenant_id,
                ProcOrderReceiptBatch.is_deleted.is_(False),
                ProcOrderReceiptBatch.id.in_(batch_ids),
            )
            .all()
        )
        return {row.id: row for row in rows}

    @staticmethod
    def _inventory_ageing_days(
        *,
        invoice_date: date | None,
        receipt_at: datetime | None,
    ) -> int | None:
        anchor = invoice_date
        if anchor is None and receipt_at is not None:
            anchor = receipt_at.date() if hasattr(receipt_at, "date") else None
        if anchor is None:
            return None
        return max(0, (date.today() - anchor).days)

    def _inventory_row_commercial_fields(
        self,
        ctx: TenantContext,
        *,
        order: ProcOrderHeader | None,
        line: ProcOrderLine | None,
        batch: ProcOrderReceiptBatch | None,
        receipt_at: datetime | None,
        fallback_description: str | None = None,
        vendor_name_cache: dict[UUID, str | None] | None = None,
    ) -> dict:
        vendor_id = order.vendor_id if order else None
        vendor_name = None
        if vendor_id is not None:
            if vendor_name_cache is not None and vendor_id in vendor_name_cache:
                vendor_name = vendor_name_cache[vendor_id]
            else:
                vendor_name = self._vendor_display_name(ctx, vendor_id)
                if vendor_name_cache is not None:
                    vendor_name_cache[vendor_id] = vendor_name
        invoice_number = (
            (getattr(batch, "vendor_invoice_number", None) or "").strip() or None
            if batch is not None
            else None
        )
        invoice_date = getattr(batch, "vendor_invoice_date", None) if batch is not None else None
        line_desc = (getattr(line, "description", None) or "").strip() if line else ""
        product_code = (getattr(line, "product_code", None) or "").strip() if line else ""
        description = line_desc or product_code or (fallback_description or None)
        return {
            "vendor_name": vendor_name,
            "payment_terms": (
                (order.payment_terms or "").strip() or None if order is not None else None
            ),
            "vendor_invoice_number": invoice_number,
            "vendor_invoice_date": invoice_date,
            "tax_rate": float(getattr(line, "tax_rate", 0) or 0) if line else 0.0,
            "description": description,
            "ageing_days": self._inventory_ageing_days(
                invoice_date=invoice_date,
                receipt_at=receipt_at,
            ),
        }

    def repair_wave_grn_batches_into_stock(
        self, ctx: TenantContext, company_id: UUID | None = None
    ) -> int:
        """Move fully-billed wave GRNs with no stock rows into inventory.

        Wave Record GRN briefly posted 100% as billed (no warehouse leftover).
        Correct path is GRN → stock, then billing/DC later. Idempotent.
        """
        if not self._inventory_stock_table_exists() or not self._receipt_batch_tables_exist():
            return 0
        cid = self._scope.resolve_list_company_id(ctx, company_id)
        batch_q = (
            self._db.query(ProcOrderReceiptBatch)
            .join(ProcOrderHeader, ProcOrderReceiptBatch.order_header_id == ProcOrderHeader.id)
            .filter(
                ProcOrderReceiptBatch.tenant_id == ctx.tenant_id,
                ProcOrderReceiptBatch.is_deleted.is_(False),
                ProcOrderReceiptBatch.vendor_dispatch_id.isnot(None),
                ProcOrderReceiptBatch.reversal_status != "reversed",
                ProcOrderHeader.is_deleted.is_(False),
            )
        )
        if cid is not None:
            batch_q = batch_q.filter(ProcOrderReceiptBatch.company_id == cid)
        batches = batch_q.all()
        if not batches:
            return 0

        batch_ids = [b.id for b in batches]
        existing_stock_batch_ids = {
            row[0]
            for row in (
                self._db.query(ProcInventoryStockUnit.receipt_batch_id)
                .filter(
                    ProcInventoryStockUnit.receipt_batch_id.in_(batch_ids),
                    ProcInventoryStockUnit.is_deleted.is_(False),
                )
                .distinct()
                .all()
            )
            if row[0] is not None
        }
        lines = (
            self._db.query(ProcOrderReceiptBatchLine)
            .filter(
                ProcOrderReceiptBatchLine.receipt_batch_id.in_(batch_ids),
                ProcOrderReceiptBatchLine.is_deleted.is_(False),
            )
            .all()
        )
        lines_by_batch: dict[UUID, list[ProcOrderReceiptBatchLine]] = defaultdict(list)
        for bl in lines:
            lines_by_batch[bl.receipt_batch_id].append(bl)

        order_ids = list({b.order_header_id for b in batches})
        orders = {
            o.id: o
            for o in self._db.query(ProcOrderHeader)
            .filter(
                ProcOrderHeader.id.in_(order_ids),
                ProcOrderHeader.tenant_id == ctx.tenant_id,
                ProcOrderHeader.is_deleted.is_(False),
            )
            .all()
        }
        line_ids = list({bl.order_line_id for bl in lines})
        order_lines = self._inventory_order_lines(ctx, line_ids) if line_ids else {}

        repaired = 0
        for batch in batches:
            if batch.id in existing_stock_batch_ids:
                continue
            order = orders.get(batch.order_header_id)
            if order is None:
                continue
            for bl in lines_by_batch.get(batch.id, []):
                qty = float(bl.quantity or 0)
                if qty <= 1e-9:
                    continue
                bill = float(getattr(bl, "billing_quantity", 0) or 0)
                dc = float(getattr(bl, "delivery_challan_quantity", 0) or 0)
                # Only rewrite fully-billed wave lines with no DC split.
                if bill + 1e-9 < qty or dc > 1e-9:
                    continue
                ol = order_lines.get(bl.order_line_id)
                if ol is None:
                    continue
                bl.billing = False
                bl.billing_quantity = 0.0
                bl.updated_by = ctx.user_id
                bl.updated_at = utcnow()
                if hasattr(ol, "last_receipt_billing"):
                    ol.last_receipt_billing = False
                if hasattr(ol, "last_receipt_billing_quantity"):
                    ol.last_receipt_billing_quantity = 0.0
                self._append_stock_units_for_receipt(
                    ctx,
                    order=order,
                    line=ol,
                    batch_id=batch.id,
                    grn_number=str(batch.grn_number or ""),
                    receipt_at=batch.receipt_at,
                    receive_qty=qty,
                    billing_quantity=0.0,
                    serial_numbers=list(bl.serial_numbers or []),
                    delivery_challan_quantity=0.0,
                )
                repaired += 1
        if repaired:
            self._db.flush()
        return repaired

    def list_procurement_inventory(
        self, ctx: TenantContext, company_id: UUID | None = None
    ) -> list[dict]:
        """One row per stock unit on hand (ledger) plus optional Excel import lines."""
        # Heal wave GRNs that were posted as 100% billed (no inventory rows).
        self.repair_wave_grn_batches_into_stock(ctx, company_id)
        cid = self._scope.resolve_list_company_id(ctx, company_id)
        order_cache: dict[UUID, ProcOrderHeader] = {}
        result: list[dict] = []

        if self._inventory_stock_table_exists():
            stock_q = self._db.query(ProcInventoryStockUnit).filter(
                ProcInventoryStockUnit.tenant_id == ctx.tenant_id,
                ProcInventoryStockUnit.is_deleted.is_(False),
            )
            if cid is not None:
                stock_q = stock_q.filter(ProcInventoryStockUnit.company_id == cid)
            stock_rows = stock_q.order_by(
                ProcInventoryStockUnit.receipt_at.desc(),
                ProcInventoryStockUnit.grn_number.desc(),
            ).all()
            order_ids = list({row.order_header_id for row in stock_rows})
            order_cache = self._inventory_order_headers(ctx, cid, order_ids)
            line_by_id = self._inventory_order_lines(
                ctx,
                list({row.order_line_id for row in stock_rows}),
            )
            batch_by_id = self._inventory_receipt_batches(
                ctx,
                list({row.receipt_batch_id for row in stock_rows if row.receipt_batch_id}),
            )
            vendor_name_cache: dict[UUID, str | None] = {}
            for stock in stock_rows:
                order = order_cache.get(stock.order_header_id)
                ol = line_by_id.get(stock.order_line_id)
                batch = batch_by_id.get(stock.receipt_batch_id) if stock.receipt_batch_id else None
                po_number = (
                    (
                        (order.company_po_number or order.document_number or "").strip()
                        if order
                        else ""
                    )
                    or "-"
                )
                unit_cost = float(getattr(ol, "unit_cost", 0) or 0) if ol else 0.0
                line_number = int(ol.line_number) if ol else 0
                stock_qty = float(getattr(stock, "quantity", None) or 1)
                commercial = self._inventory_row_commercial_fields(
                    ctx,
                    order=order,
                    line=ol,
                    batch=batch,
                    receipt_at=stock.receipt_at,
                    fallback_description=stock.product_name,
                    vendor_name_cache=vendor_name_cache,
                )
                result.append(
                    {
                        "order_id": order.id if order else stock.order_header_id,
                        "order_line_id": stock.order_line_id,
                        "receipt_batch_id": stock.receipt_batch_id,
                        "grn_number": stock.grn_number,
                        "receipt_at": stock.receipt_at,
                        "company_po_number": po_number,
                        "vendor_id": order.vendor_id if order else None,
                        "product_name": stock.product_name,
                        "line_number": line_number,
                        "unit_index": stock.unit_index,
                        "serial_number": stock.serial_number,
                        "source": "grn",
                        "received_quantity": stock_qty,
                        "billing_quantity": 0,
                        "unit_cost": unit_cost,
                        "stock_unit_id": stock.id,
                        "import_line_id": None,
                        "warranty_valid_till": getattr(stock, "warranty_valid_till", None),
                        "owner_employee_id": stock.owner_employee_id,
                        "source_ovf_id": stock.source_ovf_id,
                        "open_for_sale": bool(stock.open_for_sale),
                        **commercial,
                    }
                )
        else:
            batch_q = (
                self._db.query(ProcOrderReceiptBatch)
                .join(ProcOrderHeader, ProcOrderReceiptBatch.order_header_id == ProcOrderHeader.id)
                .filter(
                    ProcOrderReceiptBatch.tenant_id == ctx.tenant_id,
                    ProcOrderReceiptBatch.is_deleted.is_(False),
                    ProcOrderHeader.is_deleted.is_(False),
                )
            )
            if cid is not None:
                batch_q = batch_q.filter(ProcOrderReceiptBatch.company_id == cid)
            batches = batch_q.order_by(
                ProcOrderReceiptBatch.receipt_at.desc(),
                ProcOrderReceiptBatch.grn_number.desc(),
            ).all()

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
                if self._receipt_batch_line_has_delivery_challan_quantity():
                    batch_line_load.append(ProcOrderReceiptBatchLine.delivery_challan_quantity)
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
            vendor_name_cache: dict[UUID, str | None] = {}

            for batch in batches:
                if (getattr(batch, "reversal_status", None) or "posted") == "reversed":
                    continue
                order_id = batch.order_header_id
                order = order_cache.get(order_id)
                if order is None:
                    continue
                po_number = (order.company_po_number or order.document_number or "").strip() or "-"
                grn_label = (batch.grn_number or "").strip() or "-"

                for bl in lines_by_batch.get(batch.id, []):
                    qty = float(bl.quantity or 0)
                    if qty <= 0:
                        continue
                    ol = line_by_id.get(bl.order_line_id)
                    if ol is None:
                        continue
                    unit_cost = float(getattr(ol, "unit_cost", 0) or 0)
                    commercial = self._inventory_row_commercial_fields(
                        ctx,
                        order=order,
                        line=ol,
                        batch=batch,
                        receipt_at=batch.receipt_at,
                        fallback_description=ol.product_name,
                        vendor_name_cache=vendor_name_cache,
                    )
                    stock_lots = self._inventory_stock_lots_from_batch_line(bl)
                    for unit_index, serial, lot_qty in stock_lots:
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
                                "received_quantity": lot_qty,
                                "billing_quantity": 0,
                                "unit_cost": unit_cost,
                                "stock_unit_id": None,
                                "import_line_id": None,
                                "warranty_valid_till": None,
                                **commercial,
                            }
                        )

        if self._inventory_adjustment_table_exists():
            adj_q = self._db.query(ProcInventoryStockAdjustment).filter(
                ProcInventoryStockAdjustment.tenant_id == ctx.tenant_id,
                ProcInventoryStockAdjustment.is_deleted.is_(False),
            )
            if cid is not None:
                adj_q = adj_q.filter(ProcInventoryStockAdjustment.company_id == cid)
            adjustments = adj_q.order_by(ProcInventoryStockAdjustment.created_at.desc()).all()
            missing_order_ids = [
                row.order_header_id
                for row in adjustments
                if row.order_header_id not in order_cache
            ]
            if missing_order_ids:
                order_cache.update(self._inventory_order_headers(ctx, cid, list(set(missing_order_ids))))
            line_ids = list({row.order_line_id for row in adjustments})
            adj_lines = self._inventory_order_lines(ctx, line_ids)
            adj_batches = self._inventory_receipt_batches(
                ctx,
                list({row.receipt_batch_id for row in adjustments if row.receipt_batch_id}),
            )
            vendor_name_cache: dict[UUID, str | None] = {}
            for adj in adjustments:
                order = order_cache.get(adj.order_header_id)
                ol = adj_lines.get(adj.order_line_id)
                batch = adj_batches.get(adj.receipt_batch_id) if adj.receipt_batch_id else None
                po_number = (
                    (
                        (order.company_po_number or order.document_number or "").strip()
                        if order
                        else ""
                    )
                    or "-"
                )
                unit_cost = float(getattr(ol, "unit_cost", 0) or 0) if ol else 0.0
                line_number = int(ol.line_number) if ol else 0
                commercial = self._inventory_row_commercial_fields(
                    ctx,
                    order=order,
                    line=ol,
                    batch=batch,
                    receipt_at=adj.created_at,
                    fallback_description=adj.product_name,
                    vendor_name_cache=vendor_name_cache,
                )
                result.append(
                    {
                        "order_id": order.id if order else adj.order_header_id,
                        "order_line_id": adj.order_line_id,
                        "receipt_batch_id": adj.receipt_batch_id,
                        "grn_number": adj.grn_number,
                        "receipt_at": adj.created_at,
                        "company_po_number": po_number,
                        "vendor_id": order.vendor_id if order else None,
                        "product_name": adj.product_name,
                        "line_number": line_number,
                        "unit_index": adj.unit_index,
                        "serial_number": adj.serial_number,
                        "source": "grn_reversal",
                        "received_quantity": float(adj.quantity or 0),
                        "billing_quantity": 0,
                        "unit_cost": unit_cost,
                        "stock_unit_id": adj.stock_unit_id,
                        "import_line_id": None,
                        "warranty_valid_till": None,
                        **commercial,
                    }
                )

        if self._inventory_import_table_exists():
            import_q = self._db.query(ProcInventoryImportLine).filter(
                ProcInventoryImportLine.tenant_id == ctx.tenant_id,
                ProcInventoryImportLine.is_deleted.is_(False),
            )
            if cid is not None:
                import_q = import_q.filter(ProcInventoryImportLine.company_id == cid)
            imports = import_q.order_by(ProcInventoryImportLine.created_at.desc()).all()
            vendor_name_cache: dict[UUID, str | None] = {}
            for row in imports:
                vendor_id = None
                linked_order = None
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
                receipt_at = (
                    datetime.combine(row.received_on, datetime.min.time(), tzinfo=timezone.utc)
                    if row.received_on
                    else row.created_at
                )
                commercial = self._inventory_row_commercial_fields(
                    ctx,
                    order=linked_order,
                    line=None,
                    batch=None,
                    receipt_at=receipt_at,
                    fallback_description=(getattr(row, "description", None) or row.product_name),
                    vendor_name_cache=vendor_name_cache,
                )
                result.append(
                    {
                        "order_id": row.order_header_id,
                        "order_line_id": None,
                        "receipt_batch_id": None,
                        "grn_number": "Imported",
                        "receipt_at": receipt_at,
                        "company_po_number": po_label,
                        "vendor_id": vendor_id,
                        "product_name": row.product_name,
                        "line_number": 0,
                        "unit_index": 1,
                        "serial_number": row.serial_number,
                        "source": "import",
                        "received_quantity": 1,
                        "billing_quantity": 0,
                        "unit_cost": float(row.unit_cost or 0),
                        "stock_unit_id": None,
                        "import_line_id": row.id,
                        "warranty_valid_till": getattr(row, "warranty_valid_till", None),
                        "owner_employee_id": row.owner_employee_id,
                        "source_ovf_id": row.source_ovf_id,
                        "open_for_sale": bool(row.open_for_sale),
                        **commercial,
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
            description = str(raw.get("description") or "").strip() or None
            warranty_raw = raw.get("warranty_valid_till")
            warranty_valid_till = None
            if warranty_raw:
                from datetime import date as date_cls

                if isinstance(warranty_raw, date_cls):
                    warranty_valid_till = warranty_raw
                else:
                    text = str(warranty_raw).strip()[:10]
                    if text:
                        warranty_valid_till = date_cls.fromisoformat(text)
            if not product or not serial:
                continue
            from datetime import date as date_cls

            received_raw = raw.get("received_on")
            received_on = None
            if isinstance(received_raw, date_cls):
                received_on = received_raw
            elif received_raw and str(received_raw).strip():
                received_on = date_cls.fromisoformat(str(received_raw).strip()[:10])
            unit_cost_raw = raw.get("unit_cost")
            unit_cost = float(unit_cost_raw) if unit_cost_raw not in (None, "") else None
            if unit_cost is not None and unit_cost < 0:
                raise ConflictException(f'Unit cost cannot be negative for "{product}"')
            owner_employee_id = raw.get("owner_employee_id")
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
                description=description[:255] if description else None,
                serial_number=serial,
                warranty_valid_till=warranty_valid_till,
                order_header_id=order_id,
                company_po_number=po_number,
                unit_cost=unit_cost,
                received_on=received_on,
                owner_employee_id=owner_employee_id,
                owner_assigned_at=utcnow() if owner_employee_id else None,
                open_for_sale=owner_employee_id is None,
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
