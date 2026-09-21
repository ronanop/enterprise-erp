"""Master Data routers."""

from modules.master_data.routers.assets import router as assets_router
from modules.master_data.routers.categories import router as categories_router
from modules.master_data.routers.currencies import router as currencies_router
from modules.master_data.routers.customers import router as customers_router
from modules.master_data.routers.employees import router as employees_router
from modules.master_data.routers.party_registrations import (
    router as party_registrations_router,
)
from modules.master_data.routers.products import router as products_router
from modules.master_data.routers.taxes import router as taxes_router
from modules.master_data.routers.uoms import router as uoms_router
from modules.master_data.routers.vendors import router as vendors_router
from modules.master_data.routers.warehouses import router as warehouses_router

__all__ = [
    "assets_router",
    "categories_router",
    "currencies_router",
    "customers_router",
    "employees_router",
    "party_registrations_router",
    "products_router",
    "taxes_router",
    "uoms_router",
    "vendors_router",
    "warehouses_router",
]
