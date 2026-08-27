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
    EssCaptchaChallengeResponse,
    EssLoginRequest,
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


@router.get("/ess/captcha", response_model=APIResponse[EssCaptchaChallengeResponse])
def ess_captcha() -> APIResponse[EssCaptchaChallengeResponse]:
    from security.ess_login_captcha import captcha_enabled, issue_challenge

    if not captcha_enabled():
        return APIResponse(
            message="OK",
            data=EssCaptchaChallengeResponse(captcha_id="", question="", enabled=False),
        )
    cid, question = issue_challenge()
    return APIResponse(
        message="OK",
        data=EssCaptchaChallengeResponse(captcha_id=cid, question=question, enabled=True),
    )


@router.post("/ess/login", response_model=APIResponse[TokenResponse])
def ess_login(
    body: EssLoginRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[TokenResponse]:
    service = AuthService(db)
    result = service.login_ess(
        company_code=body.company_code,
        employee_code=body.employee_code,
        password=body.password,
        captcha_id=body.captcha_id,
        captcha_answer=body.captcha_answer,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    db.commit()
    return APIResponse(message="Login successful", data=TokenResponse(**result))


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
    role_codes = list(
        db.scalars(
            select(SecRole.role_code)
            .join(SecUserRole, SecUserRole.role_id == SecRole.id)
            .where(
                SecUserRole.user_id == user.id,
                SecRole.tenant_id == ctx.tenant_id,
                SecRole.is_deleted.is_(False),
            )
        ).all()
    )
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
        "user_type": user.user_type,
        "role_codes": role_codes,
    }
    return APIResponse(message="Current user", data=data)
