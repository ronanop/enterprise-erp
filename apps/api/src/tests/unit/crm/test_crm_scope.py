"""CRM scope isolation tests."""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from core.exceptions import ForbiddenException
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.foundation.domain.value_objects import TenantContext


def test_branch_isolation_for_member_other_company() -> None:
    db = MagicMock()
    other_company = uuid4()
    branch = MagicMock()
    branch.company_id = other_company
    db.scalar.return_value = branch

    validator = CrmScopeValidator(db)
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    with pytest.raises(ForbiddenException, match="Branch scope mismatch"):
        validator.validate_branch_access(ctx, uuid4())


def test_crm_member_can_use_branch_under_session_company() -> None:
    db = MagicMock()
    company_id = uuid4()
    other_branch = uuid4()
    branch = MagicMock()
    branch.company_id = company_id
    db.scalar.return_value = branch

    validator = CrmScopeValidator(db)
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=company_id,
        branch_id=uuid4(),
    )
    validator.validate_branch_access(ctx, other_branch)


def test_crm_module_admin_can_access_any_branch() -> None:
    db = MagicMock()
    validator = CrmScopeValidator(db)
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
        admin_module_keys=frozenset({"crm"}),
    )
    validator.validate_branch_access(ctx, uuid4())
    db.scalar.assert_not_called()


def test_company_isolation_for_member() -> None:
    db = MagicMock()
    validator = CrmScopeValidator(db)
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
    )
    with pytest.raises(ForbiddenException, match="Company scope mismatch"):
        validator.validate_company_access(ctx, uuid4())


def test_crm_module_admin_can_access_any_company() -> None:
    db = MagicMock()
    validator = CrmScopeValidator(db)
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        admin_module_keys=frozenset({"crm"}),
    )
    validator.validate_company_access(ctx, uuid4())
