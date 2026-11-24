"""Org data scope helpers - platform vs module-admin vs member visibility."""

from uuid import uuid4

from modules.foundation.domain.org_data_scope import (
    effective_company_ids,
    has_module_wide_data_access,
    has_procurement_tenant_wide_data_access,
    has_tenant_wide_data_access,
    is_platform_admin,
)
from modules.foundation.domain.value_objects import TenantContext


def test_effective_company_ids_uses_assigned_scope() -> None:
    c1, c2 = uuid4(), uuid4()
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        scoped_company_ids=(c1, c2),
    )
    assert effective_company_ids(ctx) == [c1, c2]
    assert effective_company_ids(ctx, module_key="crm") == [c1, c2]


def test_effective_company_ids_pins_to_active_session_company() -> None:
    c1, c2 = uuid4(), uuid4()
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=c1,
        scoped_company_ids=(c1, c2),
    )
    assert effective_company_ids(ctx, module_key="hr") == [c1]
    assert effective_company_ids(ctx, module_key="payroll") == [c1]
    assert effective_company_ids(ctx, module_key="recruitment") == [c1]


def test_session_entity_does_not_pin_non_hrms_modules() -> None:
    """HR entity switcher must not hide CT/VAPL data on CRM / home / finance."""
    c1, c2 = uuid4(), uuid4()
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=c1,
        scoped_company_ids=(c1, c2),
    )
    assert effective_company_ids(ctx, module_key="crm") == [c1, c2]
    assert effective_company_ids(ctx, module_key="finance") == [c1, c2]
    assert effective_company_ids(ctx, module_key="procurement") == [c1, c2]
    assert effective_company_ids(ctx, module_key="projects") == [c1, c2]


def test_effective_company_ids_all_companies_uses_allowlist() -> None:
    c1, c2 = uuid4(), uuid4()
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        all_companies=True,
        scoped_company_ids=(c1, c2),
    )
    assert effective_company_ids(ctx, module_key="hr") == [c1, c2]


def test_effective_company_ids_rejects_active_outside_scope() -> None:
    c1, c2, other = uuid4(), uuid4(), uuid4()
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=other,
        scoped_company_ids=(c1, c2),
    )
    assert effective_company_ids(ctx, module_key="hr") == []


def test_platform_admin_effective_company_ids_none() -> None:
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="super_admin",
        scoped_company_ids=(uuid4(),),
    )
    assert is_platform_admin(ctx) is True
    assert effective_company_ids(ctx) is None
    assert effective_company_ids(ctx, module_key="crm") is None


def test_crm_module_admin_without_scopes_is_tenant_wide_for_crm_only() -> None:
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        admin_module_keys=frozenset({"crm"}),
        scoped_company_ids=(),
        company_id=None,
    )
    assert has_module_wide_data_access(ctx, "crm") is True
    assert effective_company_ids(ctx, module_key="crm") is None
    assert has_module_wide_data_access(ctx, "finance") is False
    assert has_module_wide_data_access(ctx, "procurement") is False


def test_module_admin_keeps_whole_module_despite_entity_scopes() -> None:
    """Module admin elevation is not shrunk by SecUserOrgScope entity rows.

    Exception: HRMS respects the topbar entity pin even for module admins.
    """
    c1, c2 = uuid4(), uuid4()
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        admin_module_keys=frozenset({"hr", "crm"}),
        scoped_company_ids=(c1, c2),
        company_id=c1,
        tenant_wide=True,
    )
    assert has_module_wide_data_access(ctx, "hr") is True
    assert has_module_wide_data_access(ctx, "crm") is True
    assert effective_company_ids(ctx, module_key="hr") == [c1]
    assert effective_company_ids(ctx, module_key="crm") is None
    # Non-admin modules use full allowlist (ignore HR session entity).
    assert has_module_wide_data_access(ctx, "finance") is False
    assert effective_company_ids(ctx, module_key="finance") == [c1, c2]


def test_hrms_entity_switcher_pins_platform_admin() -> None:
    c1, c2 = uuid4(), uuid4()
    pinned = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="super_admin",
        company_id=c1,
        all_companies=False,
        scoped_company_ids=(c1, c2),
    )
    assert effective_company_ids(pinned, module_key="hr") == [c1]
    assert effective_company_ids(pinned, module_key="crm") is None

    all_entities = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="super_admin",
        company_id=None,
        all_companies=True,
        scoped_company_ids=(c1, c2),
    )
    assert effective_company_ids(all_entities, module_key="hr") is None


def test_finance_module_admin_without_scopes_does_not_elevate_crm() -> None:
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        admin_module_keys=frozenset({"finance"}),
        scoped_company_ids=(),
        company_id=None,
    )
    assert has_module_wide_data_access(ctx, "finance") is True
    assert has_module_wide_data_access(ctx, "crm") is False


def test_hr_module_admin_does_not_elevate_procurement() -> None:
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        admin_module_keys=frozenset({"hr"}),
        tenant_wide=True,  # legacy flag still set for HR admins
        procurement_tenant_wide=False,
        scoped_company_ids=(),
    )
    assert has_module_wide_data_access(ctx, "hr") is True
    assert has_procurement_tenant_wide_data_access(ctx) is False
    assert has_tenant_wide_data_access(ctx) is False  # bare call = platform only
    assert has_tenant_wide_data_access(ctx, "hr") is True


def test_procurement_module_admin_elevated() -> None:
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        admin_module_keys=frozenset({"procurement"}),
    )
    assert has_procurement_tenant_wide_data_access(ctx) is True
    assert effective_company_ids(ctx, module_key="procurement") is None


def test_member_empty_scope_no_leak() -> None:
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        scoped_company_ids=(),
        company_id=None,
    )
    assert effective_company_ids(ctx, module_key="crm") == []


def test_member_session_company_fallback() -> None:
    company_id = uuid4()
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=company_id,
        scoped_company_ids=(),
    )
    assert effective_company_ids(ctx, module_key="assets") == [company_id]


def test_legacy_procurement_tenant_wide_flag() -> None:
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        procurement_tenant_wide=True,
    )
    assert has_procurement_tenant_wide_data_access(ctx) is True


def test_module_admin_skips_session_branch_pin() -> None:
    """Session branch must never filter lists (including HRMS — company pin only)."""
    from sqlalchemy import column, select, table

    from modules.foundation.domain.org_data_scope import apply_branch_scope

    model = table("t", column("branch_id"), column("company_id"))
    c1, c2, branch = uuid4(), uuid4(), uuid4()
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        admin_module_keys=frozenset({"hr"}),
        scoped_company_ids=(c1, c2),
        company_id=c1,
        branch_id=branch,
    )
    base = select(model)
    stmt = apply_branch_scope(base, model, ctx, module_key="hr", branch_scoped=True)
    assert stmt is base
    assert stmt.whereclause is None

    member = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        scoped_company_ids=(c1,),
        company_id=c1,
        branch_id=branch,
    )
    crm_base = select(model)
    crm_stmt = apply_branch_scope(
        crm_base, model, member, module_key="crm", branch_scoped=True
    )
    assert crm_stmt is crm_base
    assert crm_stmt.whereclause is None
