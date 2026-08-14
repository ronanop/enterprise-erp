"""Asset module router aggregation."""

from fastapi import APIRouter

from modules.asset.routers import (
    asset_assignments_router,
    asset_audits_router,
    asset_categories_router,
    asset_checklists_router,
    asset_components_router,
    asset_depreciations_router,
    asset_disposals_router,
    asset_documents_router,
    asset_insurances_router,
    asset_locations_router,
    asset_maintenances_router,
    asset_notifications_router,
    asset_revaluations_router,
    asset_transfers_router,
    asset_warranties_router,
    assets_router,
    incoming_assets_router,
    maintenance_plans_router,
    meter_readings_router,
    registration_queue_router,
    reports_router,
    service_histories_router,
)

asset_router = APIRouter(prefix="/assets")
asset_router.include_router(asset_categories_router)
asset_router.include_router(assets_router)
asset_router.include_router(incoming_assets_router)
asset_router.include_router(registration_queue_router)
asset_router.include_router(asset_components_router)
asset_router.include_router(asset_assignments_router)
asset_router.include_router(asset_transfers_router)
asset_router.include_router(asset_locations_router)
asset_router.include_router(asset_warranties_router)
asset_router.include_router(asset_insurances_router)
asset_router.include_router(maintenance_plans_router)
asset_router.include_router(asset_maintenances_router)
asset_router.include_router(service_histories_router)
asset_router.include_router(asset_depreciations_router)
asset_router.include_router(asset_disposals_router)
asset_router.include_router(asset_revaluations_router)
asset_router.include_router(asset_audits_router)
asset_router.include_router(asset_documents_router)
asset_router.include_router(asset_checklists_router)
asset_router.include_router(meter_readings_router)
asset_router.include_router(asset_notifications_router)
asset_router.include_router(reports_router)
