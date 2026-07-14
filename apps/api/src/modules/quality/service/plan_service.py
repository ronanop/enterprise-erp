"""Quality plan and master data services."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.quality.domain.enums import ActiveInactive, PlanStatus, QmEntityType
from modules.quality.models import (
    QmDefectType,
    QmInspectionPlan,
    QmQualityCharacteristic,
    QmSamplingPlan,
)
from modules.quality.repository.characteristic_repository import CharacteristicRepository
from modules.quality.repository.defect_type_repository import DefectTypeRepository
from modules.quality.repository.inspection_plan_repository import InspectionPlanRepository
from modules.quality.repository.sampling_plan_repository import SamplingPlanRepository
from modules.quality.service.document_number_service import DocumentNumberService
from modules.quality.service.engines import InspectionPlanEngine
from modules.quality.service.qm_scope_validator import QmScopeValidator


class SamplingPlanService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = SamplingPlanRepository(db)
        self._scope = QmScopeValidator(db)

    def list_plans(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_plans(ctx, cid)

    def get_plan(self, ctx: TenantContext, plan_id: UUID) -> QmSamplingPlan:
        row = self._repo.get(ctx, plan_id)
        if row is None:
            raise NotFoundException("Sampling plan not found")
        return row

    def create_plan(self, ctx: TenantContext, **fields) -> QmSamplingPlan:
        company_id = fields["company_id"]
        self._scope.validate_company_access(ctx, company_id)
        if "sample_size" in fields:
            fields["sample_size"] = Decimal(str(fields["sample_size"]))
        for key in ("lot_size_from", "lot_size_to", "aql_percent"):
            if fields.get(key) is not None:
                fields[key] = Decimal(str(fields[key]))
        code = fields.pop("sampling_code", None) or f"SMP-{date.today().year}"
        return self._repo.create(
            ctx,
            sampling_code=code,
            status=fields.pop("status", ActiveInactive.ACTIVE.value),
            **fields,
        )

    def update_plan(self, ctx: TenantContext, plan_id: UUID, **fields) -> QmSamplingPlan:
        self.get_plan(ctx, plan_id)
        for key in ("sample_size", "lot_size_from", "lot_size_to", "aql_percent"):
            if fields.get(key) is not None:
                fields[key] = Decimal(str(fields[key]))
        row = self._repo.update(ctx, plan_id, **fields)
        assert row is not None
        return row


class InspectionPlanService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = InspectionPlanRepository(db)
        self._numbers = DocumentNumberService(db)
        self._engine = InspectionPlanEngine()
        self._scope = QmScopeValidator(db)
        self._audit = AuditService(db)

    def list_plans(
        self, ctx: TenantContext, company_id: UUID | None = None, inspection_type: str | None = None
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_plans(ctx, cid, inspection_type)

    def get_plan(self, ctx: TenantContext, plan_id: UUID) -> QmInspectionPlan:
        row = self._repo.get(ctx, plan_id)
        if row is None:
            raise NotFoundException("Inspection plan not found")
        return row

    def create_plan(self, ctx: TenantContext, **fields) -> QmInspectionPlan:
        company_id = fields["company_id"]
        self._scope.validate_company_access(ctx, company_id)
        number = self._numbers.generate(
            QmEntityType.INSPECTION_PLAN,
            company_id,
            model=QmInspectionPlan,
            code_column="plan_code",
        )
        return self._repo.create(
            ctx,
            plan_code=number,
            status=PlanStatus.DRAFT.value,
            **fields,
        )

    def update_plan(self, ctx: TenantContext, plan_id: UUID, **fields) -> QmInspectionPlan:
        plan = self.get_plan(ctx, plan_id)
        if plan.status != PlanStatus.DRAFT.value:
            fields = {k: v for k, v in fields.items() if k in {"notes", "sampling_plan_id"}}
        row = self._repo.update(ctx, plan_id, **fields)
        assert row is not None
        return self.get_plan(ctx, plan_id)

    def activate(self, ctx: TenantContext, plan_id: UUID) -> QmInspectionPlan:
        plan = self.get_plan(ctx, plan_id)
        self._engine.validate_activatable(plan)
        self._repo.update(ctx, plan_id, status=PlanStatus.ACTIVE.value)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="qm_inspection_plan",
            entity_id=plan_id,
            operation="activate",
            performed_by=ctx.user_id,
        )
        return self.get_plan(ctx, plan_id)


class CharacteristicService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = CharacteristicRepository(db)
        self._scope = QmScopeValidator(db)

    def list_characteristics(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        inspection_plan_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_characteristics(ctx, cid, inspection_plan_id)

    def get_characteristic(self, ctx: TenantContext, characteristic_id: UUID) -> QmQualityCharacteristic:
        row = self._repo.get(ctx, characteristic_id)
        if row is None:
            raise NotFoundException("Characteristic not found")
        return row

    def create_characteristic(self, ctx: TenantContext, **fields) -> QmQualityCharacteristic:
        company_id = fields["company_id"]
        self._scope.validate_company_access(ctx, company_id)
        for key in ("target_value", "min_value", "max_value"):
            if fields.get(key) is not None:
                fields[key] = Decimal(str(fields[key]))
        code = fields.pop("characteristic_code", None) or f"CHR-{fields.get('characteristic_name', 'X')[:20]}"
        return self._repo.create(
            ctx,
            characteristic_code=code,
            status=fields.pop("status", ActiveInactive.ACTIVE.value),
            **fields,
        )

    def update_characteristic(
        self, ctx: TenantContext, characteristic_id: UUID, **fields
    ) -> QmQualityCharacteristic:
        self.get_characteristic(ctx, characteristic_id)
        for key in ("target_value", "min_value", "max_value"):
            if fields.get(key) is not None:
                fields[key] = Decimal(str(fields[key]))
        row = self._repo.update(ctx, characteristic_id, **fields)
        assert row is not None
        return row


class DefectTypeService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = DefectTypeRepository(db)
        self._scope = QmScopeValidator(db)

    def list_types(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_types(ctx, cid)

    def get_type(self, ctx: TenantContext, defect_type_id: UUID) -> QmDefectType:
        row = self._repo.get(ctx, defect_type_id)
        if row is None:
            raise NotFoundException("Defect type not found")
        return row

    def create_type(self, ctx: TenantContext, **fields) -> QmDefectType:
        company_id = fields["company_id"]
        self._scope.validate_company_access(ctx, company_id)
        code = fields.pop("defect_type_code", None) or f"DFT-{fields.get('defect_type_name', 'X')[:20]}"
        return self._repo.create(
            ctx,
            defect_type_code=code,
            status=fields.pop("status", ActiveInactive.ACTIVE.value),
            **fields,
        )

    def update_type(self, ctx: TenantContext, defect_type_id: UUID, **fields) -> QmDefectType:
        self.get_type(ctx, defect_type_id)
        row = self._repo.update(ctx, defect_type_id, **fields)
        assert row is not None
        return row
