"""Application exception types and FastAPI handlers."""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from shared.schemas import ErrorResponse


class AppException(Exception):
    """Base application exception with HTTP status mapping."""

    def __init__(self, message: str, *, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)


class DatabaseUnavailableException(AppException):
    def __init__(self, message: str = "Database unavailable") -> None:
        super().__init__(message, status_code=status.HTTP_503_SERVICE_UNAVAILABLE)


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Unauthorized") -> None:
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED)


class ForbiddenException(AppException):
    def __init__(self, message: str = "Forbidden") -> None:
        super().__init__(message, status_code=status.HTTP_403_FORBIDDEN)


class ConflictException(AppException):
    def __init__(self, message: str = "Conflict") -> None:
        super().__init__(message, status_code=status.HTTP_409_CONFLICT)


class TooManyRequestsException(AppException):
    def __init__(self, message: str = "Too many requests") -> None:
        super().__init__(message, status_code=status.HTTP_429_TOO_MANY_REQUESTS)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(_: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(message=exc.message).model_dump(),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        errors = [
            f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}" for err in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ErrorResponse(
                message="Validation error",
                errors=errors,
            ).model_dump(),
        )

    @app.exception_handler(ResponseValidationError)
    async def response_validation_exception_handler(
        _: Request,
        exc: ResponseValidationError,
    ) -> JSONResponse:
        errors = [
            f"{'.'.join(str(loc) for loc in err.get('loc', []))}: {err.get('msg')}"
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(
                message="Response validation failed",
                errors=errors,
            ).model_dump(),
        )

    @app.exception_handler(IntegrityError)
    async def integrity_exception_handler(_: Request, exc: IntegrityError) -> JSONResponse:
        detail = str(exc.orig) if exc.orig else str(exc)
        if "uk_master_vendor_company_code" in detail or "vendor_code" in detail.lower():
            message = "A vendor with this code already exists. Refresh and try again."
        elif "ck_crm_attachment_category" in detail or "vendor_invoice" in detail.lower():
            message = (
                "Could not store the vendor invoice file (invalid attachment category). "
                "Run database migrations and try again."
            )
        elif "unique" in detail.lower() or "duplicate" in detail.lower():
            message = "This record conflicts with existing data."
        elif "fk_proc_isu_receipt_batch" in detail or "proc_order_receipt_batch" in detail:
            message = (
                "Could not add stock for this GRN (receipt batch not saved). "
                "Refresh the page and save the receipt again."
            )
        else:
            message = "Database constraint violation."
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=ErrorResponse(message=message).model_dump(),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(message="Internal server error").model_dump(),
        )
