"""Org Setup — assign hiring manager, recruiter, and HR roles."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import require_any_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.schemas import PeopleRoleResponse, PeopleRoleUpdate
from modules.hr.service.people_role_service import PeopleRoleService
from shared.schemas import APIResponse

people_roles_router = APIRouter(prefix="/people-roles", tags=["HR - People Roles"])


@people_roles_router.get("", response_model=APIResponse[list[PeopleRoleResponse]])
def list_people_roles(
    ctx: Annotated[
        TenantContext,
        Depends(require_any_permission("hr.employee_profile:read", "master.employee:read")),
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[PeopleRoleResponse]]:
    rows = PeopleRoleService(db).list_rows(ctx)
    return APIResponse(message="OK", data=[PeopleRoleResponse(**r) for r in rows])


@people_roles_router.patch("/{employee_id}", response_model=APIResponse[PeopleRoleResponse])
def update_people_role(
    employee_id: UUID,
    body: PeopleRoleUpdate,
    ctx: Annotated[
        TenantContext,
        Depends(require_any_permission("hr.employee_profile:update", "master.employee:update")),
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[PeopleRoleResponse]:
    row = PeopleRoleService(db).update(ctx, employee_id, **body.model_dump(exclude_unset=True))
    db.commit()
    return APIResponse(message="People role updated", data=PeopleRoleResponse(**row))
