"""Application pipeline service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.recruitment.domain.enums import ApplicationStatus, RecEntityType
from modules.recruitment.models import RecApplication
from modules.recruitment.repository.application_repository import ApplicationRepository
from modules.recruitment.service.document_number_service import DocumentNumberService
from modules.recruitment.service.engines import ApplicationEngine
from modules.recruitment.service.recruitment_scope_validator import RecruitmentScopeValidator


class ApplicationService:
    def __init__(self, db: Session) -> None:
        self._repo = ApplicationRepository(db)
        self._scope = RecruitmentScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = ApplicationEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> RecApplication:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Application not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(RecEntityType.APPLICATION, cid, RecApplication, "document_number")
        fields.setdefault("status", ApplicationStatus.ACTIVE.value)
        fields.setdefault("current_stage_code", "sourced")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Application not found")
        return row

    def _persist_exit(self, ctx: TenantContext, row_id: UUID, row: RecApplication):
        return self._repo.update(
            ctx,
            row_id,
            status=row.status,
            current_stage_code=row.current_stage_code,
            rejection_reason=row.rejection_reason,
            exited_at_stage=row.exited_at_stage,
            exited_at=row.exited_at,
            exit_reason=row.exit_reason,
        )

    def advance(self, ctx: TenantContext, row_id: UUID, *, stage: str):
        row = self.get(ctx, row_id)
        self._engine.advance(row, stage=stage)
        return self._repo.update(ctx, row_id, status=row.status, current_stage_code=row.current_stage_code)

    def reject(self, ctx: TenantContext, row_id: UUID, *, reason: str | None = None):
        row = self.get(ctx, row_id)
        self._engine.reject(row, reason=reason)
        return self._persist_exit(ctx, row_id, row)

    def mark_hired(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.mark_hired(row)
        return self._persist_exit(ctx, row_id, row)

    def mark_backed_out(self, ctx: TenantContext, row_id: UUID, *, reason: str | None = None):
        row = self.get(ctx, row_id)
        self._engine.mark_backed_out(row, reason=reason)
        return self._persist_exit(ctx, row_id, row)

    def pipeline_stats(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        rows = self.list(ctx, company_id)
        by_stage: dict[str, int] = {}
        hired = 0
        backed_out = 0
        bg_pending = 0
        for row in rows:
            stage = row.current_stage_code or "sourced"
            status = row.status or ApplicationStatus.ACTIVE.value
            if status == ApplicationStatus.ACTIVE.value:
                by_stage[stage] = by_stage.get(stage, 0) + 1
                if stage == "background_check":
                    bg_pending += 1
            if status == ApplicationStatus.HIRED.value:
                hired += 1
            if status == ApplicationStatus.BACKED_OUT.value:
                backed_out += 1
        denom = hired + backed_out
        backout_rate = round((backed_out / denom) * 100, 1) if denom else 0.0
        return {
            "by_stage": by_stage,
            "background_checks_pending": bg_pending,
            "backed_out": backed_out,
            "hired": hired,
            "backout_rate": backout_rate,
        }
