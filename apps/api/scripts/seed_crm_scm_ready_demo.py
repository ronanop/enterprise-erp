"""Seed a fresh Sales CRM company + lead through OVF approval (ready for Share SCM).

Creates:
  - New sales account (company) with full address / contact fields
  - Sales-process lead with all extended lead fields populated
  - Opportunity → BOQ → Presales approval → OEM quote → Quote → PO → OVF
  - Management approvals on BOQ, quote (if needed), PO, and OVF
  - Stops before ``share_to_scm`` so you can click Share to SCM in the UI

Prerequisites (from apps/api):
  python -m scripts.seed_demo_data
  python -m scripts.seed_sales_crm_demo

Usage:
  python -m scripts.seed_crm_scm_ready_demo
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
from modules.crm.models.quote import CrmQuote  # noqa: E402
from modules.crm.models.pipeline import CrmPipeline  # noqa: E402
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

DEMO_COMPANY_NAME = "NovaGrid Systems Pvt Ltd"
DEMO_MARKER = "SCM_SHARE_DEMO — stop before Share SCM"


def get_bootstrap(db) -> tuple[SecTenant, OrgCompany, OrgBranch]:
    tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
    if tenant is None:
        raise RuntimeError("BOOTSTRAP tenant missing — run seed_demo_data first.")
    company = db.scalar(
        select(OrgCompany).where(OrgCompany.tenant_id == tenant.id, OrgCompany.company_code == "DEMOCO")
    )
    branch = db.scalar(
        select(OrgBranch).where(OrgBranch.company_id == company.id, OrgBranch.branch_code == "HQ")
    )
    if company is None or branch is None:
        raise RuntimeError("DEMOCO / HQ missing — run seed_demo_data first.")
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
        raise RuntimeError(f"User {email} missing — run seed_sales_crm_demo first.")
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
        raise RuntimeError("No crm_lead_source — run seed_demo_modules / seed_demo_data.")
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
        raise RuntimeError("No crm_pipeline — run seed_demo_modules.")
    return row


def cleanup_or_finish_existing(db, org_company_id) -> bool:
    """If demo company exists: print summary and return True when SCM-ready; else soft-delete partial rows."""
    existing = db.scalar(
        select(CrmCompany).where(
            CrmCompany.company_id == org_company_id,
            CrmCompany.customer_name == DEMO_COMPANY_NAME,
            CrmCompany.is_deleted.is_(False),
        )
    )
    if existing is None:
        return False

    opps = list(
        db.scalars(
            select(CrmOpportunity).where(
                CrmOpportunity.company_account_id == existing.id,
                CrmOpportunity.is_deleted.is_(False),
            )
        )
    )
    ovf_row = None
    for opp in opps:
        row = db.scalar(
            select(CrmOvf).where(
                CrmOvf.opportunity_id == opp.id,
                CrmOvf.is_deleted.is_(False),
            )
        )
        if row is not None:
            ovf_row = row
            break

    if ovf_row is not None:
        if (
            ovf_row.approval_status == "approved"
            and ovf_row.blueprint_state == "approved"
            and not ovf_row.shared_to_scm
        ):
            print("=" * 72)
            print("CRM demo already ready for Share SCM (re-run skipped)")
            print("=" * 72)
            print(f"Company account : {existing.account_number}  {existing.customer_name}")
            print(f"OVF             : {ovf_row.ovf_no}  blueprint={ovf_row.blueprint_state}")
            print(f"  id            : {ovf_row.id}")
            print(f"  shared_to_scm : {ovf_row.shared_to_scm}")
            print(f"Open OVF: /crm/ovf/{ovf_row.id}")
            print("=" * 72)
            return True
        raise SystemExit(
            f"Demo company exists with OVF {ovf_row.ovf_no} in unexpected state "
            f"(blueprint={ovf_row.blueprint_state}, shared_to_scm={ovf_row.shared_to_scm}). "
            "Resolve manually before re-seeding."
        )

    leads = list(
        db.scalars(
            select(CrmLead).where(
                CrmLead.company_account_id == existing.id,
                CrmLead.is_deleted.is_(False),
            )
        )
    )
    for lead in leads:
        lead.is_deleted = True
    for opp in opps:
        quotes = list(
            db.scalars(
                select(CrmQuote).where(
                    CrmQuote.opportunity_id == opp.id,
                    CrmQuote.is_deleted.is_(False),
                )
            )
        )
        for quote in quotes:
            quote.is_deleted = True
        opp.is_deleted = True
    existing.is_deleted = True
    db.commit()
    print(f"Removed incomplete demo seed for '{DEMO_COMPANY_NAME}' — re-creating.")
    return False


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
    svc.decide(ctx, tasks[0].id, decision="approved", remark="Demo seed auto-approval")


def attach_payload(file_name: str) -> dict:
    return {
        "file_name": file_name,
        "file_path": f"/uploads/demo-scm-ready/{file_name}",
        "content_type": "application/pdf",
    }


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

        if cleanup_or_finish_existing(db, org_company.id):
            return

        lead_source = first_lead_source(db, tenant.id, org_company.id)
        pipeline = first_pipeline(db, tenant.id, org_company.id)
        owner_employee = first_employee(db, org_company.id)
        today = date.today()

        company_svc = CompanyService(db)
        account = company_svc.create(
            sales_ctx,
            branch_id=branch.id,
            customer_name=DEMO_COMPANY_NAME,
            account_type="prospect",
            industry="Energy & Utilities",
            other_industries="Smart grid, data centre power",
            portal_id="NOVAGRID-PORTAL-001",
            source="partner_referral",
            rating="hot",
            first_name="Meera",
            last_name="Kapoor",
            customer_email="meera.kapoor@novagrid.example",
            phone="+91-99888-77661",
            website="https://www.novagrid.example",
            account_owner_id=sales_user.id,
            role="Head of Infrastructure",
            billing_street="Plot 18, Electronic City Phase 2",
            billing_city="Bengaluru",
            billing_state="Karnataka",
            billing_code="560100",
            billing_country="India",
            shipping_street="Plot 18, Electronic City Phase 2",
            shipping_city="Bengaluru",
            shipping_state="Karnataka",
            shipping_code="560100",
            shipping_country="India",
            description=DEMO_MARKER,
        )
        db.flush()

        lead = company_svc.create_lead(
            sales_ctx,
            account.id,
            branch_id=branch.id,
            salutation="Ms",
            first_name="Meera",
            last_name="Kapoor",
            mobile="+91-99888-77661",
            email="meera.kapoor@novagrid.example",
            lead_source_id=lead_source.id,
            owner_employee_id=owner_employee.id,
            assign_to_id=sales_user.id,
            assigned_date=today,
            expected_amount=Decimal("1250000"),
            expected_closure_date=today + timedelta(days=75),
            product_type="hardware",
            sub_product_category="Data centre infrastructure",
            sub_product="Rack & power refresh",
            sub_product_other="PDU + cabling bundle",
            engagement_score=88,
            portal_link="https://portal.novagrid.example/deals/infra-2026",
            project_title="NovaGrid DC rack refresh FY26",
            requirement_type="New deployment",
            purchase_model="Outright purchase",
            dr_number="DR-NG-2026-0142",
            new_dr_number="DR-NG-2026-0142-R1",
            deal_type="New business",
            industry="Energy & Utilities",
            territory="South India",
            region="Karnataka",
            street="Plot 18, Electronic City Phase 2",
            city="Bengaluru",
            state="Karnataka",
            zip="560100",
            country="India",
            oem_name="Dell Technologies",
            oem_contact_person="Vikram Nair",
            oem_contact_number="+91-98765-11122",
            oem_contact_email="vikram.nair@dell.example",
            distributor_name="TechDistri India",
            distributor_contact="+91-80-4000-9000",
            distributor_contact_person="Anita Rao",
            distributor_contact_email="anita.rao@techdistri.example",
            distributor_department="Enterprise sales",
            end_customer_name="NovaGrid Systems Pvt Ltd",
            end_customer_location="Bengaluru DC-1",
            entity_name="NovaGrid Systems Pvt Ltd",
            entity_email="finance@novagrid.example",
            entity_address="Plot 18, Electronic City Phase 2, Bengaluru 560100, India",
            entity_gst="29AABCN1234F1Z5",
            entity_contact="+91-99888-77661",
            notes="Demo seed for SCM handoff — OVF approved, not yet shared to SCM.",
        )
        db.flush()

        opportunity = LeadService(db).convert(
            sales_ctx,
            lead.id,
            pipeline_id=pipeline.id,
            opportunity_name="NovaGrid — DC rack & power refresh",
            expected_revenue=1250000,
            remark="Qualified after technical workshop",
        )
        db.flush()

        opp_bp = OpportunityBlueprintService(db)
        opp_bp.perform_action(
            sales_ctx,
            opportunity.id,
            "attach_boq",
            attach_payload("novagrid-boq-v1.pdf"),
        )
        opp_bp.perform_action(
            sales_ctx,
            opportunity.id,
            "send_boq_approval",
            {"team_role": "presales", "remarks": "Please review BOQ for NovaGrid DC refresh"},
        )
        db.commit()
        approve_pending(db, presales_ctx, team_role="presales", entity_type="opportunity")
        db.commit()

        opp_bp.perform_action(
            sales_ctx,
            opportunity.id,
            "deal_reg",
            {"deal_reg_number": "DR-NG-2026-0142"},
        )
        opp_bp.perform_action(sales_ctx, opportunity.id, "oem_received", {})
        opp_bp.perform_action(
            sales_ctx,
            opportunity.id,
            "attach_oem_quote",
            attach_payload("novagrid-oem-quote.pdf"),
        )
        db.flush()

        quote_svc = QuoteService(db)
        quote = quote_svc.create(
            sales_ctx,
            opportunity_id=opportunity.id,
            branch_id=branch.id,
            subject="NovaGrid DC rack refresh — customer quote",
            freight=Decimal("8500"),
        )
        quote_svc.add_line(
            sales_ctx,
            quote.id,
            product_name="Enterprise Server Rack Unit",
            line_type="hardware",
            qty=Decimal("4"),
            unit_cost=Decimal("150000"),
            unit_sell=Decimal("185000"),
            gst_pct=Decimal("18"),
        )
        quote_svc.add_line(
            sales_ctx,
            quote.id,
            product_name="Implementation & Onboarding Services",
            line_type="services",
            qty=Decimal("1"),
            unit_cost=Decimal("70000"),
            unit_sell=Decimal("95000"),
            gst_pct=Decimal("18"),
        )
        quote_svc.send_for_approval(
            sales_ctx,
            quote.id,
            team_role="management",
            remarks="Demo seed quote margin review",
        )
        db.commit()
        approve_pending(db, mgmt_ctx, team_role="management", entity_type="quote")
        db.commit()
        quote_svc.apply_blueprint_action(sales_ctx, quote.id, "send_to_customer", {})
        quote_svc.apply_blueprint_action(
            sales_ctx,
            quote.id,
            "accept",
            {"remark": "Customer PO expected within 48 hours"},
        )
        db.flush()

        opp_bp.perform_action(
            sales_ctx,
            opportunity.id,
            "attach_po",
            attach_payload("novagrid-customer-po.pdf"),
        )
        opp_bp.perform_action(
            sales_ctx,
            opportunity.id,
            "send_po_approval",
            {"team_role": "management", "remarks": "Approve customer PO for NovaGrid"},
        )
        db.commit()
        approve_pending(db, mgmt_ctx, team_role="management", entity_type="opportunity")
        db.commit()

        ovf_svc = OvfService(db)
        ovf = ovf_svc.create(
            sales_ctx,
            quote_id=quote.id,
            branch_id=branch.id,
            po_number="PO-NOVAGRID-2026-0088",
            delivery_period="6 weeks from PO",
            vendor_payment_days=30,
            customer_payment_days=45,
        )
        ovf_svc.send_for_approval(
            sales_ctx,
            ovf.id,
            team_role="management",
            remarks="Approve OVF before SCM share (demo)",
        )
        db.commit()
        approve_pending(db, mgmt_ctx, team_role="management", entity_type="ovf")
        db.commit()

        ovf = ovf_svc.get(sales_ctx, ovf.id)
        opp = opp_bp.get(sales_ctx, opportunity.id)

        print("=" * 72)
        print("CRM demo ready for Share SCM")
        print("=" * 72)
        print(f"Company account : {account.account_number}  {account.customer_name}")
        print(f"  id            : {account.id}")
        print(f"Lead            : {lead.lead_code}  (id={lead.id})")
        print(f"Opportunity     : {opp.opportunity_name}  state={opp.blueprint_state}")
        print(f"  id            : {opp.id}")
        print(f"Quote           : {quote.quote_no}  stage accepted")
        print(f"  id            : {quote.id}")
        print(f"OVF             : {ovf.ovf_no}  blueprint={ovf.blueprint_state}")
        print(f"  approval      : {ovf.approval_status}  locked={ovf.locked}")
        print(f"  shared_to_scm : {ovf.shared_to_scm}  (should be False)")
        print("-" * 72)
        print("Sign in as sales.user@example.com / Secure1!")
        print(f"Open OVF: /crm/ovf/{ovf.id}")
        print("Click blueprint action: Share to SCM")
        print("=" * 72)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
