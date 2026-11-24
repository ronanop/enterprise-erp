"""IT / Non-IT Assets submodule key helpers."""

from modules.foundation.domain.erp_modules import (
    ASSET_IT_MODULE_KEY,
    ASSET_MODULE_KEY,
    ASSET_NON_IT_MODULE_KEY,
    ERP_MODULE_KEY_SET,
    asset_domain_for_module_key,
    assignment_module_keys_for_permission,
    expand_asset_module_keys,
)


def test_submodule_keys_registered() -> None:
    assert ASSET_IT_MODULE_KEY in ERP_MODULE_KEY_SET
    assert ASSET_NON_IT_MODULE_KEY in ERP_MODULE_KEY_SET
    assert ASSET_MODULE_KEY in ERP_MODULE_KEY_SET


def test_asset_domain_for_module_key() -> None:
    assert asset_domain_for_module_key("assets-it") == "IT"
    assert asset_domain_for_module_key("assets-non-it") == "NON_IT"
    assert asset_domain_for_module_key("assets") is None


def test_expand_legacy_parent_to_both_submodules() -> None:
    assert expand_asset_module_keys({ASSET_MODULE_KEY}) == {
        ASSET_MODULE_KEY,
        ASSET_IT_MODULE_KEY,
        ASSET_NON_IT_MODULE_KEY,
    }
    assert expand_asset_module_keys({ASSET_MODULE_KEY}, for_admin=True) == {
        ASSET_MODULE_KEY,
        ASSET_IT_MODULE_KEY,
        ASSET_NON_IT_MODULE_KEY,
    }


def test_expand_submodule_adds_parent_shell_for_members() -> None:
    assert expand_asset_module_keys({ASSET_IT_MODULE_KEY}) == {
        ASSET_IT_MODULE_KEY,
        ASSET_MODULE_KEY,
    }
    assert expand_asset_module_keys({ASSET_NON_IT_MODULE_KEY}) == {
        ASSET_NON_IT_MODULE_KEY,
        ASSET_MODULE_KEY,
    }


def test_expand_admin_submodule_does_not_elevate_parent() -> None:
    assert expand_asset_module_keys({ASSET_NON_IT_MODULE_KEY}, for_admin=True) == {
        ASSET_NON_IT_MODULE_KEY,
    }
    # Leftover parent + one submodule → drop parent from effective admin.
    assert expand_asset_module_keys(
        {ASSET_MODULE_KEY, ASSET_NON_IT_MODULE_KEY}, for_admin=True
    ) == {ASSET_NON_IT_MODULE_KEY}
    # Both submodule admins → parent implied.
    assert expand_asset_module_keys(
        {ASSET_IT_MODULE_KEY, ASSET_NON_IT_MODULE_KEY}, for_admin=True
    ) == {
        ASSET_IT_MODULE_KEY,
        ASSET_NON_IT_MODULE_KEY,
        ASSET_MODULE_KEY,
    }


def test_assignment_keys_include_submodules_for_asset_permissions() -> None:
    keys = assignment_module_keys_for_permission("asset.asset:read")
    assert ASSET_MODULE_KEY in keys
    assert ASSET_IT_MODULE_KEY in keys
    assert ASSET_NON_IT_MODULE_KEY in keys
