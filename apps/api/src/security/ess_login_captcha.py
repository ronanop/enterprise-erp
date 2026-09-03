"""Simple math CAPTCHA for ESS login (in-memory, dev/small deploy)."""

from __future__ import annotations

import random
import time
from uuid import uuid4

from core.config import get_settings

_store: dict[str, tuple[int, float]] = {}
_TTL_SEC = 300


def captcha_enabled() -> bool:
    return bool(get_settings().ess_login_captcha_enabled)


def issue_challenge() -> tuple[str, str]:
    a = random.randint(1, 9)
    b = random.randint(1, 9)
    challenge_id = str(uuid4())
    _store[challenge_id] = (a + b, time.time())
    _purge()
    return challenge_id, f"What is {a} + {b}?"


def verify_challenge(challenge_id: str | None, answer: str | None) -> bool:
    if not captcha_enabled():
        return True
    if not challenge_id or answer is None:
        return False
    entry = _store.pop(challenge_id, None)
    if entry is None:
        return False
    expected, created = entry
    if time.time() - created > _TTL_SEC:
        return False
    try:
        return int(str(answer).strip()) == expected
    except ValueError:
        return False


def _purge() -> None:
    now = time.time()
    stale = [k for k, (_, t) in _store.items() if now - t > _TTL_SEC]
    for k in stale:
        _store.pop(k, None)
