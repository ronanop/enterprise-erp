"""Marketing module dependencies."""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from database.session import get_db
from modules.foundation.dependencies import get_tenant_context, require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.rbac_service import RBACService

__all__ = [
    "PaginationParams",
    "get_pagination",
    "get_tenant_context",
    "require_permission",
    "require_any_permission",
    "TenantContext",
    "get_db",
    "paginate",
    "extract_update_fields",
]


@dataclass(frozen=True)
class PaginationParams:
    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def get_pagination(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 25,
) -> PaginationParams:
    return PaginationParams(page=page, page_size=page_size)


def paginate(items: list, pagination: PaginationParams) -> list:
    return items[pagination.offset : pagination.offset + pagination.page_size]


def extract_update_fields(body) -> dict:
    fields = body.model_dump(exclude_unset=True)
    fields.pop("version", None)
    return fields


def require_any_permission(*permission_codes: str) -> Callable:
    """Allow access when the user has at least one of the given permissions."""

    def _checker(
        ctx: Annotated[TenantContext, Depends(get_tenant_context)],
        db: Annotated[Session, Depends(get_db)],
    ) -> TenantContext:
        if ctx.user_type in {"super_admin", "tenant_admin"}:
            return ctx
        rbac = RBACService(db)
        for code in permission_codes:
            if rbac.has_permission(ctx.user_id, ctx.tenant_id, code):
                return ctx
        codes = ", ".join(permission_codes)
        raise ForbiddenException(f"Missing permission: one of {codes}")

    return _checker
