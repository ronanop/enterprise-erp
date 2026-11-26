"""Seed 4 CRM OVFs (Server + Laptop hardware) and share them to procurement SCM.

Distributors (one per OVF):
  OVF 1 -> Ingram Micro
  OVF 2 -> Redington
  OVF 3 -> Pacific Parts
  OVF 4 -> Ingram Micro

Each OVF gets Server + Laptop vendor lines and a filled freight amount.

Usage (from apps/api, or via docker):
  python -m scripts.seed_three_hardware_ovfs_to_scm
"""

from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.crm.models import CrmLeadSource, CrmPipeline  # noqa: E402
from modules.crm.models.ovf import CrmOvf  # noqa: E402
from modules.crm.models import CrmProduct  # noqa: E402
from modules.crm.service.ovf_service import OvfService  # noqa: E402
from modules.crm.service.product_service import ProductService  # noqa: E402
from modules.crm.service.quote_service import QuoteService  # noqa: E402
from modules.foundation.models.security import SecUser  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.master_data.models.party import MasterVendor  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from scripts import seed_many_scm_ovfs as scm_seed  # noqa: E402
from scripts.seed_many_scm_ovfs import (  # noqa: E402
    DEMO_DEALS,
    ctx_for,
    ensure_products,
    pick_user,
    require,
)

INGRAM = "Ingram Micro"
REDINGTON = "Redington"
PACIFIC = "Pacific Parts"

# Server / Laptop list prices (INR).
HARDWARE_CATALOG: list[tuple[str, Decimal]] = [
    ("Server", Decimal("285000.00")),
    ("Laptop", Decimal("78000.00")),
]

FREIGHT = Decimal("18500.00")
FREIGHT_MEDIUM = "road"
FREIGHT_WEIGHT_KG = Decimal("42.500")
FREIGHT_INSURANCE = True

# (deal index into DEMO_DEALS, distributor for every vendor line)
OVF_SPECS: list[tuple[int, str]] = [
    (0, INGRAM),  # Ericsson — Ingram
    (1, REDINGTON),  # TCS — Redington
    (3, PACIFIC),  # HDFC — Pacific Parts
    (12, INGRAM),  # Apollo Hospitals — Ingram
]


def _next_scm_index(db) -> int:
    rows = db.scalars(
        select(CrmOvf.account_name).where(
            CrmOvf.is_deleted.is_(False),
            CrmOvf.account_name.ilike("%[SCM-%"),
        )
    ).all()
    highest = 0
    for name in rows:
        text = str(name or "")
        start = text.rfind("[SCM-")
        if start < 0:
            continue
        chunk = text[start + 5 :]
        end = chunk.find("]")
        if end < 0:
            continue
        try:
            highest = max(highest, int(chunk[:end]))
        except ValueError:
            continue
    return highest + 1


def _ensure_hardware_products(db, ctx, org_id) -> list[CrmProduct]:
    svc = ProductService(db)
    rows: list[CrmProduct] = []
    for name, price in HARDWARE_CATALOG:
        existing = db.scalar(
            select(CrmProduct).where(
                CrmProduct.company_id == org_id,
                CrmProduct.product_name == name,
                CrmProduct.is_deleted.is_(False),
            )
        )
        if existing:
            rows.append(existing)
            continue
        rows.append(
            svc.create(
                ctx,
                company_id=org_id,
                product_name=name,
                product_type="hardware",
                unit_price=price,
                hsn_sac="8471",
            )
        )
        print(f"  created CRM product '{name}'")
    return rows


def _ensure_distributors(db, org_id, user_id) -> None:
    """Make sure Ingram / Redington / Pacific exist on master vendors."""
    aliases = {
        INGRAM: {INGRAM.lower(), "ingram micro india"},
        REDINGTON: {REDINGTON.lower(), "redington india"},
        PACIFIC: {PACIFIC.lower(), "pacific", "pacific parts"},
    }
    existing = list(
        db.scalars(
            select(MasterVendor).where(
                MasterVendor.company_id == org_id,
                MasterVendor.is_deleted.is_(False),
            )
        ).all()
    )
    org = db.get(OrgCompany, org_id)
    tenant_id = existing[0].tenant_id if existing else (org.tenant_id if org else None)
    for canonical, keys in aliases.items():
        row = next(
            (
                v
                for v in existing
                if (v.vendor_name or "").strip().lower() in keys
            ),
            None,
        )
        if row is not None:
            if (row.vendor_name or "").strip() != canonical and canonical in {
                INGRAM,
                REDINGTON,
            }:
                row.vendor_name = canonical
                row.updated_by = user_id
            if (row.status or "").lower() == "draft":
                row.status = "active"
                row.updated_by = user_id
            print(f"  vendor ready '{row.vendor_name}'")
            continue
        code_n = len(existing) + 1
        vendor = MasterVendor(
            vendor_code=f"VEND-{code_n:05d}",
            vendor_name=canonical,
            vendor_type="domestic",
            status="active",
            tenant_id=tenant_id,
            company_id=org_id,
            created_by=user_id,
            updated_by=user_id,
        )
        db.add(vendor)
        existing.append(vendor)
        print(f"  created vendor '{canonical}'")
    db.flush()


