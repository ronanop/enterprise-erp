"""Drive full CRM blueprint: lead test_25AUG_2 â†’ OVF â†’ SCM â†’ Deal Won."""

from __future__ import annotations

import base64
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

import httpx

BASE = "http://localhost:8000/api/v1"
PDF_CANDIDATES = [
    Path(r"C:\Users\Moksh sharma\Downloads\Company_TEST_7AUG.pdf"),
    Path(r"C:\Users\Moksh sharma\Downloads\Invoice-NVZKY1PK-0001.pdf"),
    Path(r"C:\Users\Moksh sharma\Downloads\OVF_project.pdf"),
]
LEAD_NAME = "test_25AUG_2"


def die(msg: str, payload=None) -> None:
    print("ERROR:", msg)
    if payload is not None:
        print(json.dumps(payload, indent=2, default=str)[:4000])
    sys.exit(1)


def unwrap(resp: httpx.Response, label: str):
    try:
        body = resp.json()
    except Exception:
        die(f"{label}: non-JSON {resp.status_code}", resp.text[:1000])
    if resp.status_code >= 400 or body.get("success") is False:
        die(f"{label}: HTTP {resp.status_code}", body)
    return body.get("data", body)


def login(client: httpx.Client, email: str, password: str | None = None) -> tuple[str, str]:
    resolved_password = password or os.environ.get("CRM_TEST_PASSWORD")
    if not resolved_password:
        die("CRM_TEST_PASSWORD environment variable is required")
    data = unwrap(
        client.post("/auth/login", json={"email": email, "password": resolved_password}),
        f"login {email}",
    )
    token = data.get("access_token")
    if not token:
        die(f"no token for {email}", data)
    # subject is user id
    import base64 as b64
    import json as _json

    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    claims = _json.loads(b64.urlsafe_b64decode(payload.encode("ascii")))
    return token, str(claims.get("sub"))


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def pdf_payload() -> tuple[str, str]:
    for path in PDF_CANDIDATES:
        if path.is_file():
            raw = path.read_bytes()
            return path.name, base64.b64encode(raw).decode("ascii")
    # Minimal valid-ish PDF bytes
    minimal = b"""%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >>endobj
4 0 obj<< /Length 44 >>stream
BT /F1 12 Tf 20 100 Td (demo) Tj ET
endstream endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer<< /Size 5 /Root 1 0 R >>
startxref
300
%%EOF
"""
    return "demo-attachment.pdf", base64.b64encode(minimal).decode("ascii")


def attach(
    client: httpx.Client,
    token: str,
    *,
    entity_type: str,
    entity_id: str,
    branch_id: str,
    company_id: str | None,
    category: str,
    file_name: str,
    content_b64: str,
):
    return unwrap(
        client.post(
            "/crm/attachments",
            headers=auth_headers(token),
            json={
                "entity_type": entity_type,
                "entity_id": entity_id,
                "branch_id": branch_id,
                "company_id": company_id,
                "file_name": file_name,
                "category": category,
                "content_base64": content_b64,
                "content_type": "application/pdf",
            },
        ),
        f"attach {category}",
    )


def action(
    client: httpx.Client,
    token: str,
    path: str,
    body: dict | None = None,
    label: str | None = None,
):
    return unwrap(
        client.post(path, headers=auth_headers(token), json=body or {}),
        label or path,
    )


def soft_post(client: httpx.Client, token: str, path: str, body: dict | None = None):
    resp = client.post(path, headers=auth_headers(token), json=body or {})
    try:
        payload = resp.json()
    except Exception:
        return False, {"raw": resp.text[:1000], "status": resp.status_code}
    ok = resp.status_code < 400 and payload.get("success") is not False
    return ok, payload.get("data", payload)


