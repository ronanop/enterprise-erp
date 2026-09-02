"""FP-ASSET-015 regression guards — Checklist and Maintenance unchanged."""

from __future__ import annotations

import inspect

from modules.asset.service.checklist_service import ChecklistService
from modules.asset.service.maintenance_service import MaintenanceService


def test_checklist_service_has_no_meter_coupling() -> None:
    source = inspect.getsource(ChecklistService)
    lowered = source.lower()
    assert "meterreadingservice" not in lowered
    assert "meter_reading_validator" not in lowered


def test_maintenance_service_has_no_meter_coupling() -> None:
    source = inspect.getsource(MaintenanceService)
    lowered = source.lower()
    assert "meterreadingservice" not in lowered
    assert "meter_reading_validator" not in lowered
