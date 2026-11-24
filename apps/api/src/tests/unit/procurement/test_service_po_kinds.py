"""Unit tests for service PO kind constants and channel → order_kind mapping."""

from modules.crm.domain.lead_sourcing_channels import (
    SERVICE_CHANNEL_CACHE,
    SERVICE_CHANNEL_OUTSOURCED,
)
from modules.procurement.domain.service_po import (
    ORDER_KIND_INTERNAL_SERVICE,
    ORDER_KIND_PRODUCT,
    ORDER_KIND_VENDOR_SERVICE,
    SERVICE_ORDER_KINDS,
    SETTING_INTERNAL_SERVICE_VENDOR_ID,
    SOURCE_DOC_TYPE_OPPORTUNITY_SERVICE,
)


def _order_kind_for_channel(channel: str) -> str:
    """Mirrors ServicePoService channel → order_kind fork."""
    if channel == SERVICE_CHANNEL_CACHE:
        return ORDER_KIND_INTERNAL_SERVICE
    return ORDER_KIND_VENDOR_SERVICE


def test_service_order_kinds():
    assert ORDER_KIND_PRODUCT == "product"
    assert ORDER_KIND_VENDOR_SERVICE in SERVICE_ORDER_KINDS
    assert ORDER_KIND_INTERNAL_SERVICE in SERVICE_ORDER_KINDS
    assert ORDER_KIND_PRODUCT not in SERVICE_ORDER_KINDS


def test_opportunity_service_source_doc_type():
    assert SOURCE_DOC_TYPE_OPPORTUNITY_SERVICE == "opportunity_service"
    assert SETTING_INTERNAL_SERVICE_VENDOR_ID == "scm.internal_service_vendor_id"


def test_channel_maps_to_order_kind():
    assert _order_kind_for_channel(SERVICE_CHANNEL_CACHE) == ORDER_KIND_INTERNAL_SERVICE
    assert _order_kind_for_channel(SERVICE_CHANNEL_OUTSOURCED) == ORDER_KIND_VENDOR_SERVICE


def test_selling_entity_maps_to_po_prefix():
    from modules.procurement.domain.service_po import map_selling_entity_to_po_code

    assert (
        map_selling_entity_to_po_code("CACHE DIGITECH PVT LTD (Delhi)", "ENT-000001")
        == "CDT"
    )
    assert map_selling_entity_to_po_code("CACHE TECHNOLOGIES", "ENT-000003") == "CT"
    assert (
        map_selling_entity_to_po_code("CACHE DIGITECH PVT LTD (Mumbai)", "ENT-000002")
        == "CMT"
    )
    assert map_selling_entity_to_po_code(None, "CDT") == "CDT"
