"""Unit tests for LocationService (FP-ASSET-012)."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

from modules.asset.service.location_service import LocationService
from modules.foundation.domain.value_objects import TenantContext


def test_service_wires_validator_and_engine() -> None:
    svc = LocationService(MagicMock())
    assert svc._validator is not None
    assert svc._engine is not None
    assert svc._audit is not None


def test_search_delegates_to_repository() -> None:
    svc = LocationService(MagicMock())
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
        svc.search(ctx, search="Warehouse", offset=0, limit=25)
        search.assert_called_once()
