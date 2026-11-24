"""Stock CRM Settings defaults (merged under tenant overlay)."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from modules.crm.domain.catalog_defaults import default_crm_catalogs


def _field(
    key: str,
    label: str,
    *,
    field_type: str = "text",
    source: str = "stock",
    visible: bool = True,
    required: bool = False,
    order: int = 0,
    catalog_key: str | None = None,
    options: list[dict[str, Any]] | None = None,
    when: dict[str, Any] | None = None,
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "key": key,
        "label": label,
        "type": field_type,
        "source": source,
        "visible": visible,
        "required": required,
        "order": order,
    }
    if catalog_key:
        row["catalog_key"] = catalog_key
    if options:
        row["options"] = options
    if when:
        row["when"] = when
    return row


def _column(key: str, label: str, *, visible: bool = True, order: int = 0) -> dict[str, Any]:
    return {"key": key, "label": label, "visible": visible, "order": order}


def _section(key: str, label: str, *, visible: bool = True, order: int = 0) -> dict[str, Any]:
    return {"key": key, "label": label, "visible": visible, "order": order}


def _widget(key: str, label: str, *, visible: bool = True, order: int = 0) -> dict[str, Any]:
    return {"key": key, "label": label, "visible": visible, "order": order}


def default_crm_settings() -> dict[str, Any]:
    """Full stock config covering every Settings section."""
    return {
        "navigation": {
            "panes": [
                {"key": "dashboard", "title": "Dashboard", "href": "/crm", "visible": True, "order": 0},
                {"key": "reports", "title": "Reports", "href": "/crm/reports", "visible": True, "order": 1},
                {"key": "my_jobs", "title": "My Jobs", "href": "/crm/my-jobs", "visible": True, "order": 2},
                {"key": "company", "title": "Company", "href": "/crm/companies", "visible": True, "order": 3},
                {"key": "leads", "title": "Leads", "href": "/crm/leads", "visible": True, "order": 4},
                {
                    "key": "opportunities",
                    "title": "Opportunities",
                    "href": "/crm/opportunities",
                    "visible": True,
                    "order": 5,
                },
                {"key": "users", "title": "Users", "href": "/crm/users", "visible": True, "order": 6},
                {
                    "key": "settings",
                    "title": "Settings",
                    "href": "/crm/settings",
                    "visible": True,
                    "order": 7,
                    "erp_admin_only": True,
                },
            ]
        },
        "tables": {
            "company": {
                "columns": [
                    _column("customer_name", "Company Name", order=0),
                    _column("phone", "Phone", order=1),
                    _column("customer_email", "Email", order=2),
                    _column("account_owner", "Account Manager Owner", order=3),
                    _column("created_at", "Created Time", order=4),
                    _column("updated_at", "Modified Time", order=5),
                    _column("source", "Source", order=6),
                ]
            },
            "lead": {
                "columns": [
                    _column("lead", "Lead", order=0),
                    _column("mobile", "Mobile", order=1),
                    _column("expected_amount", "Expected Amount", order=2),
                    _column("blueprint_state", "Stage", order=3),
                    _column("status", "Status", order=4),
                ]
            },
            "opportunity": {
                "columns": [
                    _column("opportunity_name", "Opportunity", order=0),
                    _column("opportunity_code", "Code", order=1),
                    _column("expected_revenue", "Expected Revenue", order=2),
                    _column("blueprint_state", "Stage", order=3),
                    _column("status", "Status", order=4),
                ]
            },
            "quote": {
                "columns": [
                    _column("quote_number", "Quote", order=0),
                    _column("subject", "Subject", order=1),
                    _column("grand_total", "Total", order=2),
                    _column("quote_stage", "Stage", order=3),
                    _column("status", "Status", order=4),
                ]
            },
            "ovf": {
                "columns": [
                    _column("ovf_no", "OVF", order=0),
                    _column("account_name", "Account", order=1),
                    _column("total_margin_amount", "Margin", order=2),
                    _column("blueprint_state", "Stage", order=3),
                    _column("approval_status", "Approval", order=4),
                ]
            },
            "contact": {
                "columns": [
                    _column("name", "Name", order=0),
                    _column("email", "Email", order=1),
                    _column("phone", "Phone", order=2),
                    _column("designation", "Designation", order=3),
                ]
            },
            "kyc": {
                "columns": [
                    _column("kyc_code", "KYC", order=0),
                    _column("status", "Status", order=1),
                    _column("updated_at", "Updated", order=2),
                ]
            },
        },
        "forms": {
            "lead": {
                "fields": [
                    _field("first_name", "First Name", field_type="text", required=True, order=0),
                    _field("last_name", "Last Name", field_type="text", required=False, order=1),
                    _field("mobile", "Mobile", field_type="phone", required=True, order=2),
                    _field("email", "Email", field_type="email", required=True, order=3),
                    _field("designation", "Designation", field_type="text", required=False, order=4),
                    _field("lead_source_id", "Lead Source", field_type="select", required=True, order=5),
                    _field(
                        "product_type",
                        "Product Type",
                        field_type="multiselect",
                        required=True,
                        order=6,
                        catalog_key="product_types",
                    ),
                    _field(
                        "sub_product_category",
                        "Sub Product Category",
                        field_type="multiselect",
                        required=True,
                        order=7,
                        catalog_key="sub_product_categories",
                    ),
                    _field(
                        "expected_amount",
                        "Expected Order Value",
                        field_type="number",
                        required=True,
                        order=8,
                    ),
                    _field(
                        "expected_closure_date",
                        "Expected Closure Date",
                        field_type="date",
                        required=True,
                        order=9,
                    ),
                    _field("project_title", "Project Title", field_type="text", required=False, order=10),
                    _field(
                        "requirement_type",
                        "Requirement Type",
                        field_type="select",
                        required=False,
                        order=11,
                        catalog_key="requirement_types",
                    ),
                    _field(
                        "purchase_model",
                        "Purchase Model",
                        field_type="select",
                        required=False,
                        order=12,
                        catalog_key="purchase_models",
                    ),
                    _field(
                        "industry",
                        "Industry",
                        field_type="select",
                        required=False,
                        order=13,
                        catalog_key="industries",
                    ),
                    _field("owner_employee_id", "Lead Owner", field_type="select", required=True, order=14),
                    _field(
                        "presales_owner_id",
                        "Presales Owner",
                        field_type="select",
                        required=False,
                        order=15,
                    ),
                    _field("requires_boq", "BOQ required", field_type="checkbox", required=False, order=16),
                    _field(
                        "requires_sow",
                        "SOW required",
                        field_type="checkbox",
                        required=False,
                        order=17,
                        when={"product_type_includes": "Services"},
                    ),
                    _field("notes", "Notes", field_type="textarea", required=False, order=18),
                ]
            },
            "company": {
                "fields": [
                    _field("customer_name", "Company Name", field_type="text", required=True, order=0),
                    _field(
                        "industry",
                        "Industry",
                        field_type="select",
                        required=True,
                        order=1,
                        catalog_key="industries",
                    ),
                    _field(
                        "source",
                        "Source",
                        field_type="select",
                        required=True,
                        order=2,
                        catalog_key="company_lead_sources",
                    ),
                    _field("first_name", "First Name", field_type="text", required=True, order=3),
                    _field("last_name", "Last Name", field_type="text", required=True, order=4),
                    _field("role", "Designation", field_type="text", required=True, order=5),
                    _field("customer_email", "Customer Email", field_type="email", required=True, order=6),
                    _field("phone", "Phone", field_type="phone", required=True, order=7),
                    _field("website", "Website", field_type="url", required=True, order=8),
                    _field("branch_id", "Branch", field_type="select", required=True, order=9),
                    _field("billing_street", "Billing Street", field_type="text", required=True, order=10),
                    _field("billing_city", "Billing City", field_type="text", required=True, order=11),
                    _field("billing_state", "Billing State", field_type="text", required=True, order=12),
                    _field("billing_code", "Billing Code", field_type="text", required=True, order=13),
                    _field("billing_country", "Billing Country", field_type="text", required=True, order=14),
                    _field(
                        "account_owner_id",
                        "Account Owner",
                        field_type="select",
                        required=False,
                        order=15,
                    ),
                    _field("description", "Description", field_type="textarea", required=False, order=16),
                ]
            },
            "quote": {
                "fields": [
                    _field("subject", "Subject", field_type="text", required=True, order=0),
                    _field("project_title", "Project Title", field_type="text", required=False, order=1),
                    _field("valid_until", "Price Validity Date", field_type="date", required=True, order=2),
                    _field(
                        "service_type",
                        "Service Type",
                        field_type="select",
                        required=False,
                        order=3,
                        catalog_key="product_types",
                    ),
                    _field("terms", "Terms", field_type="textarea", required=False, order=4),
                    _field("description", "Description", field_type="textarea", required=False, order=5),
                ]
            },
            "ovf": {
                "fields": [
                    _field("po_number", "Customer PO Number", field_type="text", required=True, order=0),
                    _field("po_date", "PO Date", field_type="date", required=False, order=1),
                    _field("delivery_period", "Delivery Period", field_type="text", required=False, order=2),
                    _field(
                        "technology_segment",
                        "Technology Segment",
                        field_type="text",
                        required=False,
                        order=3,
                    ),
                    _field(
                        "installation_details",
                        "Installation Details",
                        field_type="textarea",
                        required=False,
                        order=4,
                    ),
                ]
            },
            "contact": {
                "fields": [
                    _field("first_name", "First Name", field_type="text", required=True, order=0),
                    _field("last_name", "Last Name", field_type="text", required=False, order=1),
                    _field("email", "Email", field_type="email", required=True, order=2),
                    _field("phone", "Phone", field_type="phone", required=False, order=3),
                    _field(
                        "designation",
                        "Designation",
                        field_type="select",
                        required=False,
                        order=4,
                        catalog_key="kyc_contact_designations",
                    ),
                ]
            },
            "kyc": {
                "fields": [
                    _field("form_data", "KYC Form", field_type="textarea", required=True, order=0),
                ]
            },
            "opportunity": {
                "fields": [
                    _field(
                        "opportunity_name",
                        "Opportunity Name",
                        field_type="text",
                        required=True,
                        order=0,
                    ),
                    _field(
                        "expected_revenue",
                        "Expected Revenue",
                        field_type="number",
                        required=False,
                        order=1,
                    ),
                    _field("project_title", "Project Title", field_type="text", required=False, order=2),
                ]
            },
        },
        "catalogs": default_crm_catalogs(),
        "pages": {
            "lead_detail": {
                "sections": [
                    _section("summary", "Summary", order=0),
                    _section("presales_call", "PreSales Call", order=1),
                    _section("boq_sow", "BOQ & SOW", order=2),
                    _section("attachments", "Attachments", order=3),
                    _section("activity", "Activity", order=4),
                ]
            },
            "opportunity_detail": {
                "sections": [
                    _section("summary", "Summary", order=0),
                    _section("blueprint", "Sales Flow", order=1),
                    _section("documents", "Documents", order=2),
                    _section("quotes", "Quotes", order=3),
                    _section("ovf", "OVF", order=4),
                ]
            },
            "company_detail": {
                "sections": [
                    _section("overview", "Overview", order=0),
                    _section("contacts", "Contacts", order=1),
                    _section("leads", "Leads", order=2),
                    _section("kyc", "KYC", order=3),
                ]
            },
            "quote_detail": {
                "sections": [
                    _section("summary", "Summary", order=0),
                    _section("lines", "Lines", order=1),
                    _section("approvals", "Approvals", order=2),
                ]
            },
            "ovf_detail": {
                "sections": [
                    _section("summary", "Summary", order=0),
                    _section("lines", "Lines", order=1),
                    _section("approvals", "Approvals", order=2),
                    _section("scm", "SCM", order=3),
                ]
            },
        },
        "blueprint": {
            "stages": [
                {"key": "open", "label": "Open", "order": 0},
                {"key": "boq_pending", "label": "BOQ Pending", "order": 1},
                {"key": "boq_approval", "label": "BOQ Approval", "order": 2},
                {"key": "sow_approval", "label": "SOW Approval", "order": 3},
                {"key": "deal_reg", "label": "Deal Registration", "order": 4},
                {"key": "oem_pending", "label": "Vendor Quotation", "order": 5},
                {"key": "quote_ready", "label": "Quote Ready", "order": 6},
            ],
            "rules": {
                "sow_required_when_services": True,
                "sow_route_to_owner_when_services": True,
                "skip_deal_reg_when_dr_exists": True,
                "auto_convert_after_docs": True,
            },
            "actions": {
                "send_boq_for_attachment": {"enabled": True},
                "send_sow_for_attachment": {"enabled": True},
                "send_boq_approval": {"enabled": True},
                "send_sow_approval": {"enabled": True},
                "attach_oem_quote": {"enabled": True},
                "create_quote": {"enabled": True},
                "create_ovf": {"enabled": True},
            },
            "transitions": [],
        },
        "approvals": {
            "steps": [
                {"key": "boq_attachment", "label": "BOQ attachment", "enabled": True},
                {"key": "sow_attachment", "label": "SOW attachment", "enabled": True},
                {"key": "boq_approval", "label": "BOQ approval", "enabled": True},
                {"key": "sow_approval", "label": "SOW approval", "enabled": True},
                {"key": "quote_send_for_approval", "label": "Quote approval", "enabled": True},
                {"key": "ovf_send_for_approval", "label": "OVF approval", "enabled": True},
                {"key": "po_finance", "label": "PO Finance", "enabled": True},
                {"key": "po_legal", "label": "PO Legal", "enabled": True},
                {"key": "po_management", "label": "PO Management", "enabled": True},
            ]
        },
        "attachments": {
            "policies": [
                {
                    "key": "boq",
                    "label": "BOQ",
                    "entity": "lead",
                    "required": True,
                    "when": None,
                    "allowed_types": ["application/pdf"],
                },
                {
                    "key": "sow",
                    "label": "SOW",
                    "entity": "lead",
                    "required": True,
                    "when": {"product_type_includes": "Services"},
                    "allowed_types": ["application/pdf"],
                },
                {
                    "key": "oem_quote",
                    "label": "Vendor quotation",
                    "entity": "opportunity",
                    "required": True,
                    "when": None,
                    "allowed_types": ["message/rfc822", "application/vnd.ms-outlook"],
                },
                {
                    "key": "customer_po",
                    "label": "Customer PO",
                    "entity": "opportunity",
                    "required": True,
                    "when": None,
                    "allowed_types": ["application/pdf"],
                },
            ]
        },
        "dashboard": {
            "widgets": [
                _widget("kpi_leads", "Open leads KPI", order=0),
                _widget("kpi_opportunities", "Open opportunities KPI", order=1),
                _widget("kpi_pipeline", "Pipeline value KPI", order=2),
                _widget("chart_pipeline", "Pipeline chart", order=3),
                _widget("chart_stage", "Stage donut", order=4),
                _widget("chart_revenue", "Revenue chart", order=5),
                _widget("recent_leads", "Recent leads", order=6),
                _widget("activity", "Activity tiles", order=7),
            ]
        },
        "policies": {
            "auto_convert_after_docs": True,
            "lock_on_pending_approval": True,
            "email_on_module_access": True,
            "share_to_scm_requires_approved_ovf": True,
            "sow_required_when_services": True,
            "sow_route_to_owner_when_services": True,
        },
    }


def deep_merge(base: dict[str, Any], overlay: dict[str, Any] | None) -> dict[str, Any]:
    """Recursively merge overlay onto a deep copy of base (dicts only; lists replace)."""
    result = deepcopy(base)
    if not overlay:
        return result
    for key, value in overlay.items():
        if (
            key in result
            and isinstance(result[key], dict)
            and isinstance(value, dict)
        ):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = deepcopy(value)
    return result


SETTINGS_SECTIONS = frozenset(
    {
        "navigation",
        "tables",
        "forms",
        "catalogs",
        "pages",
        "blueprint",
        "approvals",
        "attachments",
        "dashboard",
        "policies",
    }
)
