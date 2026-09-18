"""User transfer Step 3 completion service tests (mocked)."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import TransferValidationError
from modules.asset.schemas import UserTransferReturnToStockRequest
from modules.asset.service.user_transfer_completion_service import UserTransferCompletionService
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_return_to_stock_rejects_missing_verification() -> None:
    svc = UserTransferCompletionService(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    body = UserTransferReturnToStockRequest(
        verification_id=uuid4(),
        reason="End of assignment",
    )
    with patch.object(svc, "_load_verification", side_effect=TransferValidationError("missing")):
        with pytest.raises(TransferValidationError, match="missing"):
            svc.return_to_stock(ctx, asset_id, body)
