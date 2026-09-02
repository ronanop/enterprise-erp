"""Cloud sales opportunity classification and blueprint action filtering."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from modules.crm.models.lead import CrmLead

CLOUD_PRODUCT_TYPE = "cloud"

VARIANT_BILLING_SHIFT = "billing_shift"
VARIANT_MIGRATION = "migration"
VARIANT_POC_ASSESSMENT = "poc_assessment"
VARIANT_CLOUD_OTHER = "cloud_other"

STANDARD_DOC_ACTIONS = frozenset({"attach_boq", "attach_sow", "send_boq_approval", "send_sow_approval"})
CLOUD_DOC_ACTIONS = frozenset({"attach_contract", "send_cloud_discount_approval"})
CLOUD_UNLOCKING = frozenset({"approve_cloud_discount", "reject_cloud_discount"})

# Hardware resale / DR / quote path — not used for cloud consumption deals.
HARDWARE_PIPELINE_ACTIONS = frozenset(
    {
        "deal_reg",
        "oem_received",
        "attach_po",
        "send_po_approval",
        "attach_boq",
        "attach_sow",
        "send_boq_approval",
        "send_sow_approval",
        "skip_sow",
    }
)

CLOUD_CONSUMPTION_VARIANTS = frozenset(
    {
        VARIANT_BILLING_SHIFT,
        VARIANT_MIGRATION,
        VARIANT_POC_ASSESSMENT,
        VARIANT_CLOUD_OTHER,
    }
)

DEFAULT_DISTRIBUTOR_DISCOUNT_PERCENT = Decimal("11")


def _normalize_sub(lead: CrmLead) -> str:
    parts = [
        lead.sub_product_category,
        lead.sub_product,
        lead.sub_product_other,
    ]
    return " ".join(p for p in parts if p).lower()


def cloud_variant_from_lead(lead: CrmLead) -> str | None:
    if (lead.product_type or "").strip().lower() != CLOUD_PRODUCT_TYPE:
        return None
    category = (lead.sub_product_category or "").strip().lower()

    if category == "migration" or "migration" in category:
        return VARIANT_MIGRATION
    if "billing shift" in category or category.startswith("billing shift"):
        return VARIANT_BILLING_SHIFT
    if "finops" in category:
        return VARIANT_BILLING_SHIFT
    if "poc" in category or "ola" in category or "map" in category:
        return VARIANT_POC_ASSESSMENT

    sub = _normalize_sub(lead)
    if "billing" in sub and "shift" in sub:
        return VARIANT_BILLING_SHIFT
    if "migration" in sub:
        return VARIANT_MIGRATION
    if "poc" in sub or "assessment" in sub or "ola" in sub or " map" in f" {sub}":
        return VARIANT_POC_ASSESSMENT
    if "finops" in sub:
        return VARIANT_BILLING_SHIFT
    return VARIANT_CLOUD_OTHER


def is_cloud_opportunity(record: Any) -> bool:
    return bool(getattr(record, "cloud_blueprint_variant", None))


def compute_profitability_percent(
    distributor_discount_percent: Decimal | None,
    customer_discount_percent: Decimal | None,
) -> Decimal | None:
    if distributor_discount_percent is None or customer_discount_percent is None:
        return None
    return (distributor_discount_percent - customer_discount_percent).quantize(Decimal("0.01"))


def uses_cloud_consumption_flow(record: Any) -> bool:
    variant = getattr(record, "cloud_blueprint_variant", None)
    return variant in CLOUD_CONSUMPTION_VARIANTS


def filter_opportunity_actions(record: Any, allowed: list[str]) -> list[str]:
    if not is_cloud_opportunity(record):
        return [action for action in allowed if action not in CLOUD_DOC_ACTIONS]

    filtered = [action for action in allowed if action not in STANDARD_DOC_ACTIONS]
    filtered = [action for action in filtered if action not in HARDWARE_PIPELINE_ACTIONS]
    filtered = [
        action
        for action in filtered
        if action not in {"create_quote", "create_ovf", "deal_won", "quote_accepted"}
    ]

    variant = getattr(record, "cloud_blueprint_variant", None)
    state = getattr(record, "blueprint_state", None) or ""

    if variant != VARIANT_MIGRATION or state != "map_oem_pending":
        filtered = [action for action in filtered if action != "attach_oem_quote"]
    if state != "map_oem_pending":
        filtered = [action for action in filtered if action != "skip_map_oem_quote"]

    return filtered


def cloud_sub_product_label(lead: CrmLead) -> str | None:
    if (lead.sub_product_category or "").strip().lower() == "others":
        return lead.sub_product_other or lead.sub_product_category
    return (
        lead.sub_product_category
        or lead.sub_product
        or lead.sub_product_other
    )
