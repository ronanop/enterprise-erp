"""Performance review / goals / appraisal services."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.hr.adapters.master_data_port import HrMasterDataAdapter
from modules.hr.domain.enums import HrEntityType
from modules.hr.models import HrPerformanceReview
from modules.hr.repository.appraisal_repository import AppraisalRepository
from modules.hr.repository.goal_repository import GoalRepository
from modules.hr.repository.performance_review_repository import PerformanceReviewRepository
from modules.hr.service.document_number_service import DocumentNumberService
from modules.hr.service.engines import AppraisalEngine, GoalEngine, PerformanceReviewEngine
from modules.hr.service.hr_scope_validator import HrScopeValidator


class PerformanceService:
    def __init__(self, db: Session) -> None:
        self._repo = PerformanceReviewRepository(db)
        self._scope = HrScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = PerformanceReviewEngine()
        self._master = HrMasterDataAdapter(db)
        self._audit = PlatformAuditFacade(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Performance review not found")
        return row

    def create(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        employee_id: UUID,
        reviewer_employee_id: UUID,
        company_id: UUID | None = None,
        **fields,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._master.get_employee(ctx, employee_id)
        self._master.get_employee(ctx, reviewer_employee_id)
        doc = self._numbers.generate(
            HrEntityType.PERFORMANCE_REVIEW, cid, HrPerformanceReview, "document_number"
        )
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            employee_id=employee_id,
            reviewer_employee_id=reviewer_employee_id,
            document_number=doc,
            **fields,
        )

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.approve(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="hr_performance_review",
            entity_id=row_id,
            operation="approve",
            performed_by=ctx.user_id,
        )
        return updated


class GoalService:
    def __init__(self, db: Session) -> None:
        self._repo = GoalRepository(db)
        self._reviews = PerformanceReviewRepository(db)
        self._scope = HrScopeValidator(db)
        self._engine = GoalEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def create(self, ctx: TenantContext, *, performance_review_id: UUID, company_id: UUID | None = None, **fields):
        review = self._reviews.get(ctx, performance_review_id)
        if review is None:
            raise NotFoundException("Performance review not found")
        cid = self._scope.resolve_company_id(ctx, company_id or review.company_id)
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=review.branch_id,
            performance_review_id=performance_review_id,
            employee_id=fields.pop("employee_id", review.employee_id),
            **fields,
        )


class AppraisalService:
    def __init__(self, db: Session) -> None:
        self._repo = AppraisalRepository(db)
        self._reviews = PerformanceReviewRepository(db)
        self._scope = HrScopeValidator(db)
        self._engine = AppraisalEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def create(self, ctx: TenantContext, *, performance_review_id: UUID, company_id: UUID | None = None, **fields):
        review = self._reviews.get(ctx, performance_review_id)
        if review is None:
            raise NotFoundException("Performance review not found")
        cid = self._scope.resolve_company_id(ctx, company_id or review.company_id)
        return self._repo.create(
            ctx,
            company_id=cid,
            branch_id=review.branch_id,
            performance_review_id=performance_review_id,
            employee_id=fields.pop("employee_id", review.employee_id),
            **fields,
        )

    def finalize(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Appraisal not found")
        self._engine.finalize(row)
        return self._repo.update(ctx, row_id, status=row.status)
