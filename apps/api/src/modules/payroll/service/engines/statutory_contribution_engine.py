"""StatutoryContribution lifecycle engine."""

from decimal import Decimal, ROUND_HALF_UP

from modules.payroll.domain.enums import (
    ActiveInactive,
)

_Q = Decimal("0.0001")
_PF_RATE = Decimal("0.12")
_PF_WAGE_CEILING = Decimal("15000")
_ESI_EMPLOYEE_RATE = Decimal("0.0075")
_ESI_EMPLOYER_RATE = Decimal("0.0325")
_ESI_GROSS_CEILING = Decimal("21000")
_PT_THRESHOLD = Decimal("15000")
_PT_AMOUNT = Decimal("200")


def _money(value: Decimal) -> Decimal:
    return value.quantize(_Q, rounding=ROUND_HALF_UP)


class StatutoryContributionEngine:
    def deactivate(self, row) -> None:
        row.status = ActiveInactive.INACTIVE.value

    def compute_pf_esi_pt(self, gross, basic) -> dict:
        """Compute PF / ESI / Professional Tax from gross and basic."""
        g = Decimal(str(gross or 0))
        b = Decimal(str(basic or 0))
        pf_wage = min(b, _PF_WAGE_CEILING)
        pf_employee = _money(pf_wage * _PF_RATE)
        pf_employer = pf_employee
        esi_applies = g <= _ESI_GROSS_CEILING
        esi_employee = _money(g * _ESI_EMPLOYEE_RATE) if esi_applies else Decimal("0.0000")
        esi_employer = _money(g * _ESI_EMPLOYER_RATE) if esi_applies else Decimal("0.0000")
        professional_tax = _PT_AMOUNT if g >= _PT_THRESHOLD else Decimal("0.0000")
        return {
            "pf_employee": pf_employee,
            "pf_employer": pf_employer,
            "esi_employee": esi_employee,
            "esi_employer": esi_employer,
            "professional_tax": professional_tax,
            "esi_applies": esi_applies,
        }
