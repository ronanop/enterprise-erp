"""Asset domain exceptions."""

from core.exceptions import AppException, ConflictException


class InvalidAssetCategoryState(ConflictException):
    def __init__(self, message: str = "Invalid assetcategory state") -> None:
        super().__init__(message)


class CategoryValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)

class InvalidAssetState(ConflictException):
    def __init__(self, message: str = "Invalid asset state") -> None:
        super().__init__(message)

class InvalidAssetComponentState(ConflictException):
    def __init__(self, message: str = "Invalid assetcomponent state") -> None:
        super().__init__(message)

class InvalidAssetAssignmentState(ConflictException):
    def __init__(self, message: str = "Invalid assetassignment state") -> None:
        super().__init__(message)

class InvalidAssetTransferState(ConflictException):
    def __init__(self, message: str = "Invalid assettransfer state") -> None:
        super().__init__(message)

class InvalidAssetLocationState(ConflictException):
    def __init__(self, message: str = "Invalid assetlocation state") -> None:
        super().__init__(message)

class InvalidAssetWarrantyState(ConflictException):
    def __init__(self, message: str = "Invalid assetwarranty state") -> None:
        super().__init__(message)

class InvalidAssetInsuranceState(ConflictException):
    def __init__(self, message: str = "Invalid assetinsurance state") -> None:
        super().__init__(message)

class InvalidAssetMaintenancePlanState(ConflictException):
    def __init__(self, message: str = "Invalid assetmaintenanceplan state") -> None:
        super().__init__(message)

class InvalidAssetMaintenanceState(ConflictException):
    def __init__(self, message: str = "Invalid assetmaintenance state") -> None:
        super().__init__(message)

class InvalidAssetServiceHistoryState(ConflictException):
    def __init__(self, message: str = "Invalid assetservicehistory state") -> None:
        super().__init__(message)

class InvalidAssetDepreciationState(ConflictException):
    def __init__(self, message: str = "Invalid assetdepreciation state") -> None:
        super().__init__(message)

class InvalidAssetDisposalState(ConflictException):
    def __init__(self, message: str = "Invalid assetdisposal state") -> None:
        super().__init__(message)

class InvalidAssetRevaluationState(ConflictException):
    def __init__(self, message: str = "Invalid assetrevaluation state") -> None:
        super().__init__(message)

class InvalidAssetAuditState(ConflictException):
    def __init__(self, message: str = "Invalid assetaudit state") -> None:
        super().__init__(message)

class InvalidAssetDocumentState(ConflictException):
    def __init__(self, message: str = "Invalid assetdocument state") -> None:
        super().__init__(message)

class InvalidAssetChecklistState(ConflictException):
    def __init__(self, message: str = "Invalid assetchecklist state") -> None:
        super().__init__(message)

class InvalidAssetMeterReadingState(ConflictException):
    def __init__(self, message: str = "Invalid assetmeterreading state") -> None:
        super().__init__(message)

class InvalidAssetNotificationState(ConflictException):
    def __init__(self, message: str = "Invalid assetnotification state") -> None:
        super().__init__(message)

class InvalidAssetReportState(ConflictException):
    def __init__(self, message: str = "Invalid assetreport state") -> None:
        super().__init__(message)


class ReportValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class InvalidAssetWorkflowState(ConflictException):
    def __init__(self, message: str = "Invalid asset workflow state") -> None:
        super().__init__(message)


class SegregationOfDutiesError(ConflictException):
    def __init__(self, message: str = "Segregation of duties violation") -> None:
        super().__init__(message)


class RegistrationValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class DuplicateAssetRegistrationError(ConflictException):
    def __init__(self, message: str = "Duplicate asset registration") -> None:
        super().__init__(message)


class TransferValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class AssignmentValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class InvalidDcChallanState(ConflictException):
    def __init__(self, message: str = "Invalid DC challan state") -> None:
        super().__init__(message)


class DcChallanValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class MaintenanceValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class DisposalValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class RetirementValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class ReinstateValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class DepreciationValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class RevaluationValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class AssetAuditValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class WarrantyValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class InsuranceValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class MaintenancePlanValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class LocationValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class ServiceHistoryValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class ChecklistValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class MeterReadingValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class DocumentValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class ComponentValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class DiscoveryValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class NotificationValidationError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)
