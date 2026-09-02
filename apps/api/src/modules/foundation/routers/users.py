"""User router."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.schemas import (
    AssignRoleRequest,
    UserCreateRequest,
    UserModulesResponse,
    UserModulesUpdateRequest,
    UserResponse,
    UserUpdateRequest,
)
from modules.foundation.service.user_service import UserService
from shared.schemas import APIResponse

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=APIResponse[list[UserResponse]])
def list_users(
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[UserResponse]]:
    users = UserService(db).list_users(ctx.tenant_id)
    return APIResponse(
        message="Users retrieved",
        data=[UserService.to_response(u) for u in users],
    )


@router.post("", response_model=APIResponse[UserResponse])
def create_user(
    body: UserCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[UserResponse]:
    user = UserService(db).create_user(
        tenant_id=ctx.tenant_id,
        email=body.email,
        password=body.password,
        display_name=body.display_name,
        user_type=body.user_type,
        created_by=ctx.user_id,
    )
    db.commit()
    return APIResponse(message="User created", data=UserService.to_response(user))


@router.get("/{user_id}", response_model=APIResponse[UserResponse])
def get_user(
    user_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[UserResponse]:
    user = UserService(db).get_user(ctx.tenant_id, user_id)
    return APIResponse(message="User retrieved", data=UserService.to_response(user))


@router.put("/{user_id}", response_model=APIResponse[UserResponse])
def update_user(
    user_id: UUID,
    body: UserUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[UserResponse]:
    user = UserService(db).update_user(
        ctx.tenant_id,
        user_id,
        updated_by=ctx.user_id,
        **body.model_dump(exclude_unset=True),
    )
    db.commit()
    return APIResponse(message="User updated", data=UserService.to_response(user))


@router.delete("/{user_id}", response_model=APIResponse[None])
def delete_user(
    user_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:delete"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    UserService(db).delete_user(ctx.tenant_id, user_id, deleted_by=ctx.user_id)
    db.commit()
    return APIResponse(message="User deleted", data=None)


@router.post("/{user_id}/roles", response_model=APIResponse[None])
def assign_role(
    user_id: UUID,
    body: AssignRoleRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    UserService(db).assign_role(
        tenant_id=ctx.tenant_id,
        user_id=user_id,
        role_id=body.role_id,
        assigned_by=ctx.user_id,
    )
    db.commit()
    return APIResponse(message="Role assigned", data=None)


@router.delete("/{user_id}/sessions", response_model=APIResponse[None])
def revoke_sessions(
    user_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    UserService(db).revoke_all_sessions(ctx.tenant_id, user_id, revoked_by=ctx.user_id)
    db.commit()
    return APIResponse(message="Sessions revoked", data=None)


@router.get("/{user_id}/modules", response_model=APIResponse[UserModulesResponse])
def get_user_modules(
    user_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[UserModulesResponse]:
    service = UserService(db)
    user, assigned, admin_keys, effective = service.get_user_modules(ctx.tenant_id, user_id)
    return APIResponse(
        message="User modules retrieved",
        data=UserModulesResponse(
            user_id=user.id,
            assigned_module_keys=assigned,
            admin_module_keys=admin_keys,
            effective_module_keys=effective,
        ),
    )


@router.put("/{user_id}/modules", response_model=APIResponse[UserResponse])
def set_user_modules(
    user_id: UUID,
    body: UserModulesUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("foundation.user:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[UserResponse]:
    user = UserService(db).set_user_modules(
        tenant_id=ctx.tenant_id,
        user_id=user_id,
        module_keys=body.module_keys,
        updated_by=ctx.user_id,
    )
    db.commit()
    return APIResponse(message="User modules updated", data=UserService.to_response(user))
