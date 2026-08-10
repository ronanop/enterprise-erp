"""Marketing domain exceptions."""

from core.exceptions import AppException


class InvalidMarketingState(AppException):
    def __init__(self, message: str = "Invalid marketing state transition"):
        super().__init__(message, status_code=422)
