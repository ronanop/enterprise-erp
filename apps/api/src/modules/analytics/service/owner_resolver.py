"""Resolve analytics record owners from the signed-in employee."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ValidationException
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.repository.employee_repository import EmployeeRepository


def resolve_owner_employee_id(
    db: Session,
    ctx: TenantContext,
    company_id: UUID,
    explicit: UUID | None = None,
) -> UUID:
    repo = EmployeeRepository(db)
    if explicit is not None:
        employee = repo.get_by_id(ctx, explicit)
        if employee is None:
            raise ValidationException("Owner employee not found")
        return employee.id
    linked = repo.get_by_user_id(ctx, ctx.user_id)
    if linked is not None:
        return linked.id
    employees = repo.list_employees(ctx, company_id=company_id)
    if not employees:
        raise ValidationException("No employee found to own this analytics record")
    return employees[0].id
