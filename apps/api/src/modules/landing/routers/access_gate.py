"""Public access-gate endpoints for the marketing landing Sign in flow."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header

from core.exceptions import UnauthorizedException
from modules.landing.schemas import (
    AccessGateSessionData,
    AccessGateVerifyData,
    AccessGateVerifyRequest,
)
from modules.landing.service.access_gate_service import AccessGateService
from shared.schemas import APIResponse

router = APIRouter(prefix="/public/access-gate", tags=["Public - Access Gate"])


def get_access_gate_service() -> AccessGateService:
    return AccessGateService()


@router.post("/verify", response_model=APIResponse[AccessGateVerifyData])
def verify_access_code(
    body: AccessGateVerifyRequest,
    service: Annotated[AccessGateService, Depends(get_access_gate_service)],
) -> APIResponse[AccessGateVerifyData]:
    data = service.verify_code(body.code)
    return APIResponse(success=True, message="Access granted", data=data)


@router.get("/session", response_model=APIResponse[AccessGateSessionData])
def get_access_gate_session(
    service: Annotated[AccessGateService, Depends(get_access_gate_service)],
    authorization: Annotated[str | None, Header()] = None,
) -> APIResponse[AccessGateSessionData]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedException("Missing access gate token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise UnauthorizedException("Missing access gate token")
    data = service.resolve_session(token)
    return APIResponse(success=True, message="OK", data=data)
