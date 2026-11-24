"""Authentication router."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.auth_cookies import clear_auth_cookies, set_auth_cookies
from modules.foundation.dependencies import get_client_ip, get_current_user, get_tenant_context
from modules.foundation.domain.erp_modules import resolve_session_user_type
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MfaVerifyRequest,
    RefreshRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from modules.foundation.service.auth_service import AuthService
from modules.foundation.service.rbac_service import RBACService
from modules.foundation.service.user_service import UserService
from shared.schemas import APIResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

FORGOT_PASSWORD_MESSAGE = (
    "If an account matches that user id, a reset link has been sent to its email. "
    "If you do not receive it, contact your ERP admin for a temporary password."
)


def _apply_auth_cookies(
    response: Response,
    result: dict,
    request: Request | None = None,
) -> None:
    set_auth_cookies(
        response,
        access_token=result.get("access_token"),
        refresh_token=result.get("refresh_token"),
        request=request,
    )


@router.post("/login", response_model=APIResponse[TokenResponse])
def login(
    body: LoginRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    response: Response,
) -> APIResponse[TokenResponse]:
    """Sign in with a work email or HRMS employee code plus password."""
    service = AuthService(db)
    result = service.login(
        email=body.email,
        password=body.password,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    db.commit()
    if result.get("access_token"):
        _apply_auth_cookies(response, result, request)
    return APIResponse(message="Login successful", data=TokenResponse(**result))


@router.post("/mfa/verify", response_model=APIResponse[TokenResponse])
def verify_mfa(
    body: MfaVerifyRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    response: Response,
) -> APIResponse[TokenResponse]:
    service = AuthService(db)
    result = service.verify_mfa(
        email=body.email,
        otp=body.otp,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    db.commit()
    _apply_auth_cookies(response, result, request)
    return APIResponse(message="MFA verified", data=TokenResponse(**result))


@router.post("/password/forgot", response_model=APIResponse[None])
def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    """Always returns the same message so user ids cannot be enumerated."""
    AuthService(db).request_password_reset(
        identifier=body.user_id, ip_address=get_client_ip(request)
    )
    db.commit()
    return APIResponse(message=FORGOT_PASSWORD_MESSAGE, data=None)


@router.post("/password/reset", response_model=APIResponse[None])
def reset_password(
    body: ResetPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    AuthService(db).reset_password(token=body.token, new_password=body.new_password)
    db.commit()
    return APIResponse(message="Password updated. Sign in with your new password.", data=None)


@router.post("/password/change", response_model=APIResponse[None])
def change_password(
    body: ChangePasswordRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    assert ctx.user_id is not None
    AuthService(db).change_password(
        user_id=ctx.user_id,
        current_password=body.current_password,
        new_password=body.new_password,
    )
    db.commit()
    return APIResponse(message="Password changed", data=None)


@router.post("/refresh", response_model=APIResponse[TokenResponse])
def refresh(
    body: RefreshRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    response: Response,
) -> APIResponse[TokenResponse]:
    from modules.foundation.auth_cookies import REFRESH_COOKIE

    refresh_token = body.refresh_token or request.cookies.get(REFRESH_COOKIE)
    if not refresh_token:
        from core.exceptions import UnauthorizedException

        raise UnauthorizedException("Missing refresh token")
    service = AuthService(db)
    result = service.refresh(
        refresh_token,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    db.commit()
    _apply_auth_cookies(response, result, request)
    return APIResponse(message="Token refreshed", data=TokenResponse(**result))


@router.post("/logout", response_model=APIResponse[None])
def logout(
    request: Request,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
    response: Response,
) -> APIResponse[None]:
    service = AuthService(db)
    assert ctx.session_id is not None
    service.logout(ctx.session_id, ctx.user_id, ctx.tenant_id)
    db.commit()
    clear_auth_cookies(response, request)
    return APIResponse(message="Logged out", data=None)


@router.get("/me", response_model=APIResponse[dict])
def me(
    user: Annotated[SecUser, Depends(get_current_user)],
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    rbac = RBACService(db)
    permissions = sorted(rbac.get_user_permissions(ctx.user_id, ctx.tenant_id))
    service = UserService(db)
    user_entity = service.get_user(ctx.tenant_id, ctx.user_id)
    user_entity.user_type = resolve_session_user_type(
        user_entity.user_type,
        user_entity.email,
        user_entity.role_codes,
    )
    module_keys = service.effective_modules_for_user(user_entity)
    admin_module_keys = service.effective_admin_modules_for_user(user_entity)
    from modules.foundation.repository.user_module_repository import UserModuleRepository

    module_roles = UserModuleRepository(db).list_roles_for_user(ctx.tenant_id, ctx.user_id)
    data = {
        "user": UserService.to_response(user_entity),
        "permissions": permissions,
        "module_keys": module_keys,
        "admin_module_keys": admin_module_keys,
        "module_roles": module_roles,
    }
    from modules.project.service.project_module_admin import ProjectModuleAdminService
    from modules.hr.service.hr_module_admin import HrModuleAdminService
    from modules.asset.service.asset_module_admin import AssetModuleAdminService

    data["project_module_admin"] = ProjectModuleAdminService(db).is_admin(ctx)
    data["hr_module_admin"] = HrModuleAdminService(db).is_admin(ctx)
    data["assets_module_admin"] = AssetModuleAdminService(db).is_admin(ctx)
    return APIResponse(message="Current user", data=data)
