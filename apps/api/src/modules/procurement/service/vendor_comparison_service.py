"""Vendor comparison service."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.procurement.domain.enums import ProcEntityType, VendorQuotationStatus
from modules.procurement.domain.exceptions import InvalidDocumentState
from modules.procurement.models.vendor_quotation import ProcVendorComparison
from modules.procurement.repository.rfq_repository import RfqRepository
from modules.procurement.repository.vendor_quotation_repository import VendorQuotationRepository
from modules.procurement.service.document_number_service import DocumentNumberService
from modules.procurement.service.engines.vendor_comparison_engine import VendorComparisonEngine
from modules.procurement.service.procurement_scope_validator import ProcurementScopeValidator


class VendorComparisonService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = VendorQuotationRepository(db)
        self._rfqs = RfqRepository(db)
        self._scope = ProcurementScopeValidator(db)
        self._engine = VendorComparisonEngine()
        self._numbers = DocumentNumberService(db)
        self._audit = AuditService(db)

    def get_by_rfq(self, ctx: TenantContext, rfq_header_id: UUID) -> ProcVendorComparison:
        row = self._repo.get_comparison_by_rfq(ctx, rfq_header_id)
        if row is None:
            raise NotFoundException("Vendor comparison not found")
        self._scope.validate_company_access(ctx, row.company_id)
        return row

    def list(self, ctx: TenantContext, company_id: UUID | None = None) -> list[ProcVendorComparison]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_comparisons(ctx, cid)

    def run_comparison(self, ctx: TenantContext, rfq_header_id: UUID) -> ProcVendorComparison:
        rfq = self._rfqs.get_rfq(ctx, rfq_header_id)
        if rfq is None:
            raise NotFoundException("RFQ not found")
        self._scope.validate_company_access(ctx, rfq.company_id)

        quotations = [
            q
            for q in self._repo.list_quotations(ctx, rfq.company_id)
            if q.rfq_header_id == rfq_header_id and not q.is_deleted
        ]
        result = self._engine.compare(quotations)
        now = datetime.now(timezone.utc)
        existing = self._repo.get_comparison_by_rfq(ctx, rfq_header_id)
        fields = {
            "best_price_quotation_id": result.best_price_quotation_id,
            "best_delivery_quotation_id": result.best_delivery_quotation_id,
            "best_overall_quotation_id": result.best_overall_quotation_id,
            "score_breakdown": result.score_breakdown,
            "status": "completed",
            "compared_at": now,
        }
        if existing is None:
            doc_number = self._numbers.generate(
                ProcEntityType.VENDOR_COMPARISON,
                rfq.company_id,
                model=ProcVendorComparison,
                code_column="document_number",
            )
            row = self._repo.create_comparison(
                ctx,
                company_id=rfq.company_id,
                branch_id=rfq.branch_id,
                document_number=doc_number,
                rfq_header_id=rfq_header_id,
                **fields,
            )
        else:
            updated = self._repo.update_comparison(ctx, existing.id, **fields)
            if updated is None:
                raise NotFoundException("Vendor comparison not found")
            row = updated
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="proc_vendor_comparison",
            entity_id=row.id,
            operation="compare",
            performed_by=ctx.user_id,
        )
        return row

    def select_quotation(
        self, ctx: TenantContext, rfq_header_id: UUID, quotation_id: UUID
    ) -> ProcVendorComparison:
        comparison = self.run_comparison(ctx, rfq_header_id)
        quotation = self._repo.get_quotation(ctx, quotation_id)
        if quotation is None or quotation.rfq_header_id != rfq_header_id:
            raise NotFoundException("Vendor quotation not found for RFQ")
        if quotation.status not in {
            VendorQuotationStatus.SUBMITTED.value,
            VendorQuotationStatus.UNDER_REVIEW.value,
        }:
            raise InvalidDocumentState("Quotation cannot be selected in its current state")

        for q in self._repo.list_quotations(ctx, quotation.company_id):
            if q.rfq_header_id != rfq_header_id or q.is_deleted:
                continue
            if q.id == quotation_id:
                self._repo.update_quotation(
                    ctx, q.id, status=VendorQuotationStatus.SELECTED.value
                )
            elif q.status in {
                VendorQuotationStatus.SUBMITTED.value,
                VendorQuotationStatus.UNDER_REVIEW.value,
                VendorQuotationStatus.SELECTED.value,
            }:
                self._repo.update_quotation(
                    ctx, q.id, status=VendorQuotationStatus.REJECTED.value
                )

        updated = self._repo.update_comparison(
            ctx, comparison.id, selected_quotation_id=quotation_id, status="completed"
        )
        assert updated is not None
        return updated
