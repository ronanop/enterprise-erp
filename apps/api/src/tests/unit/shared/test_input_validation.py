"""Unit tests for platform input / filename validation."""

import pytest

from shared.input_validation import (
    UnsafeInputError,
    assert_safe_entry_text,
    assert_safe_filename,
    extract_multipart_filenames,
    validate_json_entries,
)


def test_rejects_path_traversal_filename() -> None:
    with pytest.raises(UnsafeInputError, match="path"):
        assert_safe_filename("../../etc/passwd.pdf")


def test_rejects_blocked_extension() -> None:
    with pytest.raises(UnsafeInputError, match="not allowed"):
        assert_safe_filename("payload.html")


def test_allows_safe_pdf_name() -> None:
    assert assert_safe_filename("Customer PO (final).pdf") == "Customer PO (final).pdf"


def test_rejects_xss_entry() -> None:
    with pytest.raises(UnsafeInputError, match="HTML"):
        assert_safe_entry_text("<script>alert(1)</script>", field="name")


def test_validate_json_entries_file_name() -> None:
    with pytest.raises(UnsafeInputError):
        validate_json_entries({"file_name": "../evil.svg", "title": "ok"})


def test_validate_json_entries_allows_plain() -> None:
    validate_json_entries({"title": "Acme Corp", "notes": "Follow up next week"})


def test_validate_json_entries_allows_large_file_data_url() -> None:
    """Onboarding portal stores uploads as data URLs — must not hit the 20k text cap."""
    payload = {
        "portal": {
            "documents": [
                {
                    "id": "doc-1",
                    "fileName": "offer.pdf",
                    "fileDataUrl": "data:application/pdf;base64," + ("A" * 50_000),
                }
            ],
            "policies": {
                "signatureDataUrl": "data:image/png;base64," + ("B" * 30_000),
            },
        }
    }
    validate_json_entries(payload)


def test_extract_multipart_filenames() -> None:
    body = (
        b"------boundary\r\n"
        b'Content-Disposition: form-data; name="file"; filename="../../x.html"\r\n'
        b"Content-Type: text/html\r\n\r\n"
        b"<html></html>\r\n"
    )
    names = extract_multipart_filenames(body)
    assert names == ["../../x.html"]
