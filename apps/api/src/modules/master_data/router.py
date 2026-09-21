"""Master Data module router aggregation."""

from fastapi import APIRouter

from modules.master_data.routers import (
    assets_router,
    categories_router,
    currencies_router,
    customers_router,
    employees_router,
    party_registrations_router,
    products_router,
    taxes_router,
    uoms_router,
    vendors_router,
    warehouses_router,
)

master_data_router = APIRouter()
master_data_router.include_router(employees_router)
master_data_router.include_router(party_registrations_router)
master_data_router.include_router(customers_router)
master_data_router.include_router(vendors_router)
master_data_router.include_router(products_router)
master_data_router.include_router(categories_router)
master_data_router.include_router(uoms_router)
master_data_router.include_router(currencies_router)
master_data_router.include_router(taxes_router)
master_data_router.include_router(assets_router)
master_data_router.include_router(warehouses_router)
