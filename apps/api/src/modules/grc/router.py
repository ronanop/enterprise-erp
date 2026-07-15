"""GRC module router aggregation."""

from fastapi import APIRouter

from modules.grc.routers import (
    audit_findings_router,
    audit_plans_router,
    audits_router,
    compliance_assessments_router,
    compliance_frameworks_router,
    compliance_requirements_router,
    control_tests_router,
    controls_router,
    corrective_actions_router,
    exceptions_router,
    incidents_router,
    notifications_router,
    policies_router,
    policy_acknowledgements_router,
    policy_versions_router,
    reports_router,
    risk_assessments_router,
    risk_categories_router,
    risk_registers_router,
    risk_treatments_router,
)

grc_router = APIRouter(prefix="/grc")
grc_router.include_router(policies_router)
grc_router.include_router(policy_versions_router)
grc_router.include_router(policy_acknowledgements_router)
grc_router.include_router(controls_router)
grc_router.include_router(control_tests_router)
grc_router.include_router(risk_categories_router)
grc_router.include_router(risk_registers_router)
grc_router.include_router(risk_assessments_router)
grc_router.include_router(risk_treatments_router)
grc_router.include_router(compliance_frameworks_router)
grc_router.include_router(compliance_requirements_router)
grc_router.include_router(compliance_assessments_router)
grc_router.include_router(audit_plans_router)
grc_router.include_router(audits_router)
grc_router.include_router(audit_findings_router)
grc_router.include_router(corrective_actions_router)
grc_router.include_router(exceptions_router)
grc_router.include_router(incidents_router)
grc_router.include_router(notifications_router)
grc_router.include_router(reports_router)
