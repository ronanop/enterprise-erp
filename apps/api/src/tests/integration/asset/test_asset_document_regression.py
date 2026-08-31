"""FP-ASSET-016 regression guards — Checklist and Meter Reading unchanged."""

from __future__ import annotations

import inspect

from modules.asset.service.checklist_service import ChecklistService
from modules.asset.service.meter_reading_service import MeterReadingService


def test_checklist_service_has_no_document_coupling() -> None:
    source = inspect.getsource(ChecklistService)
    lowered = source.lower()
    assert "documentservice" not in lowered
    assert "document_validator" not in lowered


def test_meter_reading_service_has_no_document_coupling() -> None:
    source = inspect.getsource(MeterReadingService)
    lowered = source.lower()
    assert "documentservice" not in lowered
    assert "document_validator" not in lowered
