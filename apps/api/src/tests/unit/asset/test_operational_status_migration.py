"""Migration module smoke test (CR-004 Phase 2A)."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


def _load_migration():
    path = (
        Path(__file__).resolve().parents[4]
        / "alembic"
        / "versions"
        / "0486_ast_operational_status.py"
    )
    spec = spec_from_file_location("migration_0486", path)
    assert spec and spec.loader
    mod = module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_migration_revision_chain() -> None:
    mod = _load_migration()
    assert mod.revision == "0486_ast_operational_status"
    assert mod.down_revision == "0485_ast_discovery_profile"
    assert mod.COLUMN == "operational_status"
    assert "DISPOSED" in mod.OPS_VALUES
    assert mod.CHECK_NAME == "ck_ast_asset_operational_status"
