"""Seed one fully-populated Sales CRM demo chain.

Creates a single end-to-end record set with every business field filled:

  Company -> Contact -> Lead -> Opportunity -> Quote (+ lines + vendor quote)
  -> Customer PO -> OVF

Advances the sales blueprint through BOQ / deal-reg / OEM / quote accept /
PO approval so the OVF is creatable.

Usage (from apps/api):
  .venv\\Scripts\\python.exe -m scripts.seed_full_crm_demo_deal
"""

from __future__ import annotations

import base64
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import UUID

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.crm.models import (  # noqa: E402
    CrmCompany,
    CrmLeadSource,
    CrmPipeline,
    CrmProduct,
)
from modules.crm.service.approval_task_service import ApprovalTaskService  # noqa: E402
from modules.crm.service.attachment_service import AttachmentService  # noqa: E402
from modules.crm.service.blueprint_service import OpportunityBlueprintService  # noqa: E402
from modules.crm.service.company_service import CompanyService  # noqa: E402
from modules.crm.service.contact_service import ContactService  # noqa: E402
from modules.crm.service.lead_service import LeadService  # noqa: E402
from modules.crm.service.ovf_service import OvfService  # noqa: E402
from modules.crm.service.quote_service import QuoteService  # noqa: E402
from modules.foundation.domain.value_objects import TenantContext  # noqa: E402
from modules.foundation.models.security import SecTenant, SecUser  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402

DEMO_ACCOUNT_NAME = "Ericsson India Private Limited"
TINY_PDF = base64.b64encode(
    b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
).decode("ascii")


def ctx_for(user: SecUser, company_id: UUID, branch_id: UUID) -> TenantContext:
    return TenantContext(
        tenant_id=user.tenant_id,
        user_id=user.id,
        user_type=user.user_type or "internal",
        company_id=company_id,
        branch_id=branch_id,
    )


def require(row, label: str):
    if row is None:
        raise RuntimeError(f"{label} not found. Run seed_demo_data / seed_sales_crm_demo first.")
    return row


def tiny_file(name: str) -> dict:
    return {
        "file_name": name,
        "content_base64": TINY_PDF,
        "content_type": "application/pdf",
    }


def decide_pending(db, ctx: TenantContext, entity_id: UUID) -> None:
    tasks = ApprovalTaskService(db).list(ctx, entity_id=entity_id, status="pending")
    if not tasks:
        raise RuntimeError(f"No pending approval task for entity {entity_id}")
    ApprovalTaskService(db).decide(ctx, tasks[0].id, decision="approved", remark="Demo auto-approve")


