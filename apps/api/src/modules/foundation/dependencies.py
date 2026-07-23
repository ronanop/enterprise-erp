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
    if not company_id:
        from modules.organization.repository.org_scope_repository import OrgScopeRepository

        default_scope = OrgScopeRepository(db).get_default_scope(
            UUID(payload["sub"]), UUID(payload["tenant_id"])
        )
        if default_scope:
            company_id = default_scope.company_id
            branch_id = default_scope.branch_id
    return TenantContext(
        tenant_id=UUID(payload["tenant_id"]),
        user_id=UUID(payload["sub"]),
        user_type=str(payload["user_type"]),
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
        rbac = RBACService(db)
        if not rbac.has_permission(ctx.user_id, ctx.tenant_id, permission_code):
            raise ForbiddenException(f"Missing permission: {permission_code}")
        return ctx

    return _checker


def get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None
