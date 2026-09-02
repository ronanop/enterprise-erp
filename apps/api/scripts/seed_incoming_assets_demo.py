"""Seed 5 Procurement GRN lines so Incoming Assets / QC / Registration can be walked.

Creates a real PO + received GRNs with lines. Incoming Assets syncs those GRN lines
on GET /assets/incoming-assets — this script does not insert fake UI rows.

Walkthrough after seed:
  1. Incoming Assets  — receive qty / units  (EXPECTED → ARRIVED)
  2. Incoming QC      — accept / reject arrived units  (does not create ast_asset)
  3. Pending Registration — register QC-accepted units into inventory

Usage (from apps/api):
  .venv/bin/python -m scripts.seed_incoming_assets_demo
  .venv/bin/python -m scripts.seed_incoming_assets_demo --cleanup
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.asset.models.asset import AstAsset  # noqa: E402
from modules.asset.models.incoming_asset import (  # noqa: E402
    AstIncomingArrivalEvent,
    AstIncomingAssetLine,
    AstIncomingAssetUnit,
    AstIncomingQcEvent,
)
from modules.asset.service.incoming_asset_service import IncomingAssetService  # noqa: E402
from modules.foundation.domain.value_objects import TenantContext  # noqa: E402
from modules.foundation.models.security import SecTenant, SecUser  # noqa: E402
from modules.master_data.models.category import MasterProductCategory  # noqa: E402
from modules.master_data.models.party import MasterVendor  # noqa: E402
from modules.master_data.models.product import MasterProduct  # noqa: E402
from modules.master_data.models.reference import MasterUom  # noqa: E402
from modules.master_data.models.warehouse import MasterWarehouse  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from modules.procurement.models.grn import ProcGrnHeader, ProcGrnLine  # noqa: E402
from modules.procurement.models.order import ProcOrderHeader, ProcOrderLine  # noqa: E402

MARKER = "DEMO_INCOMING_ASSETS_WALKTHROUGH"
PO_NUMBER = "DEMO-IT-PO-0001"
CATEGORY_CODE = "DEMO-IT-CAT"
DOC_DATE = date(2026, 8, 20)

ITEMS: tuple[dict, ...] = (
    {
        "code": "DEMO-IT-DELL-5440",
        "name": "Dell Latitude 5440 Laptop",
        "qty": 5,
        "unit_cost": Decimal("78500.00"),
        "grn_number": "DEMO-IT-GRN-0001",
        "grn_status": "received",
        "grn_qty": 5,
    },
    {
        "code": "DEMO-IT-MBP-14",
        "name": "Apple MacBook Pro 14",
        "qty": 2,
        "unit_cost": Decimal("189900.00"),
        "grn_number": "DEMO-IT-GRN-0002",
        "grn_status": "received",
        "grn_qty": 2,
    },
    {
        "code": "DEMO-IT-T14",
        "name": "Lenovo ThinkPad T14 Gen 4",
        "qty": 3,
        "unit_cost": Decimal("112400.00"),
        "grn_number": "DEMO-IT-GRN-0003",
        "grn_status": "received",
        "grn_qty": 3,
    },
    {
        "code": "DEMO-IT-HP-E24",
        "name": "HP EliteDisplay E24 Monitor",
        "qty": 4,
        "unit_cost": Decimal("18600.00"),
        "grn_number": "DEMO-IT-GRN-0004",
        "grn_status": "received",
        "grn_qty": 4,
    },
    {
        "code": "DEMO-IT-IPAD-11",
        "name": "Apple iPad 11-inch",
        "qty": 6,
        "unit_cost": Decimal("52400.00"),
        "grn_number": "DEMO-IT-GRN-0005",
        "grn_status": "partially_received",
        "grn_qty": 2,
    },
)

PRODUCT_CODES = tuple(item["code"] for item in ITEMS)
GRN_NUMBERS = tuple(item["grn_number"] for item in ITEMS)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def require(row, label: str):
    if row is None:
        raise SystemExit(f"{label} not found. Run seed_demo_data / seed_demo_modules first.")
    return row


def ctx_for(user: SecUser, company_id: UUID, branch_id: UUID) -> TenantContext:
    return TenantContext(
        tenant_id=user.tenant_id,
        user_id=user.id,
        user_type=user.user_type or "internal",
        company_id=company_id,
        branch_id=branch_id,
    )


def _active(stmt, model):
    return stmt.where(model.is_deleted.is_(False))


def _soft_delete(row, user_id: UUID) -> None:
    now = utcnow()
    row.is_deleted = True
    row.deleted_at = now
    row.deleted_by = user_id
    row.updated_by = user_id
    row.updated_at = now


def _retire_code(row, field: str, *, max_len: int) -> None:
    current = str(getattr(row, field) or "")
    suffix = f"~{uuid4().hex[:8]}"
    base = current[: max(1, max_len - len(suffix))]
    setattr(row, field, f"{base}{suffix}"[:max_len])


def _get(db: Session, model, **filters):
    stmt = select(model)
    for key, value in filters.items():
        stmt = stmt.where(getattr(model, key) == value)
    return db.scalar(_active(stmt, model))


def resolve_scope(db: Session) -> tuple[SecTenant, OrgCompany, OrgBranch, SecUser]:
    tenant = require(
        db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP")),
        "BOOTSTRAP tenant",
    )
    company = require(
        db.scalar(
            _active(select(OrgCompany), OrgCompany).where(
                OrgCompany.tenant_id == tenant.id,
                OrgCompany.company_code == "DEMOCO",
            )
        ),
        "DEMOCO company",
    )
    branch = require(
        db.scalar(
            _active(select(OrgBranch), OrgBranch).where(
                OrgBranch.company_id == company.id,
                OrgBranch.branch_code == "HQ",
            )
        ),
        "HQ branch",
    )
    admin = require(
        db.scalar(
            _active(select(SecUser), SecUser).where(SecUser.email == "admin@example.com")
        ),
        "admin@example.com",
    )
    return tenant, company, branch, admin


def resolve_vendor(db: Session, company_id: UUID) -> MasterVendor:
    vendor = db.scalar(
        _active(select(MasterVendor), MasterVendor).where(
            MasterVendor.company_id == company_id,
            MasterVendor.vendor_code == "VEND-001",
        )
    )
    if vendor is None:
        vendor = db.scalar(
            _active(select(MasterVendor), MasterVendor).where(
                MasterVendor.company_id == company_id
            )
        )
    return require(vendor, "Vendor (VEND-001)")


def resolve_uom(db: Session, company_id: UUID) -> MasterUom:
    uom = db.scalar(
        _active(select(MasterUom), MasterUom).where(
            MasterUom.company_id == company_id,
            MasterUom.uom_code == "EA",
        )
    )
    if uom is None:
        uom = db.scalar(
            _active(select(MasterUom), MasterUom).where(MasterUom.company_id == company_id)
        )
    return require(uom, "UOM (EA)")


def resolve_warehouse(
    db: Session, *, tenant_id: UUID, company_id: UUID, branch_id: UUID, admin_id: UUID
) -> MasterWarehouse:
    warehouse = db.scalar(
        _active(select(MasterWarehouse), MasterWarehouse).where(
            MasterWarehouse.company_id == company_id,
            MasterWarehouse.warehouse_code == "WH-HQ",
        )
    )
    if warehouse is not None:
        return warehouse
    warehouse = db.scalar(
        _active(select(MasterWarehouse), MasterWarehouse).where(
            MasterWarehouse.company_id == company_id
        )
    )
    if warehouse is not None:
        return warehouse
    warehouse = MasterWarehouse(
        id=uuid4(),
        tenant_id=tenant_id,
        company_id=company_id,
        branch_id=branch_id,
        warehouse_code="WH-HQ",
        warehouse_name="HQ Warehouse",
        warehouse_type="central",
        status="active",
        created_by=admin_id,
        updated_by=admin_id,
    )
    db.add(warehouse)
    db.flush()
    return warehouse


def ensure_category(
    db: Session, *, tenant_id: UUID, company_id: UUID, admin_id: UUID
) -> MasterProductCategory:
    cat = _get(db, MasterProductCategory, company_id=company_id, category_code=CATEGORY_CODE)
    if cat is not None:
        return cat
    cat = MasterProductCategory(
        id=uuid4(),
        tenant_id=tenant_id,
        company_id=company_id,
        category_code=CATEGORY_CODE,
        category_name="IT Hardware (Incoming Assets demo)",
        status="active",
        created_by=admin_id,
        updated_by=admin_id,
    )
    db.add(cat)
    db.flush()
    return cat


def ensure_products(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    branch_id: UUID,
    admin_id: UUID,
    uom_id: UUID,
    category_id: UUID,
) -> dict[str, MasterProduct]:
    by_code: dict[str, MasterProduct] = {}
    for item in ITEMS:
        product = _get(db, MasterProduct, company_id=company_id, product_code=item["code"])
        if product is None:
            product = MasterProduct(
                id=uuid4(),
                tenant_id=tenant_id,
                company_id=company_id,
                branch_id=branch_id,
                product_code=item["code"],
                product_name=item["name"],
                product_type="goods",
                category_id=category_id,
                uom_id=uom_id,
                standard_cost=float(item["unit_cost"]),
                list_price=float(item["unit_cost"]),
                is_inventory_tracked=True,
                description=MARKER,
                status="active",
                created_by=admin_id,
                updated_by=admin_id,
            )
            db.add(product)
            db.flush()
        by_code[item["code"]] = product
    return by_code


def ensure_po_and_grns(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    branch_id: UUID,
    admin_id: UUID,
    vendor_id: UUID,
    warehouse_id: UUID,
    uom_id: UUID,
    products: dict[str, MasterProduct],
) -> tuple[ProcOrderHeader, list[ProcGrnHeader]]:
    po = db.scalar(
        _active(select(ProcOrderHeader), ProcOrderHeader)
        .options(selectinload(ProcOrderHeader.lines))
        .where(
            ProcOrderHeader.company_id == company_id,
            ProcOrderHeader.document_number == PO_NUMBER,
        )
    )
    line_total_by_code: dict[str, Decimal] = {}
    po_subtotal = Decimal("0")
    for item in ITEMS:
        line_total = item["qty"] * item["unit_cost"]
        line_total_by_code[item["code"]] = line_total
        po_subtotal += line_total

    if po is None:
        po = ProcOrderHeader(
            id=uuid4(),
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            document_number=PO_NUMBER,
            document_date=DOC_DATE,
            vendor_id=vendor_id,
            currency_code="INR",
            exchange_rate=1,
            subtotal_amount=float(po_subtotal),
            total_amount=float(po_subtotal),
            status="partially_received",
            source_module="asset",
            source_document_type=MARKER,
            created_by=admin_id,
            updated_by=admin_id,
        )
        db.add(po)
        db.flush()

    existing_lines = {int(line.line_number): line for line in (po.lines or []) if not line.is_deleted}
    po_lines_by_code: dict[str, ProcOrderLine] = {}
    for index, item in enumerate(ITEMS, start=1):
        product = products[item["code"]]
        line = existing_lines.get(index)
        qty_received = Decimal(str(item["grn_qty"]))
        line_status = "received" if qty_received >= item["qty"] else "partially_received"
        if line is None:
            line = ProcOrderLine(
                id=uuid4(),
                tenant_id=tenant_id,
                company_id=company_id,
                branch_id=branch_id,
                order_header_id=po.id,
                line_number=index,
                product_id=product.id,
                product_code=product.product_code,
                product_name=product.product_name,
                quantity=float(item["qty"]),
                uom_id=uom_id,
                unit_cost=float(item["unit_cost"]),
                line_total=float(line_total_by_code[item["code"]]),
                quantity_received=float(qty_received),
                status=line_status,
                created_by=admin_id,
                updated_by=admin_id,
            )
            db.add(line)
            db.flush()
        po_lines_by_code[item["code"]] = line

    po.status = "partially_received"
    po.subtotal_amount = float(po_subtotal)
    po.total_amount = float(po_subtotal)
    po.updated_by = admin_id

    grns: list[ProcGrnHeader] = []
    for item in ITEMS:
        product = products[item["code"]]
        po_line = po_lines_by_code[item["code"]]
        grn = db.scalar(
            _active(select(ProcGrnHeader), ProcGrnHeader)
            .options(selectinload(ProcGrnHeader.lines))
            .where(
                ProcGrnHeader.company_id == company_id,
                ProcGrnHeader.document_number == item["grn_number"],
            )
        )
        if grn is None:
            grn = ProcGrnHeader(
                id=uuid4(),
                tenant_id=tenant_id,
                company_id=company_id,
                branch_id=branch_id,
                document_number=item["grn_number"],
                document_date=DOC_DATE,
                order_header_id=po.id,
                vendor_id=vendor_id,
                warehouse_reference=warehouse_id,
                status=item["grn_status"],
                subtotal_amount=float(item["grn_qty"] * item["unit_cost"]),
                notes=MARKER,
                created_by=admin_id,
                updated_by=admin_id,
            )
            db.add(grn)
            db.flush()

        has_line = any(not gl.is_deleted for gl in (grn.lines or []))
        if not has_line:
            grn.lines.append(
                ProcGrnLine(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    company_id=company_id,
                    branch_id=branch_id,
                    order_line_id=po_line.id,
                    line_number=1,
                    product_id=product.id,
                    quantity=float(item["grn_qty"]),
                    quantity_rejected=0,
                    uom_id=uom_id,
                    status="received",
                    created_by=admin_id,
                    updated_by=admin_id,
                )
            )
            db.flush()
        grn.status = item["grn_status"]
        grn.notes = MARKER
        grn.updated_by = admin_id
        grns.append(grn)

    db.expire_all()
    return po, grns


def sync_incoming(db: Session, ctx: TenantContext, company_id: UUID, branch_id: UUID) -> list:
    rows, total = IncomingAssetService(db).search(
        ctx,
        company_id=company_id,
        branch_id=branch_id,
        search="DEMO-IT-GRN-",
        offset=0,
        limit=25,
        sync=True,
    )
    _ = total
    return rows


def seed(db: Session) -> None:
    tenant, company, branch, admin = resolve_scope(db)
    vendor = resolve_vendor(db, company.id)
    uom = resolve_uom(db, company.id)
    warehouse = resolve_warehouse(
        db,
        tenant_id=tenant.id,
        company_id=company.id,
        branch_id=branch.id,
        admin_id=admin.id,
    )
    category = ensure_category(
        db, tenant_id=tenant.id, company_id=company.id, admin_id=admin.id
    )
    products = ensure_products(
        db,
        tenant_id=tenant.id,
        company_id=company.id,
        branch_id=branch.id,
        admin_id=admin.id,
        uom_id=uom.id,
        category_id=category.id,
    )
    po, grns = ensure_po_and_grns(
        db,
        tenant_id=tenant.id,
        company_id=company.id,
        branch_id=branch.id,
        admin_id=admin.id,
        vendor_id=vendor.id,
        warehouse_id=warehouse.id,
        uom_id=uom.id,
        products=products,
    )
    db.flush()
    ctx = ctx_for(admin, company.id, branch.id)
    incoming = sync_incoming(db, ctx, company.id, branch.id)
    db.commit()

    print(f"PO {po.document_number}  vendor={vendor.vendor_code}  warehouse={warehouse.warehouse_code}")
    print(f"GRNs: {', '.join(g.document_number for g in grns)}")
    print(f"Incoming Assets synced: {len(incoming)} line(s)")
    for row in incoming:
        print(
            f"  {row.grn_document_number}  {row.product_code}  "
            f"expected={row.expected_quantity}  arrived={row.arrived_quantity}  "
            f"status={row.status}"
        )
    print()
    print("Walk: Incoming Assets (receive) → Incoming QC (accept) → Pending Registration")
    print("Remove later:  .venv/bin/python -m scripts.seed_incoming_assets_demo --cleanup")


def _incoming_demo_lines(db: Session, company_id: UUID) -> list[AstIncomingAssetLine]:
    return list(
        db.scalars(
            select(AstIncomingAssetLine)
            .options(selectinload(AstIncomingAssetLine.units))
            .where(
                AstIncomingAssetLine.company_id == company_id,
                AstIncomingAssetLine.is_deleted.is_(False),
                AstIncomingAssetLine.grn_document_number.in_(GRN_NUMBERS),
            )
        ).all()
    )


def cleanup(db: Session) -> None:
    _tenant, company, _branch, admin = resolve_scope(db)
    counts = {
        "incoming_events": 0,
        "incoming_units": 0,
        "incoming_lines": 0,
        "assets": 0,
        "grn_lines": 0,
        "grns": 0,
        "po_lines": 0,
        "po": 0,
        "products": 0,
        "category": 0,
    }

    incoming_lines = _incoming_demo_lines(db, company.id)
    asset_ids: list[UUID] = []
    for line in incoming_lines:
        for unit in line.units or []:
            if unit.registered_asset_id:
                asset_ids.append(unit.registered_asset_id)
        events = list(
            db.scalars(
                select(AstIncomingArrivalEvent).where(
                    AstIncomingArrivalEvent.incoming_line_id == line.id,
                    AstIncomingArrivalEvent.is_deleted.is_(False),
                )
            ).all()
        ) + list(
            db.scalars(
                select(AstIncomingQcEvent).where(
                    AstIncomingQcEvent.incoming_line_id == line.id,
                    AstIncomingQcEvent.is_deleted.is_(False),
                )
            ).all()
        )
        for event in events:
            _soft_delete(event, admin.id)
            counts["incoming_events"] += 1
        for unit in line.units or []:
            if not unit.is_deleted:
                _soft_delete(unit, admin.id)
                counts["incoming_units"] += 1
        _soft_delete(line, admin.id)
        counts["incoming_lines"] += 1

    if asset_ids:
        assets = list(
            db.scalars(
                select(AstAsset).where(
                    AstAsset.id.in_(asset_ids),
                    AstAsset.is_deleted.is_(False),
                )
            ).all()
        )
        for asset in assets:
            _retire_code(asset, "asset_code", max_len=50)
            _retire_code(asset, "document_number", max_len=50)
            _soft_delete(asset, admin.id)
            counts["assets"] += 1

    grns = list(
        db.scalars(
            select(ProcGrnHeader)
            .options(selectinload(ProcGrnHeader.lines))
            .where(
                ProcGrnHeader.company_id == company.id,
                ProcGrnHeader.is_deleted.is_(False),
                ProcGrnHeader.document_number.in_(GRN_NUMBERS),
            )
        ).all()
    )
    for grn in grns:
        for line in grn.lines or []:
            if not line.is_deleted:
                _soft_delete(line, admin.id)
                counts["grn_lines"] += 1
        _retire_code(grn, "document_number", max_len=50)
        _soft_delete(grn, admin.id)
        counts["grns"] += 1

    po = db.scalar(
        _active(select(ProcOrderHeader), ProcOrderHeader)
        .options(selectinload(ProcOrderHeader.lines))
        .where(
            ProcOrderHeader.company_id == company.id,
            ProcOrderHeader.document_number == PO_NUMBER,
        )
    )
    if po is not None:
        for line in po.lines or []:
            if not line.is_deleted:
                _soft_delete(line, admin.id)
                counts["po_lines"] += 1
        _retire_code(po, "document_number", max_len=50)
        _soft_delete(po, admin.id)
        counts["po"] += 1

    products = list(
        db.scalars(
            _active(select(MasterProduct), MasterProduct).where(
                MasterProduct.company_id == company.id,
                MasterProduct.product_code.in_(PRODUCT_CODES),
            )
        ).all()
    )
    for product in products:
        _retire_code(product, "product_code", max_len=50)
        _soft_delete(product, admin.id)
        counts["products"] += 1

    category = _get(db, MasterProductCategory, company_id=company.id, category_code=CATEGORY_CODE)
    if category is not None:
        _retire_code(category, "category_code", max_len=50)
        _soft_delete(category, admin.id)
        counts["category"] += 1

    db.commit()
    print("Removed Incoming Assets walkthrough demo data:")
    for key, value in counts.items():
        print(f"  {key}: {value}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Soft-delete the demo PO/GRNs/products and any synced incoming lines",
    )
    args = parser.parse_args()
    db = SessionLocal()
    try:
        if args.cleanup:
            cleanup(db)
        else:
            seed(db)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