def main() -> None:
    db = SessionLocal()
    try:
        org = require(
            db.scalar(
                select(OrgCompany).where(
                    OrgCompany.company_code == "CDPL",
                    OrgCompany.is_deleted.is_(False),
                )
            ),
            "org company CDPL",
        )
        branch = require(
            db.scalar(
                select(OrgBranch).where(
                    OrgBranch.company_id == org.id,
                    OrgBranch.branch_code == "HQ",
                    OrgBranch.is_deleted.is_(False),
                )
            ),
            "HQ branch",
        )
        sales_user = db.scalar(
            select(SecUser).where(
                SecUser.email == "techbank@cachedigitech.com",
                SecUser.is_deleted.is_(False),
            )
        ) or pick_user(db, "sales.user@example.com")
        employee = require(
            db.scalar(
                select(MasterEmployee).where(
                    MasterEmployee.company_id == org.id,
                    MasterEmployee.user_id == sales_user.id,
                    MasterEmployee.is_deleted.is_(False),
                )
            )
            or db.scalar(
                select(MasterEmployee).where(
                    MasterEmployee.company_id == org.id,
                    MasterEmployee.is_deleted.is_(False),
                )
            ),
            "master employee",
        )
        lead_source = require(
            db.scalar(
                select(CrmLeadSource).where(
                    CrmLeadSource.company_id == org.id,
                    CrmLeadSource.is_deleted.is_(False),
                )
            ),
            "lead source",
        )
        pipeline = require(
            db.scalar(
                select(CrmPipeline).where(
                    CrmPipeline.company_id == org.id,
                    CrmPipeline.is_deleted.is_(False),
                )
            ),
            "pipeline",
        )
        sales_ctx = ctx_for(sales_user, org.id, branch.id)
        _ensure_distributors(db, org.id, sales_user.id)
        ensure_products(db, sales_ctx, org.id)
        hardware_products = _ensure_hardware_products(db, sales_ctx, org.id)
        # Prefer Server/Laptop first so any leftover pick uses them.
        products = hardware_products + [
            p
            for p in ensure_products(db, sales_ctx, org.id)
            if p.id not in {h.id for h in hardware_products}
        ]

        start_index = _next_scm_index(db)
        created: list[tuple[str, str, str]] = []

        original_add_line = QuoteService.add_line
        original_quote_create = QuoteService.create
        original_ovf_create = OvfService.create

        def quote_create_with_freight(self, ctx, **fields):
            fields["freight"] = FREIGHT
            quote = original_quote_create(self, ctx, **fields)
            # Some create paths reset freight — force the seed value.
            if float(getattr(quote, "freight", 0) or 0) != float(FREIGHT):
                updated = self._repo.update(ctx, quote.id, freight=FREIGHT)
                if updated is not None:
                    return updated
            return quote

        def ovf_create_with_freight(self, ctx, **fields):
            # OvfService.create forces freight=0 internally; set after create.
            ovf = original_ovf_create(self, ctx, **fields)
            updated = self._repo.update(
                ctx,
                ovf.id,
                freight=FREIGHT,
                freight_medium=FREIGHT_MEDIUM,
                freight_weight_kg=FREIGHT_WEIGHT_KG,
                freight_insurance=FREIGHT_INSURANCE,
            )
            return updated or ovf

        def add_line_server_laptop(self, ctx, quote_id, **fields):
            line_type = str(fields.get("line_type") or "").strip().lower()
            if line_type == "services":
                print("    skip services quote line")
                return None
            if line_type not in {"hardware", "product", ""}:
                return original_add_line(self, ctx, quote_id, **fields)

            # Replace the single hardware add from create_shared_ovf with Server + Laptop.
            if getattr(self, "_scm_hw_seed_done", None) == quote_id:
                print("    skip extra hardware quote line")
                return None
            self._scm_hw_seed_done = quote_id  # type: ignore[attr-defined]

            last = None
            for product in hardware_products:
                unit_cost = Decimal(str(product.unit_price or 0)).quantize(Decimal("0.01"))
                if unit_cost <= 0:
                    unit_cost = Decimal(str(fields.get("unit_cost") or "50000")).quantize(
                        Decimal("0.01")
                    )
                unit_sell = (unit_cost * Decimal("1.18")).quantize(Decimal("0.01"))
                qty = Decimal("2") if product.product_name == "Server" else Decimal("5")
                last = original_add_line(
                    self,
                    ctx,
                    quote_id,
                    product_id=product.id,
                    product_name=product.product_name,
                    hsn_sac=product.hsn_sac or "8471",
                    description=f"{product.product_name} hardware supply",
                    line_type="hardware",
                    qty=qty,
                    unit_cost=unit_cost,
                    unit_sell=unit_sell,
                    gst_pct=Decimal("18"),
                )
                print(f"    quote line -> {product.product_name} qty={qty}")
            return last

        QuoteService.create = quote_create_with_freight  # type: ignore[method-assign]
        QuoteService.add_line = add_line_server_laptop  # type: ignore[method-assign]
        OvfService.create = ovf_create_with_freight  # type: ignore[method-assign]
        try:
            for offset, (deal_idx, distributor) in enumerate(OVF_SPECS):
                index = start_index + offset
                deal = dict(DEMO_DEALS[deal_idx % len(DEMO_DEALS)])
                deal["distributor"] = distributor
                print(
                    f"[{offset + 1}/{len(OVF_SPECS)}] {deal['account']} "
                    f"distributor={distributor} freight={FREIGHT} "
                    f"(Server + Laptop) ...",
                    flush=True,
                )

                original_share = OvfService.share_to_scm

                def share_with_distributor(
                    self,
                    ctx,
                    ovf_id,
                    _orig=original_share,
                    _dist=distributor,
                ):
                    vendor_lines = [
                        line
                        for line in self._lines.list_for_ovf(ctx, ovf_id)
                        if line.side == "vendor"
                    ]
                    if not vendor_lines:
                        raise RuntimeError(
                            f"OVF {ovf_id} has no vendor lines after hardware-only quote"
                        )
                    for line in vendor_lines:
                        ptype = (getattr(line, "line_type", None) or "").lower()
                        if ptype and ptype not in {"hardware", "product", ""}:
                            print(
                                f"    skip non-hardware vendor line "
                                f"'{line.product_name}' ({ptype})"
                            )
                            continue
                        self._lines.update(ctx, line.id, distributor_name=_dist)
                        print(f"    vendor line '{line.product_name}' -> {_dist}")
                    # Ensure freight survived create/share prep.
                    ovf_row = self._repo.get(ctx, ovf_id)
                    if ovf_row is not None and float(ovf_row.freight or 0) <= 0:
                        self._repo.update(
                            ctx,
                            ovf_id,
                            freight=FREIGHT,
                            freight_medium=FREIGHT_MEDIUM,
                            freight_weight_kg=FREIGHT_WEIGHT_KG,
                            freight_insurance=FREIGHT_INSURANCE,
                        )
                        print(f"    freight set to {FREIGHT}")
                    return _orig(self, ctx, ovf_id)

                OvfService.share_to_scm = share_with_distributor  # type: ignore[method-assign]
                try:
                    ovf_no, state = scm_seed.create_shared_ovf(
                        db=db,
                        index=index,
                        deal=deal,
                        org=org,
                        branch=branch,
                        sales_ctx=sales_ctx,
                        sales_user=sales_user,
                        employee=employee,
                        lead_source=lead_source,
                        pipeline=pipeline,
                        products=products,
                    )
                finally:
                    OvfService.share_to_scm = original_share  # type: ignore[method-assign]

                db.commit()
                created.append((ovf_no, state, distributor))
                print(f"    -> {ovf_no} ({state}) shared to procurement")
        finally:
            QuoteService.add_line = original_add_line  # type: ignore[method-assign]
            QuoteService.create = original_quote_create  # type: ignore[method-assign]
            OvfService.create = original_ovf_create  # type: ignore[method-assign]

        print()
        print("Created and sent to procurement:")
        ovfs = OvfService(db)
        for ovf_no, state, dist in created:
            print(f"  {ovf_no}  {state}  distributor={dist}")
            row = db.scalar(
                select(CrmOvf).where(CrmOvf.ovf_no == ovf_no, CrmOvf.is_deleted.is_(False))
            )
            if not row:
                continue
            print(
                f"      freight={row.freight} medium={row.freight_medium} "
                f"weight_kg={row.freight_weight_kg} insurance={row.freight_insurance}"
            )
            for line in ovfs._lines.list_for_ovf(sales_ctx, row.id):
                if line.side == "vendor":
                    print(
                        f"      [vendor] {line.product_name} "
                        f"type={getattr(line, 'line_type', None)} "
                        f"dist={line.distributor_name}"
                    )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
