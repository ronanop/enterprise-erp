"""Foundation domain exceptions."""

from core.exceptions import AppException


class FoundationDomainException(AppException):
    """Base foundation domain error."""


class InvalidCredentialsException(FoundationDomainException):
    def __init__(self, message: str = "Invalid credentials") -> None:
        super().__init__(message, status_code=401)


class AccountLockedException(FoundationDomainException):
    def __init__(self, message: str = "Account is locked") -> None:
        super().__init__(message, status_code=403)


class PermissionDeniedException(FoundationDomainException):
    def __init__(self, message: str = "Permission denied") -> None:
        super().__init__(message, status_code=403)


class InvalidPasswordPolicyException(FoundationDomainException):
    def __init__(self, message: str = "Password does not meet policy requirements") -> None:
        super().__init__(message, status_code=422)


class WorkflowStateException(FoundationDomainException):
    def __init__(self, message: str = "Invalid workflow state transition") -> None:
        super().__init__(message, status_code=400)


class MicrosoftLoginNotConfiguredException(FoundationDomainException):
    def __init__(
        self, message: str = "Microsoft sign-in is not configured on this environment"
    ) -> None:
        super().__init__(message, status_code=503)


class OrganizationLoginForbiddenException(FoundationDomainException):
    def __init__(
        self,
        message: str = "Microsoft sign-in is only available for Organization module users",
    ) -> None:
        super().__init__(message, status_code=403)
