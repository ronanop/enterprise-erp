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


def check_redis_connection() -> bool:
    try:
        return bool(get_redis().ping())
    except Exception:
        return False


class SessionStore:
    def __init__(self, client: redis.Redis | None = None) -> None:
        self._client = client or get_redis()
        self._ttl = settings.session_ttl_seconds

    def set_session(self, session_id: UUID, payload: dict[str, Any]) -> None:
        key = f"session:{session_id}"
        try:
            self._client.setex(key, self._ttl, json.dumps(payload))
        except redis.ConnectionError:
            return

    def get_session(self, session_id: UUID) -> dict[str, Any] | None:
        try:
            raw = cast(str | None, self._client.get(f"session:{session_id}"))
        except redis.ConnectionError:
            return None
        if raw is None:
            return None
        return json.loads(raw)

    def delete_session(self, session_id: UUID) -> None:
        try:
            self._client.delete(f"session:{session_id}")
        except redis.ConnectionError:
            return

    def set_permissions(self, user_id: UUID, permissions: set[str]) -> None:
        key = f"permissions:{user_id}"
        ttl = settings.jwt_access_token_expire_minutes * 60
        try:
            self._client.setex(key, ttl, json.dumps(list(permissions)))
        except redis.ConnectionError:
            return

    def get_permissions(self, user_id: UUID) -> set[str] | None:
        try:
            raw = cast(str | None, self._client.get(f"permissions:{user_id}"))
        except redis.ConnectionError:
            return None
        if raw is None:
            return None
        return set(json.loads(raw))

    def invalidate_permissions(self, user_id: UUID) -> None:
        try:
            self._client.delete(f"permissions:{user_id}")
        except redis.ConnectionError:
            return

    def increment_login_attempts(self, ip: str) -> int:
        key = f"rate_limit:login:{ip}"
        count = cast(int, self._client.incr(key))
        if count == 1:
            self._client.expire(key, settings.login_rate_window_seconds)
        return count
