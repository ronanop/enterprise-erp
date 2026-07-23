"""Procurement routers package."""

from modules.procurement.routers.comparisons import comparisons_router
from modules.procurement.routers.contracts import contracts_router
from modules.procurement.routers.grns import grns_router
from modules.procurement.routers.invoices import invoices_router
from modules.procurement.routers.orders import orders_router
from modules.procurement.routers.performance import performance_router
from modules.procurement.routers.requisitions import requisitions_router
from modules.procurement.routers.returns import returns_router
from modules.procurement.routers.rfqs import rfqs_router
from modules.procurement.routers.scm import scm_router
from modules.procurement.routers.vendor_quotations import vendor_quotations_router

__all__ = [
    "requisitions_router",
    "rfqs_router",
    "vendor_quotations_router",
    "comparisons_router",
    "orders_router",
    "grns_router",
    "invoices_router",
    "returns_router",
    "contracts_router",
    "performance_router",
    "scm_router",
]
