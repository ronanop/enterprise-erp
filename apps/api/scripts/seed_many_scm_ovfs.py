"""Seed many CRM OVFs shared into the procurement SCM queue.

Builds N full sales chains (company → lead → opportunity → quote → PO → OVF)
on an org company, then approves each OVF and calls share_to_scm so they appear
in GET /procurement/scm/queue.

Usage (from apps/api):
  .venv\\Scripts\\python.exe -m scripts.seed_many_scm_ovfs
  .venv\\Scripts\\python.exe -m scripts.seed_many_scm_ovfs --count 20 --company CDPL
"""

from __future__ import annotations

import argparse
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
from modules.crm.models import CrmLeadSource, CrmPipeline, CrmProduct  # noqa: E402
from modules.crm.service.approval_task_service import ApprovalTaskService  # noqa: E402
from modules.crm.service.attachment_service import AttachmentService  # noqa: E402
from modules.crm.service.blueprint_service import OpportunityBlueprintService  # noqa: E402
from modules.crm.service.company_service import CompanyService  # noqa: E402
from modules.crm.service.contact_service import ContactService  # noqa: E402
from modules.crm.service.lead_service import LeadService  # noqa: E402
from modules.crm.service.ovf_service import OvfService  # noqa: E402
from modules.crm.service.product_service import ProductService  # noqa: E402
from modules.crm.service.quote_service import QuoteService  # noqa: E402
from modules.foundation.domain.value_objects import TenantContext  # noqa: E402
from modules.foundation.models.security import SecUser  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402

