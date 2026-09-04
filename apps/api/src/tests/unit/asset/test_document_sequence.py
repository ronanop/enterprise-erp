"""Unit tests for ADR-REG-04 document sequence formatting."""

from modules.asset.domain.enums import AstEntityType, CODE_PREFIXES


def test_asset_code_prefix_includes_year() -> None:
    prefix, width, include_year = CODE_PREFIXES[AstEntityType.ASSET]
    assert prefix == "AST-"
    assert width == 6
    assert include_year is True


def test_formatted_code_shape() -> None:
    year = 2026
    seq = 42
    prefix, width, include_year = CODE_PREFIXES[AstEntityType.ASSET]
    key = f"{prefix.rstrip('-')}-{year}"
    code = f"{key}-{seq:0{width}d}"
    assert code == "AST-2026-000042"
