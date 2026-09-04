"""Foundation module router aggregation."""

from fastapi import APIRouter

from modules.foundation.routers.audit import router as audit_router
from modules.foundation.routers.auth import router as auth_router
from modules.foundation.routers.module_members import router as module_members_router
from modules.foundation.routers.notifications import router as notifications_router
from modules.foundation.routers.roles import permissions_router, roles_router
from modules.foundation.routers.settings import router as settings_router
from modules.foundation.routers.tenants import router as tenants_router
from modules.foundation.routers.users import router as users_router
from modules.foundation.routers.workflows import router as workflows_router

foundation_router = APIRouter()
foundation_router.include_router(auth_router)
foundation_router.include_router(tenants_router)
foundation_router.include_router(users_router)
foundation_router.include_router(module_members_router)
foundation_router.include_router(roles_router)
foundation_router.include_router(permissions_router)
foundation_router.include_router(workflows_router)
foundation_router.include_router(notifications_router)
foundation_router.include_router(audit_router)
foundation_router.include_router(settings_router)
