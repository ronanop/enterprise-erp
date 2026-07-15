"""GRC domain exceptions."""

from core.exceptions import ConflictException


class InvalidPolicyState(ConflictException):
    def __init__(self, message: str = "Invalid policy state") -> None:
        super().__init__(message)

class InvalidPolicyVersionState(ConflictException):
    def __init__(self, message: str = "Invalid policyversion state") -> None:
        super().__init__(message)

class InvalidPolicyAcknowledgementState(ConflictException):
    def __init__(self, message: str = "Invalid policyacknowledgement state") -> None:
        super().__init__(message)

class InvalidControlState(ConflictException):
    def __init__(self, message: str = "Invalid control state") -> None:
        super().__init__(message)

class InvalidControlTestState(ConflictException):
    def __init__(self, message: str = "Invalid controltest state") -> None:
        super().__init__(message)

class InvalidRiskCategoryState(ConflictException):
    def __init__(self, message: str = "Invalid riskcategory state") -> None:
        super().__init__(message)

class InvalidRiskRegisterState(ConflictException):
    def __init__(self, message: str = "Invalid riskregister state") -> None:
        super().__init__(message)

class InvalidRiskAssessmentState(ConflictException):
    def __init__(self, message: str = "Invalid riskassessment state") -> None:
        super().__init__(message)

class InvalidRiskTreatmentState(ConflictException):
    def __init__(self, message: str = "Invalid risktreatment state") -> None:
        super().__init__(message)

class InvalidComplianceFrameworkState(ConflictException):
    def __init__(self, message: str = "Invalid complianceframework state") -> None:
        super().__init__(message)

class InvalidComplianceRequirementState(ConflictException):
    def __init__(self, message: str = "Invalid compliancerequirement state") -> None:
        super().__init__(message)

class InvalidComplianceAssessmentState(ConflictException):
    def __init__(self, message: str = "Invalid complianceassessment state") -> None:
        super().__init__(message)

class InvalidAuditPlanState(ConflictException):
    def __init__(self, message: str = "Invalid auditplan state") -> None:
        super().__init__(message)

class InvalidAuditState(ConflictException):
    def __init__(self, message: str = "Invalid audit state") -> None:
        super().__init__(message)

class InvalidAuditFindingState(ConflictException):
    def __init__(self, message: str = "Invalid auditfinding state") -> None:
        super().__init__(message)

class InvalidCorrectiveActionState(ConflictException):
    def __init__(self, message: str = "Invalid correctiveaction state") -> None:
        super().__init__(message)

class InvalidExceptionState(ConflictException):
    def __init__(self, message: str = "Invalid exception state") -> None:
        super().__init__(message)

class InvalidIncidentState(ConflictException):
    def __init__(self, message: str = "Invalid incident state") -> None:
        super().__init__(message)

class InvalidNotificationState(ConflictException):
    def __init__(self, message: str = "Invalid notification state") -> None:
        super().__init__(message)

class InvalidReportState(ConflictException):
    def __init__(self, message: str = "Invalid report state") -> None:
        super().__init__(message)
