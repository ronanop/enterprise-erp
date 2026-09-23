"""JWT token encoding and decoding."""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

import jwt

from core.config import settings
from core.exceptions import UnauthorizedException


class JWTService:
    def __init__(self) -> None:
        # PyJWT recommends >= 32 bytes for HS256; pad short local secrets so encode never fails.
        secret = (settings.jwt_secret_key or "").strip() or "change-me-in-production"
        if len(secret.encode("utf-8")) < 32:
            secret = (secret * ((32 // max(len(secret), 1)) + 1))[:48]
        self._secret = secret
        self._algorithm = settings.jwt_algorithm
        self._access_minutes = settings.jwt_access_token_expire_minutes
        self._refresh_days = settings.jwt_refresh_token_expire_days

    def create_access_token(
        self,
        *,
        user_id: UUID,
        tenant_id: UUID,
        user_type: str,
        session_id: UUID,
    ) -> str:
        now = datetime.now(timezone.utc)
        payload = {
            "sub": str(user_id),
            "tenant_id": str(tenant_id),
            "user_type": user_type,
            "session_id": str(session_id),
            "type": "access",
            "iat": now,
            "exp": now + timedelta(minutes=self._access_minutes),
        }
        return jwt.encode(payload, self._secret, algorithm=self._algorithm)

    def create_refresh_token(self, *, user_id: UUID, session_id: UUID) -> tuple[str, str]:
        token_id = str(uuid4())
        now = datetime.now(timezone.utc)
        payload = {
            "sub": str(user_id),
            "session_id": str(session_id),
            "jti": token_id,
            "type": "refresh",
            "iat": now,
            "exp": now + timedelta(days=self._refresh_days),
        }
        token = jwt.encode(payload, self._secret, algorithm=self._algorithm)
        return token, token_id

    def create_access_gate_token(self, *, target: str, hours: int | None = None) -> str:
        """Short-lived token proving a landing access code was verified."""
        now = datetime.now(timezone.utc)
        ttl = hours if hours is not None else settings.access_gate_token_hours
        payload = {
            "type": "access_gate",
            "target": target,
            "jti": str(uuid4()),
            "iat": now,
            "exp": now + timedelta(hours=max(1, ttl)),
        }
        return jwt.encode(payload, self._secret, algorithm=self._algorithm)

    def decode_token(self, token: str, *, expected_type: str | None = None) -> dict[str, Any]:
        try:
            payload = jwt.decode(token, self._secret, algorithms=[self._algorithm])
        except jwt.PyJWTError as exc:
            raise UnauthorizedException("Invalid or expired token") from exc
        if expected_type and payload.get("type") != expected_type:
            raise UnauthorizedException("Invalid token type")
        return payload
