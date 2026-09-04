"""Module-scoped user assignment (module admins add members)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import get_tenant_context
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.schemas import (
    ModuleUserCreateRequest,
    ModuleUserOption,
    ModuleUserRecord,
)
from modules.foundation.service.module_admin_service import ModuleAdminService
from shared.schemas import APIResponse

router = APIRouter(prefix="/modules", tags=["Module users"])


@router.get("/{module_key}/members", response_model=APIResponse[list[ModuleUserRecord]])
def list_module_members(
    module_key: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[ModuleUserRecord]]:
    rows = ModuleAdminService(db).list_members(ctx, module_key)
    return APIResponse(
        message="Module members retrieved",
        data=[ModuleUserRecord(**row) for row in rows],
    )


@router.get(
    "/{module_key}/assignable-users",
    response_model=APIResponse[list[ModuleUserOption]],
)
def list_assignable_module_users(
    module_key: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[ModuleUserOption]]:
    rows = ModuleAdminService(db).list_assignable_users(ctx, module_key)
    return APIResponse(
        message="Assignable users retrieved",
        data=[ModuleUserOption(**row) for row in rows],
    )


@router.post("/{module_key}/members", response_model=APIResponse[ModuleUserRecord])
def add_module_member(
    module_key: str,
    body: ModuleUserCreateRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ModuleUserRecord]:
    row = ModuleAdminService(db).add_member(ctx, module_key, body.user_id)
    db.commit()
    return APIResponse(message="Module user assigned", data=ModuleUserRecord(**row))


@router.delete("/{module_key}/members/{user_id}", response_model=APIResponse[None])
def remove_module_member(
    module_key: str,
    user_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    ModuleAdminService(db).remove_member(ctx, module_key, user_id)
    db.commit()
    return APIResponse(message="Module user removed", data=None)
