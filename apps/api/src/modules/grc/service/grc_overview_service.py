"""GRC dashboard overview aggregates."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.grc.models import (
    GrcAudit,
    GrcComplianceAssessment,
    GrcComplianceFramework,
    GrcComplianceRequirement,
    GrcControl,
    GrcCorrectiveAction,
    GrcIncident,
    GrcPolicy,
    GrcRiskRegister,
)
from modules.grc.repository.base import GrcScopedRepository
from modules.grc.service.compliance.signal_registry import ComplianceSignalRegistry
from modules.grc.service.grc_scope_validator import GrcScopeValidator


class GrcOverviewService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._scope = GrcScopeValidator(db)

    def get_overview(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)

        def count_model(model, *, branch: bool = False) -> int:
            stmt = select(func.count()).select_from(model).where(
                model.company_id == cid,
                model.is_deleted.is_(False),
            )
            stmt = GrcScopedRepository.apply_grc_filter(stmt, model, ctx, branch_scoped=branch)
            return int(self._db.scalar(stmt) or 0)

        risks = self._db.scalars(
            GrcScopedRepository.apply_grc_filter(
                select(GrcRiskRegister).where(
                    GrcRiskRegister.company_id == cid,
                    GrcRiskRegister.is_deleted.is_(False),
                ),
                GrcRiskRegister,
                ctx,
                branch_scoped=True,
            )
        ).all()
        open_risk_statuses = {"closed", "mitigated", "accepted", "cancelled"}
        open_risks = sum(1 for r in risks if (r.status or "").lower() not in open_risk_statuses)

        controls = count_model(GrcControl)
        active_controls = int(
            self._db.scalar(
                GrcScopedRepository.apply_grc_filter(
                    select(func.count())
                    .select_from(GrcControl)
                    .where(
                        GrcControl.company_id == cid,
                        GrcControl.is_deleted.is_(False),
                        GrcControl.status.in_(["active", "approved"]),
                    ),
                    GrcControl,
                    ctx,
                )
            )
            or 0
        )

        audits = self._db.scalars(
            GrcScopedRepository.apply_grc_filter(
                select(GrcAudit).where(
                    GrcAudit.company_id == cid,
                    GrcAudit.is_deleted.is_(False),
                ),
                GrcAudit,
                ctx,
                branch_scoped=True,
            )
        ).all()
        planned_audits = sum(
            1 for a in audits if (a.status or "").lower() in {"planned", "in_progress", "scheduled"}
        )

        capas = self._db.scalars(
            GrcScopedRepository.apply_grc_filter(
                select(GrcCorrectiveAction).where(
                    GrcCorrectiveAction.company_id == cid,
                    GrcCorrectiveAction.is_deleted.is_(False),
                ),
                GrcCorrectiveAction,
                ctx,
                branch_scoped=True,
            )
        ).all()
        closed_capa = {"closed", "completed", "cancelled"}
        open_capas = sum(1 for c in capas if (c.status or "").lower() not in closed_capa)

        assessments = self._db.scalars(
            GrcScopedRepository.apply_grc_filter(
                select(GrcComplianceAssessment).where(
                    GrcComplianceAssessment.company_id == cid,
                    GrcComplianceAssessment.is_deleted.is_(False),
                ),
                GrcComplianceAssessment,
                ctx,
                branch_scoped=True,
            )
        ).all()
        compliance_mix = {
            "compliant": 0,
            "partially_compliant": 0,
            "non_compliant": 0,
            "unknown": 0,
        }
        for a in assessments:
            key = (a.compliance_status or "unknown").lower()
            if key in compliance_mix:
                compliance_mix[key] += 1
            else:
                compliance_mix["unknown"] += 1

        return {
            "kpis": {
                "open_risks": open_risks,
                "total_risks": len(risks),
                "active_controls": active_controls,
                "total_controls": controls,
                "planned_audits": planned_audits,
                "total_audits": len(audits),
                "open_capas": open_capas,
                "total_capas": len(capas),
                "total_policies": count_model(GrcPolicy),
                "total_frameworks": count_model(GrcComplianceFramework),
                "total_requirements": count_model(GrcComplianceRequirement),
                "total_assessments": len(assessments),
                "total_incidents": count_model(GrcIncident, branch=True),
            },
            "compliance_status_mix": compliance_mix,
            "automated_signal_codes": ComplianceSignalRegistry.registered_codes(),
        }
