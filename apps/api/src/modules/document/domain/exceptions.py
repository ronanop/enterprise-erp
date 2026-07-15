"""Document domain exceptions."""

from core.exceptions import ConflictException


class InvalidFolderState(ConflictException):
    def __init__(self, message: str = "Invalid folder state") -> None:
        super().__init__(message)

class InvalidDocumentState(ConflictException):
    def __init__(self, message: str = "Invalid document state") -> None:
        super().__init__(message)

class InvalidDocumentVersionState(ConflictException):
    def __init__(self, message: str = "Invalid documentversion state") -> None:
        super().__init__(message)

class InvalidDocumentMetadataState(ConflictException):
    def __init__(self, message: str = "Invalid documentmetadata state") -> None:
        super().__init__(message)

class InvalidDocumentTagState(ConflictException):
    def __init__(self, message: str = "Invalid documenttag state") -> None:
        super().__init__(message)

class InvalidDocumentTagMapState(ConflictException):
    def __init__(self, message: str = "Invalid documenttagmap state") -> None:
        super().__init__(message)

class InvalidDocumentPermissionState(ConflictException):
    def __init__(self, message: str = "Invalid documentpermission state") -> None:
        super().__init__(message)

class InvalidDocumentShareState(ConflictException):
    def __init__(self, message: str = "Invalid documentshare state") -> None:
        super().__init__(message)

class InvalidDocumentCommentState(ConflictException):
    def __init__(self, message: str = "Invalid documentcomment state") -> None:
        super().__init__(message)

class InvalidDocumentApprovalState(ConflictException):
    def __init__(self, message: str = "Invalid documentapproval state") -> None:
        super().__init__(message)

class InvalidDocumentWorkflowState(ConflictException):
    def __init__(self, message: str = "Invalid documentworkflow state") -> None:
        super().__init__(message)

class InvalidDocumentCheckoutState(ConflictException):
    def __init__(self, message: str = "Invalid documentcheckout state") -> None:
        super().__init__(message)

class InvalidDocumentAuditState(ConflictException):
    def __init__(self, message: str = "Invalid documentaudit state") -> None:
        super().__init__(message)

class InvalidDocumentAttachmentState(ConflictException):
    def __init__(self, message: str = "Invalid documentattachment state") -> None:
        super().__init__(message)

class InvalidTemplateState(ConflictException):
    def __init__(self, message: str = "Invalid template state") -> None:
        super().__init__(message)

class InvalidTemplateFieldState(ConflictException):
    def __init__(self, message: str = "Invalid templatefield state") -> None:
        super().__init__(message)

class InvalidRetentionPolicyState(ConflictException):
    def __init__(self, message: str = "Invalid retentionpolicy state") -> None:
        super().__init__(message)

class InvalidArchiveState(ConflictException):
    def __init__(self, message: str = "Invalid archive state") -> None:
        super().__init__(message)

class InvalidNotificationState(ConflictException):
    def __init__(self, message: str = "Invalid notification state") -> None:
        super().__init__(message)

class InvalidReportState(ConflictException):
    def __init__(self, message: str = "Invalid report state") -> None:
        super().__init__(message)
