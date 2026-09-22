"""Job requisition service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.recruitment.domain.enums import RecEntityType
from modules.recruitment.models import RecJobRequisition
from modules.recruitment.repository.job_requisition_repository import JobRequisitionRepository
from modules.recruitment.service.document_number_service import DocumentNumberService
from modules.recruitment.service.engines import JobRequisitionEngine
from modules.recruitment.service.recruitment_scope_validator import RecruitmentScopeValidator


class JobRequisitionService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = JobRequisitionRepository(db)
        self._scope = RecruitmentScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = JobRequisitionEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> RecJobRequisition:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Job requisition not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(RecEntityType.JOB_REQUISITION, cid, RecJobRequisition, "document_number")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)

    def _notify_requisition(self, ctx: TenantContext, row: RecJobRequisition, *, title: str, body: str) -> None:
        try:
            from modules.hr.service.hr_notify import notify_users_with_permission

            exclude = {ctx.user_id} if ctx.user_id else set()
            notify_users_with_permission(
                self._db,
                tenant_id=ctx.tenant_id,
                permission_code="recruitment.requisition:read",
                template_code="rec.requisition",
                template_name="Job Requisition",
                event_type="rec.requisition",
                title=title,
                body=body,
                kind="interview",
                extra={"href": "/hr/recruitment", "requisition_id": str(row.id)},
                exclude_user_ids=exclude,
            )
        except Exception:
            pass

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Job requisition not found")
        return row

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        if updated is not None:
            self._notify_requisition(
                ctx,
                updated,
                title="Open Requisitions",
                body=f"Requisition {updated.document_number} was submitted and is awaiting approval.",
            )
        return updated

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.approve(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        if updated is not None:
            self._notify_requisition(
                ctx,
                updated,
                title="Open Requisitions",
                body=f"Requisition {updated.document_number} is approved and open.",
            )
        return updated
