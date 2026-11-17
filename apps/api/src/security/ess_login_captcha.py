"""ESS login CAPTCHA: short typeable code (in-memory, dev/small deploy)."""

from __future__ import annotations

import random
import string
import time
from uuid import uuid4

from core.config import get_settings

_store: dict[str, tuple[str, float]] = {}
_TTL_SEC = 300
_CODE_ALPHABET = string.ascii_uppercase + string.digits


def captcha_enabled() -> bool:
    return bool(get_settings().ess_login_captcha_enabled)


def issue_challenge() -> tuple[str, str, str]:
    """Return (captcha_id, instruction, code_to_type). Always issues a challenge."""
    code = "".join(random.choices(_CODE_ALPHABET, k=5))
    challenge_id = str(uuid4())
    _store[challenge_id] = (code, time.time())
    _purge()
    return challenge_id, "Please type the below code", code


def verify_challenge(
    challenge_id: str | None,
    answer: str | None,
    *,
    required: bool | None = None,
) -> bool:
    """Verify captcha. required=True always checks; None follows ESS_LOGIN_CAPTCHA_ENABLED."""
    must = captcha_enabled() if required is None else required
    if not must:
        return True
    if not challenge_id or answer is None:
        return False
    entry = _store.pop(challenge_id, None)
    if entry is None:
        return False
    expected, created = entry
    if time.time() - created > _TTL_SEC:
        return False
    return str(answer).strip().upper() == expected.upper()


def _purge() -> None:
    now = time.time()
    stale = [k for k, (_, t) in _store.items() if now - t > _TTL_SEC]
    for k in stale:
        _store.pop(k, None)
