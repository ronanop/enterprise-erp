"""SPC reading capture and auto-NCR via NcrService."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.quality.domain.enums import QmEntityType
from modules.quality.models import QmSpcReading
from modules.quality.repository.characteristic_repository import CharacteristicRepository
from modules.quality.repository.spc_reading_repository import SpcReadingRepository
from modules.quality.service.document_number_service import DocumentNumberService
from modules.quality.service.engines.spc_engine import SpcCapability, SpcEngine
from modules.quality.service.ncr_capa_service import NcrService
from modules.quality.service.qm_scope_validator import QmScopeValidator


class SpcReadingService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = SpcReadingRepository(db)
        self._chars = CharacteristicRepository(db)
        self._numbers = DocumentNumberService(db)
        self._engine = SpcEngine()
        self._ncrs = NcrService(db)
        self._scope = QmScopeValidator(db)
        self._audit = AuditService(db)

    def list_readings(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        characteristic_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_readings(ctx, cid, characteristic_id)

    def get_reading(self, ctx: TenantContext, reading_id: UUID) -> QmSpcReading:
        row = self._repo.get(ctx, reading_id)
        if row is None:
            raise NotFoundException("SPC reading not found")
        return row

    def capability(
        self,
        ctx: TenantContext,
        characteristic_id: UUID,
        company_id: UUID | None = None,
    ) -> SpcCapability:
        cid = self._scope.resolve_company_id(ctx, company_id)
        char = self._chars.get(ctx, characteristic_id)
        if char is None:
            raise NotFoundException("Characteristic not found")
        window = self._repo.list_window(ctx, cid, characteristic_id)
        return self._engine.compute_capability(
            characteristic_id,
            [r.measured_value for r in window],
            min_value=char.min_value,
            max_value=char.max_value,
            target_value=char.target_value,
        )

    def create_reading(self, ctx: TenantContext, **fields) -> QmSpcReading:
        company_id = fields.pop("company_id")
        branch_id = self._scope.require_branch(ctx, fields.pop("branch_id", None))
        self._scope.validate_company_access(ctx, company_id)
        characteristic_id = fields["characteristic_id"]
        char = self._chars.get(ctx, characteristic_id)
        if char is None:
            raise NotFoundException("Characteristic not found")
        measured = Decimal(str(fields.pop("measured_value")))
        recorded_at = fields.pop("recorded_at", None) or datetime.now(timezone.utc)
        window = self._repo.list_window(ctx, company_id, characteristic_id)
        prior = [r.measured_value for r in window]
        evaluation = self._engine.evaluate_point(
            measured,
            min_value=char.min_value,
            max_value=char.max_value,
            target_value=char.target_value,
            prior_values=prior,
        )
        number = self._numbers.generate(
            QmEntityType.SPC_READING,
            company_id,
            model=QmSpcReading,
            code_column="document_number",
        )
        if not fields.get("inspection_plan_id") and char.inspection_plan_id:
            fields["inspection_plan_id"] = char.inspection_plan_id
        reading = self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            document_number=number,
            measured_value=measured,
            recorded_at=recorded_at,
            is_out_of_control=evaluation.is_out_of_control,
            **fields,
        )
        if evaluation.is_out_of_control:
            ncr = self._ncrs.create_ncr(
                ctx,
                **self._engine.build_auto_ncr_kwargs(
                    company_id=company_id,
                    branch_id=branch_id,
                    reading_id=reading.id,
                    measured_value=measured,
                    evaluation=evaluation,
                    product_id=reading.product_id,
                    inprocess_inspection_id=reading.inprocess_inspection_id,
                    incoming_inspection_id=reading.incoming_inspection_id,
                    final_inspection_id=reading.final_inspection_id,
                    characteristic_code=char.characteristic_code,
                ),
            )
            self._repo.update(ctx, reading.id, ncr_id=ncr.id)
            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name="qm_spc_reading",
                entity_id=reading.id,
                operation="auto_ncr",
                performed_by=ctx.user_id,
            )
            reading = self.get_reading(ctx, reading.id)
        return reading
