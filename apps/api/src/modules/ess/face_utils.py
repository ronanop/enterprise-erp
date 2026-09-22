"""Lightweight face-image fingerprint for ESS (dev-friendly; replace with vendor API in production)."""

from __future__ import annotations

import base64
import binascii
import re


def _decode_image_bytes(image_base64: str) -> bytes:
    raw = image_base64.strip()
    if "," in raw:
        raw = raw.split(",", 1)[1]
    raw = re.sub(r"\s+", "", raw)
    try:
        return base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Invalid image data") from exc


def image_fingerprint(image_base64: str) -> str:
    """64-bit average hash as 16-char hex (tolerates minor re-encode differences)."""
    data = _decode_image_bytes(image_base64)
    if len(data) < 16:
        raise ValueError("Image too small")
    samples = [data[i * len(data) // 64] for i in range(64)]
    avg = sum(samples) / 64
    bits = 0
    for i, sample in enumerate(samples):
        if sample >= avg:
            bits |= 1 << i
    return f"{bits:016x}"


def fingerprints_match(stored_hex: str, candidate_hex: str, *, max_hamming: int = 14) -> bool:
    try:
        a = int(stored_hex, 16)
        b = int(candidate_hex, 16)
    except ValueError:
        return False
    return (a ^ b).bit_count() <= max_hamming
