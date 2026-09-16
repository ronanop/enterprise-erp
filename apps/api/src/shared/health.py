"""Health check endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends

from security.public_routes import optional_authentication
from shared.schemas import APIResponse

router = APIRouter()


@router.get("/health", response_model=APIResponse[dict[str, str]])
def health_check(
    _: Annotated[None, Depends(optional_authentication)],
) -> APIResponse[dict[str, str]]:
    """Public liveness probe — no DB/network I/O (Coolify/Docker healthchecks)."""
    return APIResponse(
        success=True,
        message="OK",
        data={"status": "ok"},
    )
