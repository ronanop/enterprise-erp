"""Authentication router."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import get_client_ip, get_current_user, get_tenant_context
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecRole, SecUser, SecUserRole
from modules.foundation.schemas import (
    LoginRequest,
    MfaVerifyRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)
from modules.foundation.service.auth_service import AuthService
from modules.foundation.service.rbac_service import RBACService
from modules.master_data.models.employee import MasterEmployee
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

    designation = None
    if user.employee_id:
        emp = db.scalar(
            select(MasterEmployee).where(
                MasterEmployee.id == user.employee_id,
                MasterEmployee.is_deleted.is_(False),
            )
        )
        if emp:
            designation = emp.designation

    role_rows = db.execute(
        select(SecRole.role_name, SecRole.role_code)
        .join(SecUserRole, SecUserRole.role_id == SecRole.id)
        .where(
            SecUserRole.user_id == user.id,
            SecRole.tenant_id == user.tenant_id,
            SecRole.is_deleted.is_(False),
        )
        .order_by(SecRole.role_name)
    ).all()
    role_names = [str(r[0]) for r in role_rows]
    role_codes = [str(r[1]) for r in role_rows]

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
        "employee_id": str(user.employee_id) if user.employee_id else None,
        "designation": designation,
        "role_name": role_names[0] if role_names else None,
        "role_names": role_names,
        "role_codes": role_codes,
    }
    return APIResponse(message="Current user", data=data)