def main() -> None:
    db = SessionLocal()
    try:
        tenant = require(
            db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP")),
            "BOOTSTRAP tenant",
        )
        org = require(
            db.scalar(
                select(OrgCompany).where(
                    OrgCompany.tenant_id == tenant.id,
                    OrgCompany.company_code == "DEMOCO",
                )
            ),
            "DEMOCO",
        )
        branch = require(
            db.scalar(
                select(OrgBranch).where(
                    OrgBranch.company_id == org.id,
                    OrgBranch.branch_code == "HQ",
                )
            ),
            "HQ branch",
        )
        sales_user = require(
            db.scalar(
                select(SecUser).where(
                    SecUser.email == "sales.user@example.com",
                    SecUser.is_deleted.is_(False),
                )
            ),
            "sales.user@example.com",
        )
        presales_user = require(
            db.scalar(
                select(SecUser).where(
                    SecUser.email == "presales.user@example.com",
                    SecUser.is_deleted.is_(False),
                )
            ),
            "presales.user@example.com",
        )
        management_user = require(
            db.scalar(
                select(SecUser).where(
                    SecUser.email == "management.user@example.com",
                    SecUser.is_deleted.is_(False),
                )
            ),
            "management.user@example.com",
        )
        employee = require(
            db.scalar(
                select(MasterEmployee).where(
                    MasterEmployee.company_id == org.id,
                    MasterEmployee.employee_code == "EMP-001",
                    MasterEmployee.is_deleted.is_(False),
                )
            ),
            "EMP-001",
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
        products = list(
            db.scalars(
                select(CrmProduct).where(
                    CrmProduct.company_id == org.id,
                    CrmProduct.is_deleted.is_(False),
                )
            ).all()
        )
        if not products:
            raise RuntimeError("No CRM products. Run seed_sales_crm_demo first.")

        existing = db.scalar(
            select(CrmCompany).where(
                CrmCompany.company_id == org.id,
                CrmCompany.customer_name == DEMO_ACCOUNT_NAME,
                CrmCompany.is_deleted.is_(False),
            )
        )
        if existing is not None:
            print(f"Demo company already exists: {existing.account_number} ({existing.id})")
            print("Delete it first if you want to re-seed this deal.")
            return

        sales_ctx = ctx_for(sales_user, org.id, branch.id)
        presales_ctx = ctx_for(presales_user, org.id, branch.id)
        management_ctx = ctx_for(management_user, org.id, branch.id)

        companies = CompanyService(db)
        contacts = ContactService(db)
        leads = LeadService(db)
        blueprint = OpportunityBlueprintService(db)
        quotes = QuoteService(db)
        attachments = AttachmentService(db)
        ovfs = OvfService(db)

        print("1) Company...")
        company = companies.create(
            sales_ctx,
            branch_id=branch.id,
            customer_name=DEMO_ACCOUNT_NAME,
            account_owner_id=sales_user.id,
            account_type="customer",
            industry="IT & Technology",
            other_industries="Telecom Infrastructure, Networking",
            portal_id="ERICSSON-PORTAL-001",
            source="referral",
            rating="hot",
            first_name="Rajesh",
            last_name="Khanna",
            customer_email="rajesh.khanna@ericsson-india.example",
            phone="+91-120-456-7890",
            website="https://www.ericsson.com/en/about-us/company-facts/ericsson-india",
            customer_id_ext="ERIC-IN-NCR-001",
            role="End Customer",
            billing_street="3rd & 4th Floor, DLF Building No. 7A, DLF Cyber City",
            billing_city="Noida",
            billing_state="Uttar Pradesh",
            billing_code="201301",
            billing_country="India",
            shipping_street="3rd & 4th Floor, DLF Building No. 7A, DLF Cyber City",
            shipping_city="Noida",
            shipping_state="Uttar Pradesh",
            shipping_code="201301",
            shipping_country="India",
            description=(
                "Ericsson India Private Limited - enterprise networking and telecom "
                "infrastructure account for Cache Technologies USB-RJ45 adaptor supply."
            ),
        )
        print(f"   {company.account_number}  {company.id}")

        print("2) Contact...")
        contact = contacts.create(
            sales_ctx,
            company_account_id=company.id,
            branch_id=branch.id,
            first_name="Rajesh",
            last_name="Khanna",
            email="rajesh.khanna@ericsson-india.example",
            phone="+91-120-456-7890",
            mobile="+91-98100-11223",
            title="Head of Network Procurement",
            is_primary=True,
            owner_id=sales_user.id,
        )
        print(f"   {contact.first_name} {contact.last_name}  {contact.id}")

        print("3) Lead (all fields)...")
        today = date.today()
        lead = companies.create_lead(
            sales_ctx,
            company.id,
            branch_id=branch.id,
            first_name="Rajesh",
            last_name="Khanna",
            salutation="Mr.",
            mobile="+91-98100-11223",
            email="rajesh.khanna@ericsson-india.example",
            lead_source_id=lead_source.id,
            owner_employee_id=employee.id,
            assign_to_id=employee.id,
            assigned_date=today,
            expected_amount=Decimal("9906.80"),
            expected_closure_date=today + timedelta(days=30),
            product_type="hardware",
            sub_product_category="Networking Adapters",
            sub_product="USB-RJ45 Adaptor",
            sub_product_other="TP-Link UE306 compatible",
            engagement_score=75,
            portal_link="https://portal.cache.example/leads/ericsson-usb-rj45",
            project_title="USB-RJ45 Adaptor Supply - Ericsson Noida",
            requirement_type="New Requirement",
            purchase_model="CAPEX",
            dr_number="DR-ERIC-2026-014",
            new_dr_number="NDR-ERIC-2026-014",
            deal_type="Back to Back",
            industry="IT & Technology",
            territory="NCR",
            region="North India",
            street="3rd & 4th Floor, DLF Building No. 7A, DLF Cyber City",
            city="Noida",
            state="Uttar Pradesh",
            zip="201301",
            country="India",
            oem_name="TP-Link India",
            oem_contact_person="Suresh Patel",
            oem_contact_number="+91-22-4000-2200",
            oem_contact_email="suresh.patel@tp-link.example",
            distributor_name="Ingram Micro India",
            distributor_contact="+91-22-6676-1000",
            distributor_contact_person="Anita Desai",
            distributor_contact_email="anita.desai@ingram.example",
            distributor_department="Networking Distribution",
            end_customer_name="Ericsson India Private Limited",
            end_customer_location="Noida, Uttar Pradesh",
            entity_name="ERICSSON INDIA PRIVATE LIMITED",
            entity_email="procurement.noida@ericsson-india.example",
            entity_address="3&4th floor, DLF Building No. 7A,,Noida,Uttar Pradesh,India",
            entity_gst="09AABCE1234F1Z5",
            entity_contact="+91-120-456-7890",
            notes=(
                "Customer needs 10x USB to Ethernet adapters for lab benches. "
                "Requested TP-Link UE306 or equivalent. Delivery 1-2 weeks from PO."
            ),
        )
        print(f"   {lead.lead_code}  {lead.id}")

        print("4) Convert lead -> opportunity...")
        opportunity = leads.convert(
            sales_ctx,
            lead.id,
            pipeline_id=pipeline.id,
            opportunity_name="Ericsson USB-RJ45 Adaptor Deal",
            expected_revenue=float(Decimal("9906.80")),
            remark="Converted from fully populated demo lead",
        )
        print(f"   {opportunity.opportunity_code}  state={opportunity.blueprint_state}")

        print("5) Opportunity blueprint -> quote_ready...")
        blueprint.perform_action(sales_ctx, opportunity.id, "attach_boq", tiny_file("Ericsson_BOQ_USB-RJ45.pdf"))
        blueprint.perform_action(
            sales_ctx,
            opportunity.id,
            "send_boq_approval",
            {"team_role": "presales", "remarks": "Please approve BOQ for Ericsson adaptor deal"},
        )
        decide_pending(db, presales_ctx, opportunity.id)
        opportunity = blueprint.get(sales_ctx, opportunity.id)
        print(f"   after BOQ approve: {opportunity.blueprint_state}")

        blueprint.perform_action(
            sales_ctx,
            opportunity.id,
            "deal_reg",
            {"deal_reg_number": "CT-DR-2026-ERIC-014"},
        )
        blueprint.perform_action(sales_ctx, opportunity.id, "oem_received", {})
        blueprint.perform_action(
            sales_ctx,
            opportunity.id,
            "attach_oem_quote",
            tiny_file("TPLink_OEM_Quote_UE306.pdf"),
        )
        opportunity = blueprint.get(sales_ctx, opportunity.id)
        print(f"   quote_ready: {opportunity.blueprint_state}")

        print("6) Quote + lines (all fields)...")
        hw = next((p for p in products if p.product_type == "hardware"), products[0])
        svc = next((p for p in products if p.product_type == "services"), products[-1])
        quote = quotes.create(
            sales_ctx,
            opportunity_id=opportunity.id,
            branch_id=branch.id,
            contact_id=contact.id,
            subject="USB-RJ45 Adaptor",
            project_title="USB-RJ45 Adaptor Supply - Ericsson Noida",
            account_name=DEMO_ACCOUNT_NAME,
            service_type="hardware",
            owner_name=f"{employee.first_name} {employee.last_name}",
            valid_until=today + timedelta(days=14),
            entity_name="ERICSSON INDIA PRIVATE LIMITED",
            entity_email="procurement.noida@ericsson-india.example",
            entity_address="3&4th floor, DLF Building No. 7A,,Noida,Uttar Pradesh,India",
            entity_gst="09AABCE1234F1Z5",
            entity_contact="+91-120-456-7890",
            billing_country="India",
            shipping_country="India",
            freight=Decimal("0.00"),
            terms=(
                "Prices: In INR, Exclusive of Taxes. Taxes extra as applicable as per Govt. of India.\n"
                "Order to be placed on: Cache technologies\n"
                "Delivery Period : 1-2 Weeks from the date of PO\n"
                "Payment terms: 30 days from the date of invoice"
            ),
            description=(
                "Thank you for your inquiry. As requested, please find our offer below, along with the "
                "terms and conditions related to the sale."
            ),
            reason_for_discount="Strategic telecom account - standard list pricing applied",
        )
        quotes.add_line(
            sales_ctx,
            quote.id,
            product_id=hw.id,
            product_name="USB-RJ45 Adaptor",
            hsn_sac="85176290",
            description="TP-Link USB to Ethernet Adapter (UE306)",
            line_type="hardware",
            qty=Decimal("10"),
            unit_cost=Decimal("850.00"),
            unit_sell=Decimal("990.68"),
            gst_pct=Decimal("18"),
        )
        quotes.add_line(
            sales_ctx,
            quote.id,
            product_id=svc.id,
            product_name="Onsite Configuration Support",
            hsn_sac="998313",
            description="Half-day onsite configuration and handover at Ericsson Noida lab",
            line_type="services",
            qty=Decimal("1"),
            unit_cost=Decimal("2000.00"),
            unit_sell=Decimal("2500.00"),
            gst_pct=Decimal("18"),
        )
        attachments.create(
            sales_ctx,
            entity_type="quote",
            entity_id=quote.id,
            file_name="Vendor_Quote_TPLink_UE306.pdf",
            category="vendor_quote",
            branch_id=branch.id,
            company_id=org.id,
            content_base64=TINY_PDF,
            content_type="application/pdf",
        )
        quote = quotes.send_for_approval(
            sales_ctx,
            quote.id,
            team_role="management",
            remarks="Demo margin review for Ericsson quote",
        )
        decide_pending(db, management_ctx, quote.id)
        quote = quotes.apply_blueprint_action(
            sales_ctx,
            quote.id,
            "send_to_customer",
            {"remark": "Sent to Ericsson procurement"},
        )
        quote = quotes.apply_blueprint_action(
            sales_ctx,
            quote.id,
            "accept",
            {"remark": "Customer accepted quote"},
        )
        quote = quotes.get(sales_ctx, quote.id)
        print(f"   {quote.quote_no}  stage={quote.quote_stage}  total={quote.grand_total}")

        print("7) Customer PO -> ovf_ready...")
        opportunity = blueprint.get(sales_ctx, opportunity.id)
        print(f"   opp state before PO: {opportunity.blueprint_state}")
        blueprint.perform_action(
            sales_ctx,
            opportunity.id,
            "attach_po",
            tiny_file("Ericsson_Customer_PO_4500123456.pdf"),
        )
        blueprint.perform_action(
            sales_ctx,
            opportunity.id,
            "send_po_approval",
            {"team_role": "management", "remarks": "Approve Ericsson customer PO"},
        )
        decide_pending(db, management_ctx, opportunity.id)
        opportunity = blueprint.get(sales_ctx, opportunity.id)
        print(f"   ovf_ready: {opportunity.blueprint_state} po_approved={opportunity.customer_po_approved}")

        print("8) OVF (all fields)...")
        ovf = ovfs.create(
            sales_ctx,
            quote_id=quote.id,
            branch_id=branch.id,
            po_number="4500123456",
            delivery_period="1-2 Weeks from the date of PO",
            customer_name=DEMO_ACCOUNT_NAME,
            quote_name=quote.subject,
            billing_address="3rd & 4th Floor, DLF Building No. 7A, DLF Cyber City, Noida 201301",
            billing_state="Uttar Pradesh",
            billing_country="India",
            owner_name=f"{employee.first_name} {employee.last_name}",
            billing_contact_person="Rajesh Khanna",
            shipping_address="3rd & 4th Floor, DLF Building No. 7A, DLF Cyber City, Noida 201301",
            shipping_state="Uttar Pradesh",
            shipping_country="India",
            shipping_contact_person="Rajesh Khanna",
            account_name=DEMO_ACCOUNT_NAME,
            technology_segment="Networking",
            sub_technology_segment="USB Ethernet Adapters",
            installation_details="Deliver to Ericsson Noida lab store; coordinate with Rajesh Khanna",
            vendor_payment_days=45,
            customer_payment_days=30,
            additional_charges=Decimal("0.00"),
            freight=Decimal("0.00"),
            finance_cost_pct=Decimal("1.50"),
        )
        print(f"   {ovf.ovf_no}  state={ovf.blueprint_state}  {ovf.id}")

        db.commit()
        print()
        print("Done. Full demo deal created:")
        print(f"  Company : {company.account_number} - {company.customer_name}")
        print(f"  Lead    : {lead.lead_code}")
        print(f"  Opp     : {opportunity.opportunity_code} ({opportunity.blueprint_state})")
        print(f"  Quote   : {quote.quote_no} ({quote.quote_stage}) grand_total={quote.grand_total}")
        print(f"  OVF     : {ovf.ovf_no} ({ovf.blueprint_state})")
        print(f"  UI      : http://localhost:3000/crm/companies/{company.id}")
        print(f"            http://localhost:3000/crm/quotes/{quote.id}")
        print(f"            http://localhost:3000/crm/ovf/{ovf.id}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
