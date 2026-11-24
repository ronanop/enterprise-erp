"""Create CRM OVFs shared to procurement SCM with a distributor on every vendor line.

Uses the same sales-chain builder as seed_many_scm_ovfs, then sets
crm_ovf_line.distributor_name from CRM distributor dropdown options
(per line item) before share_to_scm. Customer email is moksh@cachedigitech.com.
"""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import func, select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.crm.models import CrmLeadSource, CrmPipeline  # noqa: E402
from modules.crm.models.company import CrmCompany  # noqa: E402
from modules.crm.models.contact import CrmContact  # noqa: E402
from modules.crm.models.ovf import CrmOvf  # noqa: E402
from modules.crm.service.ovf_service import OvfService  # noqa: E402
from modules.foundation.models.security import SecUser  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
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

CUSTOMER_EMAIL = "moksh@cachedigitech.com"

# Match apps/web lead-distributor dropdown (normalized names).
DISTRIBUTOR_OPTIONS = (
    "Ingram Micro",
    "Redington",
    "Tech Data",
    "TD SYNNEX",
    "Savex Technologies",
    "Rashi Peripherals (RP Tech)",
)

OVF_COUNT = 2


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
        products = ensure_products(db, sales_ctx, org.id)
        ovfs = OvfService(db)

        start_index = _next_scm_index(db)
        created: list[tuple[str, str, list[str]]] = []

        # Force customer / contact emails used by create_shared_ovf.
        original_create = scm_seed.create_shared_ovf

        def create_with_customer_email(**kwargs):
            index = kwargs["index"]
            deal = kwargs["deal"]
            # Patch email inside create_shared_ovf by wrapping CompanyService.create
            from modules.crm.service import company_service as company_mod
            from modules.crm.service import contact_service as contact_mod

            orig_company_create = company_mod.CompanyService.create
            orig_contact_create = contact_mod.ContactService.create
            orig_create_lead = company_mod.CompanyService.create_lead

            def company_create(self, ctx, **fields):
                fields["customer_email"] = CUSTOMER_EMAIL
                return orig_company_create(self, ctx, **fields)

            def contact_create(self, ctx, **fields):
                fields["email"] = CUSTOMER_EMAIL
                return orig_contact_create(self, ctx, **fields)

            def create_lead(self, ctx, company_id, **fields):
                fields["email"] = CUSTOMER_EMAIL
                fields["entity_email"] = CUSTOMER_EMAIL
                return orig_create_lead(self, ctx, company_id, **fields)

            company_mod.CompanyService.create = company_create  # type: ignore[method-assign]
            contact_mod.ContactService.create = contact_create  # type: ignore[method-assign]
            company_mod.CompanyService.create_lead = create_lead  # type: ignore[method-assign]
            try:
                return original_create(**kwargs)
            finally:
                company_mod.CompanyService.create = orig_company_create  # type: ignore[method-assign]
                contact_mod.ContactService.create = orig_contact_create  # type: ignore[method-assign]
                company_mod.CompanyService.create_lead = orig_create_lead  # type: ignore[method-assign]

        scm_seed.create_shared_ovf = create_with_customer_email  # type: ignore[assignment]

        try:
            for offset in range(OVF_COUNT):
                index = start_index + offset
                deal = dict(DEMO_DEALS[offset % len(DEMO_DEALS)])
                # Lead-level distributor (first option); lines get per-item names below.
                deal["distributor"] = DISTRIBUTOR_OPTIONS[offset % len(DISTRIBUTOR_OPTIONS)]
                print(
                    f"[{offset + 1}/{OVF_COUNT}] {deal['account']} "
                    f"lead_distributor={deal['distributor']} email={CUSTOMER_EMAIL} ...",
                    flush=True,
                )

                original_share = OvfService.share_to_scm
                assigned: list[str] = []

                def share_with_distributors(self, ctx, ovf_id, _orig=original_share, _assigned=assigned):
                    vendor_lines = [
                        line
                        for line in self._lines.list_for_ovf(ctx, ovf_id)
                        if line.side == "vendor"
                    ]
                    for i, line in enumerate(vendor_lines):
                        dist = DISTRIBUTOR_OPTIONS[i % len(DISTRIBUTOR_OPTIONS)]
                        self._lines.update(ctx, line.id, distributor_name=dist)
                        _assigned.append(dist)
                        print(f"    vendor line '{line.product_name}' -> {dist}")
                    return _orig(self, ctx, ovf_id)

                OvfService.share_to_scm = share_with_distributors  # type: ignore[method-assign]
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

                # Ensure CRM company / contact emails stick to moksh@.
                row = db.scalar(
                    select(CrmOvf).where(CrmOvf.ovf_no == ovf_no, CrmOvf.is_deleted.is_(False))
                )
                if row and row.company_account_id:
                    company = db.get(CrmCompany, row.company_account_id)
                    if company is not None:
                        company.customer_email = CUSTOMER_EMAIL
                    contact = db.scalar(
                        select(CrmContact).where(
                            CrmContact.company_account_id == row.company_account_id,
                            CrmContact.is_deleted.is_(False),
                        )
                    )
                    if contact is not None:
                        contact.email = CUSTOMER_EMAIL

                db.commit()
                created.append((ovf_no, state, list(assigned)))
                print(f"    -> {ovf_no} ({state})")
        finally:
            scm_seed.create_shared_ovf = original_create  # type: ignore[assignment]

        print()
        print("Created:")
        for ovf_no, state, dists in created:
            print(f"  {ovf_no}  {state}  distributors={dists}  email={CUSTOMER_EMAIL}")
            row = db.scalar(
                select(CrmOvf).where(CrmOvf.ovf_no == ovf_no, CrmOvf.is_deleted.is_(False))
            )
            if row:
                for line in ovfs._lines.list_for_ovf(sales_ctx, row.id):
                    if line.side == "vendor":
                        print(f"      [{line.side}] {line.product_name}: {line.distributor_name}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
