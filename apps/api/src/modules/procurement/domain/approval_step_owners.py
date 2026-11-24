"""Catalog of Procurement Approval steps with configurable owners."""

from __future__ import annotations

# step_key -> (label, default team_role)
APPROVAL_STEP_CATALOG: dict[str, tuple[str, str]] = {
    "accept_po": ("Accept PO", "scm"),
    "management_po": ("Management PO approval", "management"),
    "invoice_generation": ("Invoice generation", "accounts"),
    "hold_decision": ("Hold approve / reject", "scm"),
    "freight_finance": ("Freight & finance", "scm"),
}

APPROVAL_STEP_KEYS = frozenset(APPROVAL_STEP_CATALOG.keys())

# Order scm_approval_stage -> step_key that may decide.
STAGE_TO_STEP_KEY: dict[str, str] = {
    "accept_po": "accept_po",
    "management": "management_po",
}
