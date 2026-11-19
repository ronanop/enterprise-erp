"""Master Data module router — employees only (standalone HRMS)."""

from fastapi import APIRouter

from modules.master_data.routers import employees_router

master_data_router = APIRouter()
master_data_router.include_router(employees_router)
