"""Application exception types and FastAPI handlers."""

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import (
    DBAPIError,
    DataError,
    IntegrityError,
    OperationalError,
    TimeoutError as SATimeoutError,
)
from sqlalchemy.orm.exc import StaleDataError

from shared.schemas import ErrorResponse

logger = logging.getLogger(__name__)


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


class RedisUnavailableException(AppException):
    def __init__(self, message: str = "Session store unavailable") -> None:
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


class ValidationException(AppException):
    def __init__(self, message: str = "Validation error") -> None:
        super().__init__(message, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)


class TooManyRequestsException(AppException):
    def __init__(self, message: str = "Too many requests") -> None:
        super().__init__(message, status_code=status.HTTP_429_TOO_MANY_REQUESTS)


def conflict_from_integrity(exc: IntegrityError) -> ConflictException:
    """Turn a DB constraint failure into a client-facing 409."""
    orig = getattr(exc, "orig", None)
    name = type(orig).__name__ if orig is not None else ""
    detail = str(orig) if orig is not None else str(exc)
    lowered = detail.lower()
    if "CheckViolation" in name or "check constraint" in lowered:
        return ConflictException(
            "This status or value is not allowed for this record.",
        )
    if "ForeignKeyViolation" in name or "foreign key" in lowered:
        return ConflictException(
            "Cannot delete or change this record because other data still depends on it.",
        )
    if "UniqueViolation" in name or "unique constraint" in lowered:
        if "uk_hr_bio_device_code" in lowered or "hr_biometric_device" in lowered:
            return ConflictException(
                "Device code already registered for this company. Choose a different code."
            )
        return ConflictException("A record with these values already exists.")
    if "NotNullViolation" in name or "not-null constraint" in lowered:
        if "company_id" in lowered:
            return ConflictException(
                "Company is required. Select a branch that belongs to a company and try again."
            )
        return ConflictException("A required value is missing, so this could not be saved.")
    return ConflictException("This change conflicts with existing data.")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(_: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(message=exc.message).model_dump(),
        )

    @app.exception_handler(StaleDataError)
    async def stale_data_handler(_: Request, __: StaleDataError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=ErrorResponse(
                message="Record was modified by another user. Reload and try again."
            ).model_dump(),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        from core.config import settings

        # In production, avoid leaking detailed schema paths / validator internals (VAPT info).
        if settings.is_development:
            errors = [
                f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}"
                for err in exc.errors()
            ]
        else:
            errors = ["One or more fields failed validation"]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ErrorResponse(
                message="Validation error",
                errors=errors,
            ).model_dump(),
        )

    @app.exception_handler(DatabaseUnavailableException)
    async def database_unavailable_handler(
        _: Request,
        exc: DatabaseUnavailableException,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(message=exc.message).model_dump(),
        )

    @app.exception_handler(OperationalError)
    async def operational_error_handler(_: Request, exc: OperationalError) -> JSONResponse:
        logger.warning("database operational error: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=ErrorResponse(message="Database temporarily unavailable").model_dump(),
        )

    @app.exception_handler(SATimeoutError)
    async def pool_timeout_handler(_: Request, exc: SATimeoutError) -> JSONResponse:
        logger.warning("database pool timeout: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=ErrorResponse(message="Database temporarily unavailable").model_dump(),
        )

    @app.exception_handler(DataError)
    async def data_error_handler(_: Request, exc: DataError) -> JSONResponse:
        logger.warning("database data error (invalid input): %s", exc)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ErrorResponse(
                message="Validation error",
                errors=["One or more field values are out of range or invalid for storage"],
            ).model_dump(),
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(_: Request, exc: IntegrityError) -> JSONResponse:
        logger.warning("database integrity error: %s", exc)
        conflict = conflict_from_integrity(exc)
        return JSONResponse(
            status_code=conflict.status_code,
            content=ErrorResponse(message=conflict.message).model_dump(),
        )

    @app.exception_handler(DBAPIError)
    async def dbapi_error_handler(_: Request, exc: DBAPIError) -> JSONResponse:
        if isinstance(exc.orig, Exception) and "too many clients" in str(exc.orig).lower():
            logger.warning("database connection pool exhausted: %s", exc.orig)
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content=ErrorResponse(message="Database temporarily unavailable").model_dump(),
            )
        logger.exception("database error")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(message="Internal server error").model_dump(),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled exception on %s %s", request.method, request.url.path)
        origin = request.headers.get("origin")
        headers: dict[str, str] = {}
        if origin:
            headers["Access-Control-Allow-Origin"] = origin
            headers["Access-Control-Allow-Credentials"] = "true"
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(message="Internal server error").model_dump(),
            headers=headers,
        )
