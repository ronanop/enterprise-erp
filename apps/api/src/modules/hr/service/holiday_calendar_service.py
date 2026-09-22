"""Holiday calendar service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, ConflictException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.domain.enums import HolidayCalendarStatus
from modules.hr.repository.holiday_calendar_repository import HolidayCalendarRepository
from modules.hr.service.engines import HolidayCalendarEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator

_ALLOWED_STATUSES = {s.value for s in HolidayCalendarStatus}


class HolidayCalendarService:
    def __init__(self, db: Session) -> None:
        self._repo = HolidayCalendarRepository(db)
        self._scope = HrScopeValidator(db)
        self._engine = HolidayCalendarEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Holiday calendar not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        status = fields.get("status", HolidayCalendarStatus.DRAFT.value)
        if status not in _ALLOWED_STATUSES:
            raise AppException(
                f"Invalid holiday calendar status '{status}'. Allowed: {sorted(_ALLOWED_STATUSES)}"
            )
        return self._repo.create(ctx, company_id=cid, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        status = fields.get("status")
        if status is not None and status not in _ALLOWED_STATUSES:
            raise AppException(
                f"Invalid holiday calendar status '{status}'. Allowed: {sorted(_ALLOWED_STATUSES)}"
            )
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Holiday calendar not found")
        return row

    def publish(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        for existing in self._repo.list_rows(ctx, row.company_id):
            if (
                existing.id != row.id
                and existing.calendar_year == row.calendar_year
                and existing.status == HolidayCalendarStatus.PUBLISHED.value
            ):
                raise ConflictException("Published holiday calendar already exists for year")
        self._engine.publish(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def archive(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.archive(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        if not self._repo.soft_delete(ctx, row_id):
            raise NotFoundException("Holiday calendar not found")
