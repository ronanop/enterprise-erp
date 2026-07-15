"""Document RBAC permission tests."""

from modules.document.permissions import (
    DOCUMENT_ADMIN_PERMISSIONS,
    DOCUMENT_EDITOR_PERMISSIONS,
    DOCUMENT_MANAGER_PERMISSIONS,
    DOCUMENT_PERMISSIONS,
    DOCUMENT_REVIEWER_PERMISSIONS,
)


def test_document_permissions_defined():
    assert len(DOCUMENT_PERMISSIONS) >= 40
    assert "document.document:approve" in [p[0] for p in DOCUMENT_PERMISSIONS]
    assert "document.document:publish" in [p[0] for p in DOCUMENT_PERMISSIONS]


def test_document_roles():
    assert DOCUMENT_MANAGER_PERMISSIONS
    assert DOCUMENT_EDITOR_PERMISSIONS
    assert DOCUMENT_REVIEWER_PERMISSIONS
    assert DOCUMENT_ADMIN_PERMISSIONS
    assert "document.document:approve" in DOCUMENT_MANAGER_PERMISSIONS
    assert "document.folder:create" in DOCUMENT_ADMIN_PERMISSIONS
