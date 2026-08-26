"""Onboarding service — employee conversion via adapters only."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.recruitment.adapters.hr_port import RecruitmentHrAdapter
from modules.recruitment.adapters.master_data_port import RecruitmentMasterDataAdapter
from modules.recruitment.domain.enums import OnboardingStatus, PayrollHandoffStatus, RecEntityType
from modules.recruitment.domain.exceptions import InvalidOnboardingState
from modules.recruitment.models import RecOnboarding
from modules.recruitment.repository.candidate_repository import CandidateRepository
from modules.recruitment.repository.offer_repository import OfferRepository
from modules.recruitment.repository.onboarding_repository import OnboardingRepository
from modules.recruitment.service.document_number_service import DocumentNumberService
from modules.recruitment.service.engines import CandidateEngine, OnboardingEngine
from modules.recruitment.service.recruitment_scope_validator import RecruitmentScopeValidator


class OnboardingService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = OnboardingRepository(db)
        self._candidates = CandidateRepository(db)
        self._offers = OfferRepository(db)
        self._scope = RecruitmentScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = OnboardingEngine()
        self._candidate_engine = CandidateEngine()
        self._master = RecruitmentMasterDataAdapter(db)
        self._hr = RecruitmentHrAdapter(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> RecOnboarding:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Onboarding not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(RecEntityType.ONBOARDING, cid, RecOnboarding, "document_number")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Onboarding not found")
        return row

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.approve(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def complete(self, ctx: TenantContext, row_id: UUID, *, designation: str):
        """Create employee in onboarding status — Emp ID / Active / payroll wait for activation."""
        from uuid import uuid4

        row = self.get(ctx, row_id)
        if row.status != OnboardingStatus.IN_PROGRESS.value:
            raise InvalidOnboardingState("Only in-progress onboarding can complete")

        candidate = self._candidates.get(ctx, row.candidate_id)
        offer = self._offers.get(ctx, row.offer_id)
        if candidate is None or offer is None:
            raise NotFoundException("Candidate or offer not found for onboarding")

        self._assert_mandatory_documents(ctx, row)
        self._assert_mandatory_tasks(ctx, row)

        # Temporary code until HR assigns permanent Emp ID at activation
        temp_code = f"ONB-{str(uuid4())[:8].upper()}"

        employee = self._master.create_employee(
            ctx,
            branch_id=row.branch_id,
            department_id=row.department_id,
            first_name=candidate.first_name,
            last_name=candidate.last_name,
            email=candidate.email,
            mobile=candidate.mobile or "",
            designation=designation,
            date_of_joining=offer.joining_date,
            company_id=row.company_id,
            employee_code=temp_code,
        )

        row.employee_id = employee.id
        self._candidate_engine.mark_hired(candidate)

        employment = self._hr.create_employment(
            ctx,
            branch_id=row.branch_id,
            employee_id=employee.id,
            company_id=row.company_id,
            employment_type=offer.employment_type,
            date_of_joining=offer.joining_date,
            status="onboarding",
            lifecycle_source="recruitment_onboarding",
            probation_start_date=offer.joining_date,
            payroll_eligible=False,
        )
        # Stay in onboarding — activation assigns Emp ID, shift, payroll_eligible, then Active
        try:
            from modules.master_data.service.employee_service import EmployeeService

            EmployeeService(self._db).update_employee(ctx, employee.id, status="onboarding")
        except Exception:
            pass
        row.hr_employment_request_id = employment.id
        row.payroll_handoff_status = PayrollHandoffStatus.PENDING.value

        self._engine.complete(row)
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            employee_id=row.employee_id,
            hr_employment_request_id=row.hr_employment_request_id,
            payroll_handoff_status=row.payroll_handoff_status,
            actual_joining_date=offer.joining_date,
        )
        self._candidates.update(ctx, candidate.id, employee_id=employee.id, status=candidate.status)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="rec_onboarding",
            entity_id=row_id,
            operation="complete",
            performed_by=ctx.user_id,
        )
        return updated

    def _assert_mandatory_documents(self, ctx: TenantContext, row) -> None:
        """Block hire without KYC docs: identity, education, photo."""
        from modules.recruitment.repository.candidate_document_repository import (
            CandidateDocumentRepository,
        )

        docs = CandidateDocumentRepository(self._db).list_rows(ctx, row.company_id)
        cand_docs = [d for d in docs if d.candidate_id == row.candidate_id and not d.is_deleted]
        required = {"identity", "education", "photo"}
        present = {
            d.document_type
            for d in cand_docs
            if d.status in {"uploaded", "verified"} or d.verified_flag
        }
        missing = sorted(required - present)
        if missing:
            raise InvalidOnboardingState(
                "Mandatory documents missing before employee creation: "
                + ", ".join(missing)
                + " (identity=Aadhaar/PAN; photo; education required)"
            )

    def _assert_mandatory_tasks(self, ctx: TenantContext, row) -> None:
        from modules.recruitment.repository.onboarding_task_repository import (
            OnboardingTaskRepository,
        )

        try:
            tasks = OnboardingTaskRepository(self._db).list_rows(ctx, row.company_id)
        except Exception:
            return
        open_mandatory = [
            t
            for t in tasks
            if t.onboarding_id == row.id
            and t.is_mandatory
            and t.status not in {"completed", "waived", "cancelled"}
        ]
        if open_mandatory:
            codes = ", ".join(t.task_code for t in open_mandatory[:8])
            raise InvalidOnboardingState(
                f"Mandatory onboarding tasks incomplete: {codes}"
            )
