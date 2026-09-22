"""Unit tests for exit agreement rendering and signature rules."""

from datetime import date

from modules.hr.domain.exit_agreements import (
    DEFAULT_NON_SOLICIT_MONTHS,
    REQUIRED_FOR_COMPLETION,
    AgreementContext,
    ExitAgreementType,
    add_months,
    content_hash,
    render,
    signature_matches,
)

CTX = AgreementContext(
    employee_name="Asha Menon",
    employee_code="EMP-000123",
    company_name="Cache Digitech Pvt Ltd",
    designation="Senior Engineer",
    last_working_date=date(2026, 10, 31),
    restriction_months=6,
    restriction_end_date=date(2027, 4, 30),
)


def test_noc_states_no_dues_and_names_the_employee() -> None:
    body = render(ExitAgreementType.NOC, CTX)

    assert "NO OBJECTION CERTIFICATE" in body
    assert "Asha Menon" in body
    assert "EMP-000123" in body
    assert "31 October 2026" in body
    assert "no dues outstanding" in body


def test_nda_covers_customer_lists_and_survives_the_exit() -> None:
    body = render(ExitAgreementType.NDA, CTX)

    assert "CONFIDENTIALITY UNDERTAKING" in body
    assert "customer lists" in body
    assert "at any time after my last working day" in body
    assert "Cache Digitech Pvt Ltd" in body


def test_non_solicit_states_the_window_and_the_customer_restriction() -> None:
    body = render(ExitAgreementType.NON_SOLICIT, CTX)

    assert "NON-SOLICITATION UNDERTAKING" in body
    assert "6 months" in body
    assert "30 April 2027" in body
    assert "solicit or accept business from any customer" in body
    assert "solicit or induce any employee" in body


def test_restriction_end_date_is_months_after_the_last_working_day() -> None:
    assert add_months(date(2026, 10, 31), 6) == date(2027, 4, 30)
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)
    assert add_months(date(2026, 12, 15), 8) == date(2027, 8, 15)


def test_default_non_solicit_window_is_six_months() -> None:
    assert DEFAULT_NON_SOLICIT_MONTHS == 6


def test_noc_and_nda_are_required_before_an_exit_can_close() -> None:
    required = {t.value for t in REQUIRED_FOR_COMPLETION}
    assert required == {"noc", "nda"}


def test_hash_changes_when_the_text_changes() -> None:
    original = render(ExitAgreementType.NDA, CTX)
    tampered = original.replace("will not", "may")

    assert content_hash(original) != content_hash(tampered)
    assert len(content_hash(original)) == 64


def test_signature_must_be_the_employees_own_name() -> None:
    assert signature_matches("Asha Menon", "Asha Menon")
    assert signature_matches("  asha   menon ", "Asha Menon")
    assert not signature_matches("A Menon", "Asha Menon")
    assert not signature_matches("Someone Else", "Asha Menon")
