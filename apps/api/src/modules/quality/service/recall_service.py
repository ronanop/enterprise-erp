"""Recall campaigns — VIN range scope; CAPA/NCR/warranty referenced only."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.quality.domain.enums import QmEntityType, RecallStatus
from modules.quality.models import QmRecall
from modules.quality.repository.capa_repository import CapaRepository
from modules.quality.repository.ncr_repository import NcrRepository
from modules.quality.repository.recall_repository import RecallRepository
from modules.quality.repository.warranty_claim_repository import WarrantyClaimRepository
from modules.quality.service.document_number_service import DocumentNumberService
from modules.quality.service.engines.recall_engine import RecallEngine
from modules.quality.service.qm_scope_validator import QmScopeValidator


class RecallService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = RecallRepository(db)
        self._ncrs = NcrRepository(db)
        self._capas = CapaRepository(db)
        self._claims = WarrantyClaimRepository(db)
        self._numbers = DocumentNumberService(db)
        self._engine = RecallEngine()
        self._scope = QmScopeValidator(db)

    def list_recalls(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        product_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_recalls(ctx, cid, product_id)

    def get_recall(self, ctx: TenantContext, recall_id: UUID) -> QmRecall:
        row = self._repo.get(ctx, recall_id)
        if row is None:
            raise NotFoundException("Recall not found")
        return row

    def create_recall(self, ctx: TenantContext, **fields) -> QmRecall:
        company_id = fields.pop("company_id")
        branch_id = self._scope.require_branch(ctx, fields.pop("branch_id", None))
        self._scope.validate_company_access(ctx, company_id)
        self._require_optional_ncr(ctx, fields.get("ncr_id"))
        self._require_optional_capa(ctx, fields.get("capa_id"))
        self._require_optional_claim(ctx, fields.get("warranty_claim_id"))
        number = self._numbers.generate(
            QmEntityType.RECALL,
            company_id,
            model=QmRecall,
            code_column="document_number",
        )
        document_date = fields.pop("document_date", None) or date.today()
        return self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            document_number=number,
            document_date=document_date,
            status=RecallStatus.DRAFT.value,
            **fields,
        )

    def update_recall(self, ctx: TenantContext, recall_id: UUID, **fields) -> QmRecall:
        recall = self.get_recall(ctx, recall_id)
        if recall.status in {RecallStatus.CLOSED.value, RecallStatus.CANCELLED.value}:
            fields = {}
        new_status = fields.pop("status", None)
        self._require_optional_ncr(ctx, fields.get("ncr_id"))
        self._require_optional_capa(ctx, fields.get("capa_id"))
        self._require_optional_claim(ctx, fields.get("warranty_claim_id"))
        if new_status is not None:
            self._engine.apply_status(recall, new_status)
            fields["status"] = recall.status
        if fields:
            self._repo.update(ctx, recall_id, **fields)
        return self.get_recall(ctx, recall_id)

    def announce(self, ctx: TenantContext, recall_id: UUID) -> QmRecall:
        recall = self.get_recall(ctx, recall_id)
        self._engine.apply_announce(recall)
        self._repo.update(ctx, recall_id, status=recall.status)
        return self.get_recall(ctx, recall_id)

    def close(self, ctx: TenantContext, recall_id: UUID) -> QmRecall:
        recall = self.get_recall(ctx, recall_id)
        self._engine.apply_close(recall)
        self._repo.update(ctx, recall_id, status=recall.status)
        return self.get_recall(ctx, recall_id)

    def _require_optional_ncr(self, ctx: TenantContext, ncr_id: UUID | None) -> None:
        if ncr_id is None:
            return
        if self._ncrs.get(ctx, ncr_id) is None:
            raise NotFoundException("NCR not found")

    def _require_optional_capa(self, ctx: TenantContext, capa_id: UUID | None) -> None:
        if capa_id is None:
            return
        if self._capas.get(ctx, capa_id) is None:
            raise NotFoundException("CAPA not found")

    def _require_optional_claim(self, ctx: TenantContext, claim_id: UUID | None) -> None:
        if claim_id is None:
            return
        if self._claims.get(ctx, claim_id) is None:
            raise NotFoundException("Warranty claim not found")
