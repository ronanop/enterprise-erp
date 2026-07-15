"""Analytics RBAC permission tests."""

from modules.analytics.permissions import (
    ANALYTICS_PERMISSIONS,
    BI_ADMIN_PERMISSIONS,
    BI_ANALYST_PERMISSIONS,
    BI_MANAGER_PERMISSIONS,
    DATA_STEWARD_PERMISSIONS,
)


def test_analytics_permissions_defined():
    assert len(ANALYTICS_PERMISSIONS) >= 40
    codes = [p[0] for p in ANALYTICS_PERMISSIONS]
    assert "analytics.dashboard:approve" in codes
    assert "analytics.dashboard:publish" in codes
    assert "analytics.report:run" in codes
    assert "analytics.dataset:refresh" in codes


def test_analytics_roles():
    assert BI_ANALYST_PERMISSIONS
    assert BI_MANAGER_PERMISSIONS
    assert DATA_STEWARD_PERMISSIONS
    assert BI_ADMIN_PERMISSIONS
    assert "analytics.dashboard:create" in BI_ANALYST_PERMISSIONS
    assert "analytics.dashboard:approve" in BI_MANAGER_PERMISSIONS
    assert "analytics.dataset:approve" in DATA_STEWARD_PERMISSIONS
