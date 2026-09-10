"""Quality domain exceptions."""

from core.exceptions import ConflictException


class InvalidInspectionState(ConflictException):
    def __init__(self, detail: str = "Invalid inspection state") -> None:
        super().__init__(detail)


class InvalidNcrState(ConflictException):
    def __init__(self, detail: str = "Invalid NCR state") -> None:
        super().__init__(detail)


class InvalidCapaState(ConflictException):
    def __init__(self, detail: str = "Invalid CAPA state") -> None:
        super().__init__(detail)


class InvalidPlanState(ConflictException):
    def __init__(self, detail: str = "Invalid plan state") -> None:
        super().__init__(detail)


class InvalidSamplingPlan(ConflictException):
    def __init__(self, detail: str = "Invalid sampling plan") -> None:
        super().__init__(detail)


class InvalidComplaintState(ConflictException):
    def __init__(self, detail: str = "Invalid complaint state") -> None:
        super().__init__(detail)


class InvalidAuditState(ConflictException):
    def __init__(self, detail: str = "Invalid audit state") -> None:
        super().__init__(detail)


class InvalidScoreState(ConflictException):
    def __init__(self, detail: str = "Invalid quality score state") -> None:
        super().__init__(detail)


class InvalidDefectState(ConflictException):
    def __init__(self, detail: str = "Invalid defect state") -> None:
        super().__init__(detail)


class InvalidPfmeaState(ConflictException):
    def __init__(self, detail: str = "Invalid PFMEA state") -> None:
        super().__init__(detail)


class InvalidPpapState(ConflictException):
    def __init__(self, detail: str = "Invalid PPAP state") -> None:
        super().__init__(detail)


class InvalidScarState(ConflictException):
    def __init__(self, detail: str = "Invalid SCAR state") -> None:
        super().__init__(detail)


class InvalidVinTraceState(ConflictException):
    def __init__(self, detail: str = "Invalid VIN trace state") -> None:
        super().__init__(detail)


class InvalidWarrantyClaimState(ConflictException):
    def __init__(self, detail: str = "Invalid warranty claim state") -> None:
        super().__init__(detail)


class InvalidRecallState(ConflictException):
    def __init__(self, detail: str = "Invalid recall state") -> None:
        super().__init__(detail)
