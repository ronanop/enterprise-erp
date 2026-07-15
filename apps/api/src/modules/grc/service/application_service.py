"""GRC application service facade."""

from sqlalchemy.orm import Session

from modules.grc.service.audit_finding_service import AuditFindingService
from modules.grc.service.audit_plan_service import AuditPlanService
from modules.grc.service.compliance_assessment_service import ComplianceAssessmentService
from modules.grc.service.compliance_framework_service import ComplianceFrameworkService
from modules.grc.service.compliance_requirement_service import ComplianceRequirementService
from modules.grc.service.control_service import ControlService
from modules.grc.service.control_test_service import ControlTestService
from modules.grc.service.corrective_action_service import CorrectiveActionService
from modules.grc.service.exception_service import ExceptionService
from modules.grc.service.grc_audit_service import GrcAuditService
from modules.grc.service.grc_report_service import GrcReportService
from modules.grc.service.incident_service import IncidentService
from modules.grc.service.integration_service import GrcIntegrationService
from modules.grc.service.notification_service import NotificationService
from modules.grc.service.policy_acknowledgement_service import PolicyAcknowledgementService
from modules.grc.service.policy_service import PolicyService
from modules.grc.service.policy_version_service import PolicyVersionService
from modules.grc.service.risk_assessment_service import RiskAssessmentService
from modules.grc.service.risk_category_service import RiskCategoryService
from modules.grc.service.risk_register_service import RiskRegisterService
from modules.grc.service.risk_treatment_service import RiskTreatmentService


class GrcApplicationService:
    def __init__(self, db: Session) -> None:
        self.policies = PolicyService(db)
        self.policy_versions = PolicyVersionService(db)
        self.policy_acknowledgements = PolicyAcknowledgementService(db)
        self.controls = ControlService(db)
        self.control_tests = ControlTestService(db)
        self.risk_categories = RiskCategoryService(db)
        self.risk_registers = RiskRegisterService(db)
        self.risk_assessments = RiskAssessmentService(db)
        self.risk_treatments = RiskTreatmentService(db)
        self.compliance_frameworks = ComplianceFrameworkService(db)
        self.compliance_requirements = ComplianceRequirementService(db)
        self.compliance_assessments = ComplianceAssessmentService(db)
        self.audit_plans = AuditPlanService(db)
        self.audits = GrcAuditService(db)
        self.audit_findings = AuditFindingService(db)
        self.corrective_actions = CorrectiveActionService(db)
        self.exceptions = ExceptionService(db)
        self.incidents = IncidentService(db)
        self.notifications = NotificationService(db)
        self.reports = GrcReportService(db)
        self.integration = GrcIntegrationService(db)
