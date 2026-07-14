"""Quality defect, NCR, and CAPA services."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.quality.domain.enums import (
    SOURCE_MODULE,
    CapaStatus,
    DefectStatus,
    NcrStatus,
    QmEntityType,
)
from modules.quality.models import QmCapa, QmDefect, QmNcr
from modules.quality.repository.capa_repository import CapaRepository
from modules.quality.repository.defect_repository import DefectRepository
from modules.quality.repository.ncr_repository import NcrRepository
from modules.quality.service.document_number_service import DocumentNumberService
from modules.quality.service.engines import CapaEngine, DefectEngine, NcrEngine
from modules.quality.service.qm_scope_validator import QmScopeValidator


class DefectService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = DefectRepository(db)
        self._numbers = DocumentNumberService(db)
        self._engine = DefectEngine()
        self._scope = QmScopeValidator(db)

    def list_defects(
        self, ctx: TenantContext, company_id: UUID | None = None, ncr_id: UUID | None = None
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_defects(ctx, cid, ncr_id)

    def get_defect(self, ctx: TenantContext, defect_id: UUID) -> QmDefect:
        row = self._repo.get(ctx, defect_id)
        if row is None:
            raise NotFoundException("Defect not found")
        return row

    def create_defect(self, ctx: TenantContext, **fields) -> QmDefect:
        company_id = fields["company_id"]
        branch_id = self._scope.require_branch(ctx, fields.get("branch_id"))
        self._scope.validate_company_access(ctx, company_id)
        number = self._numbers.generate(
            QmEntityType.DEFECT,
            company_id,
            model=QmDefect,
            code_column="document_number",
        )
        if fields.get("quantity") is not None:
            fields["quantity"] = Decimal(str(fields["quantity"]))
        return self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            document_number=number,
            status=DefectStatus.OPEN.value,
            **fields,
        )

    def update_defect(self, ctx: TenantContext, defect_id: UUID, **fields) -> QmDefect:
        self.get_defect(ctx, defect_id)
        if fields.get("quantity") is not None:
            fields["quantity"] = Decimal(str(fields["quantity"]))
        row = self._repo.update(ctx, defect_id, **fields)
        assert row is not None
        return row

    def link_to_ncr(self, ctx: TenantContext, defect_id: UUID, ncr_id: UUID) -> QmDefect:
        defect = self.get_defect(ctx, defect_id)
        self._engine.validate_linkable_to_ncr(defect)
        self._repo.update(
            ctx,
            defect_id,
            ncr_id=ncr_id,
            status=DefectStatus.LINKED_TO_NCR.value,
        )
        return self.get_defect(ctx, defect_id)


class NcrService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = NcrRepository(db)
        self._numbers = DocumentNumberService(db)
        self._engine = NcrEngine()
        self._scope = QmScopeValidator(db)
        self._audit = AuditService(db)

    def list_ncrs(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_ncrs(ctx, cid)

    def get_ncr(self, ctx: TenantContext, ncr_id: UUID) -> QmNcr:
        row = self._repo.get(ctx, ncr_id)
        if row is None:
            raise NotFoundException("NCR not found")
        return row

    def create_ncr(self, ctx: TenantContext, **fields) -> QmNcr:
        company_id = fields["company_id"]
        branch_id = self._scope.require_branch(ctx, fields.get("branch_id"))
        self._scope.validate_company_access(ctx, company_id)
        number = self._numbers.generate(
            QmEntityType.NCR,
            company_id,
            model=QmNcr,
            code_column="document_number",
        )
        return self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            document_number=number,
            document_date=fields.pop("document_date", date.today()),
            status=NcrStatus.DRAFT.value,
            source_module=SOURCE_MODULE,
            **fields,
        )

    def update_ncr(self, ctx: TenantContext, ncr_id: UUID, **fields) -> QmNcr:
        ncr = self.get_ncr(ctx, ncr_id)
        if ncr.status != NcrStatus.DRAFT.value:
            fields = {k: v for k, v in fields.items() if k in {"description"}}
        row = self._repo.update(ctx, ncr_id, **fields)
        assert row is not None
        return row

    def submit(self, ctx: TenantContext, ncr_id: UUID) -> QmNcr:
        ncr = self.get_ncr(ctx, ncr_id)
        self._engine.apply_submit(ncr)
        self._repo.update(ctx, ncr_id, status=ncr.status)
        return self.get_ncr(ctx, ncr_id)

    def approve(self, ctx: TenantContext, ncr_id: UUID) -> QmNcr:
        ncr = self.get_ncr(ctx, ncr_id)
        self._engine.apply_approve(ncr)
        self._repo.update(ctx, ncr_id, status=ncr.status, workflow_status="approved")
        return self.get_ncr(ctx, ncr_id)

    def close(self, ctx: TenantContext, ncr_id: UUID) -> QmNcr:
        ncr = self.get_ncr(ctx, ncr_id)
        self._engine.apply_close(ncr)
        self._repo.update(ctx, ncr_id, status=ncr.status)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="qm_ncr",
            entity_id=ncr_id,
            operation="close",
            performed_by=ctx.user_id,
        )
        return self.get_ncr(ctx, ncr_id)


class CapaService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = CapaRepository(db)
        self._numbers = DocumentNumberService(db)
        self._engine = CapaEngine()
        self._scope = QmScopeValidator(db)

    def list_capas(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_capas(ctx, cid)

    def get_capa(self, ctx: TenantContext, capa_id: UUID) -> QmCapa:
        row = self._repo.get(ctx, capa_id)
        if row is None:
            raise NotFoundException("CAPA not found")
        return row

    def create_capa(
        self,
        ctx: TenantContext,
        *,
        root_causes: list[dict] | None = None,
        corrective_actions: list[dict] | None = None,
        preventive_actions: list[dict] | None = None,
        **fields,
    ) -> QmCapa:
        company_id = fields["company_id"]
        branch_id = self._scope.require_branch(ctx, fields.get("branch_id"))
        self._scope.validate_company_access(ctx, company_id)
        number = self._numbers.generate(
            QmEntityType.CAPA,
            company_id,
            model=QmCapa,
            code_column="document_number",
        )
        capa = self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            document_number=number,
            document_date=fields.pop("document_date", date.today()),
            status=CapaStatus.DRAFT.value,
            **fields,
        )
        for i, rc in enumerate(root_causes or [], start=1):
            self._repo.add_root_cause(
                ctx,
                capa,
                sequence_no=rc.get("sequence_no", i),
                method=rc.get("method", "5_why"),
                cause_text=rc["cause_text"],
                status=rc.get("status", "open"),
            )
        for i, ca in enumerate(corrective_actions or [], start=1):
            self._repo.add_corrective(
                ctx,
                capa,
                sequence_no=ca.get("sequence_no", i),
                action_text=ca["action_text"],
                owner_employee_id=ca.get("owner_employee_id"),
                due_date=ca.get("due_date"),
                status=ca.get("status", "open"),
            )
        for i, pa in enumerate(preventive_actions or [], start=1):
            self._repo.add_preventive(
                ctx,
                capa,
                sequence_no=pa.get("sequence_no", i),
                action_text=pa["action_text"],
                owner_employee_id=pa.get("owner_employee_id"),
                due_date=pa.get("due_date"),
                status=pa.get("status", "open"),
            )
        return self.get_capa(ctx, capa.id)

    def update_capa(self, ctx: TenantContext, capa_id: UUID, **fields) -> QmCapa:
        capa = self.get_capa(ctx, capa_id)
        if capa.status != CapaStatus.DRAFT.value:
            fields = {k: v for k, v in fields.items() if k in {"notes", "due_date", "owner_employee_id"}}
        row = self._repo.update(ctx, capa_id, **fields)
        assert row is not None
        return self.get_capa(ctx, capa_id)

    def submit(self, ctx: TenantContext, capa_id: UUID) -> QmCapa:
        capa = self.get_capa(ctx, capa_id)
        self._engine.apply_submit(capa)
        self._repo.update(ctx, capa_id, status=capa.status)
        return self.get_capa(ctx, capa_id)

    def approve(self, ctx: TenantContext, capa_id: UUID) -> QmCapa:
        capa = self.get_capa(ctx, capa_id)
        self._engine.apply_approve(capa)
        self._repo.update(ctx, capa_id, status=capa.status, workflow_status="approved")
        return self.get_capa(ctx, capa_id)

    def verify(self, ctx: TenantContext, capa_id: UUID) -> QmCapa:
        capa = self.get_capa(ctx, capa_id)
        self._engine.apply_verify(capa)
        self._repo.update(ctx, capa_id, status=capa.status, verified_at=capa.verified_at)
        return self.get_capa(ctx, capa_id)

    def close(self, ctx: TenantContext, capa_id: UUID) -> QmCapa:
        capa = self.get_capa(ctx, capa_id)
        self._engine.apply_close(capa)
        self._repo.update(ctx, capa_id, status=capa.status)
        return self.get_capa(ctx, capa_id)
