"""CR-004 operational status domain exceptions."""

from core.exceptions import AppException, ConflictException


class OperationalStatusException(AppException):
    """Base for operational status business rule violations."""


class InvalidTransition(OperationalStatusException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=409)


class TerminalState(OperationalStatusException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=409)


class UnknownOperationalStatus(OperationalStatusException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class InvalidOperationalAction(OperationalStatusException):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=422)


class AssetNotFoundForOperationalStatus(ConflictException):
    """Asset row missing when applying operational transition."""

    def __init__(self, message: str = "Asset not found") -> None:
        super().__init__(message)


class OperationalStatusConflict(ConflictException):
    """Optimistic lock failure or concurrent operational status transition."""

    def __init__(self, message: str = "Operational status conflict; refresh and retry") -> None:
        super().__init__(message)
