"""Constants for CRM service purchase orders (Outsourced / Cache Service)."""

ORDER_KIND_PRODUCT = "product"
ORDER_KIND_VENDOR_SERVICE = "vendor_service"
ORDER_KIND_INTERNAL_SERVICE = "internal_service"

SERVICE_ORDER_KINDS = frozenset({ORDER_KIND_VENDOR_SERVICE, ORDER_KIND_INTERNAL_SERVICE})

SOURCE_DOC_TYPE_OPPORTUNITY_SERVICE = "opportunity_service"

# Tenant settings (cfg_setting.setting_key).
SETTING_INTERNAL_SERVICE_VENDOR_ID = "scm.internal_service_vendor_id"
SETTING_OUTSOURCED_SERVICE_VENDOR_ID = "scm.outsourced_service_vendor_id"

# SCM company PO number prefixes (PO/CDT/001, PO/CT/001, PO/CMT/001).
PO_ENTITY_CODES = frozenset({"CDT", "CT", "CMT"})


def map_selling_entity_to_po_code(
    entity_name: str | None, entity_code: str | None = None
) -> str | None:
    """Map CRM selling-entity name/code → SCM PO prefix. CRM codes are ENT-#####."""
    raw_code = (entity_code or "").strip().upper()
    if raw_code in PO_ENTITY_CODES:
        return raw_code
    name = (entity_name or "").strip().upper()
    if not name:
        return None
    if "MUMBAI" in name:
        return "CMT"
    if "TECHNOLOG" in name:
        return "CT"
    if "DIGITECH" in name or "CACHE" in name:
        return "CDT"
    return None


def resolve_service_po_entity_code(
    *,
    entity_name: str | None = None,
    entity_code: str | None = None,
    fallback: str = "CDT",
) -> str:
    mapped = map_selling_entity_to_po_code(entity_name, entity_code)
    if mapped is not None:
        return mapped
    return fallback if fallback in PO_ENTITY_CODES else "CDT"
