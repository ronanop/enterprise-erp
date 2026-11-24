"""Tests for upload hardening (VAPT stored XSS via attachments)."""

import pytest

from shared.upload_safety import (
    OUTLOOK_MAIL_EXPORT_EXTENSIONS,
    UnsafeUploadError,
    content_disposition_type,
    sanitize_filename,
    validate_upload,
)


def test_blocks_html_extension() -> None:
    with pytest.raises(UnsafeUploadError):
        validate_upload(
            file_name="xss.html",
            content_type="text/html",
            raw=b"<script>alert(1)</script>",
        )


def test_blocks_svg_extension() -> None:
    with pytest.raises(UnsafeUploadError):
        validate_upload(
            file_name="payload.svg",
            content_type="image/svg+xml",
            raw=b'<svg onload="alert(1)"></svg>',
        )


def test_blocks_html_masquerading_as_pdf() -> None:
    with pytest.raises(UnsafeUploadError):
        validate_upload(
            file_name="invoice.pdf",
            content_type="application/pdf",
            raw=b"<!DOCTYPE html><html><script>alert(1)</script></html>",
        )


def test_allows_pdf_bytes() -> None:
    name, media = validate_upload(
        file_name="quote.pdf",
        content_type="application/pdf",
        raw=b"%PDF-1.4 fake",
    )
    assert name == "quote.pdf"
    assert media == "application/pdf"
    assert content_disposition_type(name, media) == "attachment"


def test_sanitize_strips_path_and_specials() -> None:
    assert ".." not in sanitize_filename("../../evil.html")
    cleaned = sanitize_filename("1_--____script__svg_onload='_alert(Xss)_'_.pdf")
    assert "<" not in cleaned
    assert cleaned.endswith(".pdf")


def test_office_download_not_inline() -> None:
    assert content_disposition_type("boq.xlsx", "application/vnd.ms-excel") == "attachment"


def test_allowed_extensions_override() -> None:
    name, _ = validate_upload(
        file_name="diag.zip",
        content_type="application/zip",
        raw=b"PK\x03\x04fake",
        allowed_extensions=frozenset({".zip"}),
    )
    assert name == "diag.zip"


def test_override_still_blocks_html() -> None:
    with pytest.raises(UnsafeUploadError):
        validate_upload(
            file_name="x.html",
            content_type="text/html",
            raw=b"<html></html>",
            allowed_extensions=frozenset({".html"}),
        )


def test_outlook_export_allows_eml_and_msg() -> None:
    eml_name, eml_media = validate_upload(
        file_name="vendor.eml",
        content_type="message/rfc822",
        raw=b"From: a@b.com\r\nTo: c@d.com\r\nSubject: Quote\r\n\r\nHi",
        allowed_extensions=OUTLOOK_MAIL_EXPORT_EXTENSIONS,
    )
    assert eml_name == "vendor.eml"
    assert eml_media == "message/rfc822"

    msg_name, msg_media = validate_upload(
        file_name="vendor.msg",
        content_type="application/octet-stream",
        raw=b"\xd0\xcf\x11\xe0" + b"\x00" * 32,
        allowed_extensions=OUTLOOK_MAIL_EXPORT_EXTENSIONS,
    )
    assert msg_name == "vendor.msg"
    assert msg_media == "application/vnd.ms-outlook"


def test_outlook_export_rejects_pdf_and_fake_msg() -> None:
    with pytest.raises(UnsafeUploadError, match="Outlook email export"):
        validate_upload(
            file_name="quote.pdf",
            content_type="application/pdf",
            raw=b"%PDF-1.4",
            allowed_extensions=OUTLOOK_MAIL_EXPORT_EXTENSIONS,
        )
    with pytest.raises(UnsafeUploadError, match="does not look like an Outlook"):
        validate_upload(
            file_name="fake.msg",
            content_type="application/octet-stream",
            raw=b"%PDF-1.4xxxx",
            allowed_extensions=OUTLOOK_MAIL_EXPORT_EXTENSIONS,
        )
