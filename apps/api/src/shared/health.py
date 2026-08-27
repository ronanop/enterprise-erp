"""Health check endpoints."""

from fastapi import APIRouter

from core.config import settings
from core.object_storage import is_enabled as minio_enabled
from core.object_storage import ping as check_minio
from core.redis import check_redis_connection
from database.session import check_database_connection
from shared.schemas import APIResponse

router = APIRouter()


@router.get("/health", response_model=APIResponse[dict[str, str]])
def health_check() -> APIResponse[dict[str, str]]:
    """Liveness and dependency health probe."""
    db_status = "healthy" if check_database_connection() else "unhealthy"
    redis_status = "healthy" if check_redis_connection() else "unhealthy"
    storage_status = "disabled"
    if minio_enabled():
        storage_status = "healthy" if check_minio() else "unhealthy"
    overall = (
        "healthy"
        if db_status == "healthy" and redis_status == "healthy" and storage_status != "unhealthy"
        else "degraded"
    )
    return APIResponse(
        success=True,
        message="Service health check",
        data={
            "status": overall,
            "environment": settings.environment,
            "version": settings.app_version,
            "database": db_status,
            "redis": redis_status,
            "storage": storage_status,
        },
    )
