"""Deal registration number prefix from Cache legal entity name."""

from modules.crm.service.document_number_service import (
    deal_reg_prefix_from_entity_name,
    is_deal_reg_number,
)


def test_prefix_from_two_word_entity():
    assert deal_reg_prefix_from_entity_name("Cache Digitech") == "CD"
    assert deal_reg_prefix_from_entity_name("Cache Technologies") == "CT"


def test_prefix_from_single_word_entity():
    assert deal_reg_prefix_from_entity_name("Acme") == "AC"
    assert deal_reg_prefix_from_entity_name("X") == "XX"


def test_prefix_fallback():
    assert deal_reg_prefix_from_entity_name(None) == "DR"
    assert deal_reg_prefix_from_entity_name("") == "DR"
    assert deal_reg_prefix_from_entity_name("   ") == "DR"


def test_is_deal_reg_number_accepts_entity_and_legacy():
    assert is_deal_reg_number("CD-2026-1")
    assert is_deal_reg_number("CT-2026-12")
    assert is_deal_reg_number("DR-2026-3")
    assert not is_deal_reg_number("LEAD-2026-1")
    assert not is_deal_reg_number("OPP-1")
    assert not is_deal_reg_number("")
    assert not is_deal_reg_number(None)
