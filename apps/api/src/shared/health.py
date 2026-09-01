"""Health check endpoints."""

from fastapi import APIRouter

from database.session import check_database_connection
from shared.schemas import APIResponse

router = APIRouter()


@router.get("/health", response_model=APIResponse[dict[str, str]])
def health_check() -> APIResponse[dict[str, str]]:
    """Public liveness probe for load balancers and orchestrators."""
    db_status = "healthy" if check_database_connection() else "unhealthy"
    return APIResponse(
        success=True,
        message="Service health check",
        data={
            "status": "healthy" if db_status == "healthy" else "unhealthy",
            "database": db_status,
        },
    )
