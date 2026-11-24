"""Payroll port — salary structure hints + onboarding CTC → structure handoff."""

from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.payroll.domain.salary_structure_calculator import compute_ctc_split
from modules.payroll.models import PayEmployeeSalary, PaySalaryStructure
from modules.payroll.repository.employee_salary_repository import EmployeeSalaryRepository
from modules.payroll.repository.salary_structure_repository import SalaryStructureRepository
from modules.payroll.service.employee_salary_service import EmployeeSalaryService
from modules.payroll.service.salary_structure_service import SalaryStructureService


def _rupee(value: Decimal | float | int | None) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


class RecruitmentPayrollAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._structures = SalaryStructureRepository(db)
        self._structure_svc = SalaryStructureService(db)
        self._salary_svc = EmployeeSalaryService(db)
        self._salaries = EmployeeSalaryRepository(db)

    def get_salary_structure(self, ctx: TenantContext, salary_structure_id: UUID):
        row = self._structures.get(ctx, salary_structure_id)
        if row is None:
            raise NotFoundException("Salary structure not found")
        return row

    def assign_annual_ctc_on_hire(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        employee_id: UUID,
        employment_id: UUID,
        department_id: UUID | None,
        annual_ctc: Decimal | float | int | None,
        employee_code: str,
        employee_name: str,
        effective_from: date,
        existing_structure_id: UUID | None = None,
    ) -> PaySalaryStructure | None:
        """Create/update Excel 60/50 structure from annual offer CTC and assign to employee.

        Offer CTC is annual; payroll structures use monthly gross CTC.
        """
        annual = _rupee(annual_ctc)
        if annual <= 0:
            return None

        monthly = _rupee(annual / Decimal("12"))
        split = compute_ctc_split(gross_ctc=monthly)
        if not split.get("valid", True):
            # Soft-fail: still create with default employer so hire is not blocked.
            split = compute_ctc_split(
                gross_ctc=monthly,
                employer_contribution=Decimal("1800"),
            )

        code = f"SS-{(employee_code or 'NEWHIRE').strip().upper()}"[:50]
        name = f"{(employee_name or employee_code or 'New hire').strip()} ({employee_code})"[:255]

        structure: PaySalaryStructure | None = None
        if existing_structure_id:
            structure = self._structures.get(ctx, existing_structure_id)

        if structure is None:
            structure = self._db.scalar(
                select(PaySalaryStructure).where(
                    PaySalaryStructure.tenant_id == ctx.tenant_id,
                    PaySalaryStructure.company_id == company_id,
                    PaySalaryStructure.structure_code == code,
                    PaySalaryStructure.is_deleted.is_(False),
                )
            )

        payload = {
            "structure_code": code,
            "structure_name": name,
            "branch_id": branch_id,
            "effective_from": effective_from,
            "currency_code": "INR",
            "status": "active",
            "gross_ctc": monthly,
            "basic_percent": Decimal("0.6000"),
            "hra_percent_of_basic": Decimal("0.5000"),
            "telephone_allowance": Decimal("0"),
            "employer_contribution": split["employer_contribution"],
            "pf_percent": Decimal("0.1200"),
            "pf_wage_ceiling": Decimal("25000"),
            "pf_fixed_ceiling": Decimal("3000"),
            "edli_admin_amount": Decimal("0"),
            "esi_percent": Decimal("0.0075"),
            "esi_monthly_ceiling": Decimal("21000"),
        }

        if structure is not None:
            structure = self._structure_svc.update(ctx, structure.id, **payload)
        else:
            structure = self._structure_svc.create(ctx, company_id=company_id, **payload)

        # Active assignment for this employment (skip if already linked to same structure).
        existing_asg = self._db.scalar(
            select(PayEmployeeSalary).where(
                PayEmployeeSalary.tenant_id == ctx.tenant_id,
                PayEmployeeSalary.employee_id == employee_id,
                PayEmployeeSalary.employment_id == employment_id,
                PayEmployeeSalary.is_deleted.is_(False),
                PayEmployeeSalary.status.in_(("active", "draft")),
            )
        )
        ctc_amount = _rupee(split["ctc"])
        gross_amount = _rupee(split["employee_gross"])
        if existing_asg is not None:
            self._salary_svc.update(
                ctx,
                existing_asg.id,
                salary_structure_id=structure.id,
                effective_from=effective_from,
                ctc_amount=ctc_amount,
                gross_amount=gross_amount,
                status="active",
            )
        else:
            self._salary_svc.create(
                ctx,
                company_id=company_id,
                branch_id=branch_id,
                employee_id=employee_id,
                salary_structure_id=structure.id,
                employment_id=employment_id,
                department_id=department_id,
                effective_from=effective_from,
                ctc_amount=ctc_amount,
                gross_amount=gross_amount,
                currency_code="INR",
                status="active",
            )
        return structure
