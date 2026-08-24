"""HR digital onboarding (HR auth + public candidate portal by token)."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.exceptions import AppException
from modules.foundation.dependencies import get_client_ip, require_any_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.dependencies import get_db
from modules.hr.service.digital_onboarding_service import (
    DigitalOnboardingService,
    InvalidDigitalOnboardingState,
)
from shared.schemas import APIResponse

digital_onboarding_router = APIRouter(
    prefix="/digital-onboarding",
    tags=["HR - Digital Onboarding"],
)

public_onboarding_router = APIRouter(
    prefix="/public/onboarding",
    tags=["Public - Onboarding Portal"],
)


class DigitalOnboardingUpsertRequest(BaseModel):
    case: dict[str, Any]


class PortalSaveRequest(BaseModel):
    portal: dict[str, Any]
    advance_status: bool = True


class AcceptTermsRequest(BaseModel):
    terms_version: str = Field(default="v1", max_length=40)


def _handle_state(exc: InvalidDigitalOnboardingState):
    raise AppException(exc.message, status_code=400) from exc


@digital_onboarding_router.get("/{case_id}/portal-full", response_model=APIResponse[dict])
def get_digital_onboarding_portal_full(
    case_id: str,
    ctx: Annotated[
        TenantContext,
        Depends(
            require_any_permission(
                "hr.employment:read",
                "hr.employee_profile:read",
                "hr.employee_profile:update",
                "recruitment.onboarding:read",
                "recruitment.onboarding:update",
            )
        ),
    ],
    db: Annotated[Session, Depends(get_db)],
):
    """Return case with clear-text portal PII for hire / employee import only."""
    data = DigitalOnboardingService(db).get_case(ctx, case_id, include_pii=True)
    return APIResponse(message="OK", data=data)


@digital_onboarding_router.get("", response_model=APIResponse[list[dict]])
def list_digital_onboarding(
    ctx: Annotated[
        TenantContext,
        Depends(
            require_any_permission(
                "hr.employment:read",
                "hr.employee_profile:read",
                "recruitment.onboarding:read",
            )
        ),
    ],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DigitalOnboardingService(db).list_cases(ctx))


@digital_onboarding_router.post("", response_model=APIResponse[dict])
def upsert_digital_onboarding(
    body: DigitalOnboardingUpsertRequest,
    ctx: Annotated[
        TenantContext,
        Depends(
            require_any_permission(
                "hr.employment:create",
                "hr.employment:update",
                "hr.employee_profile:create",
                "recruitment.onboarding:create",
            )
        ),
    ],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        data = DigitalOnboardingService(db).upsert_case(ctx, body.case)
    except InvalidDigitalOnboardingState as exc:
        _handle_state(exc)
    return APIResponse(message="Saved", data=data)


@public_onboarding_router.get("/{token}", response_model=APIResponse[dict])
def public_get_onboarding(
    token: str,
    db: Annotated[Session, Depends(get_db)],
):
    data = DigitalOnboardingService(db).get_by_token(token)
    return APIResponse(message="OK", data=data)


@public_onboarding_router.post("/{token}/accept-terms", response_model=APIResponse[dict])
def public_accept_terms(
    token: str,
    body: AcceptTermsRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        data = DigitalOnboardingService(db).accept_terms(
            token,
            terms_version=body.terms_version,
            client_ip=get_client_ip(request),
        )
    except InvalidDigitalOnboardingState as exc:
        _handle_state(exc)
    return APIResponse(message="Terms accepted", data=data)


@public_onboarding_router.post("/{token}/portal", response_model=APIResponse[dict])
def public_save_portal(
    token: str,
    body: PortalSaveRequest,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        data = DigitalOnboardingService(db).save_portal(
            token, body.portal, advance_status=body.advance_status
        )
    except InvalidDigitalOnboardingState as exc:
        _handle_state(exc)
    return APIResponse(message="Progress saved", data=data)


@public_onboarding_router.post("/{token}/submit", response_model=APIResponse[dict])
def public_submit_portal(
    token: str,
    body: PortalSaveRequest,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        data = DigitalOnboardingService(db).submit_portal(token, body.portal)
    except InvalidDigitalOnboardingState as exc:
        _handle_state(exc)
    return APIResponse(message="Submitted", data=data)
