"""GRC RBAC permission tests."""

from modules.grc.permissions import (
    COMPLIANCE_OFFICER_PERMISSIONS,
    GRC_ADMIN_PERMISSIONS,
    GRC_MANAGER_PERMISSIONS,
    GRC_PERMISSIONS,
    RISK_MANAGER_PERMISSIONS,
)


def test_grc_permissions_defined():
    assert len(GRC_PERMISSIONS) >= 40
    assert "grc.policy:approve" in [p[0] for p in GRC_PERMISSIONS]
    assert "grc.policy:publish" in [p[0] for p in GRC_PERMISSIONS]
    assert "grc.incident:close" in [p[0] for p in GRC_PERMISSIONS]


def test_grc_roles():
    assert GRC_MANAGER_PERMISSIONS
    assert RISK_MANAGER_PERMISSIONS
    assert COMPLIANCE_OFFICER_PERMISSIONS
    assert GRC_ADMIN_PERMISSIONS
    assert "grc.policy:approve" in GRC_MANAGER_PERMISSIONS
    assert "grc.risk:approve" in RISK_MANAGER_PERMISSIONS
    assert "grc.compliance_framework:create" in COMPLIANCE_OFFICER_PERMISSIONS
