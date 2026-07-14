"""Quality module router aggregation."""

from fastapi import APIRouter

from modules.quality.routers import (
    audits_router,
    capas_router,
    characteristics_router,
    complaints_router,
    defect_types_router,
    defects_router,
    final_router,
    incoming_router,
    inprocess_router,
    ncrs_router,
    plans_router,
    reports_router,
    sampling_plans_router,
    scores_router,
    supplier_quality_router,
)

quality_router = APIRouter(prefix="/quality")
quality_router.include_router(plans_router)
quality_router.include_router(sampling_plans_router)
quality_router.include_router(characteristics_router)
quality_router.include_router(defect_types_router)
quality_router.include_router(incoming_router)
quality_router.include_router(inprocess_router)
quality_router.include_router(final_router)
quality_router.include_router(defects_router)
quality_router.include_router(ncrs_router)
quality_router.include_router(capas_router)
quality_router.include_router(supplier_quality_router)
quality_router.include_router(complaints_router)
quality_router.include_router(audits_router)
quality_router.include_router(scores_router)
quality_router.include_router(reports_router)
