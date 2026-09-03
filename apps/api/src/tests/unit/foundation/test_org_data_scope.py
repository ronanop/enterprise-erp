"""Org data scope helpers — platform vs module-admin vs member visibility."""

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


def test_crm_module_admin_tenant_wide_for_crm_only() -> None:
    c1 = uuid4()
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        admin_module_keys=frozenset({"crm"}),
        scoped_company_ids=(c1,),
        company_id=c1,
    )
    assert has_module_wide_data_access(ctx, "crm") is True
    assert effective_company_ids(ctx, module_key="crm") is None
    assert has_module_wide_data_access(ctx, "finance") is False
    assert effective_company_ids(ctx, module_key="finance") == [c1]
    assert has_module_wide_data_access(ctx, "procurement") is False


def test_finance_module_admin_does_not_elevate_crm() -> None:
    c1 = uuid4()
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        admin_module_keys=frozenset({"finance"}),
        scoped_company_ids=(c1,),
        company_id=c1,
    )
    assert has_module_wide_data_access(ctx, "finance") is True
    assert has_module_wide_data_access(ctx, "crm") is False
    assert effective_company_ids(ctx, module_key="crm") == [c1]


def test_hr_module_admin_does_not_elevate_procurement() -> None:
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        admin_module_keys=frozenset({"hr"}),
        tenant_wide=True,  # legacy flag still set for HR admins
        procurement_tenant_wide=False,
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
