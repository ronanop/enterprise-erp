"""Authentication router."""

from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import settings
from core.redis import SessionStore
from database.session import get_db
from modules.foundation.dependencies import get_client_ip, get_current_user, get_tenant_context
from modules.foundation.domain.erp_modules import resolve_session_user_type
from modules.foundation.domain.exceptions import MicrosoftLoginNotConfiguredException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecRole, SecUser, SecUserRole
from modules.foundation.schemas import (
    EssCaptchaChallengeResponse,
    EssLoginRequest,
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


@router.get("/microsoft/config", response_model=APIResponse[MicrosoftLoginConfigResponse])
def microsoft_config() -> APIResponse[MicrosoftLoginConfigResponse]:
    """Public: exposes only whether Microsoft SSO is enabled (no secrets)."""
    return APIResponse(
        message="Microsoft sign-in configuration",
        data=MicrosoftLoginConfigResponse(enabled=MicrosoftOAuthService.is_enabled()),
    )


@router.get("/microsoft/login")
def microsoft_login(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    return_to: Annotated[str, Query(max_length=200)] = "/organization",
    client: Annotated[str | None, Query(max_length=32)] = None,
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
    # Employee PWA uses EMPLOYEE_APP_URL so OAuth lands back on :3001, not admin web.
    frontend_base = (
        settings.employee_app_url.rstrip("/")
        if (client or "").strip().lower() in {"ess", "employee", "employee-app"}
        else settings.frontend_url.rstrip("/")
    )
    SessionStore().set_oauth_state(
        state,
        {
            "return_to": safe_return,
            "frontend_base": frontend_base,
            "ip": get_client_ip(request),
        },
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
        exchange_code, _return_to, frontend_base = service.complete_microsoft_oauth(
            code=code,
            state=state,
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        db.commit()
        base = (frontend_base or settings.frontend_url).rstrip("/")
        redirect_url = f"{base}/auth/microsoft/callback?code={quote(exchange_code)}"
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
    service = UserService(db)
    user_entity = service.get_user(ctx.tenant_id, ctx.user_id)
    user_entity.user_type = resolve_session_user_type(
        user_entity.user_type,
        user_entity.email,
        user_entity.role_codes,
        platform_admin_emails=settings.microsoft_platform_admin_email_set(),
    )
    module_keys = service.effective_modules_for_user(user_entity)
    admin_module_keys = service.effective_admin_modules_for_user(user_entity)
    data = {
        "user": UserService.to_response(user_entity),
        "permissions": permissions,
        "user_type": user_entity.user_type,
        "role_codes": role_codes,
        "module_keys": module_keys,
        "admin_module_keys": admin_module_keys,
    }
    from modules.project.service.project_module_admin import ProjectModuleAdminService
    from modules.hr.service.hr_module_admin import HrModuleAdminService
    from modules.asset.service.asset_module_admin import AssetModuleAdminService

    data["project_module_admin"] = ProjectModuleAdminService(db).is_admin(ctx)
    data["hr_module_admin"] = HrModuleAdminService(db).is_admin(ctx)
    data["assets_module_admin"] = AssetModuleAdminService(db).is_admin(ctx)
    return APIResponse(message="Current user", data=data)
