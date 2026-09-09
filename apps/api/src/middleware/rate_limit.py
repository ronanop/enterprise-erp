"""Simple Redis-backed API rate limiting (AppScan: lack of resources / rate limiting)."""

from collections.abc import Awaitable, Callable

from redis.exceptions import RedisError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from core.config import settings
from core.logging import get_logger
from core.redis import get_redis

logger = get_logger(__name__)

_EXEMPT_SUFFIXES = (
    "/health",
    "/auth/microsoft/config",
    "/auth/microsoft/login",
    "/auth/microsoft/callback",
    "/auth/microsoft/exchange",
    "/docs",
    "/openapi.json",
    "/redoc",
)


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Limit requests per client IP within a sliding fixed window."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        limit = int(getattr(settings, "api_rate_limit", 0) or 0)
        window = int(getattr(settings, "api_rate_window_seconds", 60) or 60)
        if limit <= 0:
            return await call_next(request)

        path = request.url.path or ""
        if any(path.endswith(suffix) or path == suffix for suffix in _EXEMPT_SUFFIXES):
            return await call_next(request)
        if not path.startswith("/api/"):
            return await call_next(request)

        ip = _client_key(request)
        key = f"rate_limit:api:{ip}"
        try:
            client = get_redis()
            count = int(client.incr(key))
            if count == 1:
                client.expire(key, window)
            if count > limit:
                ttl = int(client.ttl(key) or window)
                return JSONResponse(
                    status_code=429,
                    content={
                        "success": False,
                        "message": "Too many requests. Please try again later.",
                        "errors": [],
                    },
                    headers={
                        "Retry-After": str(max(ttl, 1)),
                        "X-RateLimit-Limit": str(limit),
                        "X-RateLimit-Remaining": "0",
                    },
                )
            remaining = max(limit - count, 0)
            response = await call_next(request)
            response.headers["X-RateLimit-Limit"] = str(limit)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            return response
        except RedisError as exc:
            logger.warning("API rate limit skipped (Redis unavailable): %s", exc)
            return await call_next(request)
        except Exception as exc:  # noqa: BLE001 — never block requests on limiter bugs
            logger.warning("API rate limit skipped: %s", exc)
            return await call_next(request)
