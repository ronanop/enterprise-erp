"""PFMEA and PPAP services."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.quality.domain.enums import PlanStatus, PpapStatus, QmEntityType
from modules.quality.models import QmPfmea, QmPpap
from modules.quality.repository.inspection_plan_repository import InspectionPlanRepository
from modules.quality.repository.pfmea_repository import PfmeaRepository
from modules.quality.repository.ppap_repository import PpapRepository
from modules.quality.service.document_number_service import DocumentNumberService
from modules.quality.service.engines.pfmea_engine import PfmeaEngine
from modules.quality.service.engines.ppap_engine import PpapEngine
from modules.quality.service.qm_scope_validator import QmScopeValidator


class PfmeaService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = PfmeaRepository(db)
        self._plans = InspectionPlanRepository(db)
        self._numbers = DocumentNumberService(db)
        self._engine = PfmeaEngine()
        self._scope = QmScopeValidator(db)

    def list_pfmeas(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_pfmeas(ctx, cid)

    def get_pfmea(self, ctx: TenantContext, pfmea_id: UUID) -> QmPfmea:
        row = self._repo.get(ctx, pfmea_id)
        if row is None:
            raise NotFoundException("PFMEA not found")
        return row

    def create_pfmea(self, ctx: TenantContext, **fields) -> QmPfmea:
        lines = fields.pop("lines", []) or []
        company_id = fields["company_id"]
        self._scope.validate_company_access(ctx, company_id)
        plan = self._plans.get(ctx, fields["inspection_plan_id"])
        if plan is None:
            raise NotFoundException("Inspection plan not found")
        number = self._numbers.generate(
            QmEntityType.PFMEA,
            company_id,
            model=QmPfmea,
            code_column="pfmea_code",
        )
        row = self._repo.create(
            ctx,
            pfmea_code=number,
            status=fields.pop("status", PlanStatus.DRAFT.value),
            **fields,
        )
        for index, line in enumerate(lines, start=1):
            self._add_line(ctx, row, line, default_seq=index)
        return self.get_pfmea(ctx, row.id)

    def update_pfmea(self, ctx: TenantContext, pfmea_id: UUID, **fields) -> QmPfmea:
        pfmea = self.get_pfmea(ctx, pfmea_id)
        lines = fields.pop("lines", None)
        if pfmea.status != PlanStatus.DRAFT.value:
            fields = {k: v for k, v in fields.items() if k in {"notes", "revision", "process_name"}}
            lines = None
        if fields:
            self._repo.update(ctx, pfmea_id, **fields)
        if lines:
            next_seq = max((ln.sequence_no for ln in pfmea.lines), default=0) + 1
            for offset, line in enumerate(lines):
                self._add_line(ctx, pfmea, line, default_seq=next_seq + offset)
        return self.get_pfmea(ctx, pfmea_id)

    def _add_line(self, ctx: TenantContext, pfmea: QmPfmea, line: dict, default_seq: int) -> None:
        severity = int(line["severity"])
        occurrence = int(line["occurrence"])
        detection = int(line["detection"])
        rpn = self._engine.compute_rpn(severity, occurrence, detection)
        self._repo.add_line(
            ctx,
            pfmea,
            sequence_no=line.get("sequence_no") or default_seq,
            process_step=line.get("process_step"),
            failure_mode=line.get("failure_mode"),
            failure_effect=line.get("failure_effect"),
            failure_cause=line.get("failure_cause"),
            severity=severity,
            occurrence=occurrence,
            detection=detection,
            rpn=rpn,
            characteristic_id=line.get("characteristic_id"),
            recommended_action=line.get("recommended_action"),
            status=line.get("status") or "open",
        )


class PpapService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = PpapRepository(db)
        self._plans = InspectionPlanRepository(db)
        self._pfmeas = PfmeaRepository(db)
        self._numbers = DocumentNumberService(db)
        self._engine = PpapEngine()
        self._scope = QmScopeValidator(db)
        self._audit = AuditService(db)

    def list_ppaps(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_ppaps(ctx, cid)

    def get_ppap(self, ctx: TenantContext, ppap_id: UUID) -> QmPpap:
        row = self._repo.get(ctx, ppap_id)
        if row is None:
            raise NotFoundException("PPAP not found")
        return row

    def create_ppap(self, ctx: TenantContext, **fields) -> QmPpap:
        company_id = fields.pop("company_id")
        branch_id = self._scope.require_branch(ctx, fields.pop("branch_id", None))
        self._scope.validate_company_access(ctx, company_id)
        plan = self._plans.get(ctx, fields["inspection_plan_id"])
        if plan is None:
            raise NotFoundException("Inspection plan not found")
        pfmea_id = fields.get("pfmea_id")
        if pfmea_id is not None:
            pfmea = self._pfmeas.get(ctx, pfmea_id)
            if pfmea is None:
                raise NotFoundException("PFMEA not found")
        number = self._numbers.generate(
            QmEntityType.PPAP,
            company_id,
            model=QmPpap,
            code_column="document_number",
        )
        document_date = fields.pop("document_date", None) or date.today()
        return self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            document_number=number,
            document_date=document_date,
            status=PpapStatus.DRAFT.value,
            **fields,
        )

    def update_ppap(self, ctx: TenantContext, ppap_id: UUID, **fields) -> QmPpap:
        ppap = self.get_ppap(ctx, ppap_id)
        if ppap.status != PpapStatus.DRAFT.value:
            fields = {k: v for k, v in fields.items() if k in {"notes"}}
        row = self._repo.update(ctx, ppap_id, **fields)
        assert row is not None
        return row

    def submit(self, ctx: TenantContext, ppap_id: UUID) -> QmPpap:
        ppap = self.get_ppap(ctx, ppap_id)
        self._engine.apply_submit(ppap)
        self._repo.update(ctx, ppap_id, status=ppap.status, workflow_status="submitted")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="qm_ppap",
            entity_id=ppap_id,
            operation="submit",
            performed_by=ctx.user_id,
        )
        return self.get_ppap(ctx, ppap_id)

    def approve(self, ctx: TenantContext, ppap_id: UUID) -> QmPpap:
        ppap = self.get_ppap(ctx, ppap_id)
        self._engine.apply_approve(ppap)
        self._repo.update(ctx, ppap_id, status=ppap.status, workflow_status="approved")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="qm_ppap",
            entity_id=ppap_id,
            operation="approve",
            performed_by=ctx.user_id,
        )
        return self.get_ppap(ctx, ppap_id)

    def reject(self, ctx: TenantContext, ppap_id: UUID) -> QmPpap:
        ppap = self.get_ppap(ctx, ppap_id)
        self._engine.apply_reject(ppap)
        self._repo.update(ctx, ppap_id, status=ppap.status, workflow_status="rejected")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="qm_ppap",
            entity_id=ppap_id,
            operation="reject",
            performed_by=ctx.user_id,
        )
        return self.get_ppap(ctx, ppap_id)

    def interim(self, ctx: TenantContext, ppap_id: UUID) -> QmPpap:
        ppap = self.get_ppap(ctx, ppap_id)
        self._engine.apply_interim(ppap)
        self._repo.update(ctx, ppap_id, status=ppap.status, workflow_status="interim")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="qm_ppap",
            entity_id=ppap_id,
            operation="interim",
            performed_by=ctx.user_id,
        )
        return self.get_ppap(ctx, ppap_id)
