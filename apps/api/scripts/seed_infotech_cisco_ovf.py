"""Seed Infotech customer + Cisco OEM lead through approved OVF (not shared to SCM).

Usage (from apps/api, or inside API container):
  python -m scripts.seed_infotech_cisco_ovf
"""

from __future__ import annotations

import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.crm.models import CrmCompany  # noqa: E402
from modules.crm.models.lead import CrmLead  # noqa: E402
from modules.crm.models.lead_source import CrmLeadSource  # noqa: E402
from modules.crm.models.opportunity import CrmOpportunity  # noqa: E402
from modules.crm.models.ovf import CrmOvf  # noqa: E402
from modules.crm.models.pipeline import CrmPipeline  # noqa: E402
from modules.crm.models.quote import CrmQuote  # noqa: E402
from modules.crm.service.approval_task_service import ApprovalTaskService  # noqa: E402
from modules.crm.service.blueprint_service import OpportunityBlueprintService  # noqa: E402
from modules.crm.service.company_service import CompanyService  # noqa: E402
from modules.crm.service.lead_service import LeadService  # noqa: E402
from modules.crm.service.ovf_service import OvfService  # noqa: E402
from modules.crm.service.quote_service import QuoteService  # noqa: E402
from modules.foundation.domain.value_objects import TenantContext  # noqa: E402
from modules.foundation.models.security import SecTenant, SecUser  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402

CUSTOMER_NAME = "Infotech"
OEM_NAME = "Cisco"
DEMO_MARKER = "INFOTECH_CISCO — OVF ready, do not share to SCM (user will)"


def get_bootstrap(db) -> tuple[SecTenant, OrgCompany, OrgBranch]:
    tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
    if tenant is None:
        raise RuntimeError("BOOTSTRAP tenant missing.")
    company = db.scalar(
        select(OrgCompany).where(OrgCompany.tenant_id == tenant.id, OrgCompany.company_code == "DEMOCO")
    )
    branch = db.scalar(
        select(OrgBranch).where(OrgBranch.company_id == company.id, OrgBranch.branch_code == "HQ")
    )
    if company is None or branch is None:
        raise RuntimeError("DEMOCO / HQ missing.")
    return tenant, company, branch


def get_user(db, tenant_id, email: str) -> SecUser:
    user = db.scalar(
        select(SecUser).where(
            SecUser.tenant_id == tenant_id,
            SecUser.email == email,
            SecUser.is_deleted.is_(False),
        )
    )
    if user is None:
        raise RuntimeError(f"User {email} missing.")
    return user


def make_ctx(user: SecUser, tenant_id, company_id, branch_id) -> TenantContext:
    return TenantContext(
        tenant_id=tenant_id,
        user_id=user.id,
        user_type=user.user_type,
        company_id=company_id,
        branch_id=branch_id,
    )


def first_lead_source(db, tenant_id, company_id) -> CrmLeadSource:
    row = db.scalar(
        select(CrmLeadSource).where(
            CrmLeadSource.tenant_id == tenant_id,
            CrmLeadSource.company_id == company_id,
            CrmLeadSource.is_deleted.is_(False),
        )
    )
    if row is None:
        raise RuntimeError("No crm_lead_source.")
    return row


def first_pipeline(db, tenant_id, company_id) -> CrmPipeline:
    row = db.scalar(
        select(CrmPipeline).where(
            CrmPipeline.tenant_id == tenant_id,
            CrmPipeline.company_id == company_id,
            CrmPipeline.is_deleted.is_(False),
        )
    )
    if row is None:
        raise RuntimeError("No crm_pipeline.")
    return row


def first_employee(db, company_id) -> MasterEmployee:
    row = db.scalar(
        select(MasterEmployee).where(
            MasterEmployee.company_id == company_id,
            MasterEmployee.is_deleted.is_(False),
        )
    )
    if row is None:
        raise RuntimeError("No master_employee for DEMOCO.")
    return row


