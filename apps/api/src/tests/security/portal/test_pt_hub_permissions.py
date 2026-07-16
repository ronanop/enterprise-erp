"""Security tests for Customer Portal permissions."""

from modules.portal.permissions import (
    CUSTOMER_USER_PERMISSIONS,
    PORTAL_ADMIN_PERMISSIONS,
    PORTAL_MANAGER_PERMISSIONS,
    PORTAL_PERMISSIONS,
    SUPPORT_USER_PERMISSIONS,
)


def test_portal_permissions_defined():
    codes = [p[0] for p in PORTAL_PERMISSIONS]
    assert "portal.account:approve" in codes
    assert "portal.document_access:submit" in codes
    assert "portal.support_ticket:submit" in codes


def test_portal_roles():
    assert len(PORTAL_ADMIN_PERMISSIONS) == len(PORTAL_PERMISSIONS)
    assert any("portal.dashboard" in p for p in CUSTOMER_USER_PERMISSIONS)
    assert any("portal.support_ticket" in p for p in SUPPORT_USER_PERMISSIONS)
    assert any("portal.account" in p for p in PORTAL_MANAGER_PERMISSIONS)
