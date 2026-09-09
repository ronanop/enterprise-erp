"""Health check endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends

from database.session import check_database_connection
from security.public_routes import optional_authentication
from shared.schemas import APIResponse

router = APIRouter()


@router.get("/health", response_model=APIResponse[dict[str, str]])
def health_check(
    _: Annotated[None, Depends(optional_authentication)],
) -> APIResponse[dict[str, str]]:
    """Public liveness probe — minimal payload (no stack/env disclosure)."""
    ok = check_database_connection()
    return APIResponse(
        success=True,
        message="OK",
        data={"status": "ok" if ok else "degraded"},
    )
