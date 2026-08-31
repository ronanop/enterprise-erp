"""Unit tests for MaintenancePlanService (FP-ASSET-011)."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

from modules.asset.service.maintenance_plan_service import MaintenancePlanService
from modules.foundation.domain.value_objects import TenantContext


def test_service_wires_validator_and_engine() -> None:
    svc = MaintenancePlanService(MagicMock())
    assert svc._validator is not None
    assert svc._engine is not None
    assert svc._audit is not None


def test_search_delegates_to_repository() -> None:
    svc = MaintenancePlanService(MagicMock())
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._repo, "search", return_value=([], 0)) as search,
    ):
        svc.search(ctx, search="AMPL", offset=0, limit=25)
        search.assert_called_once()
