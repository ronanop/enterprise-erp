"""Signed WebSocket URL for private ElevenLabs agents."""

from typing import Annotated

from fastapi import APIRouter, Depends

from modules.foundation.dependencies import get_tenant_context
from modules.foundation.domain.value_objects import TenantContext
from modules.voice_agent.schemas import SignedUrlResponse
from modules.voice_agent.service.elevenlabs_service import ElevenLabsService
from shared.schemas import APIResponse

router = APIRouter(tags=["Voice Agent"])


@router.get("/signed-url", response_model=APIResponse[SignedUrlResponse])
def get_signed_url(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
) -> APIResponse[SignedUrlResponse]:
    """Return a fresh signed WebSocket URL for the configured private agent."""
    _ = ctx
    signed_url = ElevenLabsService().get_signed_url()
    return APIResponse(
        message="Signed URL generated",
        data=SignedUrlResponse(signed_url=signed_url),
    )
