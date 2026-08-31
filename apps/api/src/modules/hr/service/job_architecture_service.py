"""Job level and grade master services."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, ConflictException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.repository.job_architecture_repository import GradeRepository, JobLevelRepository
from modules.hr.service.hr_scope_validator import HrScopeValidator


def _validate_ctc_band(fields: dict) -> None:
    min_ctc = fields.get("min_ctc")
    max_ctc = fields.get("max_ctc")
    if min_ctc is None or max_ctc is None:
        return
    try:
        lo = Decimal(str(min_ctc))
        hi = Decimal(str(max_ctc))
    except Exception as exc:  # noqa: BLE001
        raise AppException("Salary band values must be numeric") from exc
    if hi < lo:
        raise AppException("Maximum salary must be greater than or equal to minimum salary")


class JobLevelService:
    def __init__(self, db: Session) -> None:
        self._repo = JobLevelRepository(db)
        self._scope = HrScopeValidator(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.create(ctx, company_id=cid, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Job level not found")
        return row


class GradeService:
    def __init__(self, db: Session) -> None:
        self._repo = GradeRepository(db)
        self._scope = HrScopeValidator(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        _validate_ctc_band(fields)
        code = str(fields.get("grade_code") or "").strip()
        if code and any(
            str(r.grade_code).lower() == code.lower() for r in self._repo.list_rows(ctx, cid)
        ):
            raise ConflictException(f"Grade code '{code}' already exists")
        return self._repo.create(ctx, company_id=cid, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        existing = self._repo.get(ctx, row_id)
        if existing is None:
            raise NotFoundException("Grade not found")
        merged = {
            "min_ctc": fields["min_ctc"] if "min_ctc" in fields else existing.min_ctc,
            "max_ctc": fields["max_ctc"] if "max_ctc" in fields else existing.max_ctc,
        }
        _validate_ctc_band(merged)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Grade not found")
        return row
