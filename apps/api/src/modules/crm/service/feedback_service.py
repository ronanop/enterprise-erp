"""Feedback and satisfaction services."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.crm.domain.enums import CrmEntityType
from modules.crm.models import CrmCustomerFeedback
from modules.crm.repository.customer_feedback_repository import CustomerFeedbackRepository
from modules.crm.repository.customer_satisfaction_repository import CustomerSatisfactionRepository
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import DocumentNumberService
from modules.crm.service.engines import CustomerSatisfactionEngine, FeedbackEngine
from modules.foundation.domain.value_objects import TenantContext


class FeedbackService:
    def __init__(self, db: Session) -> None:
        self._repo = CustomerFeedbackRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = FeedbackEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_feedback(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Feedback not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        code = self._numbers.generate(CrmEntityType.FEEDBACK, cid, CrmCustomerFeedback, "feedback_code")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, feedback_code=code, **fields)

    def close(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.close(row)
        return self._repo.update(ctx, row_id, status="closed")


class CustomerSatisfactionService:
    def __init__(self, db: Session) -> None:
        self._repo = CustomerSatisfactionRepository(db)
        self._scope = CrmScopeValidator(db)
        self._engine = CustomerSatisfactionEngine()

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_scores(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Satisfaction score not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.create(ctx, company_id=cid, **fields)

    def publish(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.publish(row)
        return self._repo.update(ctx, row_id, status="published")
