"""Org data scope helpers."""

from uuid import uuid4

from modules.foundation.domain.org_data_scope import data_company_ids, effective_company_ids
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


def test_effective_company_ids_tenant_wide_returns_none() -> None:
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        tenant_wide=True,
        scoped_company_ids=(uuid4(),),
    )
    assert effective_company_ids(ctx) is None


def test_data_company_ids_uses_selected_entity() -> None:
    c1, c2 = uuid4(), uuid4()
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=c2,
        scoped_company_ids=(c1, c2),
    )
    assert data_company_ids(ctx) == [c2]


def test_data_company_ids_tenant_wide_uses_selected_entity() -> None:
    selected = uuid4()
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="tenant_admin",
        company_id=selected,
        tenant_wide=True,
    )
    assert data_company_ids(ctx) == [selected]


def test_data_company_ids_all_keeps_every_assigned_entity() -> None:
    c1, c2 = uuid4(), uuid4()
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        scoped_company_ids=(c1, c2),
        all_companies=True,
    )
    assert data_company_ids(ctx) == [c1, c2]


def test_data_company_ids_all_tenant_wide_is_unfiltered() -> None:
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="tenant_admin",
        tenant_wide=True,
        all_companies=True,
    )
    assert data_company_ids(ctx) is None


def test_data_company_ids_without_selection_keeps_assigned_scope() -> None:
    c1, c2 = uuid4(), uuid4()
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        scoped_company_ids=(c1, c2),
    )
    assert data_company_ids(ctx) == [c1, c2]
