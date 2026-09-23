"""Unit tests — Non-IT asset code formatting."""

from modules.asset.nonit.code_service import format_nonit_code


def test_format_zero_pads_to_three():
    assert format_nonit_code("CH", 1) == "CH001"
    assert format_nonit_code("CH", 42) == "CH042"
    assert format_nonit_code("CH", 999) == "CH999"


def test_format_grows_past_999():
    assert format_nonit_code("CH", 1000) == "CH1000"
    assert format_nonit_code("TBD", 10000) == "TBD10000"
