"""Request context and logging middleware."""

import time
import uuid
from collections.abc import Awaitable, Callable

from sqlalchemy.exc import DBAPIError, OperationalError, TimeoutError as SATimeoutError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from core.logging import get_logger

logger = get_logger(__name__)

_INTERNAL_ERROR_BODY = (
    b'{"success":false,"message":"Internal server error","errors":[]}'
)
_UNAVAILABLE_BODY = (
    b'{"success":false,"message":"Database temporarily unavailable","errors":[]}'
)


def _json_error_response(
    *,
    status_code: int,
    body: bytes,
    request_id: str,
    request: Request,
) -> Response:
    origin = request.headers.get("origin")
    headers: dict[str, str] = {"X-Request-ID": request_id}
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Vary"] = "Origin"
    return Response(
        content=body,
        status_code=status_code,
        media_type="application/json",
        headers=headers,
    )


def _is_connection_pool_exhausted(exc: BaseException) -> bool:
    text = str(getattr(exc, "orig", exc)).lower()
    return "too many clients" in text or "connection pool" in text


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Attach request ID and emit structured access logs."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        start = time.perf_counter()

        try:
            response = await call_next(request)
        except (OperationalError, SATimeoutError) as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.warning(
                "database operational error",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": 503,
                    "duration_ms": round(duration_ms, 2),
                    "error": str(exc),
                },
            )
            return _json_error_response(
                status_code=503,
                body=_UNAVAILABLE_BODY,
                request_id=request_id,
                request=request,
            )
        except DBAPIError as exc:
            if _is_connection_pool_exhausted(exc):
                duration_ms = (time.perf_counter() - start) * 1000
                logger.warning(
                    "database connection pool exhausted",
                    extra={
                        "request_id": request_id,
                        "method": request.method,
                        "path": request.url.path,
                        "status_code": 503,
                        "duration_ms": round(duration_ms, 2),
                    },
                )
                return _json_error_response(
                    status_code=503,
                    body=_UNAVAILABLE_BODY,
                    request_id=request_id,
                    request=request,
                )
            raise
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.exception(
                "request failed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": 500,
                    "duration_ms": round(duration_ms, 2),
                },
            )
            return _json_error_response(
                status_code=500,
                body=_INTERNAL_ERROR_BODY,
                request_id=request_id,
                request=request,
            )
        duration_ms = (time.perf_counter() - start) * 1000

        logger.info(
            "request completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
            },
        )
        response.headers["X-Request-ID"] = request_id
        return response
