"""HR module dependencies."""

from collections.abc import Callable, Generator
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from database.session import SessionLocal
from modules.foundation.dependencies import get_tenant_context, require_permission
from modules.foundation.domain.value_objects import TenantContext

__all__ = [
    "PaginationParams",
    "get_pagination",
    "get_tenant_context",
    "require_permission",
    "require_hr_module_admin",
    "require_hr_superadmin_only",
    "TenantContext",
    "get_db",
    "paginate",
    "extract_update_fields",
]


def get_db() -> Generator[Session]:
    """HR request-scoped unit of work — commit on success, roll back on failure."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


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


def require_hr_module_admin() -> Callable:
    def _checker(
        ctx: Annotated[TenantContext, Depends(get_tenant_context)],
        db: Annotated[Session, Depends(get_db)],
    ) -> TenantContext:
        from modules.hr.service.hr_module_admin import HrModuleAdminService

        if not HrModuleAdminService(db).is_admin(ctx):
            raise ForbiddenException("HR module admin access required")
        return ctx

    return _checker


def require_hr_superadmin_only() -> Callable:
    """Platform superadmin / tenant admin, or explicit hr.superadmin:manage. Not module membership."""

    def _checker(
        ctx: Annotated[TenantContext, Depends(get_tenant_context)],
        db: Annotated[Session, Depends(get_db)],
    ) -> TenantContext:
        from modules.foundation.service.rbac_service import RBACService
        from modules.hr.permissions import HR_SUPERADMIN_PERMISSION

        if ctx.user_type in {"super_admin", "tenant_admin"}:
            return ctx
        rbac = RBACService(db)
        if ctx.user_id is not None and rbac.has_permission(
            ctx.user_id, ctx.tenant_id, HR_SUPERADMIN_PERMISSION
        ):
            return ctx
        raise ForbiddenException("HR superadmin access required")

    return _checker
