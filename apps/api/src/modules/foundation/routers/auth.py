"""Authentication router."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import get_client_ip, get_current_user, get_tenant_context
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.schemas import (
    LoginRequest,
    MfaVerifyRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)
from modules.foundation.service.auth_service import AuthService
from modules.foundation.service.rbac_service import RBACService
from shared.schemas import APIResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=APIResponse[TokenResponse])
def login(
    body: LoginRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[TokenResponse]:
    service = AuthService(db)
    result = service.login(
        email=body.email,
        password=body.password,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    db.commit()
    return APIResponse(message="Login successful", data=TokenResponse(**result))


@router.post("/mfa/verify", response_model=APIResponse[TokenResponse])
def verify_mfa(
    body: MfaVerifyRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[TokenResponse]:
    service = AuthService(db)
    result = service.verify_mfa(
        email=body.email,
        otp=body.otp,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    db.commit()
    return APIResponse(message="MFA verified", data=TokenResponse(**result))


@router.post("/refresh", response_model=APIResponse[TokenResponse])
def refresh(
    body: RefreshRequest,
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[TokenResponse]:
    service = AuthService(db)
    result = service.refresh(body.refresh_token)
    db.commit()
    return APIResponse(message="Token refreshed", data=TokenResponse(**result))


@router.post("/logout", response_model=APIResponse[None])
def logout(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    service = AuthService(db)
    assert ctx.session_id is not None
    service.logout(ctx.session_id, ctx.user_id, ctx.tenant_id)
    db.commit()
    return APIResponse(message="Logged out", data=None)


@router.get("/me", response_model=APIResponse[dict])
def me(
    user: Annotated[SecUser, Depends(get_current_user)],
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    rbac = RBACService(db)
    permissions = sorted(rbac.get_user_permissions(ctx.user_id, ctx.tenant_id))
    data = {
        "user": UserResponse(
            id=user.id,
            tenant_id=user.tenant_id,
            email=user.email,
            display_name=user.display_name,
            user_type=user.user_type,
            status=user.status,
            mfa_enabled=user.mfa_enabled,
        ),
        "permissions": permissions,
    }
    return APIResponse(message="Current user", data=data)
