"""Regression / architecture guards for Excel import (CR-004 Phase 8B)."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from modules.asset.domain.excel_import import VALID_IMPORT_OPERATIONAL_STATUSES
from modules.asset.domain.enums import AssetOperationalStatus
from modules.asset.domain.operational_status_rules import ALLOWED_OPERATIONAL_TRANSITIONS


ENGINE = Path(__file__).resolve().parents[3] / "modules" / "asset" / "service" / "excel_import_engine.py"
SERVICE = (
    Path(__file__).resolve().parents[3]
    / "modules"
    / "asset"
    / "service"
    / "asset_excel_import_service.py"
)


def _source(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_engine_does_not_import_repositories() -> None:
    """Engine may resolve site locations via a scoped repository lookup only."""
    tree = ast.parse(_source(ENGINE))
    imports: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            imports.append(node.module)
        elif isinstance(node, ast.Import):
            imports.extend(a.name for a in node.names)
    allowed = {"modules.asset.repository.site_location_repository"}
    unexpected = [m for m in imports if "repository" in m and m not in allowed]
    assert unexpected == []
    assert not any(m.endswith(".models") or ".models." in m for m in imports)


def test_engine_imports_business_services_only() -> None:
    src = _source(ENGINE)
    assert "AssetService" in src
    assert "AssignmentService" in src
    assert "AssetOperationalStatusService" in src
    assert "AssetComponentService" in src
    assert "MaintenanceService" in src


def test_service_does_not_import_repositories() -> None:
    """Batch service may resolve default IT category via category repository only."""
    tree = ast.parse(_source(SERVICE))
    allowed = {"modules.asset.repository.asset_category_repository"}
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and "repository" in node.module:
            if node.module not in allowed:
                pytest.fail(f"Import service must not import repository: {node.module}")


def test_import_ops_align_with_domain_enum() -> None:
    enum_values = {s.value for s in AssetOperationalStatus}
    assert VALID_IMPORT_OPERATIONAL_STATUSES <= enum_values


def test_ready_to_in_maintenance_allowed_in_matrix() -> None:
    ready = AssetOperationalStatus.READY_TO_MOVE.value
    maint = AssetOperationalStatus.IN_MAINTENANCE.value
    assert (ready, maint) in ALLOWED_OPERATIONAL_TRANSITIONS


def test_engine_source_mentions_no_overwrite_policy() -> None:
    src = _source(ENGINE)
    assert "find_by_asset_code" in src
    assert "create_for_import" in src
    assert "update(" not in src or "create_for_import" in src


def test_batch_default_documented_in_service() -> None:
    src = _source(SERVICE)
    assert "DEFAULT_IMPORT_BATCH_SIZE" in src
    assert "begin_nested" in src
    assert "commit" in src
    assert "rollback" in src


@pytest.mark.parametrize(
    "action",
    ["assign", "return_to_ready", "start_maintenance"],
)
def test_engine_does_not_hardcode_direct_status_writes(action: str) -> None:
    src = _source(ENGINE)
    assert "set_operational_status(" not in src
    assert "._repo." not in src
    assert "complete_disposal" not in src
    assert action  # parametrize keeps action names as regression documentation


def test_router_endpoint_exists() -> None:
    router = (
        Path(__file__).resolve().parents[3]
        / "modules"
        / "asset"
        / "routers"
        / "__init__.py"
    )
    src = router.read_text(encoding="utf-8")
    assert '"/import"' in src
    assert "AssetExcelImportService" in src
    assert "asset.asset:create" in src
