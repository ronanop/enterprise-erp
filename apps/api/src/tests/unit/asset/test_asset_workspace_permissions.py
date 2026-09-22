"""Asset role packs include master/org reads for import + Configuration."""

from modules.asset.permissions import (
    ASSET_ADMIN_PERMISSIONS,
    ASSET_AUDITOR_PERMISSIONS,
    ASSET_EXECUTIVE_PERMISSIONS,
    ASSET_MANAGER_PERMISSIONS,
    ASSET_MEMBER_WORKSPACE_READ_PERMISSIONS,
)


def test_workspace_reads_include_employee_and_department() -> None:
    assert "master.employee:read" in ASSET_MEMBER_WORKSPACE_READ_PERMISSIONS
    assert "organization.department:read" in ASSET_MEMBER_WORKSPACE_READ_PERMISSIONS


def test_asset_role_packs_include_workspace_reads() -> None:
    for pack in (
        ASSET_MANAGER_PERMISSIONS,
        ASSET_EXECUTIVE_PERMISSIONS,
        ASSET_AUDITOR_PERMISSIONS,
        ASSET_ADMIN_PERMISSIONS,
    ):
        for code in ASSET_MEMBER_WORKSPACE_READ_PERMISSIONS:
            assert code in pack