TINY_PDF = base64.b64encode(b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n").decode("ascii")

PRODUCTS: list[tuple[str, str, Decimal]] = [
    ("USB-RJ45 Network Adapter", "hardware", Decimal("990.00")),
    ("Firewall Appliance Lite", "hardware", Decimal("185000.00")),
    ("ERP Platform License (per seat)", "software", Decimal("42000.00")),
    ("Implementation & Onboarding Services", "services", Decimal("95000.00")),
    ("Managed Support (Annual)", "services", Decimal("120000.00")),
]

# Diverse demo accounts for SCM queue variety.
DEMO_DEALS: list[dict] = [
    {
        "account": "Ericsson India Private Limited",
        "contact": ("Rajesh", "Khanna"),
        "project": "USB-RJ45 Adaptor Supply",
        "oem": "TP-Link India",
        "distributor": "Ingram Micro India",
        "city": "Noida",
        "state": "Uttar Pradesh",
        "zip": "201301",
        "gst": "09AABCE1234F1Z5",
        "industry": "Telecom",
        "segment": "Networking",
    },
    {
        "account": "Tata Consultancy Services Limited",
        "contact": ("Ananya", "Iyer"),
        "project": "Campus Firewall Refresh",
        "oem": "Fortinet",
        "distributor": "Redington India",
        "city": "Mumbai",
        "state": "Maharashtra",
        "zip": "400001",
        "gst": "27AAACR5055K1Z5",
        "industry": "IT & Technology",
        "segment": "Cybersecurity",
    },
    {
        "account": "Infosys Limited",
        "contact": ("Vikram", "Rao"),
        "project": "Endpoint Security Bundle",
        "oem": "Microsoft",
        "distributor": "Ingram Micro India",
        "city": "Bengaluru",
        "state": "Karnataka",
        "zip": "560100",
        "gst": "29AAACI1681G1Z5",
        "industry": "IT & Technology",
        "segment": "Software",
    },
    {
        "account": "HDFC Bank Limited",
        "contact": ("Neha", "Kapoor"),
        "project": "Branch Network Upgrade",
        "oem": "Cisco",
        "distributor": "Tech Data India",
        "city": "Mumbai",
        "state": "Maharashtra",
        "zip": "400013",
        "gst": "27AAACH2702H1Z5",
        "industry": "BFSI",
        "segment": "Networking",
    },
    {
        "account": "Reliance Retail Limited",
        "contact": ("Suresh", "Patel"),
        "project": "Store Wi-Fi Access Points",
        "oem": "Aruba",
        "distributor": "Ingram Micro India",
        "city": "Ahmedabad",
        "state": "Gujarat",
        "zip": "380015",
        "gst": "24AABCR1718E1Z5",
        "industry": "Retail",
        "segment": "Wireless",
    },
    {
        "account": "Bharti Airtel Limited",
        "contact": ("Kavita", "Singh"),
        "project": "Core Router Spares",
        "oem": "Nokia",
        "distributor": "Redington India",
        "city": "Gurugram",
        "state": "Haryana",
        "zip": "122002",
        "gst": "06AABCB1387G1Z5",
        "industry": "Telecom",
        "segment": "Networking",
    },
    {
        "account": "Wipro Limited",
        "contact": ("Arjun", "Menon"),
        "project": "Cloud Migration Assessment",
        "oem": "AWS",
        "distributor": "Ingram Micro India",
        "city": "Bengaluru",
        "state": "Karnataka",
        "zip": "560035",
        "gst": "29AAACW2419P1Z5",
        "industry": "IT & Technology",
        "segment": "Cloud",
    },
    {
        "account": "Mahindra & Mahindra Limited",
        "contact": ("Pooja", "Deshmukh"),
        "project": "Plant OT Security Kit",
        "oem": "Palo Alto Networks",
        "distributor": "Tech Data India",
        "city": "Pune",
        "state": "Maharashtra",
        "zip": "411018",
        "gst": "27AAACM3025E1Z5",
        "industry": "Manufacturing",
        "segment": "Cybersecurity",
    },
    {
        "account": "Larsen & Toubro Limited",
        "contact": ("Rohit", "Nair"),
        "project": "Project Site Networking",
        "oem": "Juniper",
        "distributor": "Redington India",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "zip": "600089",
        "gst": "33AAACL0140P1Z5",
        "industry": "Infrastructure",
        "segment": "Networking",
    },
    {
        "account": "ICICI Bank Limited",
        "contact": ("Meera", "Joshi"),
        "project": "ATM Network Hardening",
        "oem": "Check Point",
        "distributor": "Ingram Micro India",
        "city": "Mumbai",
        "state": "Maharashtra",
        "zip": "400051",
        "gst": "27AAACI0467G1Z5",
        "industry": "BFSI",
        "segment": "Cybersecurity",
    },
    {
        "account": "Adani Enterprises Limited",
        "contact": ("Harsh", "Shah"),
        "project": "Data Center Cross-Connect",
        "oem": "Dell",
        "distributor": "Tech Data India",
        "city": "Ahmedabad",
        "state": "Gujarat",
        "zip": "380009",
        "gst": "24AABCA1234D1Z5",
        "industry": "Energy",
        "segment": "Infrastructure",
    },
    {
        "account": "Flipkart Internet Private Limited",
        "contact": ("Sneha", "Reddy"),
        "project": "Warehouse Wi-Fi Expansion",
        "oem": "Ubiquiti",
        "distributor": "Ingram Micro India",
        "city": "Bengaluru",
        "state": "Karnataka",
        "zip": "560103",
        "gst": "29AABCF1234E1Z5",
        "industry": "Retail",
        "segment": "Wireless",
    },
    {
        "account": "Apollo Hospitals Enterprise Limited",
        "contact": ("Dr. Anita", "Verma"),
        "project": "Hospital LAN Refresh",
        "oem": "HPE",
        "distributor": "Redington India",
        "city": "Hyderabad",
        "state": "Telangana",
        "zip": "500033",
        "gst": "36AABCA4567F1Z5",
        "industry": "Healthcare",
        "segment": "Networking",
    },
    {
        "account": "Maruti Suzuki India Limited",
        "contact": ("Yogesh", "Malik"),
        "project": "Plant Switch Stack",
        "oem": "Cisco",
        "distributor": "Tech Data India",
        "city": "Gurugram",
        "state": "Haryana",
        "zip": "122015",
        "gst": "06AABCM1234G1Z5",
        "industry": "Manufacturing",
        "segment": "Networking",
    },
    {
        "account": "Paytm Payments Bank Limited",
        "contact": ("Isha", "Gupta"),
        "project": "Payment Gateway Soft Appliances",
        "oem": "VMware",
        "distributor": "Ingram Micro India",
        "city": "Noida",
        "state": "Uttar Pradesh",
        "zip": "201301",
        "gst": "09AABCP7890H1Z5",
        "industry": "BFSI",
        "segment": "Software",
    },
    {
        "account": "NTPC Limited",
        "contact": ("Amitabh", "Sinha"),
        "project": "SCADA Network Segregation",
        "oem": "Siemens",
        "distributor": "Redington India",
        "city": "New Delhi",
        "state": "Delhi",
        "zip": "110003",
        "gst": "07AABCN1122I1Z5",
        "industry": "Energy",
        "segment": "OT Security",
    },
    {
        "account": "Zomato Limited",
        "contact": ("Karan", "Malhotra"),
        "project": "Office Collaboration Suite",
        "oem": "Google",
        "distributor": "Ingram Micro India",
        "city": "Gurugram",
        "state": "Haryana",
        "zip": "122002",
        "gst": "06AABCZ3344J1Z5",
        "industry": "IT & Technology",
        "segment": "Software",
    },
    {
        "account": "Asian Paints Limited",
        "contact": ("Deepa", "Nair"),
        "project": "Factory Edge Routers",
        "oem": "MikroTik",
        "distributor": "Tech Data India",
        "city": "Mumbai",
        "state": "Maharashtra",
        "zip": "400093",
        "gst": "27AABCA5566K1Z5",
        "industry": "Manufacturing",
        "segment": "Networking",
    },
    {
        "account": "IndiGo Airlines",
        "contact": ("Farhan", "Qureshi"),
        "project": "Airport Lounge Wi-Fi",
        "oem": "Ruckus",
        "distributor": "Redington India",
        "city": "Gurugram",
        "state": "Haryana",
        "zip": "122001",
        "gst": "06AABCI7788L1Z5",
        "industry": "Aviation",
        "segment": "Wireless",
    },
    {
        "account": "Deloitte Touche Tohmatsu India LLP",
        "contact": ("Priya", "Banerjee"),
        "project": "Consultant Laptop Docking Kits",
        "oem": "Lenovo",
        "distributor": "Ingram Micro India",
        "city": "Gurugram",
        "state": "Haryana",
        "zip": "122002",
        "gst": "06AABCD9900M1Z5",
        "industry": "Professional Services",
        "segment": "Hardware",
    },
]


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
        raise RuntimeError(f"{label} not found")
    return row


def tiny_file(name: str) -> dict:
    return {"file_name": name, "content_base64": TINY_PDF, "content_type": "application/pdf"}


def decide_pending(db, ctx: TenantContext, entity_id: UUID) -> None:
    tasks = ApprovalTaskService(db).list(ctx, entity_id=entity_id, status="pending")
    if not tasks:
        raise RuntimeError(f"No pending approval task for entity {entity_id}")
    ApprovalTaskService(db).decide(ctx, tasks[0].id, decision="approved", remark="Demo auto-approve")


def ensure_products(db, ctx: TenantContext, org_id: UUID) -> list[CrmProduct]:
    svc = ProductService(db)
    rows: list[CrmProduct] = []
    for name, ptype, price in PRODUCTS:
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
                product_type=ptype,
                unit_price=price,
                hsn_sac="8471" if ptype == "hardware" else ("8523" if ptype == "software" else "9983"),
            )
        )
    return rows


