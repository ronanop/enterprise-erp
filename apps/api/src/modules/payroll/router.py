"""Payroll module router aggregation."""

from fastapi import APIRouter

from modules.payroll.routers import (
    adjustments_router,
    bonuses_router,
    deduction_types_router,
    earning_types_router,
    employee_salaries_router,
    employee_salary_components_router,
    loan_installments_router,
    loans_router,
    payroll_runs_router,
    payslips_router,
    periods_router,
    policies_router,
    postings_router,
    reimbursements_router,
    reports_router,
    run_lines_router,
    salary_components_router,
    salary_structures_router,
    statutory_contributions_router,
    structure_lines_router,
    summaries_router,
    tax_configurations_router,
)

payroll_router = APIRouter(prefix="/payroll")
payroll_router.include_router(periods_router)
payroll_router.include_router(policies_router)
payroll_router.include_router(salary_structures_router)
payroll_router.include_router(salary_components_router)
payroll_router.include_router(structure_lines_router)
payroll_router.include_router(employee_salaries_router)
payroll_router.include_router(employee_salary_components_router)
payroll_router.include_router(earning_types_router)
payroll_router.include_router(deduction_types_router)
payroll_router.include_router(tax_configurations_router)
payroll_router.include_router(statutory_contributions_router)
payroll_router.include_router(payroll_runs_router)
payroll_router.include_router(run_lines_router)
payroll_router.include_router(payslips_router)
payroll_router.include_router(bonuses_router)
payroll_router.include_router(reimbursements_router)
payroll_router.include_router(loans_router)
payroll_router.include_router(loan_installments_router)
payroll_router.include_router(adjustments_router)
payroll_router.include_router(postings_router)
payroll_router.include_router(summaries_router)
payroll_router.include_router(reports_router)
