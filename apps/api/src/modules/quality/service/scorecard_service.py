"""Quality scorecard and audit services."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ConflictException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.quality.domain.enums import (
    SOURCE_MODULE,
    ComplaintStatus,
    PublishStatus,
    QmEntityType,
)
from modules.quality.models import (
    QmCustomerComplaint,
    QmQualityAudit,
    QmQualityScore,
    QmSupplierQuality,
)
from modules.quality.repository.customer_complaint_repository import CustomerComplaintRepository
from modules.quality.repository.quality_audit_repository import QualityAuditRepository
from modules.quality.repository.quality_score_repository import QualityScoreRepository
from modules.quality.repository.supplier_quality_repository import SupplierQualityRepository
from modules.quality.service.document_number_service import DocumentNumberService
from modules.quality.service.engines import (
    AuditEngine,
    ComplaintEngine,
    QualityScoreEngine,
    SupplierQualityEngine,
)
from modules.quality.service.qm_scope_validator import QmScopeValidator


class SupplierQualityService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = SupplierQualityRepository(db)
        self._engine = SupplierQualityEngine()
        self._scope = QmScopeValidator(db)

    def list_scores(
        self, ctx: TenantContext, company_id: UUID | None = None, vendor_id: UUID | None = None
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_scores(ctx, cid, vendor_id)

    def get_score(self, ctx: TenantContext, score_id: UUID) -> QmSupplierQuality:
        row = self._repo.get(ctx, score_id)
        if row is None:
            raise NotFoundException("Supplier quality score not found")
        return row

    def create_score(self, ctx: TenantContext, **fields) -> QmSupplierQuality:
        company_id = fields["company_id"]
        self._scope.validate_company_access(ctx, company_id)
        for key in ("incoming_accept_rate", "defect_rate", "ncr_count", "overall_score"):
            if fields.get(key) is not None:
                fields[key] = Decimal(str(fields[key]))
        return self._repo.create(
            ctx,
            status=PublishStatus.DRAFT.value,
            **fields,
        )

    def update_score(self, ctx: TenantContext, score_id: UUID, **fields) -> QmSupplierQuality:
        score = self.get_score(ctx, score_id)
        if score.status == PublishStatus.PUBLISHED.value:
            raise ConflictException("Published scorecards cannot be updated")
        for key in ("incoming_accept_rate", "defect_rate", "ncr_count", "overall_score"):
            if fields.get(key) is not None:
                fields[key] = Decimal(str(fields[key]))
        row = self._repo.update(ctx, score_id, **fields)
        assert row is not None
        return row

    def publish(self, ctx: TenantContext, score_id: UUID) -> QmSupplierQuality:
        score = self.get_score(ctx, score_id)
        self._engine.validate_publishable(score)
        self._repo.update(ctx, score_id, status=PublishStatus.PUBLISHED.value)
        return self.get_score(ctx, score_id)


class CustomerComplaintService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = CustomerComplaintRepository(db)
        self._numbers = DocumentNumberService(db)
        self._engine = ComplaintEngine()
        self._scope = QmScopeValidator(db)

    def list_complaints(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_complaints(ctx, cid)

    def get_complaint(self, ctx: TenantContext, complaint_id: UUID) -> QmCustomerComplaint:
        row = self._repo.get(ctx, complaint_id)
        if row is None:
            raise NotFoundException("Customer complaint not found")
        return row

    def create_complaint(self, ctx: TenantContext, **fields) -> QmCustomerComplaint:
        company_id = fields["company_id"]
        branch_id = self._scope.require_branch(ctx, fields.get("branch_id"))
        self._scope.validate_company_access(ctx, company_id)
        number = self._numbers.generate(
            QmEntityType.CUSTOMER_COMPLAINT,
            company_id,
            model=QmCustomerComplaint,
            code_column="document_number",
        )
        if fields.get("quantity") is not None:
            fields["quantity"] = Decimal(str(fields["quantity"]))
        return self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            document_number=number,
            document_date=fields.pop("document_date", date.today()),
            status=ComplaintStatus.DRAFT.value,
            source_module=SOURCE_MODULE,
            **fields,
        )

    def update_complaint(
        self, ctx: TenantContext, complaint_id: UUID, **fields
    ) -> QmCustomerComplaint:
        complaint = self.get_complaint(ctx, complaint_id)
        if complaint.status in {ComplaintStatus.CLOSED.value, ComplaintStatus.CANCELLED.value}:
            fields = {}
        if fields.get("quantity") is not None:
            fields["quantity"] = Decimal(str(fields["quantity"]))
        row = self._repo.update(ctx, complaint_id, **fields)
        assert row is not None
        return row

    def investigate(self, ctx: TenantContext, complaint_id: UUID) -> QmCustomerComplaint:
        complaint = self.get_complaint(ctx, complaint_id)
        self._engine.advance_to_investigating(complaint)
        self._repo.update(ctx, complaint_id, status=complaint.status)
        return self.get_complaint(ctx, complaint_id)

    def close(self, ctx: TenantContext, complaint_id: UUID) -> QmCustomerComplaint:
        complaint = self.get_complaint(ctx, complaint_id)
        self._engine.apply_close(complaint)
        self._repo.update(ctx, complaint_id, status=complaint.status)
        return self.get_complaint(ctx, complaint_id)


class QualityAuditService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = QualityAuditRepository(db)
        self._numbers = DocumentNumberService(db)
        self._engine = AuditEngine()
        self._scope = QmScopeValidator(db)

    def list_audits(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_audits(ctx, cid)

    def get_audit(self, ctx: TenantContext, audit_id: UUID) -> QmQualityAudit:
        row = self._repo.get(ctx, audit_id)
        if row is None:
            raise NotFoundException("Quality audit not found")
        return row

    def create_audit(self, ctx: TenantContext, **fields) -> QmQualityAudit:
        company_id = fields["company_id"]
        branch_id = self._scope.require_branch(ctx, fields.get("branch_id"))
        self._scope.validate_company_access(ctx, company_id)
        number = self._numbers.generate(
            QmEntityType.QUALITY_AUDIT,
            company_id,
            model=QmQualityAudit,
            code_column="document_number",
        )
        return self._repo.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            document_number=number,
            document_date=fields.pop("document_date", date.today()),
            **fields,
        )

    def update_audit(self, ctx: TenantContext, audit_id: UUID, **fields) -> QmQualityAudit:
        self.get_audit(ctx, audit_id)
        row = self._repo.update(ctx, audit_id, **fields)
        assert row is not None
        return row

    def start(self, ctx: TenantContext, audit_id: UUID) -> QmQualityAudit:
        audit = self.get_audit(ctx, audit_id)
        self._engine.apply_start(audit)
        self._repo.update(
            ctx,
            audit_id,
            status=audit.status,
            actual_start=audit.actual_start,
        )
        return self.get_audit(ctx, audit_id)

    def complete(self, ctx: TenantContext, audit_id: UUID) -> QmQualityAudit:
        audit = self.get_audit(ctx, audit_id)
        self._engine.apply_complete(audit)
        self._repo.update(
            ctx,
            audit_id,
            status=audit.status,
            actual_end=audit.actual_end,
        )
        return self.get_audit(ctx, audit_id)

    def close(self, ctx: TenantContext, audit_id: UUID) -> QmQualityAudit:
        audit = self.get_audit(ctx, audit_id)
        self._engine.apply_close(audit)
        self._repo.update(ctx, audit_id, status=audit.status)
        return self.get_audit(ctx, audit_id)


class QualityScoreService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = QualityScoreRepository(db)
        self._engine = QualityScoreEngine()
        self._scope = QmScopeValidator(db)

    def list_scores(
        self, ctx: TenantContext, company_id: UUID | None = None, dimension: str | None = None
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_scores(ctx, cid, dimension)

    def get_score(self, ctx: TenantContext, score_id: UUID) -> QmQualityScore:
        row = self._repo.get(ctx, score_id)
        if row is None:
            raise NotFoundException("Quality score not found")
        return row

    def create_score(self, ctx: TenantContext, **fields) -> QmQualityScore:
        company_id = fields["company_id"]
        self._scope.validate_company_access(ctx, company_id)
        return self._repo.create(
            ctx,
            status=PublishStatus.DRAFT.value,
            **fields,
        )

    def update_score(self, ctx: TenantContext, score_id: UUID, **fields) -> QmQualityScore:
        score = self.get_score(ctx, score_id)
        if score.status == PublishStatus.PUBLISHED.value:
            raise ConflictException("Published scores cannot be updated")
        row = self._repo.update(ctx, score_id, **fields)
        assert row is not None
        return row

    def compute_and_publish(
        self, ctx: TenantContext, score_id: UUID, counts: dict
    ) -> QmQualityScore:
        score = self.get_score(ctx, score_id)
        self._engine.validate_publishable(score)
        kpis = self._engine.compute_kpis(counts)
        self._repo.update(
            ctx,
            score_id,
            status=PublishStatus.PUBLISHED.value,
            first_pass_yield=kpis.first_pass_yield,
            defect_rate=kpis.defect_rate,
            rework_rate=kpis.rework_rate,
            complaint_rate=kpis.complaint_rate,
            supplier_quality_score=kpis.supplier_quality_score,
        )
        return self.get_score(ctx, score_id)

    def publish(self, ctx: TenantContext, score_id: UUID) -> QmQualityScore:
        score = self.get_score(ctx, score_id)
        self._engine.validate_publishable(score)
        self._repo.update(ctx, score_id, status=PublishStatus.PUBLISHED.value)
        return self.get_score(ctx, score_id)
