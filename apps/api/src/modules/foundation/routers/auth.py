"""Authentication router."""

from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from core.config import settings
from core.redis import SessionStore
from database.session import get_db
from modules.foundation.dependencies import get_client_ip, get_current_user, get_tenant_context
from modules.foundation.domain.exceptions import MicrosoftLoginNotConfiguredException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.schemas import (
    LoginRequest,
    MfaVerifyRequest,
    MicrosoftExchangeRequest,
    MicrosoftLoginConfigResponse,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)
from modules.foundation.service.auth_service import AuthService
from modules.foundation.service.microsoft_oauth_service import MicrosoftOAuthService
from modules.foundation.service.rbac_service import RBACService
from modules.foundation.service.user_service import UserService
from shared.schemas import APIResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/microsoft/config", response_model=APIResponse[MicrosoftLoginConfigResponse])
def microsoft_config() -> APIResponse[MicrosoftLoginConfigResponse]:
    return APIResponse(
        message="Microsoft sign-in configuration",
        data=MicrosoftLoginConfigResponse(enabled=MicrosoftOAuthService.is_enabled()),
    )


@router.get("/microsoft/login")
def microsoft_login(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    return_to: Annotated[str, Query(max_length=200)] = "/organization",
) -> RedirectResponse:
    if not MicrosoftOAuthService.is_enabled():
        raise MicrosoftLoginNotConfiguredException()

    oauth = MicrosoftOAuthService()
    state = oauth.create_state()
    safe_return = (
        return_to
        if return_to.startswith("/") and not return_to.startswith("//")
        else "/organization"
    )
    SessionStore().set_oauth_state(
        state,
        {"return_to": safe_return, "ip": get_client_ip(request)},
    )
    return RedirectResponse(oauth.build_authorization_url(state=state), status_code=302)


@router.get("/microsoft/callback")
def microsoft_callback(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    code: Annotated[str, Query(min_length=8)],
    state: Annotated[str, Query(min_length=8)],
) -> RedirectResponse:
    service = AuthService(db)
    try:
        exchange_code, _return_to = service.complete_microsoft_oauth(
            code=code,
            state=state,
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        db.commit()
        redirect_url = (
            f"{settings.frontend_url.rstrip('/')}/auth/microsoft/callback?code={quote(exchange_code)}"
        )
        return RedirectResponse(redirect_url, status_code=302)
    except Exception as exc:
        db.rollback()
        message = getattr(exc, "message", str(exc))
        redirect_url = f"{settings.frontend_url.rstrip('/')}/login?error={quote(message)}"
        return RedirectResponse(redirect_url, status_code=302)


@router.post("/microsoft/exchange", response_model=APIResponse[TokenResponse])
def microsoft_exchange(
    body: MicrosoftExchangeRequest,
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[TokenResponse]:
    service = AuthService(db)
    payload = service.redeem_microsoft_exchange(body.code)
    token_payload = {
        "access_token": payload.get("access_token"),
        "refresh_token": payload.get("refresh_token"),
        "token_type": payload.get("token_type", "bearer"),
        "session_id": payload.get("session_id"),
        "redirect_to": payload.get("return_to"),
    }
    return APIResponse(
        message="Microsoft sign-in successful",
        data=TokenResponse(**token_payload),
    )


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
    service = UserService(db)
    user_entity = service.get_user(ctx.tenant_id, ctx.user_id)
    module_keys = service.effective_modules_for_user(user_entity)
    data = {
        "user": UserService.to_response(user_entity),
        "permissions": permissions,
        "module_keys": module_keys,
    }
    from modules.project.service.project_module_admin import ProjectModuleAdminService

    data["project_module_admin"] = ProjectModuleAdminService(db).is_admin(ctx)
    return APIResponse(message="Current user", data=data)
