"""StatutoryContribution lifecycle engine."""

from decimal import Decimal, ROUND_HALF_UP

from modules.payroll.domain.enums import (
    ActiveInactive,
)

_Q = Decimal("0.0001")
_PF_RATE = Decimal("0.12")
# Sheet default: MIN(wage, 25000)×12% (max ₹3,000). Override via pf_wage_ceiling.
_PF_WAGE_CEILING = Decimal("25000")
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
        pf_wage: Decimal | None = None,
        statutory_esi: bool = True,
    ) -> dict:
        """Compute PF / ESI / Professional Tax.

        PF wage = ``pf_wage`` when provided (Basic+Special), else ``basic``.
        Employee/Employer PF = MIN(wage, ceiling) × rate.
        """
        g = Decimal(str(gross or 0))
        b = Decimal(str(basic or 0))
        wage_in = Decimal(str(pf_wage)) if pf_wage is not None else b
        ceiling = Decimal(str(pf_wage_ceiling if pf_wage_ceiling is not None else _PF_WAGE_CEILING))
        ee_rate = Decimal(str(pf_employee_rate if pf_employee_rate is not None else _PF_RATE))
        er_rate = Decimal(str(pf_employer_rate if pf_employer_rate is not None else _PF_RATE))
        capped = min(max(Decimal("0"), wage_in), ceiling) if ceiling > 0 else max(Decimal("0"), wage_in)
        pf_employee = _money(capped * ee_rate)
        pf_employer = _money(capped * er_rate)
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
            "pf_wage": capped,
        }
