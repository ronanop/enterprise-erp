"""Runs automated compliance signals and updates assessments."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.grc.domain.enums import GrcEntityType
from modules.grc.models import GrcComplianceAssessment, GrcComplianceRequirement
from modules.grc.repository.compliance_assessment_repository import ComplianceAssessmentRepository
from modules.grc.repository.compliance_requirement_repository import ComplianceRequirementRepository
from modules.grc.service.compliance.signal_registry import ComplianceSignalRegistry
from modules.grc.service.engines import ComplianceAssessmentEngine
from modules.grc.service.grc_number_service import GrcNumberService
from modules.grc.service.grc_scope_validator import GrcScopeValidator


class ComplianceMonitorService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._requirements = ComplianceRequirementRepository(db)
        self._assessments = ComplianceAssessmentRepository(db)
        self._scope = GrcScopeValidator(db)
        self._numbers = GrcNumberService(db)
        self._engine = ComplianceAssessmentEngine()

    def refresh_company(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        *,
        branch_id: UUID | None = None,
    ) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        bid = branch_id or ctx.branch_id
        if bid is None:
            msg = "branch_id is required for compliance monitor refresh"
            raise ValueError(msg)

        requirements = self._requirements.list_rows(ctx, cid)
        active = [r for r in requirements if r.status == "active"]
        updated = 0
        skipped = 0
        results: list[dict] = []

        for req in active:
            signal = ComplianceSignalRegistry.run(self._db, ctx, cid, req.requirement_code)
            if signal is None:
                skipped += 1
                continue

            assessor = req.owner_employee_id
            if assessor is None:
                skipped += 1
                continue

            row = self._upsert_assessment(
                ctx,
                company_id=cid,
                branch_id=bid,
                requirement=req,
                assessor_id=assessor,
                compliance_status=signal.status,
                evidence_summary=signal.summary,
            )
            updated += 1
            results.append(
                {
                    "requirement_code": req.requirement_code,
                    "assessment_id": str(row.id),
                    "compliance_status": signal.status,
                }
            )

        return {
            "company_id": str(cid),
            "requirements_checked": len(active),
            "assessments_updated": updated,
            "requirements_skipped": skipped,
            "results": results,
        }

    def _upsert_assessment(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        requirement: GrcComplianceRequirement,
        assessor_id: UUID,
        compliance_status: str,
        evidence_summary: str,
    ) -> GrcComplianceAssessment:
        stmt = (
            select(GrcComplianceAssessment)
            .where(
                GrcComplianceAssessment.company_id == company_id,
                GrcComplianceAssessment.requirement_id == requirement.id,
                GrcComplianceAssessment.is_deleted.is_(False),
            )
            .order_by(GrcComplianceAssessment.created_at.desc())
            .limit(1)
        )
        existing = self._db.scalar(stmt)
        now = datetime.now(timezone.utc)
        if existing is not None:
            existing.compliance_status = compliance_status
            existing.evidence_summary = evidence_summary
            existing.assessed_at = now
            existing.assessed_by_employee_id = assessor_id
            self._engine.complete(existing)
            self._db.flush()
            return existing

        doc = self._numbers.generate(
            GrcEntityType.COMPLIANCE_ASSESSMENT,
            company_id,
            GrcComplianceAssessment,
            "assessment_number",
        )
        row = self._assessments.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            assessment_number=doc,
            requirement_id=requirement.id,
            assessed_by_employee_id=assessor_id,
            assessed_at=now,
            compliance_status=compliance_status,
            evidence_summary=evidence_summary,
            status="completed",
        )
        return row
