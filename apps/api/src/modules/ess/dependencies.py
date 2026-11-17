"""ESS module dependencies."""

from collections.abc import Generator
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from database.session import SessionLocal
from modules.foundation.dependencies import get_tenant_context
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.repository.employee_repository import EmployeeRepository

__all__ = [
    "get_db",
    "get_tenant_context",
    "get_ess_tenant_context",
    "TenantContext",
    "pin_ess_employee_context",
]


def get_db() -> Generator[Session]:
    """ESS request-scoped unit of work - commit on success, roll back on failure."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def pin_ess_employee_context(ctx: TenantContext, *, company_id: UUID, branch_id: UUID | None) -> TenantContext:
    """Pin ESS session company/branch to the linked employee so HRMS data scopes match."""
    if (
        ctx.company_id == company_id
        and (branch_id is None or ctx.branch_id == branch_id)
        and (not ctx.scoped_company_ids or company_id in ctx.scoped_company_ids)
    ):
        return ctx

    scoped = tuple(
        dict.fromkeys([*(ctx.scoped_company_ids or ()), company_id])
    )
    return TenantContext(
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        user_type=ctx.user_type,
        session_id=ctx.session_id,
        company_id=company_id,
        branch_id=branch_id or ctx.branch_id,
        admin_module_keys=ctx.admin_module_keys,
        tenant_wide=ctx.tenant_wide,
        procurement_tenant_wide=ctx.procurement_tenant_wide,
        scoped_company_ids=scoped,
        all_companies=False,
    )


def get_ess_tenant_context(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> TenantContext:
    """Auth context pinned to the employee company for shared HRMS tables."""
    emp = EmployeeRepository(db).get_by_user_id(ctx, ctx.user_id)
    if emp is None:
        raise NotFoundException("No employee profile linked to this user")
    return pin_ess_employee_context(
        ctx,
        company_id=emp.company_id,
        branch_id=getattr(emp, "branch_id", None),
    )
