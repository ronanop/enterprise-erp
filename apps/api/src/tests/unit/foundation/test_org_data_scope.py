"""Org data scope helpers."""

from uuid import uuid4

from modules.foundation.domain.org_data_scope import effective_company_ids
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
