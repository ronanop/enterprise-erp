"""SQLAlchemy column types that encrypt PII at rest and decrypt on load."""

from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any

from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator

from security.field_crypto import (
    decrypt_json,
    decrypt_str,
    encrypt_str,
    is_encrypted,
    json_ciphertext_envelope,
)


class EncryptedString(TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect: Any) -> str | None:
        if value is None:
            return None
        return encrypt_str(str(value))

    def process_result_value(self, value: str | None, dialect: Any) -> str | None:
        if value is None:
            return None
        return decrypt_str(str(value))


class EncryptedDate(TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value: date | datetime | str | None, dialect: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            value = value.date()
        if isinstance(value, date):
            plain = value.isoformat()
        else:
            plain = str(value)[:10]
        return encrypt_str(plain)

    def process_result_value(self, value: str | None, dialect: Any) -> date | None:
        if value is None:
            return None
        plain = decrypt_str(str(value)) or ""
        if not plain:
            return None
        return date.fromisoformat(plain[:10])


class EncryptedJSON(TypeDecorator):
    """JSONB column stored as {\"enc\": \"enc1:...\"}. Legacy objects still load."""

    impl = JSONB
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, dict) and set(value.keys()) == {"enc"} and is_encrypted(value.get("enc")):
            return value
        return json_ciphertext_envelope(value)

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, dict) and set(value.keys()) == {"enc"}:
            return decrypt_json(value)
        if isinstance(value, str):
            loaded = decrypt_json(value)
            if isinstance(loaded, str):
                try:
                    return json.loads(loaded)
                except json.JSONDecodeError:
                    return loaded
            return loaded
        return value
