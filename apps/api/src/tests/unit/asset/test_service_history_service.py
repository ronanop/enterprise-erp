"""Unit tests for ServiceHistoryService (FP-ASSET-013)."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

from modules.asset.service.service_history_service import ServiceHistoryService
from modules.foundation.domain.value_objects import TenantContext


def test_service_wires_validator_and_engine() -> None:
    svc = ServiceHistoryService(MagicMock())
    assert svc._validator is not None
    assert svc._engine is not None
    assert svc._audit is not None


def test_create_ignores_client_status_override() -> None:
    svc = ServiceHistoryService(MagicMock())
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    asset_id = uuid4()
    maintenance_id = uuid4()
    created = MagicMock(status="recorded")
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._validator, "validate_create_fields", return_value=None),
        patch.object(svc._repo, "create", return_value=created) as create,
        patch.object(svc._engine, "record", return_value=None),
        patch.object(svc._audit, "log_entity_change", return_value=None),
    ):
        svc.create(
            ctx,
            asset_id=asset_id,
            maintenance_id=maintenance_id,
            service_summary="Test",
            status="void",
        )
        create.assert_called_once()
        assert create.call_args.kwargs["status"] == "recorded"


def test_search_delegates_to_repository() -> None:
    svc = ServiceHistoryService(MagicMock())
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
        svc.search(ctx, search="filter", offset=0, limit=25)
        search.assert_called_once()
