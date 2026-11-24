"""ERP-admin CRM Settings API."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from modules.crm.dependencies import get_db
from modules.crm.domain.settings_defaults import default_crm_settings
from modules.crm.service.crm_settings_service import CrmSettingsService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

settings_router = APIRouter(prefix="/settings", tags=["CRM - Settings"])


class SettingsMetaResponse(BaseModel):
    has_overlay: bool
    config_version: int
    updated_at: str | None = None
    sections: list[str] = Field(default_factory=list)


class SettingsSectionReplaceRequest(BaseModel):
    section: dict[str, Any] = Field(default_factory=dict)


class SettingsOverlayReplaceRequest(BaseModel):
    overlay: dict[str, Any] = Field(default_factory=dict)


@settings_router.get("", response_model=APIResponse[dict[str, Any]])
def get_settings_overlay(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.settings:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict[str, Any]]:
    data = CrmSettingsService(db).get_overlay(ctx)
    return APIResponse(message="CRM settings overlay", data=data)


@settings_router.get("/effective", response_model=APIResponse[dict[str, Any]])
def get_settings_effective(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict[str, Any]]:
    """Merged defaults+overlay for runtime forms/tables (any CRM reader)."""
    data = CrmSettingsService(db).get_effective(ctx, require_erp_admin=False)
    return APIResponse(message="CRM settings (effective)", data=data)


@settings_router.get("/meta", response_model=APIResponse[SettingsMetaResponse])
def get_settings_meta(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.settings:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[SettingsMetaResponse]:
    meta = CrmSettingsService(db).get_meta(ctx)
    return APIResponse(message="OK", data=SettingsMetaResponse(**meta))


@settings_router.get("/defaults", response_model=APIResponse[dict[str, Any]])
def get_settings_defaults(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.settings:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict[str, Any]]:
    _ = db
    CrmSettingsService(db)._require_erp_admin(ctx)
    return APIResponse(message="Stock CRM defaults", data=default_crm_settings())


@settings_router.put("/sections/{section}", response_model=APIResponse[dict[str, Any]])
def put_settings_section(
    section: str,
    body: SettingsSectionReplaceRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.settings:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict[str, Any]]:
    data = CrmSettingsService(db).replace_section(ctx, section, body.section)
    db.commit()
    return APIResponse(message=f"Updated settings section {section}", data=data)


@settings_router.put("/overlay", response_model=APIResponse[dict[str, Any]])
def put_settings_overlay(
    body: SettingsOverlayReplaceRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.settings:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict[str, Any]]:
    data = CrmSettingsService(db).replace_overlay(ctx, body.overlay)
    db.commit()
    return APIResponse(message="CRM settings overlay replaced", data=data)


@settings_router.post("/reset", response_model=APIResponse[dict[str, Any]])
def reset_settings(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.settings:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict[str, Any]]:
    data = CrmSettingsService(db).reset(ctx)
    db.commit()
    return APIResponse(message="CRM settings reset to defaults", data=data)
