"""Procurement module router aggregation."""

from fastapi import APIRouter

from modules.procurement.routers import (
    comparisons_router,
    contracts_router,
    grns_router,
    invoices_router,
    orders_router,
    performance_router,
    requisitions_router,
    returns_router,
    rfqs_router,
    scm_router,
    vendor_quotations_router,
)

procurement_router = APIRouter(prefix="/procurement")
procurement_router.include_router(scm_router)
procurement_router.include_router(requisitions_router)
procurement_router.include_router(rfqs_router)
procurement_router.include_router(vendor_quotations_router)
procurement_router.include_router(comparisons_router)
procurement_router.include_router(orders_router)
procurement_router.include_router(grns_router)
procurement_router.include_router(invoices_router)
procurement_router.include_router(returns_router)
procurement_router.include_router(contracts_router)
procurement_router.include_router(performance_router)
