"""Offer service."""

import base64
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException, ValidationException
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.recruitment.domain.enums import RecEntityType
from modules.recruitment.models import RecOffer
from modules.recruitment.repository.offer_repository import OfferRepository
from modules.recruitment.service.document_number_service import DocumentNumberService
from modules.recruitment.service.engines import OfferEngine
from modules.recruitment.service.offer_template_storage import store_offer_pdf
from modules.recruitment.service.recruitment_scope_validator import RecruitmentScopeValidator


def _persist_offer_letter_uri(tenant_id: UUID, offer_id: UUID, uri: str | None) -> str | None:
    value = (uri or "").strip()
    if not value:
        return None
    if value.startswith("s3://") or value.startswith("minio://") or value.startswith("file:"):
        return value
    if not value.startswith("data:"):
        return value
    comma = value.find(",")
    if comma < 0:
        raise ValidationException("Invalid offer letter data URL")
    try:
        raw = base64.b64decode(value[comma + 1 :], validate=False)
    except Exception as exc:  # noqa: BLE001
        raise ValidationException("Could not decode offer letter PDF") from exc
    return store_offer_pdf(
        tenant_id=tenant_id,
        offer_id=str(offer_id),
        file_name="offer-letter.pdf",
        data=raw,
    )


class OfferService:
    def __init__(self, db: Session) -> None:
        self._repo = OfferRepository(db)
        self._scope = RecruitmentScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = OfferEngine()
        self._audit = PlatformAuditFacade(db)

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
        pending_letter = fields.pop("offer_letter_uri", None)
        row = self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)
        if pending_letter:
            stored = _persist_offer_letter_uri(ctx.tenant_id, row.id, pending_letter)
            if stored:
                row = self._repo.update(ctx, row.id, offer_letter_uri=stored) or row
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        if "offer_letter_uri" in fields:
            fields["offer_letter_uri"] = _persist_offer_letter_uri(
                ctx.tenant_id,
                row_id,
                fields.get("offer_letter_uri"),
            )
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
