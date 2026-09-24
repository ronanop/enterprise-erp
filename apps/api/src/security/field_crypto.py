"""AES field encryption for HR PII stored in PostgreSQL.

Ciphertext is prefixed with ``enc1:`` so existing plaintext can be detected
and migrated. Values that are already encrypted are left unchanged.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from functools import lru_cache
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from core.config import settings

CIPHER_PREFIX = "enc1:"
_JSON_MARKER = "enc"


def is_encrypted(value: str | None) -> bool:
    return isinstance(value, str) and value.startswith(CIPHER_PREFIX)


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    raw = (settings.pii_encryption_key or "").strip().encode()
    if not raw:
        raise RuntimeError("PII_ENCRYPTION_KEY is not configured")
    try:
        return Fernet(raw)
    except (ValueError, TypeError):
        digest = hashlib.pbkdf2_hmac("sha256", raw, b"erp-hr-pii-v1", 120_000, dklen=32)
        return Fernet(base64.urlsafe_b64encode(digest))


def pii_lookup(value: str | None) -> str | None:
    """Stable HMAC so encrypted email/mobile can still be matched exactly."""
    if value is None:
        return None
    text = str(value).strip().lower()
    if text == "" or is_encrypted(text):
        return None
    key = (settings.pii_encryption_key or "").encode()
    return hmac.new(key, text.encode(), hashlib.sha256).hexdigest()


def encrypt_str(plain: str | None) -> str | None:
    if plain is None:
        return None
    text = str(plain)
    if text == "" or is_encrypted(text):
        return text
    token = _fernet().encrypt(text.encode()).decode()
    return f"{CIPHER_PREFIX}{token}"


def decrypt_str(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value)
    if text == "" or not is_encrypted(text):
        return text
    token = text[len(CIPHER_PREFIX) :]
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt PII field") from exc


def encrypt_json(value: Any) -> str:
    payload = json.dumps(value, separators=(",", ":"), default=str)
    encrypted = encrypt_str(payload)
    if encrypted is None:
        raise ValueError("Unable to encrypt PII JSON")
    return encrypted


def decrypt_json(value: Any) -> Any:
    if isinstance(value, dict) and set(value.keys()) == {_JSON_MARKER}:
        value = value[_JSON_MARKER]
    if not isinstance(value, str):
        return value
    plain = decrypt_str(value)
    if plain is None or not is_encrypted(str(value)):
        return value
    return json.loads(plain)


def json_ciphertext_envelope(value: Any) -> dict[str, str]:
    return {_JSON_MARKER: encrypt_json(value)}