def approve_pending(
    db,
    ctx: TenantContext,
    *,
    team_role: str,
    entity_type: str | None = None,
) -> None:
    svc = ApprovalTaskService(db)
    tasks = svc.list(
        ctx,
        team_role=team_role,
        status="pending",
        entity_type=entity_type,
    )
    if not tasks:
        tasks = svc.list(ctx, team_role=team_role, status="pending")
    if not tasks:
        raise RuntimeError(f"No pending My Jobs task for team_role={team_role} entity_type={entity_type}")
    svc.decide(ctx, tasks[0].id, decision="approved", remark="Infotech/Cisco seed auto-approval")


def attach_payload(file_name: str) -> dict:
    return {
        "file_name": file_name,
        "file_path": f"/uploads/demo-infotech-cisco/{file_name}",
        "content_type": "application/pdf",
    }


def find_ready_ovf(db, org_company_id) -> tuple[CrmCompany, CrmOvf] | None:
    accounts = list(
        db.scalars(
            select(CrmCompany).where(
                CrmCompany.company_id == org_company_id,
                CrmCompany.customer_name == CUSTOMER_NAME,
                CrmCompany.is_deleted.is_(False),
            )
        )
    )
    for account in accounts:
        opps = list(
            db.scalars(
                select(CrmOpportunity).where(
                    CrmOpportunity.company_account_id == account.id,
                    CrmOpportunity.is_deleted.is_(False),
                )
            )
        )
        for opp in opps:
            ovf = db.scalar(
                select(CrmOvf).where(
                    CrmOvf.opportunity_id == opp.id,
                    CrmOvf.is_deleted.is_(False),
                )
            )
            if (
                ovf is not None
                and ovf.approval_status == "approved"
                and ovf.blueprint_state == "approved"
                and not ovf.shared_to_scm
            ):
                return account, ovf
    return None


