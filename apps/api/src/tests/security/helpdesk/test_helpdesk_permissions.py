"""Helpdesk RBAC permission tests."""

from modules.helpdesk.permissions import (
    HELPDESK_ADMIN_PERMISSIONS,
    HELPDESK_AGENT_PERMISSIONS,
    HELPDESK_MANAGER_PERMISSIONS,
    HELPDESK_PERMISSIONS,
    SUPPORT_ENGINEER_PERMISSIONS,
)


def test_helpdesk_permissions_defined():
    assert len(HELPDESK_PERMISSIONS) >= 40
    assert "helpdesk.ticket:approve" in [p[0] for p in HELPDESK_PERMISSIONS]
    assert "helpdesk.knowledge:publish" in [p[0] for p in HELPDESK_PERMISSIONS]


def test_helpdesk_roles():
    assert HELPDESK_MANAGER_PERMISSIONS
    assert HELPDESK_AGENT_PERMISSIONS
    assert SUPPORT_ENGINEER_PERMISSIONS
    assert HELPDESK_ADMIN_PERMISSIONS
    assert "helpdesk.ticket:approve" in HELPDESK_MANAGER_PERMISSIONS
    assert "helpdesk.knowledge:publish" in HELPDESK_ADMIN_PERMISSIONS
