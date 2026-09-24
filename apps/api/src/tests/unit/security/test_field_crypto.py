"""HR PII field encryption."""

from security.field_crypto import decrypt_json, decrypt_str, encrypt_json, encrypt_str, is_encrypted, pii_lookup


def test_encrypt_and_decrypt_roundtrip() -> None:
    cipher = encrypt_str("ABCDE1234F")
    assert cipher is not None
    assert is_encrypted(cipher)
    assert cipher != "ABCDE1234F"
    assert decrypt_str(cipher) == "ABCDE1234F"


def test_encrypt_is_idempotent() -> None:
    once = encrypt_str("123412341234")
    twice = encrypt_str(once)
    assert once == twice
    assert decrypt_str(twice) == "123412341234"


def test_legacy_plaintext_passes_through() -> None:
    assert decrypt_str("999988887777") == "999988887777"


def test_lookup_is_stable_and_hides_email() -> None:
    first = pii_lookup("Anil@Example.com")
    second = pii_lookup("  anil@example.com ")
    assert first is not None
    assert first == second
    assert "anil" not in first
    assert pii_lookup("other@example.com") != first


def test_json_pii_roundtrip() -> None:
    payload = {"personal": {"phone": "9876543210"}, "governmentIds": {"aadhaar": "123412341234"}}
    cipher = encrypt_json(payload)
    assert is_encrypted(cipher)
    assert decrypt_json(cipher) == payload
