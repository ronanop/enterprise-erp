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

    def compute_pf_esi_pt(
        self,
        gross,
        basic,
        *,
        pf_employee_rate: Decimal | None = None,
        pf_employer_rate: Decimal | None = None,
        pf_wage_ceiling: Decimal | None = None,
        statutory_esi: bool = True,
    ) -> dict:
        """Compute PF / ESI / Professional Tax from gross and basic.

        Statutory rates remain isolated defaults (12% / ₹15,000 / ESI 0.75%+3.25%).
        Callers may pass company-configured PF rates and wage ceiling.
        """
        g = Decimal(str(gross or 0))
        b = Decimal(str(basic or 0))
        ceiling = Decimal(str(pf_wage_ceiling if pf_wage_ceiling is not None else _PF_WAGE_CEILING))
        ee_rate = Decimal(str(pf_employee_rate if pf_employee_rate is not None else _PF_RATE))
        er_rate = Decimal(str(pf_employer_rate if pf_employer_rate is not None else _PF_RATE))
        pf_wage = min(b, ceiling) if ceiling > 0 else b
        pf_employee = _money(pf_wage * ee_rate)
        pf_employer = _money(pf_wage * er_rate)
        esi_applies = statutory_esi and g <= _ESI_GROSS_CEILING
        esi_employee = _money(g * _ESI_EMPLOYEE_RATE) if esi_applies else Decimal("0.0000")
        esi_employer = _money(g * _ESI_EMPLOYER_RATE) if esi_applies else Decimal("0.0000")
        professional_tax = _PT_AMOUNT if statutory_esi and g >= _PT_THRESHOLD else Decimal("0.0000")
        return {
            "pf_employee": pf_employee,
            "pf_employer": pf_employer,
            "pf_total": _money(pf_employee + pf_employer),
            "esi_employee": esi_employee,
            "esi_employer": esi_employer,
            "professional_tax": professional_tax,
            "esi_applies": esi_applies,
            "pf_wage": pf_wage,
        }
