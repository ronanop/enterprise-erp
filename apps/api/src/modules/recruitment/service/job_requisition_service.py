"""Job requisition service."""

from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException, ValidationException
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.models.branch import OrgBranch
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.recruitment.domain.enums import RecEntityType
from modules.recruitment.models import RecJobRequisition
from modules.recruitment.repository.job_requisition_repository import JobRequisitionRepository
from modules.recruitment.service.document_number_service import DocumentNumberService
from modules.recruitment.service.engines import JobRequisitionEngine
from modules.recruitment.service.recruitment_scope_validator import RecruitmentScopeValidator

_EVIDENCE_ROOT = Path(__file__).resolve().parents[4] / "var" / "recruitment-job-evidence"
_ALLOWED_AUDIENCES = frozenset({"internal", "external"})


class JobRequisitionService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = JobRequisitionRepository(db)
        self._scope = RecruitmentScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = JobRequisitionEngine()
        self._audit = PlatformAuditFacade(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> RecJobRequisition:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Job requisition not found")
        return row

    def _resolve_create_company_id(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        company_id: UUID | None,
    ) -> UUID:
        """Creates need a concrete company_id (NOT NULL). Prefer explicit, else branch."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        if cid is not None:
            return cid
        branch = self._db.get(OrgBranch, branch_id)
        if branch is None or getattr(branch, "is_deleted", False):
            raise NotFoundException("Branch not found")
        cid = branch.company_id
        if cid is None:
            raise ValidationException("Branch has no company; cannot create job requisition")
        self._scope.validate_company_access(ctx, cid)
        return cid

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        self._scope.validate_branch_access(ctx, branch_id)
        cid = self._resolve_create_company_id(ctx, branch_id=branch_id, company_id=company_id)
        audience = str(fields.get("posting_audience") or "external").strip().lower()
        if audience not in _ALLOWED_AUDIENCES:
            raise ValidationException("Posting audience must be internal or external")
        fields["posting_audience"] = audience
        evidence_name = str(fields.get("evidence_email_file_name") or "").strip()
        if not evidence_name:
            raise ValidationException(
                "Upload the approval email copy as evidence before creating the job opening"
            )
        fields["evidence_email_file_name"] = evidence_name
        doc = self._numbers.generate(
            RecEntityType.JOB_REQUISITION,
            cid,
            RecJobRequisition,
            "document_number",
            tenant_id=ctx.tenant_id,
        )
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)

    def attach_approval_evidence(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        file_name: str,
        content: bytes,
    ) -> RecJobRequisition:
        row = self.get(ctx, row_id)
        safe_name = Path(file_name or "evidence.bin").name
        if not safe_name or safe_name in {".", ".."}:
            raise ValidationException("Invalid evidence file name")
        if not content:
            raise ValidationException("Evidence file is empty")
        if len(content) > 15 * 1024 * 1024:
            raise ValidationException("Evidence file must be 15 MB or smaller")
        _EVIDENCE_ROOT.mkdir(parents=True, exist_ok=True)
        stored = f"{row.id}_{uuid4().hex[:8]}_{safe_name}"
        path = _EVIDENCE_ROOT / stored
        path.write_bytes(content)
        updated = self._repo.update(
            ctx,
            row_id,
            evidence_email_file_name=safe_name,
            evidence_email_path=str(path),
        )
        if updated is None:
            raise NotFoundException("Job requisition not found")
        return updated

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

    def open(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.open(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        if updated is not None:
            self._notify_requisition(
                ctx,
                updated,
                title="Open Requisitions",
                body=f"Requisition {updated.document_number} is now open for hiring.",
            )
        return updated
