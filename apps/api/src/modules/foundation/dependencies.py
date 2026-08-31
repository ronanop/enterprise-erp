"""FastAPI dependencies for foundation module."""

from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException, UnauthorizedException
from core.redis import SessionStore
from database.session import get_db
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecUser
from modules.foundation.repository.session_repository import SessionRepository
from modules.foundation.service.rbac_service import RBACService
from security.jwt import JWTService

bearer_scheme = HTTPBearer(auto_error=False)


def get_tenant_context(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> TenantContext:
    if credentials is None:
        raise UnauthorizedException("Missing authentication token")
    jwt_service = JWTService()
    payload = jwt_service.decode_token(credentials.credentials, expected_type="access")
    session_id = UUID(payload["session_id"])
    session_repo = SessionRepository(db)
    session = session_repo.get_active(session_id)
    if session is None:
        raise UnauthorizedException("Session expired or revoked")
    store = SessionStore()
    cached = store.get_session(session_id)
    if cached is None:
        # Rehydrate Redis from the active DB session instead of hard-failing
        # when the cache TTL elapsed while the JWT/session are still valid.
        cached = {
            "user_id": str(payload["sub"]),
            "tenant_id": str(payload["tenant_id"]),
        }
        store.set_session(session_id, cached)
    else:
        store.touch_session(session_id)
    company_id = UUID(cached["company_id"]) if cached.get("company_id") else None
    branch_id = UUID(cached["branch_id"]) if cached.get("branch_id") else None
    user_id = UUID(payload["sub"])
    tenant_id = UUID(payload["tenant_id"])
    user_type = str(payload["user_type"])
    user_row = db.get(SecUser, user_id)
    if user_row is not None and user_row.user_type:
        user_type = user_row.user_type

    if not company_id:
        from modules.foundation.service.org_context_service import OrgContextService

        org_ctx = OrgContextService(db)
        resolved_company, resolved_branch = org_ctx.resolve_company_and_branch(
            user_id=user_id,
            tenant_id=tenant_id,
            user_type=user_type,
        )
        if resolved_company:
            company_id = resolved_company
            branch_id = resolved_branch
            cached = {
                **cached,
                "company_id": str(company_id),
                "branch_id": str(branch_id) if branch_id else None,
            }
            store.set_session(session_id, cached)

    return TenantContext(
        tenant_id=tenant_id,
        user_id=user_id,
        user_type=user_type,
        session_id=session_id,
        company_id=company_id,
        branch_id=branch_id,
    )


def get_current_user(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> SecUser:
    from sqlalchemy import select

    stmt = select(SecUser).where(
        SecUser.id == ctx.user_id,
        SecUser.tenant_id == ctx.tenant_id,
        SecUser.is_deleted.is_(False),
    )
    user = db.scalar(stmt)
    if user is None:
        raise UnauthorizedException("User not found")
    return user


def require_permission(permission_code: str) -> Callable:
    def _checker(
        ctx: Annotated[TenantContext, Depends(get_tenant_context)],
        db: Annotated[Session, Depends(get_db)],
    ) -> TenantContext:
        from sqlalchemy import select

        from modules.foundation.domain.erp_modules import (
            module_key_for_permission_code,
            resolve_erp_module_key,
        )
        from modules.foundation.models.security import SecPermission
        from modules.foundation.repository.user_module_repository import UserModuleRepository

        rbac = RBACService(db)
        if ctx.user_type in {"super_admin", "tenant_admin"}:
            return ctx
        if rbac.has_permission(ctx.user_id, ctx.tenant_id, permission_code):
            return ctx

        # Module assignment (member/admin) unlocks that module's APIs so non-ERP-admins
        # can use the modules they were given without a separate role matrix.
        module_key = module_key_for_permission_code(permission_code)
        if module_key is None:
            perm = db.scalar(
                select(SecPermission).where(SecPermission.permission_code == permission_code)
            )
            if perm is not None:
                module_key = resolve_erp_module_key(perm.module)

        if module_key is not None:
            assignment = UserModuleRepository(db).get_assignment(
                ctx.tenant_id, ctx.user_id, module_key
            )
            if assignment is not None:
                return ctx

        raise ForbiddenException(f"Missing permission: {permission_code}")

    return _checker


def get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None