def pick_user(db, email: str) -> SecUser:
    return require(
        db.scalar(select(SecUser).where(SecUser.email == email, SecUser.is_deleted.is_(False))),
        email,
    )


def create_shared_ovf(
    *,
    db,
    index: int,
    deal: dict,
    org: OrgCompany,
    branch: OrgBranch,
    sales_ctx: TenantContext,
    sales_user: SecUser,
    employee: MasterEmployee,
    lead_source: CrmLeadSource,
    pipeline: CrmPipeline,
    products: list[CrmProduct],
) -> tuple[str, str]:
    """Build one deal and share its OVF to SCM. All approvals go to sales_user (admin)."""
    companies = CompanyService(db)
    contacts = ContactService(db)
    leads = LeadService(db)
    blueprint = OpportunityBlueprintService(db)
    quotes = QuoteService(db)
    attachments = AttachmentService(db)
    ovfs = OvfService(db)
    approver_id = str(sales_user.id)

    today = date.today()
    first, last = deal["contact"]
    account = f"{deal['account']} [SCM-{index:02d}]"
    project = f"{deal['project']} #{index:02d}"
    email = f"scm.demo{index:02d}@example.com"
    phone = f"+91-98{10000000 + index:08d}"
    po_number = f"45{10000000 + index:08d}"
    amount = Decimal("50000.00") + Decimal(index) * Decimal("12500.50")

    company = companies.create(
        sales_ctx,
        branch_id=branch.id,
        customer_name=account,
        account_owner_id=sales_user.id,
        account_type="customer",
        industry=deal["industry"],
        source="referral",
        rating="warm",
        first_name=first,
        last_name=last,
        customer_email=email,
        phone=phone,
        billing_street="Demo Street",
        billing_city=deal["city"],
        billing_state=deal["state"],
        billing_code=deal["zip"],
        billing_country="India",
        shipping_street="Demo Street",
        shipping_city=deal["city"],
        shipping_state=deal["state"],
        shipping_code=deal["zip"],
        shipping_country="India",
        description=f"SCM demo account #{index} for procurement queue seeding.",
    )
    contact = contacts.create(
        sales_ctx,
        company_account_id=company.id,
        branch_id=branch.id,
        first_name=first,
        last_name=last,
        email=email,
        phone=phone,
        mobile=phone,
        title="Procurement Lead",
        is_primary=True,
        owner_id=sales_user.id,
    )

    lead = companies.create_lead(
        sales_ctx,
        company.id,
        branch_id=branch.id,
        first_name=first,
        last_name=last,
        salutation="Mr.",
        mobile=phone,
        email=email,
        lead_source_id=lead_source.id,
        owner_employee_id=employee.id,
        assign_to_id=employee.id,
        assigned_date=today,
        expected_amount=amount,
        expected_closure_date=today + timedelta(days=21 + (index % 10)),
        product_type="hardware",
        sub_product_category=deal["segment"],
        engagement_score=50 + (index % 5) * 10,
        project_title=project,
        requirement_type="New Requirement",
        purchase_model="CAPEX",
        industry=deal["industry"],
        street="Demo Street",
        city=deal["city"],
        state=deal["state"],
        zip=deal["zip"],
        country="India",
        oem_name=deal["oem"],
        oem_contact_person=f"{deal['oem']} Sales",
        oem_contact_email=f"sales@{deal['oem'].lower().replace(' ', '')[:12]}.example",
        distributor_name=deal["distributor"],
        distributor_contact_person=f"{deal['distributor']} Desk",
        distributor_contact_email="desk@distributor.example",
        end_customer_name=deal["account"],
        end_customer_location=f"{deal['city']}, {deal['state']}",
        entity_name=deal["account"].upper(),
        entity_email=email,
        entity_address=f"Demo Street, {deal['city']}, {deal['state']}, India",
        entity_gst=deal["gst"],
        entity_contact=phone,
        notes=f"SCM demo lead #{index}",
    )

    opportunity = leads.convert(
        sales_ctx,
        lead.id,
        pipeline_id=pipeline.id,
        opportunity_name=project,
        expected_revenue=float(amount),
        remark="SCM demo convert",
    )

    blueprint.perform_action(sales_ctx, opportunity.id, "attach_boq", tiny_file(f"BOQ_{index:02d}.pdf"))
    blueprint.perform_action(
        sales_ctx,
        opportunity.id,
        "send_boq_approval",
        {
            "team_role": "presales",
            "assigned_user_ids": [approver_id],
            "remarks": f"Approve BOQ for SCM demo #{index}",
        },
    )
    decide_pending(db, sales_ctx, opportunity.id)

    blueprint.perform_action(
        sales_ctx,
        opportunity.id,
        "deal_reg",
        {"deal_reg_number": f"CT-DR-SCM-{index:04d}"},
    )
    blueprint.perform_action(sales_ctx, opportunity.id, "oem_received", {})
    blueprint.perform_action(
        sales_ctx,
        opportunity.id,
        "attach_oem_quote",
        tiny_file(f"OEM_Quote_{index:02d}.pdf"),
    )

    hw = next((p for p in products if p.product_type == "hardware"), products[0])
    svc = next((p for p in products if p.product_type == "services"), products[-1])
    qty = Decimal(5 + (index % 8))
    unit_cost = (amount / qty / Decimal("1.18")).quantize(Decimal("0.01"))
    unit_sell = (unit_cost * Decimal("1.18")).quantize(Decimal("0.01"))

    quote = quotes.create(
        sales_ctx,
        opportunity_id=opportunity.id,
        branch_id=branch.id,
        contact_id=contact.id,
        subject=project,
        project_title=project,
        account_name=account,
        service_type="hardware",
        owner_name=f"{employee.first_name} {employee.last_name}".strip(),
        valid_until=today + timedelta(days=14),
        entity_name=deal["account"].upper(),
        entity_email=email,
        entity_address=f"Demo Street, {deal['city']}, {deal['state']}, India",
        entity_gst=deal["gst"],
        entity_contact=phone,
        billing_country="India",
        shipping_country="India",
        freight=Decimal("0.00"),
        terms="Prices in INR exclusive of taxes. Payment 30 days from invoice.",
        description=f"SCM demo quote #{index}",
    )
    quotes.add_line(
        sales_ctx,
        quote.id,
        product_id=hw.id,
        product_name=hw.product_name,
        hsn_sac=hw.hsn_sac or "85176290",
        description=f"{deal['oem']} supply line for {project}",
        line_type="hardware",
        qty=qty,
        unit_cost=unit_cost,
        unit_sell=unit_sell,
        gst_pct=Decimal("18"),
    )
    quotes.add_line(
        sales_ctx,
        quote.id,
        product_id=svc.id,
        product_name=svc.product_name,
        hsn_sac=svc.hsn_sac or "998313",
        description="Installation / configuration support",
        line_type="services",
        qty=Decimal("1"),
        unit_cost=Decimal("5000.00"),
        unit_sell=Decimal("6500.00"),
        gst_pct=Decimal("18"),
    )
    attachments.create(
        sales_ctx,
        entity_type="quote",
        entity_id=quote.id,
        file_name=f"Vendor_Quote_{index:02d}.pdf",
        category="vendor_quote",
        branch_id=branch.id,
        company_id=org.id,
        content_base64=TINY_PDF,
        content_type="application/pdf",
    )
    quotes.send_for_approval(
        sales_ctx,
        quote.id,
        team_role="management",
        assigned_user_ids=[sales_user.id],
        remarks=f"Margin review SCM demo #{index}",
    )
    decide_pending(db, sales_ctx, quote.id)
    quotes.apply_blueprint_action(sales_ctx, quote.id, "send_to_customer", {"remark": "Sent"})
    quotes.apply_blueprint_action(sales_ctx, quote.id, "accept", {"remark": "Accepted"})
    quote = quotes.get(sales_ctx, quote.id)

    blueprint.perform_action(
        sales_ctx,
        opportunity.id,
        "attach_po",
        tiny_file(f"Customer_PO_{po_number}.pdf"),
    )
    blueprint.perform_action(
        sales_ctx,
        opportunity.id,
        "send_po_approval",
        {
            "finance_user_ids": [approver_id],
            "legal_user_ids": [approver_id],
            "management_user_ids": [approver_id],
            "remarks": f"PO chain SCM demo #{index}",
        },
    )
    decide_pending(db, sales_ctx, opportunity.id)  # finance
    decide_pending(db, sales_ctx, opportunity.id)  # legal
    decide_pending(db, sales_ctx, opportunity.id)  # management
    opportunity = blueprint.get(sales_ctx, opportunity.id)
    if opportunity.blueprint_state != "ovf_ready" or not opportunity.customer_po_approved:
        raise RuntimeError(
            f"Expected ovf_ready after PO chain, got {opportunity.blueprint_state} "
            f"po_approved={opportunity.customer_po_approved}"
        )

    ovf = ovfs.create(
        sales_ctx,
        quote_id=quote.id,
        branch_id=branch.id,
        po_number=po_number,
        delivery_period="2-3 Weeks from PO",
        customer_name=account,
        quote_name=quote.subject,
        billing_address=f"Demo Street, {deal['city']}, {deal['state']} {deal['zip']}",
        billing_state=deal["state"],
        billing_country="India",
        owner_name=f"{employee.first_name} {employee.last_name}".strip(),
        billing_contact_person=f"{first} {last}",
        shipping_address=f"Demo Street, {deal['city']}, {deal['state']} {deal['zip']}",
        shipping_state=deal["state"],
        shipping_country="India",
        shipping_contact_person=f"{first} {last}",
        account_name=account,
        technology_segment=deal["segment"],
        sub_technology_segment=deal["oem"],
        installation_details=f"Coordinate with {first} {last} at {deal['city']}",
        vendor_payment_days=45,
        customer_payment_days=30,
        additional_charges=Decimal("0.00"),
        freight=Decimal("0.00"),
        finance_cost_pct=Decimal("1.50"),
    )
    ovfs.send_for_approval(
        sales_ctx,
        ovf.id,
        team_role="management",
        assigned_user_ids=[sales_user.id],
        remarks=f"Approve OVF SCM demo #{index}",
    )
    decide_pending(db, sales_ctx, ovf.id)
    ovf = ovfs.share_to_scm(sales_ctx, ovf.id)
    return ovf.ovf_no, ovf.blueprint_state


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed many shared CRM OVFs into procurement SCM.")
    parser.add_argument("--count", type=int, default=15, help="Number of OVFs to create (default 15)")
    parser.add_argument(
        "--company",
        default="CDPL",
        help="Org company_code to seed into (default CDPL)",
    )
    args = parser.parse_args()
    count = max(1, min(args.count, len(DEMO_DEALS) * 3))

    db = SessionLocal()
    try:
        org = require(
            db.scalar(
                select(OrgCompany).where(
                    OrgCompany.company_code == args.company,
                    OrgCompany.is_deleted.is_(False),
                )
            ),
            f"org company {args.company}",
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

        # Prefer super_admin so approvals/visibility pass end-to-end.
        sales_user = db.scalar(
            select(SecUser).where(
                SecUser.email == "techbank@cachedigitech.com",
                SecUser.is_deleted.is_(False),
            )
        ) or pick_user(db, "sales.user@example.com")

        employee = db.scalar(
            select(MasterEmployee).where(
                MasterEmployee.company_id == org.id,
                MasterEmployee.user_id == sales_user.id,
                MasterEmployee.is_deleted.is_(False),
            )
        ) or db.scalar(
            select(MasterEmployee).where(
                MasterEmployee.company_id == org.id,
                MasterEmployee.is_deleted.is_(False),
            )
        )
        employee = require(employee, "master employee for company")

        lead_source = require(
            db.scalar(
                select(CrmLeadSource).where(
                    CrmLeadSource.company_id == org.id,
                    CrmLeadSource.is_deleted.is_(False),
                )
            ),
            "lead source (run seed_crm_lead_lookups first)",
        )
        pipeline = require(
            db.scalar(
                select(CrmPipeline).where(
                    CrmPipeline.company_id == org.id,
                    CrmPipeline.is_deleted.is_(False),
                )
            ),
            "pipeline (run seed_crm_lead_lookups first)",
        )

        sales_ctx = ctx_for(sales_user, org.id, branch.id)

        print(f"Seeding {count} shared OVFs on {org.company_code} ({org.id})")
        print(f"  actor={sales_user.email}")
        products = ensure_products(db, sales_ctx, org.id)
        print(f"  products={len(products)}")

        created: list[tuple[str, str]] = []
        for i in range(1, count + 1):
            deal = DEMO_DEALS[(i - 1) % len(DEMO_DEALS)]
            print(f"[{i}/{count}] {deal['account']} ...", flush=True)
            ovf_no, state = create_shared_ovf(
                db=db,
                index=i,
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
            db.commit()
            created.append((ovf_no, state))
            print(f"    -> {ovf_no} ({state})")

        from modules.crm.models.ovf import CrmOvf
        from sqlalchemy import func

        total_shared = db.scalar(
            select(func.count())
            .select_from(CrmOvf)
            .where(
                CrmOvf.company_id == org.id,
                CrmOvf.shared_to_scm.is_(True),
                CrmOvf.is_deleted.is_(False),
            )
        )
        print()
        print(f"Done. Created {len(created)} OVFs shared to SCM.")
        for ovf_no, state in created:
            print(f"  {ovf_no}  {state}")
        print(f"Total shared OVFs on {org.company_code}: {total_shared}")
        print("Procurement: /procurement/scm (or SCM queue under Procurement)")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
