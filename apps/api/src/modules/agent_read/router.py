"""Agent read module router aggregation."""

from fastapi import APIRouter

from modules.agent_read.routers.read_api import (
    customers_router,
    invoices_router,
    leads_router,
    orders_router,
    products_router,
)

agent_read_router = APIRouter()
agent_read_router.include_router(leads_router)
agent_read_router.include_router(orders_router)
agent_read_router.include_router(customers_router)
agent_read_router.include_router(invoices_router)
agent_read_router.include_router(products_router)
