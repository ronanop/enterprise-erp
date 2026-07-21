"""Payroll Pydantic schemas."""

from decimal import Decimal
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PayrollPeriodCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PayrollPeriodUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PayrollPeriodResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    period_code: str
    period_name: str
    payroll_year: int
    payroll_month: int
    start_date: date
    end_date: date
    payment_date: date | None
    status: str
    company_id: UUID
    version: int

class SalaryStructureCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class SalaryStructureUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class SalaryStructureResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    structure_code: str
    structure_name: str
    effective_from: date
    effective_to: date | None
    currency_code: str
    status: str
    company_id: UUID
    version: int

class SalaryComponentCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class SalaryComponentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class SalaryComponentResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    component_code: str
    component_name: str
    component_class: str
    earning_type_id: UUID | None
    deduction_type_id: UUID | None
    calculation_method: str
    percentage_base_component_id: UUID | None
    is_taxable: bool
    is_statutory: bool
    gl_expense_account_id: UUID | None
    gl_liability_account_id: UUID | None
    status: str
    company_id: UUID
    version: int

class SalaryStructureLineCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class SalaryStructureLineUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class SalaryStructureLineResponse(OrmModel):
    id: UUID
    salary_structure_id: UUID
    salary_component_id: UUID
    sequence_no: int
    default_amount: Decimal | None
    default_percent: Decimal | None
    is_mandatory: bool
    status: str
    company_id: UUID
    version: int

class EmployeeSalaryCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class EmployeeSalaryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class EmployeeSalaryResponse(OrmModel):
    id: UUID
    document_number: str | None
    employee_id: UUID
    salary_structure_id: UUID
    employment_id: UUID
    department_id: UUID | None
    effective_from: date
    effective_to: date | None
    ctc_amount: Decimal
    gross_amount: Decimal
    currency_code: str
    status: str
    company_id: UUID
    branch_id: UUID
    version: int


class EmployeeSalaryComponentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    employee_salary_id: UUID
    employee_id: UUID
    salary_component_id: UUID
    amount: Decimal | None = None
    percent: Decimal | None = None
    override_flag: bool = False
    status: str | None = None


class EmployeeSalaryComponentUpdate(BaseModel):
    amount: Decimal | None = None
    percent: Decimal | None = None
    override_flag: bool | None = None
    status: str | None = None
    version: int | None = None


class EmployeeSalaryComponentResponse(OrmModel):
    id: UUID
    employee_salary_id: UUID
    employee_id: UUID
    salary_component_id: UUID
    amount: Decimal | None
    percent: Decimal | None
    override_flag: bool
    status: str
    company_id: UUID
    branch_id: UUID
    version: int


class PayrollPostingPostRequest(BaseModel):
    debit_account_id: UUID
    credit_account_id: UUID


class EarningTypeCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class EarningTypeUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class EarningTypeResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    earning_type_code: str
    earning_type_name: str
    is_recurring: bool
    status: str
    company_id: UUID
    version: int

class DeductionTypeCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DeductionTypeUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DeductionTypeResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    deduction_type_code: str
    deduction_type_name: str
    is_statutory: bool
    status: str
    company_id: UUID
    version: int

class TaxConfigurationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class TaxConfigurationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class TaxConfigurationResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    tax_config_code: str
    tax_config_name: str
    tax_type: str
    effective_from: date
    effective_to: date | None
    slabs_json: dict | list | None
    status: str
    company_id: UUID
    version: int

class StatutoryContributionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class StatutoryContributionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class StatutoryContributionResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    contribution_code: str
    contribution_name: str
    employee_rate_percent: Decimal
    employer_rate_percent: Decimal
    wage_ceiling_amount: Decimal | None
    effective_from: date
    effective_to: date | None
    salary_component_id: UUID | None
    status: str
    company_id: UUID
    version: int

class PayrollRunCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class PayrollRunUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PayrollRunResponse(OrmModel):
    id: UUID
    document_number: str
    payroll_period_id: UUID
    run_date: date
    run_type: str
    employee_count: int
    total_gross: Decimal
    total_deduction: Decimal
    total_net: Decimal
    total_employer_cost: Decimal
    currency_code: str
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class PayrollRunLineCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class PayrollRunLineUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PayrollRunLineResponse(OrmModel):
    id: UUID
    payroll_run_id: UUID
    employee_id: UUID
    employee_salary_id: UUID | None
    department_id: UUID | None
    employment_id: UUID
    paid_days: Decimal
    lop_days: Decimal
    leave_days: Decimal
    gross_earnings: Decimal
    total_deductions: Decimal
    net_pay: Decimal
    employer_contribution: Decimal
    component_breakdown_json: dict | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class PayslipCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class PayslipUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PayslipResponse(OrmModel):
    id: UUID
    document_number: str
    payroll_run_id: UUID
    payroll_run_line_id: UUID
    employee_id: UUID
    employee_code: str | None = None
    employee_name: str | None = None
    payroll_period_id: UUID
    gross_salary: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    payslip_json: dict | None
    issued_at: datetime | None
    delivery_status: str
    payment_status: str
    bank_export_uri: str | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class BonusCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class BonusUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class BonusResponse(OrmModel):
    id: UUID
    document_number: str
    employee_id: UUID
    payroll_period_id: UUID | None
    bonus_type: str
    amount: Decimal
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class ReimbursementCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class ReimbursementUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ReimbursementResponse(OrmModel):
    id: UUID
    document_number: str
    employee_id: UUID
    payroll_period_id: UUID | None
    reimbursement_type: str
    claim_amount: Decimal
    approved_amount: Decimal | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class LoanCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class LoanUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class LoanResponse(OrmModel):
    id: UUID
    document_number: str
    employee_id: UUID
    loan_type: str
    principal_amount: Decimal
    emi_amount: Decimal
    interest_rate: Decimal
    installment_count: int
    start_date: date
    end_date: date | None
    outstanding_amount: Decimal
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    branch_id: UUID
    version: int

class LoanInstallmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class LoanInstallmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class LoanInstallmentResponse(OrmModel):
    id: UUID
    loan_id: UUID
    employee_id: UUID
    installment_no: int
    due_date: date
    payroll_period_id: UUID | None
    due_amount: Decimal
    paid_amount: Decimal
    payroll_run_line_id: UUID | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class PayrollAdjustmentCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class PayrollAdjustmentUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PayrollAdjustmentResponse(OrmModel):
    id: UUID
    document_number: str
    employee_id: UUID
    payroll_period_id: UUID
    salary_component_id: UUID | None
    adjustment_type: str
    amount: Decimal
    reason: str | None
    status: str
    company_id: UUID
    branch_id: UUID
    version: int

class PayrollPostingCreate(BaseModel):
    company_id: UUID | None = None
    branch_id: UUID
    status: str | None = None

class PayrollPostingUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PayrollPostingResponse(OrmModel):
    id: UUID
    document_number: str
    payroll_run_id: UUID
    payroll_period_id: UUID
    fiscal_year_id: UUID | None
    period_id: UUID | None
    posting_type: str
    debit_total: Decimal
    credit_total: Decimal
    finance_journal_id: UUID | None
    idempotency_key: str
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    error_message: str | None
    company_id: UUID
    branch_id: UUID
    version: int

class PayrollSummaryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class PayrollSummaryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class PayrollSummaryResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    payroll_run_id: UUID
    payroll_period_id: UUID
    department_id: UUID | None
    employee_count: int
    total_gross: Decimal
    total_deduction: Decimal
    total_net: Decimal
    total_employer_cost: Decimal
    summary_json: dict | None
    status: str
    company_id: UUID
    version: int
