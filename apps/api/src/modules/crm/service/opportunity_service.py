"""Opportunity and pipeline services."""

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.crm.domain.enums import CrmEntityType, OpportunityStatus
from modules.crm.models import CrmOpportunity, CrmPipeline
from modules.crm.repository.opportunity_repository import OpportunityRepository
from modules.crm.repository.opportunity_stage_repository import OpportunityStageRepository
from modules.crm.repository.pipeline_repository import PipelineRepository
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import DocumentNumberService
from modules.crm.service.engines import OpportunityEngine, OpportunityStageEngine, PipelineEngine
from modules.crm.service.integration_service import CRMIntegrationService
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class PipelineService:
    def __init__(self, db: Session) -> None:
        self._repo = PipelineRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = PipelineEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_pipelines(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Pipeline not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        if "pipeline_code" not in fields:
            fields["pipeline_code"] = self._numbers.generate(
                CrmEntityType.PIPELINE, cid, CrmPipeline, "pipeline_code"
            )
        return self._repo.create(ctx, company_id=cid, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Pipeline not found")
        return row


class OpportunityService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = OpportunityRepository(db)
        self._stages = OpportunityStageRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = OpportunityEngine()
        self._stage_engine = OpportunityStageEngine()
        self._integration = CRMIntegrationService(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_opportunities(ctx, cid)

    def get(self, ctx: TenantContext, opportunity_id: UUID) -> CrmOpportunity:
        row = self._repo.get(ctx, opportunity_id)
        if row is None:
            raise NotFoundException("Opportunity not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        code = self._numbers.generate(CrmEntityType.OPPORTUNITY, cid, CrmOpportunity, "opportunity_code")
        fields.setdefault("document_date", date.today())
        fields.setdefault("status", OpportunityStatus.OPEN.value)
        fields.setdefault("current_stage", "qualification")
        revenue = Decimal(str(fields.get("expected_revenue", 0)))
        prob = Decimal(str(fields.get("probability_percent", 0)))
        fields["forecast_amount"] = (revenue * prob / Decimal("100")).quantize(Decimal("0.0001"))
        row = self._repo.create(
            ctx, company_id=cid, branch_id=branch_id, opportunity_code=code, **fields
        )
        self._stages.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            opportunity_id=row.id,
            sequence_no=1,
            stage_code=row.current_stage,
            stage_name=row.current_stage.title(),
            entered_at=datetime.now(timezone.utc),
            probability_percent=prob,
            changed_by_employee_id=row.owner_employee_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="crm_opportunity",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, opportunity_id: UUID, **fields):
        opp = self.get(ctx, opportunity_id)
        if "current_stage" in fields and fields["current_stage"] != opp.current_stage:
            self._stage_engine.validate_transition(opp.current_stage, fields["current_stage"])
            seq = len([s for s in self._stages.list_stages(ctx, opp.company_id) if s.opportunity_id == opportunity_id]) + 1
            self._stages.create(
                ctx,
                company_id=opp.company_id,
                branch_id=opp.branch_id,
                opportunity_id=opportunity_id,
                sequence_no=seq,
                stage_code=fields["current_stage"],
                stage_name=str(fields["current_stage"]).title(),
                entered_at=datetime.now(timezone.utc),
                probability_percent=fields.get("probability_percent", opp.probability_percent),
                changed_by_employee_id=opp.owner_employee_id,
            )
        if "expected_revenue" in fields or "probability_percent" in fields:
            revenue = Decimal(str(fields.get("expected_revenue", opp.expected_revenue)))
            prob = Decimal(str(fields.get("probability_percent", opp.probability_percent)))
            fields["forecast_amount"] = (revenue * prob / Decimal("100")).quantize(Decimal("0.0001"))
        row = self._repo.update(ctx, opportunity_id, **fields)
        if row is None:
            raise NotFoundException("Opportunity not found")
        return row

    def close_won(self, ctx: TenantContext, opportunity_id: UUID, *, create_quotation: bool = True, currency_code: str = "USD"):
        opp = self.get(ctx, opportunity_id)
        if opp.blueprint_state and opp.blueprint_state not in {"won", "lost"}:
            raise ConflictException(
                "This opportunity is on the sales blueprint. Mark Deal Won from the "
                "OVF after Share to SCM — do not use legacy close-won."
            )
        self._engine.apply_win(opp)
        now = datetime.now(timezone.utc)
        self._repo.update(
            ctx,
            opportunity_id,
            status=OpportunityStatus.WON.value,
            current_stage="won",
            probability_percent=100,
            forecast_amount=opp.expected_revenue,
            won_at=now,
        )
        quotation = None
        if create_quotation and opp.customer_id is not None:
            quotation = self._integration.create_quotation_on_win(
                ctx, opportunity_id, currency_code=currency_code
            )
        return self.get(ctx, opportunity_id), quotation

    def close_lost(self, ctx: TenantContext, opportunity_id: UUID, *, lost_reason: str | None = None):
        opp = self.get(ctx, opportunity_id)
        if opp.blueprint_state and opp.blueprint_state not in {"won", "lost"}:
            raise ConflictException(
                "This opportunity is on the sales blueprint. Use Mark Lost from the "
                "blueprint actions instead of legacy close-lost."
            )
        self._engine.apply_loss(opp)
        return self._repo.update(
            ctx,
            opportunity_id,
            status=OpportunityStatus.LOST.value,
            current_stage="lost",
            probability_percent=0,
            forecast_amount=0,
            lost_at=datetime.now(timezone.utc),
            lost_reason=lost_reason,
        )


class OpportunityStageService:
    def __init__(self, db: Session) -> None:
        self._repo = OpportunityStageRepository(db)
        self._scope = CrmScopeValidator(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_stages(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Opportunity stage not found")
        return row
