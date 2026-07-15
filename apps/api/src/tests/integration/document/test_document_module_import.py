"""Integration smoke: Document module imports and router mount."""

from modules.document.models import DocDocument, DocFolder, DocRetentionPolicy
from modules.document.router import document_router
from modules.document.service import (
    DocumentApplicationService,
    DocumentAuditService,
    DocumentIntegrationService,
    DocumentReportService,
    DocumentService,
    FolderService,
)
from modules.document.service.engines import DocumentEngine, FolderEngine


def test_document_models_importable():
    assert DocFolder.__tablename__ == "doc_folder"
    assert DocDocument.__tablename__ == "doc_document"
    assert DocRetentionPolicy.__tablename__ == "doc_retention_policy"


def test_document_router_mounted():
    assert document_router.prefix == "/documents"
    paths = [getattr(r, "path", "") for r in document_router.routes]
    assert any("/{row_id}" in p for p in paths)
    assert any("documents" in p for p in paths)
    assert any("folders" in p for p in paths)


def test_document_services_and_engines_importable():
    assert DocumentApplicationService is not None
    assert DocumentService is not None
    assert FolderService is not None
    assert DocumentReportService is not None
    assert DocumentAuditService is not None
    assert DocumentIntegrationService is not None
    assert DocumentEngine is not None
    assert FolderEngine is not None
