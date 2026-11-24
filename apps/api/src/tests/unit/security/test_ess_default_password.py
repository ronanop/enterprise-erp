from datetime import date

from security.ess_default_password import (
    build_ess_default_password,
    parse_ess_dob_password,
    verify_ess_dob_password,
)


def test_parse_ess_dob_password():
    assert parse_ess_dob_password("CT526313031994", "CT5263") == date(1994, 3, 13)
    assert parse_ess_dob_password("ct5263-13031994", "CT-5263") is None  # bad length after normalize
    assert parse_ess_dob_password("CT526313031994", "CT5263") == date(1994, 3, 13)
    assert parse_ess_dob_password("CT526399999999", "CT5263") is None
    assert parse_ess_dob_password("WRONG13031994", "CT5263") is None


def test_verify_and_build():
    dob = date(1994, 3, 13)
    pwd = build_ess_default_password("CT-5263", dob)
    assert pwd == "CT526313031994"
    assert verify_ess_dob_password(pwd, "CT5263", dob)
