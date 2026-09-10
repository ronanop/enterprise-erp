"""VIN trace capture with nested as-built component lines."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException, ValidationException
from modules.foundation.domain.value_objects import TenantContext
from modules.quality.domain.enums import QmEntityType, VinTraceStatus
from modules.quality.models import QmVinTrace
from modules.quality.repository.final_inspection_repository import FinalInspectionRepository
from modules.quality.repository.vin_trace_repository import VinTraceRepository
from modules.quality.service.document_number_service import DocumentNumberService
from modules.quality.service.engines.vin_trace_engine import VinTraceEngine
from modules.quality.service.qm_scope_validator import QmScopeValidator


class VinTraceService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = VinTraceRepository(db)
        self._finals = FinalInspectionRepository(db)
        self._numbers = DocumentNumberService(db)
        self._engine = VinTraceEngine()
        self._scope = QmScopeValidator(db)

    def list_traces(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        product_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_traces(ctx, cid, product_id)

    def get_trace(self, ctx: TenantContext, trace_id: UUID) -> QmVinTrace:
        row = self._repo.get(ctx, trace_id)
        if row is None:
            raise NotFoundException("VIN trace not found")
        return row

    def create_trace(self, ctx: TenantContext, **fields) -> QmVinTrace:
        components = fields.pop("components", None) or fields.pop("lines", None) or []
        company_id = fields.pop("company_id")
        branch_id = self._scope.require_branch(ctx, fields.pop("branch_id", None))
        self._scope.validate_company_access(ctx, company_id)
        vin = str(fields.pop("vin")).strip().upper()
        if self._repo.get_by_vin(ctx, company_id, vin) is not None:
            raise ConflictException("VIN already exists for this company")
        final_inspection_id = fields.get("final_inspection_id")
        if final_inspection_id is not None and self._finals.get(ctx, final_inspection_id) is None:
            raise NotFoundException("Final inspection not found")
        status = fields.pop("status", None) or (
            VinTraceStatus.INSPECTED.value
            if final_inspection_id is not None
            else VinTraceStatus.BUILT.value
        )
        number = self._numbers.generate(
            QmEntityType.VIN_TRACE,
            company_id,
            model=QmVinTrace,
            code_column="document_number",
        )
        document_date = fields.pop("document_date", None) or date.today()
        header = self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            document_number=number,
            document_date=document_date,
            vin=vin,
            status=status,
            **fields,
        )
        for index, raw in enumerate(components, start=1):
            self._add_component(ctx, header, raw, default_line=index)
        return self.get_trace(ctx, header.id)

    def update_trace(self, ctx: TenantContext, trace_id: UUID, **fields) -> QmVinTrace:
        trace = self.get_trace(ctx, trace_id)
        components = fields.pop("components", None)
        if components is None:
            components = fields.pop("lines", None)
        new_status = fields.get("status")
        if new_status is not None:
            self._engine.apply_status(trace, new_status)
            fields["status"] = trace.status
        final_inspection_id = fields.get("final_inspection_id")
        if final_inspection_id is not None and self._finals.get(ctx, final_inspection_id) is None:
            raise NotFoundException("Final inspection not found")
        if trace.status == VinTraceStatus.SHIPPED.value:
            fields = {k: v for k, v in fields.items() if k in {"status"}}
            components = None
        if fields:
            self._repo.update(ctx, trace_id, **fields)
        if components:
            existing = [ln for ln in (trace.components or []) if not getattr(ln, "is_deleted", False)]
            next_no = max((int(ln.line_number) for ln in existing), default=0) + 1
            for offset, raw in enumerate(components):
                self._add_component(ctx, trace, raw, default_line=next_no + offset)
        return self.get_trace(ctx, trace_id)

    def _add_component(
        self, ctx: TenantContext, trace: QmVinTrace, raw: dict, default_line: int
    ) -> None:
        qty = Decimal(str(raw.get("quantity", 0)))
        if qty < 0:
            raise ValidationException("Component quantity cannot be negative")
        self._repo.add_component(
            ctx,
            trace,
            line_number=int(raw.get("line_number") or default_line),
            product_id=raw["product_id"],
            batch_id=raw.get("batch_id"),
            quantity=qty,
            source_module=raw.get("source_module"),
            source_document_type=raw.get("source_document_type"),
            source_document_id=raw.get("source_document_id"),
        )
