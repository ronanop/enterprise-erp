"""Redis client and session cache."""

import json
from typing import Any, cast
from uuid import UUID

import redis

from core.config import settings

_redis_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


class SessionStore:
    def __init__(self, client: redis.Redis | None = None) -> None:
        self._client = client or get_redis()
        self._ttl = settings.session_ttl_seconds

    def set_session(self, session_id: UUID, payload: dict[str, Any]) -> None:
        key = f"session:{session_id}"
        self._client.setex(key, self._ttl, json.dumps(payload))

    def get_session(self, session_id: UUID) -> dict[str, Any] | None:
        raw = cast(str | None, self._client.get(f"session:{session_id}"))
        if raw is None:
            return None
        return json.loads(raw)

    def delete_session(self, session_id: UUID) -> None:
        self._client.delete(f"session:{session_id}")

    def set_permissions(self, user_id: UUID, permissions: set[str]) -> None:
        key = f"permissions:{user_id}"
        ttl = settings.jwt_access_token_expire_minutes * 60
        self._client.setex(key, ttl, json.dumps(list(permissions)))

    def get_permissions(self, user_id: UUID) -> set[str] | None:
        raw = cast(str | None, self._client.get(f"permissions:{user_id}"))
        if raw is None:
            return None
        return set(json.loads(raw))

    def invalidate_permissions(self, user_id: UUID) -> None:
        self._client.delete(f"permissions:{user_id}")

    def touch_session(self, session_id: UUID, payload: dict[str, Any] | None = None) -> None:
        """Refresh session TTL; optionally replace cached payload."""
        key = f"session:{session_id}"
        if payload is not None:
            self._client.setex(key, self._ttl, json.dumps(payload))
            return
        raw = cast(str | None, self._client.get(key))
        if raw is not None:
            self._client.setex(key, self._ttl, raw)

    def increment_login_attempts(self, ip: str) -> int:
        """Return attempt count. When login_rate_limit <= 0, rate limiting is disabled."""
        if settings.login_rate_limit <= 0:
            return 0
        key = f"rate_limit:login:{ip}"
        count = cast(int, self._client.incr(key))
        if count == 1:
            self._client.expire(key, settings.login_rate_window_seconds)
        return count
