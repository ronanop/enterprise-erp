"""Security tests for CRM permissions/roles."""

from modules.crm.permissions import (
    CRM_ADMIN_PERMISSIONS,
    CRM_MARKETING_PERMISSIONS,
    CRM_PERMISSIONS,
    CRM_SALES_MANAGER_PERMISSIONS,
    CRM_SALES_REP_PERMISSIONS,
)


def test_permission_codes_unique():
    codes = [p[0] for p in CRM_PERMISSIONS]
    assert len(codes) == len(set(codes))
    assert all(c.startswith("crm.") for c in codes)


def test_roles_have_permissions():
    assert "crm.lead:convert" in CRM_SALES_MANAGER_PERMISSIONS
    assert "crm.lead:convert" not in CRM_SALES_REP_PERMISSIONS
    assert "crm.campaign:create" in CRM_MARKETING_PERMISSIONS
    assert len(CRM_ADMIN_PERMISSIONS) == len(CRM_PERMISSIONS)
