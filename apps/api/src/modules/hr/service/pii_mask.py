"""Mask / extract / restore PII fields for digital onboarding portal payloads."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


def looks_masked(value: str | None) -> bool:
    if not value:
        return False
    text = str(value)
    return "*" in text or "•" in text


def mask_keep_last(value: str | None, *, keep: int = 4, mask_char: str = "*") -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    if looks_masked(text):
        return text
    if len(text) <= keep:
        return mask_char * len(text)
    return (mask_char * (len(text) - keep)) + text[-keep:]


def mask_email(value: str | None) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text or looks_masked(text):
        return text
    if "@" not in text:
        return mask_keep_last(text, keep=2)
    local, _, domain = text.partition("@")
    if not local:
        return f"*@{domain}"
    if len(local) == 1:
        masked_local = "*"
    else:
        masked_local = local[0] + ("*" * (len(local) - 1))
    return f"{masked_local}@{domain}"


def mask_phone(value: str | None) -> str:
    return mask_keep_last(value, keep=4)


def mask_aadhaar(value: str | None) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if not digits:
        text = str(value or "").strip()
        return text if looks_masked(text) else ""
    return mask_keep_last(digits, keep=4)


def mask_pan(value: str | None) -> str:
    text = str(value or "").strip().upper()
    if not text:
        return ""
    if looks_masked(text):
        return text
    if len(text) <= 4:
        return "*" * len(text)
    # e.g. ABCDE1234F → ******234F
    return ("*" * (len(text) - 4)) + text[-4:]


def mask_account(value: str | None) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if digits:
        return mask_keep_last(digits, keep=4)
    return mask_keep_last(value, keep=4)


def mask_dob(value: str | None) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if looks_masked(text):
        return text
    if len(text) >= 8 and text[4] == "-" and text[7] == "-":
        return "****-**-**"
    return mask_keep_last(text, keep=2)


_PERSONAL_KEYS = ("phone", "email", "personalEmail", "dob", "address", "permanentAddress")
_GOV_KEYS = ("aadhaar", "pan", "passport", "drivingLicense", "uan", "esic")
_BANK_KEYS = ("accountNumber", "upi")
_EMERGENCY_KEYS = ("phone", "address")


def _get_section(portal: dict[str, Any], key: str) -> dict[str, Any]:
    section = portal.get(key)
    return dict(section) if isinstance(section, dict) else {}


def extract_portal_pii(portal: dict[str, Any] | None) -> dict[str, Any]:
    """Pull clear-text PII from a portal payload (skips values that already look masked)."""
    src = portal if isinstance(portal, dict) else {}
    out: dict[str, Any] = {}

    personal = _get_section(src, "personal")
    personal_pii = {
        k: str(personal.get(k) or "").strip()
        for k in _PERSONAL_KEYS
        if str(personal.get(k) or "").strip() and not looks_masked(str(personal.get(k)))
    }
    if personal_pii:
        out["personal"] = personal_pii

    gov = _get_section(src, "governmentIds")
    gov_pii = {
        k: str(gov.get(k) or "").strip()
        for k in _GOV_KEYS
        if str(gov.get(k) or "").strip() and not looks_masked(str(gov.get(k)))
    }
    if gov_pii:
        out["governmentIds"] = gov_pii

    bank = _get_section(src, "bank")
    bank_pii = {
        k: str(bank.get(k) or "").strip()
        for k in _BANK_KEYS
        if str(bank.get(k) or "").strip() and not looks_masked(str(bank.get(k)))
    }
    if bank_pii:
        out["bank"] = bank_pii

    emergency = _get_section(src, "emergency")
    emergency_pii = {
        k: str(emergency.get(k) or "").strip()
        for k in _EMERGENCY_KEYS
        if str(emergency.get(k) or "").strip() and not looks_masked(str(emergency.get(k)))
    }
    if emergency_pii:
        out["emergency"] = emergency_pii

    return out


def merge_portal_pii(
    existing: dict[str, Any] | None, incoming: dict[str, Any] | None
) -> dict[str, Any]:
    base = deepcopy(existing) if isinstance(existing, dict) else {}
    inc = incoming if isinstance(incoming, dict) else {}
    for section, keys in (
        ("personal", _PERSONAL_KEYS),
        ("governmentIds", _GOV_KEYS),
        ("bank", _BANK_KEYS),
        ("emergency", _EMERGENCY_KEYS),
    ):
        section_inc = inc.get(section)
        if not isinstance(section_inc, dict):
            continue
        section_base = dict(base.get(section) or {}) if isinstance(base.get(section), dict) else {}
        for key in keys:
            val = section_inc.get(key)
            if val is None:
                continue
            text = str(val).strip()
            if text and not looks_masked(text):
                section_base[key] = text
        if section_base:
            base[section] = section_base
    return base


def apply_masks_to_portal(portal: dict[str, Any] | None) -> dict[str, Any]:
    """Return a deep-copied portal with PII fields masked for storage / HR display."""
    out = deepcopy(portal) if isinstance(portal, dict) else {}

    personal = _get_section(out, "personal")
    if personal:
        if personal.get("phone"):
            personal["phone"] = mask_phone(personal.get("phone"))
        if personal.get("email"):
            personal["email"] = mask_email(personal.get("email"))
        if personal.get("personalEmail"):
            personal["personalEmail"] = mask_email(personal.get("personalEmail"))
        if personal.get("dob"):
            personal["dob"] = mask_dob(personal.get("dob"))
        if personal.get("address"):
            personal["address"] = mask_keep_last(str(personal.get("address")), keep=6)
        if personal.get("permanentAddress"):
            personal["permanentAddress"] = mask_keep_last(
                str(personal.get("permanentAddress")), keep=6
            )
        out["personal"] = personal

    gov = _get_section(out, "governmentIds")
    if gov:
        if gov.get("aadhaar"):
            gov["aadhaar"] = mask_aadhaar(gov.get("aadhaar"))
        if gov.get("pan"):
            gov["pan"] = mask_pan(gov.get("pan"))
        for key in ("passport", "drivingLicense", "uan", "esic"):
            if gov.get(key):
                gov[key] = mask_keep_last(str(gov.get(key)), keep=4)
        out["governmentIds"] = gov

    bank = _get_section(out, "bank")
    if bank:
        if bank.get("accountNumber"):
            bank["accountNumber"] = mask_account(bank.get("accountNumber"))
        if bank.get("upi"):
            bank["upi"] = mask_keep_last(str(bank.get("upi")), keep=4)
        out["bank"] = bank

    emergency = _get_section(out, "emergency")
    if emergency:
        if emergency.get("phone"):
            emergency["phone"] = mask_phone(emergency.get("phone"))
        if emergency.get("address"):
            emergency["address"] = mask_keep_last(str(emergency.get("address")), keep=6)
        out["emergency"] = emergency

    return out


def restore_portal_pii(
    portal: dict[str, Any] | None, pii: dict[str, Any] | None
) -> dict[str, Any]:
    """Merge clear-text PII back into portal (for candidate resume editing / hire)."""
    out = deepcopy(portal) if isinstance(portal, dict) else {}
    src = pii if isinstance(pii, dict) else {}
    for section, keys in (
        ("personal", _PERSONAL_KEYS),
        ("governmentIds", _GOV_KEYS),
        ("bank", _BANK_KEYS),
        ("emergency", _EMERGENCY_KEYS),
    ):
        section_pii = src.get(section)
        if not isinstance(section_pii, dict):
            continue
        section_out = _get_section(out, section)
        for key in keys:
            val = section_pii.get(key)
            if val is None:
                continue
            text = str(val).strip()
            if text and not looks_masked(text):
                section_out[key] = text
        out[section] = section_out
    return out


def mask_portal_for_storage(
    portal: dict[str, Any] | None,
    existing_pii: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Split clear PII into portalPii and return a masked portal for case_json.portal.
    Preserves previously stored clear values when the incoming field is already masked.
    """
    incoming_pii = extract_portal_pii(portal)
    merged_pii = merge_portal_pii(existing_pii, incoming_pii)
    # Prefer clear values from merged_pii when writing the masked view
    full_view = restore_portal_pii(portal, merged_pii)
    masked = apply_masks_to_portal(full_view)
    return masked, merged_pii
