"""Verify landing access codes and issue gate tokens."""

from __future__ import annotations

import hmac
import re

from core.config import settings
from core.exceptions import UnauthorizedException, ValidationException
from modules.landing.schemas import AccessGateSessionData, AccessGateTarget, AccessGateVerifyData
from security.jwt import JWTService

_REDIRECT: dict[AccessGateTarget, str] = {
    "demo": "/demo",
    "connectplus": "/login",
}


def _normalize_code(raw: str) -> str:
    return re.sub(r"\s+", "", raw.strip()).upper()


class AccessGateService:
    def __init__(self) -> None:
        self._jwt = JWTService()

    def verify_code(self, code: str) -> AccessGateVerifyData:
        normalized = _normalize_code(code)
        if len(normalized) < 4:
            raise ValidationException("Enter a valid access code")

        target = self._match_target(normalized)
        if target is None:
            raise UnauthorizedException("Invalid access code")

        hours = max(1, int(settings.access_gate_token_hours))
        token = self._jwt.create_access_gate_token(target=target, hours=hours)
        return AccessGateVerifyData(
            target=target,
            redirect_path=_REDIRECT[target],
            token=token,
            expires_in_hours=hours,
        )

    def resolve_session(self, token: str) -> AccessGateSessionData:
        payload = self._jwt.decode_token(token, expected_type="access_gate")
        target = payload.get("target")
        if target not in _REDIRECT:
            raise UnauthorizedException("Invalid access gate token")
        return AccessGateSessionData(
            target=target,  # type: ignore[arg-type]
            redirect_path=_REDIRECT[target],  # type: ignore[index]
        )

    def _match_target(self, normalized: str) -> AccessGateTarget | None:
        demo = _normalize_code(settings.access_code_demo)
        connect = _normalize_code(settings.access_code_connectplus)

        def _eq(candidate: str, expected: str) -> bool:
            # hmac.compare_digest raises if lengths differ — treat as non-match.
            if not expected or len(candidate) != len(expected):
                return False
            return hmac.compare_digest(candidate, expected)

        matches_demo = _eq(normalized, demo)
        matches_connect = _eq(normalized, connect)
        if matches_demo and matches_connect:
            # Misconfiguration: same code for both — prefer connectplus.
            return "connectplus"
        if matches_demo:
            return "demo"
        if matches_connect:
            return "connectplus"
        return None