def decide_pending(
    client: httpx.Client,
    email: str,
    team_role: str,
    entity_type: str | None = None,
    remark: str = "Approved for demo",
):
    token, _uid = login(client, email)
    params: dict = {"team_role": team_role, "status": "pending"}
    if entity_type:
        params["entity_type"] = entity_type
    jobs = unwrap(
        client.get("/crm/my-jobs", headers=auth_headers(token), params=params),
        f"my-jobs {team_role}",
    )
    rows = jobs if isinstance(jobs, list) else []
    if not rows:
        die(f"no pending my-jobs for {team_role}/{entity_type}")
    task_id = rows[0]["id"]
    return unwrap(
        client.post(
            f"/crm/my-jobs/{task_id}/decide",
            headers=auth_headers(token),
            json={"decision": "approved", "remark": remark},
        ),
        f"decide {team_role}",
    )


def main() -> None:
    file_name, content_b64 = pdf_payload()
    print(f"Using attachment PDF: {file_name}")

    with httpx.Client(base_url=BASE, timeout=60.0) as client:
        sales, sales_uid = login(client, "sales.user@example.com")
        _, presales_uid = login(client, "presales.user@example.com")
        _, management_uid = login(client, "management.user@example.com")
        h = auth_headers(sales)

        companies = unwrap(client.get("/crm/companies", headers=h), "companies")
        if not companies:
            die("no companies â€” seed CRM demo data first")
        # Prefer TEST_7AUG if present (matches demo PDF naming), else Calipers, else first
        company = next(
            (c for c in companies if (c.get("customer_name") or "").strip().upper() == "TEST_7AUG"),
            None,
        ) or next(
            (c for c in companies if "calipers" in (c.get("customer_name") or "").lower()),
            companies[0],
        )
        company_id = company["id"]
        branch_id = company["branch_id"]
        tenant_company_id = company.get("company_id")
        print(f"Company: {company.get('customer_name')} ({company_id})")

        sources = unwrap(client.get("/crm/lead-sources", headers=h), "lead-sources")
        lead_source_id = sources[0]["id"]

        employees = unwrap(client.get("/employees", headers=h, params={"page_size": 50}), "employees")
        if isinstance(employees, dict):
            employees = employees.get("items") or employees.get("results") or []
        owner_id = employees[0]["id"] if employees else None
        if not owner_id:
            die("no owner_employee_id from /employees")

        pipelines = unwrap(client.get("/crm/pipelines", headers=h), "pipelines")
        pipeline_id = pipelines[0]["id"]

        closure = (date.today() + timedelta(days=45)).isoformat()
        lead_body = {
            "branch_id": branch_id,
            "first_name": LEAD_NAME,
            "last_name": "Demo",
            "salutation": "Mr",
            "designation": "IT Manager",
            "mobile": "9876543210",
            "email": "test25aug2@example.com",
            "lead_source_id": lead_source_id,
            "owner_employee_id": owner_id,
            "expected_amount": 525000,
            "expected_closure_date": closure,
            "product_type": "hardware",
            "sub_product_category": "Networking",
            "sub_product": "Switches",
            "engagement_score": 80,
            "portal_link": "https://example.com/portal/test25aug2",
            "project_title": f"{LEAD_NAME} Network Refresh",
            "requirement_type": "New",
            "purchase_model": "Capex",
            "dr_number": "DR-TEST-25AUG-2",
            "new_dr_number": "NDR-25AUG-2",
            "deal_type": "New Business",
            "industry": "Manufacturing",
            "territory": "West",
            "region": "Pune",
            "street": "12 Industrial Estate",
            "city": "Pune",
            "state": "MH",
            "zip": "411001",
            "country": "India",
            "oem_name": "Cisco",
            "oem_contact_person": "OEM Contact",
            "oem_contact_number": "9123456780",
            "oem_contact_email": "oem.cisco@example.com",
            "distributor_name": "IN STOCK",
            "distributor_contact": "9811100110",
            "distributor_contact_person": "Stock Desk",
            "distributor_contact_email": "instock@example.com",
            "distributor_department": "Sales",
            "end_customer_name": f"{LEAD_NAME} End Customer",
            "end_customer_location": "Pune HQ",
            "entity_name": f"{LEAD_NAME} Billing Entity",
            "entity_email": "billing@example.com",
            "entity_address": "12 Industrial Estate, Pune",
            "entity_gst": "27AABCU9603R1ZM",
            "entity_contact": "9876501234",
            "notes": f"Full demo run for {LEAD_NAME}",
        }
        lead = unwrap(
            client.post(f"/crm/companies/{company_id}/leads", headers=h, json=lead_body),
            "create lead",
        )
        lead_id = lead["id"]
        print(f"Lead: {lead.get('lead_code')} ({lead_id}) distributor={lead.get('distributor_name')}")

        opp = action(
            client,
            sales,
            f"/crm/leads/{lead_id}/convert",
            {
                "pipeline_id": pipeline_id,
                "opportunity_name": f"{LEAD_NAME} â€” Network Refresh",
                "expected_revenue": 525000,
                "remark": "Qualified â€” full field demo",
            },
            "convert lead",
        )
        opp_id = opp.get("opportunity_id") or opp.get("id") or opp.get("converted_opportunity_id")
        if not opp_id and isinstance(opp, dict):
            # convert may return lead with converted_opportunity_id
            opp_id = lead.get("converted_opportunity_id")
            lead2 = unwrap(client.get(f"/crm/leads/{lead_id}", headers=h), "get lead")
            opp_id = lead2.get("converted_opportunity_id")
        if not opp_id:
            # list opportunities for company
            opps = unwrap(
                client.get("/crm/opportunities", headers=h, params={"company_account_id": company_id}),
                "list opps",
            )
            match = next((o for o in opps if LEAD_NAME.lower() in (o.get("opportunity_name") or "").lower()), None)
            if not match:
                die("could not resolve opportunity id", opp)
            opp_id = match["id"]
        print(f"Opportunity: {opp_id}")

        # BOQ
        action(
            client,
            sales,
            f"/crm/opportunities/{opp_id}/actions/attach_boq",
            {
                "file_name": file_name,
                "content_base64": content_b64,
                "content_type": "application/pdf",
            },
            "attach_boq",
        )
        action(
            client,
            sales,
            f"/crm/opportunities/{opp_id}/actions/send_boq_approval",
            {
                "team_role": "presales",
                "remarks": "Please review BOQ",
                "assigned_user_ids": [presales_uid],
            },
            "send_boq_approval",
        )
        decide_pending(client, "presales.user@example.com", "presales", "opportunity")
        print("BOQ approved")

        # SOW skip â†’ deal reg â†’ OEM (some tenants auto-skip SOW into deal_reg)
        ok, payload = soft_post(client, sales, f"/crm/opportunities/{opp_id}/actions/skip_sow", {})
        if ok:
            print("SOW skipped")
        else:
            print("skip_sow not needed:", (payload or {}).get("message") if isinstance(payload, dict) else payload)

        bp = unwrap(client.get(f"/crm/opportunities/{opp_id}/blueprint", headers=h), "opp bp mid")
        state = bp.get("state")
        print("blueprint state after BOQ:", state)

        if state == "deal_reg" or "deal_reg" in (bp.get("allowed_actions") or []):
            soft_post(
                client,
                sales,
                f"/crm/opportunities/{opp_id}/actions/deal_reg",
                {"deal_reg_number": "DR-TEST-25AUG-2"},
            )
        else:
            action(
                client,
                sales,
                f"/crm/opportunities/{opp_id}/actions/deal_reg",
                {"deal_reg_number": "DR-TEST-25AUG-2"},
                "deal_reg",
            )
        action(client, sales, f"/crm/opportunities/{opp_id}/actions/oem_received", {}, "oem_received")
        action(
            client,
            sales,
            f"/crm/opportunities/{opp_id}/actions/attach_oem_quote",
            {
                "file_name": file_name,
                "content_base64": content_b64,
                "content_type": "application/pdf",
            },
            "attach_oem_quote",
        )
        print("OEM quote attached -> quote_ready")

        quote = unwrap(
            client.post(
                "/crm/quotes",
                headers=h,
                json={
                    "opportunity_id": opp_id,
                    "branch_id": branch_id,
                    "subject": f"{LEAD_NAME} Quotation",
                    "project_title": f"{LEAD_NAME} Network Refresh",
                    "account_name": company.get("customer_name"),
                    "freight": 2500,
                    "entity_name": lead_body["entity_name"],
                    "entity_email": lead_body["entity_email"],
                    "entity_address": lead_body["entity_address"],
                    "entity_gst": lead_body["entity_gst"],
                    "entity_contact": lead_body["entity_contact"],
                },
            ),
            "create quote",
        )
        quote_id = quote["id"]
        print(f"Quote: {quote.get('quote_no')} ({quote_id})")

        line = unwrap(
            client.post(
                f"/crm/quotes/{quote_id}/lines",
                headers=h,
                json={
                    "product_name": "Catalyst Access Switch 24P",
                    "description": "Vendor: IN STOCK â€” demo line for test_25AUG_2",
                    "line_type": "hardware",
                    "hsn_sac": "851762",
                    "qty": 10,
                    "unit_cost": 18000,
                    "unit_sell": 22000,
                    "gst_pct": 18,
                },
            ),
            "quote line",
        )
        print(f"Quote line: {line.get('product_name')} (vendor note IN STOCK)")

        # Vendor quote attachment on quote
        attach(
            client,
            sales,
            entity_type="quote",
            entity_id=quote_id,
            branch_id=branch_id,
            company_id=tenant_company_id,
            category="vendor_quote",
            file_name=file_name,
            content_b64=content_b64,
        )
        attach(
            client,
            sales,
            entity_type="quote",
            entity_id=quote_id,
            branch_id=branch_id,
            company_id=tenant_company_id,
            category="boq",
            file_name=file_name,
            content_b64=content_b64,
        )

        ok, _ = soft_post(client, sales, f"/crm/quotes/{quote_id}/approve-internally", {})
        if not ok:
            print("Internal approve blocked â€” sending to management")
            action(
                client,
                sales,
                f"/crm/quotes/{quote_id}/send-for-approval",
                {
                    "team_role": "management",
                    "remarks": "Please approve quote",
                    "assigned_user_ids": [management_uid],
                },
                "quote send-for-approval",
            )
            decide_pending(client, "management.user@example.com", "management", "quote")
        else:
            print("Quote approved internally")

        action(client, sales, f"/crm/quotes/{quote_id}/actions/send_to_customer", {}, "send_to_customer")
        action(
            client,
            sales,
            f"/crm/quotes/{quote_id}/actions/accept",
            {"remark": "Customer accepted"},
            "accept quote",
        )
        print("Quote accepted")

        # Customer PO
        action(
            client,
            sales,
            f"/crm/opportunities/{opp_id}/actions/attach_po",
            {
                "file_name": file_name,
                "content_base64": content_b64,
                "content_type": "application/pdf",
            },
            "attach_po",
        )
        action(
            client,
            sales,
            f"/crm/opportunities/{opp_id}/actions/send_po_approval",
            {
                "team_role": "management",
                "remarks": "Please approve customer PO",
                "assigned_user_ids": [management_uid],
            },
            "send_po_approval",
        )
        decide_pending(client, "management.user@example.com", "management", "opportunity")
        print("Customer PO approved â†’ ovf_ready")

        ovf = unwrap(
            client.post(
                "/crm/ovf",
                headers=h,
                json={
                    "quote_id": quote_id,
                    "branch_id": branch_id,
                    "po_number": "PO-TEST-25AUG-2",
                    "po_date": date.today().isoformat(),
                    "delivery_period": "4 weeks",
                    "customer_name": company.get("customer_name"),
                    "quote_name": quote.get("quote_no"),
                    "vendor_payment_days": 30,
                    "customer_payment_days": 45,
                    "billing_address": lead_body["entity_address"],
                    "billing_state": "MH",
                    "billing_country": "India",
                    "shipping_address": lead_body["entity_address"],
                    "shipping_state": "MH",
                    "shipping_country": "India",
                    "account_name": company.get("customer_name"),
                    "technology_segment": "Networking",
                    "sub_technology_segment": "Switching",
                    "installation_details": "On-site rack install",
                },
            ),
            "create ovf",
        )
        ovf_id = ovf["id"]
        print(f"OVF: {ovf.get('ovf_no')} ({ovf_id})")

        # Set vendor-side distributor to IN STOCK (UI stores distributor in product_name on vendor side)
        lines = unwrap(client.get(f"/crm/ovf/{ovf_id}/lines", headers=h), "ovf lines")
        for ln in lines:
            if ln.get("side") == "vendor":
                unwrap(
                    client.patch(
                        f"/crm/ovf/lines/{ln['id']}",
                        headers=h,
                        json={
                            "product_name": "IN STOCK",
                            "qty": ln.get("qty", 10),
                            "unit_price": ln.get("unit_price", 18000),
                            "side": "vendor",
                        },
                    ),
                    "set vendor IN STOCK",
                )
                print("OVF vendor line distributor set to IN STOCK")

        # OVF attachments (customer PO + vendor quote)
        attach(
            client,
            sales,
            entity_type="ovf",
            entity_id=ovf_id,
            branch_id=branch_id,
            company_id=tenant_company_id,
            category="customer_po",
            file_name=file_name,
            content_b64=content_b64,
        )
        attach(
            client,
            sales,
            entity_type="ovf",
            entity_id=ovf_id,
            branch_id=branch_id,
            company_id=tenant_company_id,
            category="vendor_quote",
            file_name=file_name,
            content_b64=content_b64,
        )

        # OVF approval â†’ SCM â†’ Deal Won
        ok, payload = soft_post(
            client,
            sales,
            f"/crm/ovf/{ovf_id}/send-for-approval",
            {
                "team_role": "management",
                "remarks": "Please approve OVF",
                "assigned_user_ids": [management_uid],
            },
        )
        if ok:
            decide_pending(client, "management.user@example.com", "management", "ovf")
            print("OVF approved")
        else:
            print("OVF approval skipped/failed:", payload)

        action(client, sales, f"/crm/ovf/{ovf_id}/share-to-scm", {}, "share-to-scm")
        print("Shared to SCM")

        won = action(
            client,
            sales,
            f"/crm/ovf/{ovf_id}/deal-won",
            {"deal_won_amount": 220000},
            "deal-won",
        )
        print("Deal Won")

        bp = unwrap(client.get(f"/crm/opportunities/{opp_id}/blueprint", headers=h), "opp blueprint")
        ovf_final = unwrap(client.get(f"/crm/ovf/{ovf_id}", headers=h), "ovf final")
        print(
            json.dumps(
                {
                    "lead_id": lead_id,
                    "opportunity_id": opp_id,
                    "quote_id": quote_id,
                    "ovf_id": ovf_id,
                    "ovf_no": ovf_final.get("ovf_no"),
                    "ovf_blueprint_state": ovf_final.get("blueprint_state"),
                    "shared_to_scm": ovf_final.get("shared_to_scm"),
                    "deal_won": ovf_final.get("deal_won"),
                    "opportunity_blueprint_state": bp.get("state"),
                    "distributor": "IN STOCK",
                    "attachment": file_name,
                },
                indent=2,
            )
        )


if __name__ == "__main__":
    main()

