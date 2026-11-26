"""Offer letter template API — files live in MinIO via blob_store."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.recruitment.dependencies import get_db
from modules.recruitment.service import offer_template_storage as templates
from shared.schemas import APIResponse

offer_templates_router = APIRouter(
    prefix="/offer-templates",
    tags=["Recruitment - OfferTemplates"],
)


class OfferTemplateSaveRequest(BaseModel):
    id: str | None = None
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    pdf_file_name: str | None = None
    pdf_data_url: str = Field(min_length=32)
    body_content: str = Field(min_length=1)


@offer_templates_router.get("", response_model=APIResponse[list[dict[str, Any]]])
def list_offer_templates(
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.offer:read"))],
):
    return APIResponse(message="OK", data=templates.list_templates(ctx))


@offer_templates_router.get("/{template_id}", response_model=APIResponse[dict[str, Any]])
def get_offer_template(
    template_id: str,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.offer:read"))],
):
    return APIResponse(message="OK", data=templates.get_template(ctx, template_id, include_pdf=True))


@offer_templates_router.post("", response_model=APIResponse[dict[str, Any]])
def save_offer_template(
    body: OfferTemplateSaveRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.offer:create"))],
    _db: Annotated[object, Depends(get_db)],
):
    row = templates.save_template(
        ctx,
        name=body.name,
        description=body.description,
        pdf_data_url=body.pdf_data_url,
        pdf_file_name=body.pdf_file_name,
        body_content=body.body_content,
        template_id=body.id,
    )
    return APIResponse(message="Saved", data=row)


@offer_templates_router.delete("/{template_id}", response_model=APIResponse[None])
def delete_offer_template(
    template_id: str,
    ctx: Annotated[TenantContext, Depends(require_permission("recruitment.offer:create"))],
    _db: Annotated[object, Depends(get_db)],
):
    ok = templates.delete_template(ctx, template_id)
    if not ok:
        from core.exceptions import NotFoundException

        raise NotFoundException("Offer template not found")
    return APIResponse(message="Deleted", data=None)
