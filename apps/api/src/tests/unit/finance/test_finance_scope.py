"""Finance scope isolation tests."""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from core.exceptions import ForbiddenException
from modules.finance.service.finance_scope_validator import FinanceScopeValidator
from modules.foundation.domain.value_objects import TenantContext


def test_company_isolation() -> None:
    db = MagicMock()
    validator = FinanceScopeValidator(db)
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
    )
    other_company = uuid4()
    with pytest.raises(ForbiddenException):
        validator.validate_company_access(ctx, other_company)


def test_finance_module_admin_can_access_any_company() -> None:
    db = MagicMock()
    company = MagicMock()
    validator = FinanceScopeValidator(db)
    validator._company_repo.get_by_id = MagicMock(return_value=company)
    company_id = uuid4()
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        admin_module_keys=frozenset({"finance"}),
    )
    validator.validate_company_access(ctx, company_id)


def test_branch_isolation() -> None:
    db = MagicMock()
    validator = FinanceScopeValidator(db)
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    other_branch = uuid4()
    with pytest.raises(ForbiddenException):
        validator.validate_branch_access(ctx, other_branch)
