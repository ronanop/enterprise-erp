"""CRM KYC record REST endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.crm.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
)
from modules.crm.schemas import KycRecordCreate, KycRecordResponse, KycRecordUpdate
from modules.crm.service.kyc_record_service import KycRecordService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

kyc_records_router = APIRouter(prefix="/kyc-records", tags=["CRM - KYC"])


@kyc_records_router.get("", response_model=APIResponse[list[KycRecordResponse]])
def list_kyc_records(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.kyc:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_account_id: UUID | None = None,
):
    rows = KycRecordService(db).list(ctx, company_account_id=company_account_id)
    return APIResponse(message="OK", data=paginate(rows, pagination))


@kyc_records_router.get("/{kyc_id}", response_model=APIResponse[KycRecordResponse])
def get_kyc_record(
    kyc_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.kyc:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=KycRecordService(db).get(ctx, kyc_id))


@kyc_records_router.post("", response_model=APIResponse[KycRecordResponse])
def create_kyc_record(
    body: KycRecordCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.kyc:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=KycRecordService(db).create(ctx, **body.model_dump()))


@kyc_records_router.patch("/{kyc_id}", response_model=APIResponse[KycRecordResponse])
def update_kyc_record(
    kyc_id: UUID,
    body: KycRecordUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.kyc:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=KycRecordService(db).update(ctx, kyc_id, **extract_update_fields(body)),
    )
