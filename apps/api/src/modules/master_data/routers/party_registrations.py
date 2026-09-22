"""Customer / vendor registration form router."""

from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_pagination,
    paginate,
)
from modules.master_data.schemas import (
    CreditEvaluationRequest,
    KycVerifyRequest,
    PartyRegistrationCreateRequest,
    PartyRegistrationResponse,
    PartyRegistrationUpdateRequest,
    RegistrationApproveRequest,
    RegistrationRejectRequest,
)
from modules.master_data.service.party_registration_service import PartyRegistrationService
from shared.schemas import APIResponse

router = APIRouter(
    prefix="/party-registrations", tags=["Master Data - Party Registrations"]
)


def _response(entity) -> PartyRegistrationResponse:
    return PartyRegistrationResponse(**entity.__dict__)


@router.get("", response_model=APIResponse[list[PartyRegistrationResponse]])
def list_registrations(
    ctx: Annotated[
        TenantContext, Depends(require_permission("master.party_registration:read"))
    ],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    branch_id: UUID | None = None,
    party_type: str | None = None,
    status: str | None = None,
) -> APIResponse[list[PartyRegistrationResponse]]:
    registrations = PartyRegistrationService(db).list_registrations(
        ctx,
        company_id=company_id,
        branch_id=branch_id,
        party_type=party_type,
        status=status,
    )
    page = paginate(registrations, pagination)
    return APIResponse(
        message="Registrations retrieved", data=[_response(r) for r in page]
    )


@router.post("", response_model=APIResponse[PartyRegistrationResponse])
def create_registration(
    body: PartyRegistrationCreateRequest,
    ctx: Annotated[
        TenantContext, Depends(require_permission("master.party_registration:create"))
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PartyRegistrationResponse]:
    payload = body.model_dump()
    if payload.get("kyc_documents_json") is not None:
        payload["kyc_documents_json"] = [
            doc for doc in payload["kyc_documents_json"]
        ]
    registration = PartyRegistrationService(db).create_registration(ctx, **payload)
    db.commit()
    return APIResponse(message="Registration created", data=_response(registration))


@router.get("/{registration_id}", response_model=APIResponse[PartyRegistrationResponse])
def get_registration(
    registration_id: UUID,
    ctx: Annotated[
        TenantContext, Depends(require_permission("master.party_registration:read"))
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PartyRegistrationResponse]:
    registration = PartyRegistrationService(db).get_registration(ctx, registration_id)
    return APIResponse(message="Registration retrieved", data=_response(registration))


@router.put("/{registration_id}", response_model=APIResponse[PartyRegistrationResponse])
def update_registration(
    registration_id: UUID,
    body: PartyRegistrationUpdateRequest,
    ctx: Annotated[
        TenantContext, Depends(require_permission("master.party_registration:update"))
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PartyRegistrationResponse]:
    registration = PartyRegistrationService(db).update_registration(
        ctx, registration_id, **extract_update_fields(body)
    )
    db.commit()
    return APIResponse(message="Registration updated", data=_response(registration))


@router.post(
    "/{registration_id}/verify-kyc", response_model=APIResponse[PartyRegistrationResponse]
)
def verify_kyc(
    registration_id: UUID,
    body: KycVerifyRequest,
    ctx: Annotated[
        TenantContext, Depends(require_permission("master.party_registration:verify_kyc"))
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PartyRegistrationResponse]:
    registration = PartyRegistrationService(db).verify_kyc(
        ctx, registration_id, verified=body.verified, reason=body.reason
    )
    db.commit()
    message = "KYC verified" if body.verified else "KYC rejected"
    return APIResponse(message=message, data=_response(registration))


@router.post(
    "/{registration_id}/evaluate", response_model=APIResponse[PartyRegistrationResponse]
)
def evaluate_credit(
    registration_id: UUID,
    body: CreditEvaluationRequest,
    ctx: Annotated[
        TenantContext, Depends(require_permission("master.party_registration:update"))
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PartyRegistrationResponse]:
    rate = (
        Decimal(str(body.monthly_interest_rate_pct))
        if body.monthly_interest_rate_pct is not None
        else None
    )
    registration = PartyRegistrationService(db).evaluate_credit(
        ctx,
        registration_id,
        supplier_credit_days=body.supplier_credit_days,
        customer_credit_days=body.customer_credit_days,
        monthly_interest_rate_pct=rate,
    )
    db.commit()
    return APIResponse(message="Credit evaluated", data=_response(registration))


@router.post(
    "/{registration_id}/submit", response_model=APIResponse[PartyRegistrationResponse]
)
def submit_registration(
    registration_id: UUID,
    ctx: Annotated[
        TenantContext, Depends(require_permission("master.party_registration:update"))
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PartyRegistrationResponse]:
    registration = PartyRegistrationService(db).submit(ctx, registration_id)
    db.commit()
    return APIResponse(
        message="Registration submitted for approval", data=_response(registration)
    )


@router.post(
    "/{registration_id}/approve", response_model=APIResponse[PartyRegistrationResponse]
)
def approve_registration(
    registration_id: UUID,
    body: RegistrationApproveRequest,
    ctx: Annotated[
        TenantContext, Depends(require_permission("master.party_registration:approve"))
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PartyRegistrationResponse]:
    registration = PartyRegistrationService(db).approve(
        ctx,
        registration_id,
        approved_credit_limit=body.approved_credit_limit,
        approved_credit_days=body.approved_credit_days,
        reason=body.reason,
        override_risk_band=body.override_risk_band,
    )
    db.commit()
    return APIResponse(
        message="Registration approved and master record created",
        data=_response(registration),
    )


@router.post(
    "/{registration_id}/reject", response_model=APIResponse[PartyRegistrationResponse]
)
def reject_registration(
    registration_id: UUID,
    body: RegistrationRejectRequest,
    ctx: Annotated[
        TenantContext, Depends(require_permission("master.party_registration:approve"))
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PartyRegistrationResponse]:
    registration = PartyRegistrationService(db).reject(
        ctx, registration_id, reason=body.reason
    )
    db.commit()
    return APIResponse(message="Registration rejected", data=_response(registration))


@router.delete("/{registration_id}", response_model=APIResponse[None])
def delete_registration(
    registration_id: UUID,
    ctx: Annotated[
        TenantContext, Depends(require_permission("master.party_registration:delete"))
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    PartyRegistrationService(db).delete_registration(ctx, registration_id)
    db.commit()
    return APIResponse(message="Registration deleted", data=None)
