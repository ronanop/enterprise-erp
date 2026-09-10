"""SCAR service — independent entity; optional FK to existing NCR/CAPA only."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.quality.domain.enums import QmEntityType, ScarStatus
from modules.quality.models import QmScar
from modules.quality.repository.capa_repository import CapaRepository
from modules.quality.repository.ncr_repository import NcrRepository
from modules.quality.repository.scar_repository import ScarRepository
from modules.quality.service.document_number_service import DocumentNumberService
from modules.quality.service.engines.scar_engine import ScarEngine
from modules.quality.service.qm_scope_validator import QmScopeValidator


class ScarService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = ScarRepository(db)
        self._ncrs = NcrRepository(db)
        self._capas = CapaRepository(db)
        self._numbers = DocumentNumberService(db)
        self._engine = ScarEngine()
        self._scope = QmScopeValidator(db)
        self._audit = AuditService(db)

    def list_scars(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        vendor_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_scars(ctx, cid, vendor_id)

    def get_scar(self, ctx: TenantContext, scar_id: UUID) -> QmScar:
        row = self._repo.get(ctx, scar_id)
        if row is None:
            raise NotFoundException("SCAR not found")
        return row

    def create_scar(self, ctx: TenantContext, **fields) -> QmScar:
        company_id = fields.pop("company_id")
        branch_id = self._scope.require_branch(ctx, fields.pop("branch_id", None))
        self._scope.validate_company_access(ctx, company_id)
        self._require_optional_ncr(ctx, fields.get("ncr_id"))
        self._require_optional_capa(ctx, fields.get("capa_id"))
        number = self._numbers.generate(
            QmEntityType.SCAR,
            company_id,
            model=QmScar,
            code_column="document_number",
        )
        document_date = fields.pop("document_date", None) or date.today()
        return self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            document_number=number,
            document_date=document_date,
            status=ScarStatus.DRAFT.value,
            **fields,
        )

    def update_scar(self, ctx: TenantContext, scar_id: UUID, **fields) -> QmScar:
        scar = self.get_scar(ctx, scar_id)
        if scar.status != ScarStatus.DRAFT.value:
            fields = {k: v for k, v in fields.items() if k in {"description"}}
        self._require_optional_ncr(ctx, fields.get("ncr_id"))
        self._require_optional_capa(ctx, fields.get("capa_id"))
        row = self._repo.update(ctx, scar_id, **fields)
        assert row is not None
        return row

    def issue(self, ctx: TenantContext, scar_id: UUID) -> QmScar:
        scar = self.get_scar(ctx, scar_id)
        self._engine.apply_issue(scar)
        self._repo.update(ctx, scar_id, status=scar.status, workflow_status="issued")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="qm_scar",
            entity_id=scar_id,
            operation="issue",
            performed_by=ctx.user_id,
        )
        return self.get_scar(ctx, scar_id)

    def record_response(self, ctx: TenantContext, scar_id: UUID, supplier_response: str) -> QmScar:
        scar = self.get_scar(ctx, scar_id)
        self._engine.apply_record_response(scar, supplier_response)
        self._repo.update(
            ctx,
            scar_id,
            status=scar.status,
            supplier_response=scar.supplier_response,
            workflow_status="responded",
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="qm_scar",
            entity_id=scar_id,
            operation="record_response",
            performed_by=ctx.user_id,
        )
        return self.get_scar(ctx, scar_id)

    def verify(self, ctx: TenantContext, scar_id: UUID) -> QmScar:
        scar = self.get_scar(ctx, scar_id)
        self._engine.apply_verify(scar)
        self._repo.update(ctx, scar_id, status=scar.status, workflow_status="verified")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="qm_scar",
            entity_id=scar_id,
            operation="verify",
            performed_by=ctx.user_id,
        )
        return self.get_scar(ctx, scar_id)

    def close(self, ctx: TenantContext, scar_id: UUID) -> QmScar:
        scar = self.get_scar(ctx, scar_id)
        self._engine.apply_close(scar)
        self._repo.update(ctx, scar_id, status=scar.status, workflow_status="closed")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="qm_scar",
            entity_id=scar_id,
            operation="close",
            performed_by=ctx.user_id,
        )
        return self.get_scar(ctx, scar_id)

    def _require_optional_ncr(self, ctx: TenantContext, ncr_id: UUID | None) -> None:
        if ncr_id is None:
            return
        if self._ncrs.get(ctx, ncr_id) is None:
            raise NotFoundException("NCR not found")

    def _require_optional_capa(self, ctx: TenantContext, capa_id: UUID | None) -> None:
        if capa_id is None:
            return
        if self._capas.get(ctx, capa_id) is None:
            raise NotFoundException("CAPA not found")
