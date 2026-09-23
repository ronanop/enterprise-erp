"""Unit tests for asset document file validation helpers."""

from io import BytesIO
from zipfile import ZipFile, ZipInfo

import pytest

from modules.asset.domain.exceptions import DocumentValidationError
from modules.asset.service.document_file import (
    build_asset_doc_uri,
    display_filename,
    parse_asset_doc_uri,
    sniff_content_type,
    validate_upload_bytes,
)


def _minimal_docx() -> bytes:
    buf = BytesIO()
    with ZipFile(buf, "w") as zf:
        zf.writestr(ZipInfo("word/document.xml"), "<w:document />")
        zf.writestr(ZipInfo("[Content_Types].xml"), "<Types />")
    return buf.getvalue()


def test_display_filename_preserves_original_name() -> None:
    assert display_filename(r"C:\invoices\HP_Laptop_Invoice_2026.pdf") == "HP_Laptop_Invoice_2026.pdf"


def test_validate_pdf_upload() -> None:
    data = b"%PDF-1.4 minimal"
    ctype, name, size = validate_upload_bytes(
        data,
        declared_content_type="application/pdf",
        original_filename="purchase_invoice.pdf",
    )
    assert ctype == "application/pdf"
    assert name == "purchase_invoice.pdf"
    assert size == len(data)


def test_validate_rejects_exe() -> None:
    with pytest.raises(DocumentValidationError, match="not allowed|Executable|supported"):
        validate_upload_bytes(b"MZ..............", original_filename="bad.exe")


def test_sniff_docx() -> None:
    assert sniff_content_type(_minimal_docx(), original_filename="a.docx").endswith("wordprocessingml.document")


def test_asset_doc_uri_roundtrip() -> None:
    uri = build_asset_doc_uri(
        "asset-documents/aid/file.pdf",
        content_type="application/pdf",
        file_size_bytes=2400,
    )
    meta = parse_asset_doc_uri(uri)
    assert meta.is_stored
    assert meta.storage_key == "asset-documents/aid/file.pdf"
    assert meta.content_type == "application/pdf"
    assert meta.file_size_bytes == 2400
