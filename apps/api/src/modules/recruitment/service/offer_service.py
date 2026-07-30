"""Offer service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.recruitment.domain.enums import RecEntityType
from modules.recruitment.models import RecOffer
from modules.recruitment.repository.offer_repository import OfferRepository
from modules.recruitment.service.document_number_service import DocumentNumberService
from modules.recruitment.service.engines import OfferEngine
from modules.recruitment.service.recruitment_scope_validator import RecruitmentScopeValidator


class OfferService:
    def __init__(self, db: Session) -> None:
        self._repo = OfferRepository(db)
        self._scope = RecruitmentScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = OfferEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> RecOffer:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Offer not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(RecEntityType.OFFER, cid, RecOffer, "document_number")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Offer not found")
        return row

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.approve(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def send(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.send(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="rec_offer",
            entity_id=row_id,
            operation="send",
            performed_by=ctx.user_id,
        )
        return updated

    def accept(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.accept(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def reject(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.reject(row)
        return self._repo.update(ctx, row_id, status=row.status)
