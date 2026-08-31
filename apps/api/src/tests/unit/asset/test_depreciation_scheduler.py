"""Scheduler smoke tests for depreciation draft generation."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

from modules.asset.tasks import depreciation_scheduler, retry_finance_posting


def test_depreciation_scheduler_skips_without_tenant_context() -> None:
    result = depreciation_scheduler(period_year=2026, period_month=7)
    assert result["status"] == "skipped"
    assert result["period_year"] == 2026


def test_depreciation_scheduler_calls_generate_period_run() -> None:
    tenant_id = str(uuid4())
    company_id = str(uuid4())
    user_id = str(uuid4())
    batch_id = uuid4()

    mock_session = MagicMock()
    mock_svc = MagicMock()
    mock_svc.generate_period_run.return_value = {
        "depreciation_batch_id": batch_id,
        "created_count": 2,
        "skipped_count": 1,
    }

    with (
        patch("database.session.SessionLocal", return_value=mock_session),
        patch(
            "modules.asset.service.depreciation_service.DepreciationService",
            return_value=mock_svc,
        ),
    ):
        result = depreciation_scheduler(
            period_year=2026,
            period_month=7,
            tenant_id=tenant_id,
            company_id=company_id,
            user_id=user_id,
        )

    assert result["status"] == "ok"
    assert result["created_count"] == 2
    mock_session.commit.assert_called_once()
    mock_svc.generate_period_run.assert_called_once()


def test_retry_finance_posting_lists_failed_only() -> None:
    with patch("database.session.SessionLocal") as session_local:
        db = MagicMock()
        session_local.return_value = db
        db.scalars.return_value.all.return_value = []
        result = retry_finance_posting()
    assert result["status"] == "ok"
    assert result["failed_depreciations"] == 0
