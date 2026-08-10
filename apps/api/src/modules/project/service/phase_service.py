"""PhaseService application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.project.domain.enums import PrjEntityType
from modules.project.models import PrjProjectPhase
from modules.project.repository.project_phase_repository import ProjectPhaseRepository
from modules.project.service.document_number_service import DocumentNumberService
from modules.project.service.engines import ProjectPhaseEngine
from modules.project.service.project_scope_validator import ProjectScopeValidator


class PhaseService:
    def __init__(self, db: Session) -> None:
        self._repo = ProjectPhaseRepository(db)
        self._scope = ProjectScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = ProjectPhaseEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> PrjProjectPhase:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("PhaseService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        if not fields.get("phase_code"):
            fields["phase_code"] = self._numbers.generate(
                PrjEntityType.PROJECT_PHASE, cid, PrjProjectPhase, "phase_code"
            )

        row = self._repo.create(ctx, company_id=cid,  **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="prj_project_phase",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("PhaseService not found")
        return row