def main() -> None:
    db = SessionLocal()
    try:
        tenant, org_company, branch = get_bootstrap(db)
        sales_user = get_user(db, tenant.id, "sales.user@example.com")
        presales_user = get_user(db, tenant.id, "presales.user@example.com")
        mgmt_user = get_user(db, tenant.id, "management.user@example.com")

        sales_ctx = make_ctx(sales_user, tenant.id, org_company.id, branch.id)
        presales_ctx = make_ctx(presales_user, tenant.id, org_company.id, branch.id)
        mgmt_ctx = make_ctx(mgmt_user, tenant.id, org_company.id, branch.id)

        ready = find_ready_ovf(db, org_company.id)
        if ready is not None:
            account, ovf = ready
            print("=" * 72)
            print("Infotech / Cisco OVF already ready (not shared to SCM)")
            print("=" * 72)
            print(f"Company account : {account.account_number}  {account.customer_name}")
            print(f"OVF             : {ovf.ovf_no}  id={ovf.id}")
            print(f"shared_to_scm   : {ovf.shared_to_scm}")
            print(f"Open OVF: /crm/ovf/{ovf.id}")
            print("=" * 72)
            return

        lead_source = first_lead_source(db, tenant.id, org_company.id)
        pipeline = first_pipeline(db, tenant.id, org_company.id)
        owner_employee = first_employee(db, org_company.id)
        today = date.today()

        company_svc = CompanyService(db)
        account = company_svc.create(
            sales_ctx,
            branch_id=branch.id,
            customer_name=CUSTOMER_NAME,
            account_type="prospect",
            industry="IT Services",
            other_industries="Networking, enterprise infrastructure",
            portal_id="INFOTECH-PORTAL-001",
            source="oem_referral",
            rating="hot",
            first_name="Ravi",
            last_name="Menon",
            customer_email="ravi.menon@infotech.example",
            phone="+91-98765-44001",
            website="https://www.infotech.example",
            account_owner_id=sales_user.id,
            role="IT Infrastructure Head",
            billing_street="12th Floor, Tech Park Tower A",
            billing_city="Hyderabad",
            billing_state="Telangana",
            billing_code="500081",
            billing_country="India",
            shipping_street="12th Floor, Tech Park Tower A",
            shipping_city="Hyderabad",
            shipping_state="Telangana",
            shipping_code="500081",
            shipping_country="India",
            description=DEMO_MARKER,
        )
        db.flush()

        lead = company_svc.create_lead(
            sales_ctx,
            account.id,
            branch_id=branch.id,
            salutation="Mr",
            first_name="Ravi",
            last_name="Menon",
            mobile="+91-98765-44001",
            email="ravi.menon@infotech.example",
            lead_source_id=lead_source.id,
            owner_employee_id=owner_employee.id,
            assign_to_id=sales_user.id,
            assigned_date=today,
            expected_amount=Decimal("1850000"),
            expected_closure_date=today + timedelta(days=60),
            product_type="hardware",
            sub_product_category="Networking",
            sub_product="Campus switching & wireless",
            sub_product_other="Catalyst + Meraki bundle",
            engagement_score=92,
            portal_link="https://portal.infotech.example/deals/cisco-campus-2026",
            project_title="Infotech Cisco campus refresh FY26",
            requirement_type="New deployment",
            purchase_model="Outright purchase",
            dr_number="DR-INFO-CISCO-2026-01",
            new_dr_number="DR-INFO-CISCO-2026-01-R1",
            deal_type="New business",
            industry="IT Services",
            territory="South India",
            region="Telangana",
            street="12th Floor, Tech Park Tower A",
            city="Hyderabad",
            state="Telangana",
            zip="500081",
            country="India",
            oem_name=OEM_NAME,
            oem_contact_person="Priya Sharma",
            oem_contact_number="+91-98450-22110",
            oem_contact_email="priya.sharma@cisco.example",
            distributor_name="Ingram Micro India",
            distributor_contact="+91-40-4000-8800",
            distributor_contact_person="Suresh Iyer",
            distributor_contact_email="suresh.iyer@ingram.example",
            distributor_department="Cisco enterprise",
            end_customer_name=CUSTOMER_NAME,
            end_customer_location="Hyderabad HQ",
            entity_name=CUSTOMER_NAME,
            entity_email="finance@infotech.example",
            entity_address="12th Floor, Tech Park Tower A, Hyderabad 500081, India",
            entity_gst="36AABCI1234F1Z8",
            entity_contact="+91-98765-44001",
            notes="Infotech / Cisco deal — OVF approved; user will Share to SCM manually.",
        )
        db.flush()

        opportunity = LeadService(db).convert(
            sales_ctx,
            lead.id,
            pipeline_id=pipeline.id,
            opportunity_name="Infotech — Cisco campus networking refresh",
            expected_revenue=1850000,
            remark="Qualified after Cisco solution workshop",
        )
        db.flush()

        opp_bp = OpportunityBlueprintService(db)
        opp_bp.perform_action(
            sales_ctx,
            opportunity.id,
            "attach_boq",
            attach_payload("infotech-cisco-boq-v1.pdf"),
        )
        opp_bp.perform_action(
            sales_ctx,
            opportunity.id,
            "send_boq_approval",
            {"team_role": "presales", "remarks": "Please review Infotech Cisco BOQ"},
        )
        db.commit()
        approve_pending(db, presales_ctx, team_role="presales", entity_type="opportunity")
        db.commit()

        opp_bp.perform_action(
            sales_ctx,
            opportunity.id,
            "deal_reg",
            {"deal_reg_number": "DR-INFO-CISCO-2026-01"},
        )
        opp_bp.perform_action(sales_ctx, opportunity.id, "oem_received", {})
        opp_bp.perform_action(
            sales_ctx,
            opportunity.id,
            "attach_oem_quote",
            attach_payload("infotech-cisco-oem-quote.pdf"),
        )
        db.flush()

        quote_svc = QuoteService(db)
        quote = quote_svc.create(
            sales_ctx,
            opportunity_id=opportunity.id,
            branch_id=branch.id,
            subject="Infotech Cisco campus refresh — customer quote",
            freight=Decimal("12000"),
        )
        quote_svc.add_line(
            sales_ctx,
            quote.id,
            product_name="Cisco Catalyst Switch Bundle",
            line_type="hardware",
            qty=Decimal("6"),
            unit_cost=Decimal("185000"),
            unit_sell=Decimal("225000"),
            gst_pct=Decimal("18"),
        )
        quote_svc.add_line(
            sales_ctx,
            quote.id,
            product_name="Cisco Wireless AP Pack",
            line_type="hardware",
            qty=Decimal("20"),
            unit_cost=Decimal("18000"),
            unit_sell=Decimal("24000"),
            gst_pct=Decimal("18"),
        )
        quote_svc.add_line(
            sales_ctx,
            quote.id,
            product_name="Implementation & Configuration Services",
            line_type="services",
            qty=Decimal("1"),
            unit_cost=Decimal("90000"),
            unit_sell=Decimal("125000"),
            gst_pct=Decimal("18"),
        )
        quote_svc.send_for_approval(
            sales_ctx,
            quote.id,
            team_role="management",
            remarks="Infotech/Cisco quote margin review",
        )
        db.commit()
        approve_pending(db, mgmt_ctx, team_role="management", entity_type="quote")
        db.commit()
        quote_svc.apply_blueprint_action(sales_ctx, quote.id, "send_to_customer", {})
        quote_svc.apply_blueprint_action(
            sales_ctx,
            quote.id,
            "accept",
            {"remark": "Customer PO expected — Infotech"},
        )
        db.flush()

        opp_bp.perform_action(
            sales_ctx,
            opportunity.id,
            "attach_po",
            attach_payload("infotech-customer-po.pdf"),
        )
        opp_bp.perform_action(
            sales_ctx,
            opportunity.id,
            "send_po_approval",
            {"team_role": "management", "remarks": "Approve Infotech customer PO"},
        )
        db.commit()
        approve_pending(db, mgmt_ctx, team_role="management", entity_type="opportunity")
        db.commit()

        ovf_svc = OvfService(db)
        ovf = ovf_svc.create(
            sales_ctx,
            quote_id=quote.id,
            branch_id=branch.id,
            po_number="PO-INFOTECH-CISCO-2026-01",
            delivery_period="8 weeks from PO",
            vendor_payment_days=30,
            customer_payment_days=45,
        )
        ovf_svc.send_for_approval(
            sales_ctx,
            ovf.id,
            team_role="management",
            remarks="Approve OVF — user will Share to SCM manually",
        )
        db.commit()
        approve_pending(db, mgmt_ctx, team_role="management", entity_type="ovf")
        db.commit()

        ovf = ovf_svc.get(sales_ctx, ovf.id)
        opp = opp_bp.get(sales_ctx, opportunity.id)

        print("=" * 72)
        print("Infotech / Cisco — OVF ready (NOT shared to SCM)")
        print("=" * 72)
        print(f"Customer        : {account.customer_name}  ({account.account_number})")
        print(f"  id            : {account.id}")
        print(f"OEM / Vendor    : {OEM_NAME}")
        print(f"Lead            : {lead.lead_code}  id={lead.id}")
        print(f"Opportunity     : {opp.opportunity_name}  state={opp.blueprint_state}")
        print(f"  id            : {opp.id}")
        print(f"Quote           : {quote.quote_no}")
        print(f"  id            : {quote.id}")
        print(f"OVF             : {ovf.ovf_no}  blueprint={ovf.blueprint_state}")
        print(f"  approval      : {ovf.approval_status}  locked={ovf.locked}")
        print(f"  shared_to_scm : {ovf.shared_to_scm}  (False — you send to SCM)")
        print("-" * 72)
        print("Sign in as sales.user@example.com / Secure1!")
        print(f"Open OVF: http://localhost:3000/crm/ovf/{ovf.id}")
        print("=" * 72)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
