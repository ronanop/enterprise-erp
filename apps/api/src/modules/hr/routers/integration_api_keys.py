"""Superadmin + public integration API key routes."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.dependencies import get_db
from modules.hr.routers.superadmin import require_hr_superadmin_access
from modules.hr.schemas import (
    HrIntegrationApiKeyCreateRequest,
    HrIntegrationApiKeyCreated,
    HrIntegrationApiKeyRecord,
    HrIntegrationCatalog,
    HrIntegrationEmployeesResponse,
)
from modules.hr.service.integration_api_key_service import HrIntegrationApiKeyService
from shared.schemas import APIResponse

superadmin_api_keys_router = APIRouter(
    prefix="/superadmin/api-keys",
    tags=["HR - Superadmin API Keys"],
)

integration_public_router = APIRouter(
    prefix="/integration",
    tags=["HR - Integration"],
)


@superadmin_api_keys_router.get("/catalog", response_model=APIResponse[HrIntegrationCatalog])
def get_integration_catalog(
    ctx: Annotated[TenantContext, Depends(require_hr_superadmin_access())],
    db: Annotated[Session, Depends(get_db)],
):
    _ = ctx
    return APIResponse(message="OK", data=HrIntegrationApiKeyService(db).catalog())


@superadmin_api_keys_router.get("", response_model=APIResponse[list[HrIntegrationApiKeyRecord]])
def list_integration_api_keys(
    ctx: Annotated[TenantContext, Depends(require_hr_superadmin_access())],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=HrIntegrationApiKeyService(db).list_keys(ctx))


@superadmin_api_keys_router.post("", response_model=APIResponse[HrIntegrationApiKeyCreated])
def create_integration_api_key(
    body: HrIntegrationApiKeyCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_hr_superadmin_access())],
    db: Annotated[Session, Depends(get_db)],
):
    data = HrIntegrationApiKeyService(db).create(
        ctx,
        name=body.name,
        endpoints=body.endpoints,
        fields=body.fields,
        company_ids=body.company_ids,
        notes=body.notes,
        expires_at=body.expires_at,
    )
    return APIResponse(message="API key created — copy it now; it will not be shown again", data=data)


@superadmin_api_keys_router.delete("/{key_id}", response_model=APIResponse[None])
def revoke_integration_api_key(
    key_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_hr_superadmin_access())],
    db: Annotated[Session, Depends(get_db)],
):
    HrIntegrationApiKeyService(db).revoke(ctx, key_id)
    return APIResponse(message="API key revoked", data=None)


@integration_public_router.get("/employees", response_model=APIResponse[HrIntegrationEmployeesResponse])
def integration_list_employees(
    db: Annotated[Session, Depends(get_db)],
    x_hrms_api_key: Annotated[str | None, Header(alias="X-HRMS-Api-Key")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=500)] = 100,
):
    service = HrIntegrationApiKeyService(db)
    key = service.resolve_key(x_hrms_api_key)
    rows, total = service.list_employees(key, page=page, page_size=page_size)
    return APIResponse(
        message="OK",
        data=HrIntegrationEmployeesResponse(
            total=total,
            page=page,
            page_size=page_size,
            fields=list(key.fields or []),
            rows=rows,
        ),
    )
