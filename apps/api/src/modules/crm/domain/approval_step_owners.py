"""Catalog of CRM My Jobs steps that support configurable default owners."""

from __future__ import annotations

# Ordered by CRM sales-process flow (hardware happy path + cloud branch).
# step_key -> (label, default team_role, seed emails)
APPROVAL_STEP_CATALOG: dict[str, tuple[str, str, tuple[str, ...]]] = {
    "boq_attachment": ("BOQ attachment", "presales", ()),
    "sow_attachment": ("SOW attachment", "presales", ()),
    "cloud_discount": ("Cloud discount", "management", ()),
    "quote_send_for_approval": (
        "Quote — Send for approval",
        "management",
        ("shraddha@cachedigitech.com", "vinod@cachedigitech.com", "prarthana@cachedigitech.com"),
    ),
    "po_finance": (
        "Customer PO — Finance",
        "accounts",
        ("accounts@cachedigitech.com", "navneet.kumar@cachedigitech.com"),
    ),
    "po_legal": ("Customer PO — Legal", "legal", ()),
    "po_management": ("Customer PO — Management", "management", ()),
    "service_scope": ("Operations / service scope", "project", ()),
    "ovf_provide_freight": ("OVF — Provide freight", "scm", ()),
    "ovf_send_for_approval": (
        "OVF — Send for approval",
        "management",
        ("shraddha@cachedigitech.com", "vinod@cachedigitech.com", "prarthana@cachedigitech.com"),
    ),
}

APPROVAL_STEP_KEYS = frozenset(APPROVAL_STEP_CATALOG.keys())

# Maps blueprint / UI approval actions to step_key for loading defaults.
ACTION_TO_STEP_KEY: dict[str, str] = {
    "send_for_approval": "quote_send_for_approval",  # quote/OVF share the same emails; UI picks by entity
    "send_po_approval": "po_finance",
    "send_cloud_discount_approval": "cloud_discount",
    "send_boq_for_attachment": "boq_attachment",
    "send_sow_for_attachment": "sow_attachment",
}

PINNED_STEP_KEYS = frozenset(
    {
        "quote_send_for_approval",
        "ovf_send_for_approval",
        "po_finance",
    }
)
