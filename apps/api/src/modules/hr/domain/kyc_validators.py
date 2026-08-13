"""India KYC validators for HR employee profile."""

from __future__ import annotations

import re

from core.exceptions import AppException

PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
AADHAAR_RE = re.compile(r"^\d{12}$")
UAN_RE = re.compile(r"^\d{12}$")
IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")

# Verhoeff algorithm tables for Aadhaar checksum
_D = (
    (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    (1, 2, 3, 4, 0, 6, 7, 8, 9, 5),
    (2, 3, 4, 0, 1, 7, 8, 9, 5, 6),
    (3, 4, 0, 1, 2, 8, 9, 5, 6, 7),
    (4, 0, 1, 2, 3, 9, 5, 6, 7, 8),
    (5, 9, 8, 7, 6, 0, 4, 3, 2, 1),
    (6, 5, 9, 8, 7, 1, 0, 4, 3, 2),
    (7, 6, 5, 9, 8, 2, 1, 0, 4, 3),
    (8, 7, 6, 5, 9, 3, 2, 1, 0, 4),
    (9, 8, 7, 6, 5, 4, 3, 2, 1, 0),
)
_P = (
    (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    (1, 5, 7, 6, 2, 8, 3, 0, 9, 4),
    (5, 8, 0, 3, 7, 9, 6, 1, 4, 2),
    (8, 9, 1, 6, 0, 4, 3, 5, 2, 7),
    (9, 4, 5, 3, 1, 2, 6, 8, 7, 0),
    (4, 2, 8, 6, 5, 7, 3, 9, 0, 1),
    (2, 7, 9, 3, 8, 0, 6, 4, 1, 5),
    (7, 0, 4, 6, 9, 1, 3, 2, 5, 8),
)


def _verhoeff_ok(num: str) -> bool:
    c = 0
    for i, ch in enumerate(reversed(num)):
        c = _D[c][_P[i % 8][int(ch)]]
    return c == 0


def validate_pan(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip().upper()
    if not PAN_RE.match(v):
        raise AppException("Invalid PAN format (e.g. ABCDE1234F)")
    return v


def validate_aadhaar(value: str | None) -> str | None:
    if not value:
        return None
    v = re.sub(r"\s", "", value)
    if not AADHAAR_RE.match(v):
        raise AppException("Aadhaar must be 12 digits")
    if not _verhoeff_ok(v):
        raise AppException("Aadhaar failed checksum validation")
    return v


def validate_uan(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip()
    if not UAN_RE.match(v):
        raise AppException("UAN must be 12 digits when provided")
    return v


def validate_ifsc(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip().upper()
    if not IFSC_RE.match(v):
        raise AppException("Invalid IFSC code")
    return v


def normalize_kyc_fields(fields: dict) -> dict:
    out = dict(fields)
    if "pan_number" in out:
        out["pan_number"] = validate_pan(out.get("pan_number"))
    if "aadhaar_number" in out:
        out["aadhaar_number"] = validate_aadhaar(out.get("aadhaar_number"))
    if "uan_number" in out:
        out["uan_number"] = validate_uan(out.get("uan_number"))
    if "bank_ifsc" in out:
        out["bank_ifsc"] = validate_ifsc(out.get("bank_ifsc"))
    return out
