"""Quality RBAC permission constants."""

from modules.quality.permissions import (
    QM_PERMISSIONS,
    QUALITY_AUDITOR_PERMISSIONS,
    QUALITY_ENGINEER_PERMISSIONS,
    QUALITY_INSPECTOR_PERMISSIONS,
    QUALITY_MANAGER_PERMISSIONS,
)


def test_qm_permissions_non_empty():
    assert len(QM_PERMISSIONS) >= 40
    codes = {p[0] for p in QM_PERMISSIONS}
    assert "quality.incoming_inspection:approve" in codes
    assert "quality.capa:verify" in codes
    assert "quality.score:publish" in codes


def test_role_permission_lists():
    assert len(QUALITY_INSPECTOR_PERMISSIONS) > 0
    assert len(QUALITY_ENGINEER_PERMISSIONS) >= len(QUALITY_INSPECTOR_PERMISSIONS)
    assert len(QUALITY_AUDITOR_PERMISSIONS) > 0
    assert len(QUALITY_MANAGER_PERMISSIONS) >= len(QUALITY_ENGINEER_PERMISSIONS)
    assert "quality.ncr:approve" in QUALITY_MANAGER_PERMISSIONS
    assert "quality.audit:close" in QUALITY_AUDITOR_PERMISSIONS
