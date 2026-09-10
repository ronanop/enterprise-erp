"""Warranty claims — VIN-linked entity; no complaint KPI or finance posting."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.quality.domain.enums import QmEntityType, WarrantyClaimStatus
from modules.quality.models import QmWarrantyClaim
from modules.quality.repository.capa_repository import CapaRepository
from modules.quality.repository.customer_complaint_repository import CustomerComplaintRepository
from modules.quality.repository.ncr_repository import NcrRepository
from modules.quality.repository.vin_trace_repository import VinTraceRepository
from modules.quality.repository.warranty_claim_repository import WarrantyClaimRepository
from modules.quality.service.document_number_service import DocumentNumberService
from modules.quality.service.engines.warranty_engine import WarrantyEngine
from modules.quality.service.qm_scope_validator import QmScopeValidator


class WarrantyClaimService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = WarrantyClaimRepository(db)
        self._traces = VinTraceRepository(db)
        self._ncrs = NcrRepository(db)
        self._capas = CapaRepository(db)
        self._complaints = CustomerComplaintRepository(db)
        self._numbers = DocumentNumberService(db)
        self._engine = WarrantyEngine()
        self._scope = QmScopeValidator(db)

    def list_claims(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        vin_trace_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_claims(ctx, cid, vin_trace_id)

    def get_claim(self, ctx: TenantContext, claim_id: UUID) -> QmWarrantyClaim:
        row = self._repo.get(ctx, claim_id)
        if row is None:
            raise NotFoundException("Warranty claim not found")
        return row

    def create_claim(self, ctx: TenantContext, **fields) -> QmWarrantyClaim:
        company_id = fields.pop("company_id")
        branch_id = self._scope.require_branch(ctx, fields.pop("branch_id", None))
        self._scope.validate_company_access(ctx, company_id)
        vin_trace_id = fields.pop("vin_trace_id")
        trace = self._traces.get(ctx, vin_trace_id)
        if trace is None:
            raise NotFoundException("VIN trace not found")
        self._require_optional_ncr(ctx, fields.get("ncr_id"))
        self._require_optional_capa(ctx, fields.get("capa_id"))
        self._require_optional_complaint(ctx, fields.get("customer_complaint_id"))
        vin = fields.pop("vin", None) or trace.vin
        product_id = fields.pop("product_id", None) or trace.product_id
        if fields.get("quantity") is not None:
            fields["quantity"] = Decimal(str(fields["quantity"]))
        number = self._numbers.generate(
            QmEntityType.WARRANTY_CLAIM,
            company_id,
            model=QmWarrantyClaim,
            code_column="document_number",
        )
        document_date = fields.pop("document_date", None) or date.today()
        return self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            document_number=number,
            document_date=document_date,
            vin_trace_id=vin_trace_id,
            vin=str(vin).strip().upper() if vin else None,
            product_id=product_id,
            status=WarrantyClaimStatus.DRAFT.value,
            **fields,
        )

    def update_claim(self, ctx: TenantContext, claim_id: UUID, **fields) -> QmWarrantyClaim:
        claim = self.get_claim(ctx, claim_id)
        if claim.status in {
            WarrantyClaimStatus.CLOSED.value,
            WarrantyClaimStatus.CANCELLED.value,
        }:
            fields = {}
        new_status = fields.pop("status", None)
        self._require_optional_ncr(ctx, fields.get("ncr_id"))
        self._require_optional_capa(ctx, fields.get("capa_id"))
        self._require_optional_complaint(ctx, fields.get("customer_complaint_id"))
        if fields.get("quantity") is not None:
            fields["quantity"] = Decimal(str(fields["quantity"]))
        if fields.get("vin"):
            fields["vin"] = str(fields["vin"]).strip().upper()
        if new_status is not None:
            self._engine.apply_status(claim, new_status)
            fields["status"] = claim.status
        if fields:
            self._repo.update(ctx, claim_id, **fields)
        return self.get_claim(ctx, claim_id)

    def investigate(self, ctx: TenantContext, claim_id: UUID) -> QmWarrantyClaim:
        claim = self.get_claim(ctx, claim_id)
        self._engine.apply_investigate(claim)
        self._repo.update(ctx, claim_id, status=claim.status)
        return self.get_claim(ctx, claim_id)

    def link_capa(self, ctx: TenantContext, claim_id: UUID, capa_id: UUID) -> QmWarrantyClaim:
        claim = self.get_claim(ctx, claim_id)
        if self._capas.get(ctx, capa_id) is None:
            raise NotFoundException("CAPA not found")
        self._engine.apply_link_capa(claim)
        self._repo.update(ctx, claim_id, status=claim.status, capa_id=capa_id)
        return self.get_claim(ctx, claim_id)

    def close(self, ctx: TenantContext, claim_id: UUID) -> QmWarrantyClaim:
        claim = self.get_claim(ctx, claim_id)
        self._engine.apply_close(claim)
        self._repo.update(ctx, claim_id, status=claim.status)
        return self.get_claim(ctx, claim_id)

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

    def _require_optional_complaint(self, ctx: TenantContext, complaint_id: UUID | None) -> None:
        if complaint_id is None:
            return
        if self._complaints.get(ctx, complaint_id) is None:
            raise NotFoundException("Customer complaint not found")
