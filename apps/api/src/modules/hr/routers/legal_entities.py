"""HR Setup Legal Entities — CRUD over organization.org_company."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import require_any_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.permissions import HR_SUPERADMIN_PERMISSION
from modules.hr.service.legal_entity_service import HrLegalEntityService
from modules.organization.schemas import (
    CompanyCreateRequest,
    CompanyResponse,
    CompanyUpdateRequest,
)
from shared.schemas import APIResponse

legal_entities_router = APIRouter(prefix="/legal-entities", tags=["HR - Legal Entities"])


def _to_response(company) -> CompanyResponse:
    return CompanyResponse(**company.__dict__)


@legal_entities_router.get("", response_model=APIResponse[list[CompanyResponse]])
def list_legal_entities(
    ctx: Annotated[
        TenantContext,
        Depends(require_any_permission("organization.company:read", HR_SUPERADMIN_PERMISSION)),
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[CompanyResponse]]:
    rows = HrLegalEntityService(db).list_entities(ctx)
    return APIResponse(
        message="Legal entities retrieved",
        data=[_to_response(row) for row in rows],
    )


@legal_entities_router.post("", response_model=APIResponse[CompanyResponse])
def create_legal_entity(
    body: CompanyCreateRequest,
    ctx: Annotated[
        TenantContext,
        Depends(require_any_permission("organization.company:create", HR_SUPERADMIN_PERMISSION)),
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CompanyResponse]:
    company = HrLegalEntityService(db).create(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Legal entity created", data=_to_response(company))


@legal_entities_router.patch("/{company_id}", response_model=APIResponse[CompanyResponse])
def update_legal_entity(
    company_id: UUID,
    body: CompanyUpdateRequest,
    ctx: Annotated[
        TenantContext,
        Depends(require_any_permission("organization.company:update", HR_SUPERADMIN_PERMISSION)),
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CompanyResponse]:
    company = HrLegalEntityService(db).update(
        ctx, company_id, **body.model_dump(exclude_unset=True)
    )
    db.commit()
    return APIResponse(message="Legal entity updated", data=_to_response(company))


@legal_entities_router.delete("/{company_id}", response_model=APIResponse[None])
def delete_legal_entity(
    company_id: UUID,
    ctx: Annotated[
        TenantContext,
        Depends(require_any_permission("organization.company:delete", HR_SUPERADMIN_PERMISSION)),
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    HrLegalEntityService(db).delete(ctx, company_id)
    db.commit()
    return APIResponse(message="Legal entity deleted", data=None)
