"""Landing module router aggregation."""

from fastapi import APIRouter

from modules.landing.routers.access_gate import router as access_gate_router

landing_router = APIRouter()
landing_router.include_router(access_gate_router)
