"""Payroll REST routers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.payroll.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_pagination,
    paginate,
)
from modules.payroll.schemas import (
    BonusCreate,
    BonusResponse,
    BonusUpdate,
    DeductionTypeCreate,
    DeductionTypeResponse,
    DeductionTypeUpdate,
    EarningTypeCreate,
    EarningTypeResponse,
    EarningTypeUpdate,
    EmployeeSalaryComponentCreate,
    EmployeeSalaryComponentResponse,
    EmployeeSalaryComponentUpdate,
    EmployeeSalaryCreate,
    EmployeeSalaryResponse,
    EmployeeSalaryUpdate,
    LoanCreate,
    LoanInstallmentCreate,
    LoanInstallmentResponse,
    LoanInstallmentUpdate,
    LoanResponse,
    LoanUpdate,
    PayrollAdjustmentCreate,
    PayrollAdjustmentResponse,
    PayrollAdjustmentUpdate,
    PayrollPeriodCreate,
    PayrollPeriodGenerateRequest,
    PayrollPeriodResponse,
    PayrollPeriodUpdate,
    PayrollPolicyCreate,
    PayrollPolicyResponse,
    PayrollPolicyUpdate,
    PayrollPostingCreate,
    PayrollPostingPostRequest,
    PayrollPostingResponse,
    PayrollPostingUpdate,
    PayrollRunCreate,
    PayrollRunLineCreate,
    PayrollRunLineResponse,
    PayrollRunLineUpdate,
    PayrollRunResponse,
    PayrollRunUpdate,
    PayrollSummaryCreate,
    PayrollSummaryResponse,
    PayrollSummaryUpdate,
    GeneratePayslipsRequest,
    PayslipCreate,
    PayslipResponse,
    PayslipUpdate,
    ReimbursementCreate,
    ReimbursementResponse,
    ReimbursementUpdate,
    SalaryComponentCreate,
    SalaryComponentResponse,
    SalaryComponentUpdate,
    SalaryStructureCreate,
    SalaryStructureLineCreate,
    SalaryStructureLineResponse,
    SalaryStructureLineUpdate,
    SalaryStructureResponse,
    SalaryStructureUpdate,
    StatutoryContributionCreate,
    StatutoryContributionResponse,
    StatutoryContributionUpdate,
    TaxConfigurationCreate,
    TaxConfigurationResponse,
    TaxConfigurationUpdate,
)
from modules.payroll.service import (
    BonusService,
    DeductionTypeService,
    EarningTypeService,
    EmployeeSalaryComponentService,
    EmployeeSalaryService,
    LoanInstallmentService,
    LoanService,
    PayrollAdjustmentService,
    PayrollPeriodService,
    PayrollPolicyService,
    PayrollPeriodDayService,
    PayrollPostingService,
    PayrollReportService,
    PayrollRunLineService,
    PayrollRunService,
    PayrollSummaryService,
    PayslipService,
    ReimbursementService,
    SalaryComponentService,
    SalaryStructureLineService,
    SalaryStructureService,
    StatutoryContributionService,
    TaxConfigurationService,
)
from shared.schemas import APIResponse

periods_router = APIRouter(prefix="/payroll-periods", tags=["Payroll - PayrollPeriod"])
policies_router = APIRouter(prefix="/policies", tags=["Payroll - PayrollPolicy"])
salary_structures_router = APIRouter(prefix="/salary-structures", tags=["Payroll - SalaryStructure"])
salary_components_router = APIRouter(prefix="/salary-components", tags=["Payroll - SalaryComponent"])
structure_lines_router = APIRouter(prefix="/structure-lines", tags=["Payroll - SalaryStructureLine"])
employee_salaries_router = APIRouter(prefix="/employee-salaries", tags=["Payroll - EmployeeSalary"])
earning_types_router = APIRouter(prefix="/earning-types", tags=["Payroll - EarningType"])
deduction_types_router = APIRouter(prefix="/deduction-types", tags=["Payroll - DeductionType"])
tax_configurations_router = APIRouter(prefix="/tax-configurations", tags=["Payroll - TaxConfiguration"])
statutory_contributions_router = APIRouter(prefix="/statutory-contributions", tags=["Payroll - StatutoryContribution"])
payroll_runs_router = APIRouter(prefix="/payroll-runs", tags=["Payroll - PayrollRun"])
run_lines_router = APIRouter(prefix="/payroll-run-lines", tags=["Payroll - PayrollRunLine"])
payslips_router = APIRouter(prefix="/payslips", tags=["Payroll - Payslip"])
bonuses_router = APIRouter(prefix="/bonuses", tags=["Payroll - Bonus"])
reimbursements_router = APIRouter(prefix="/reimbursements", tags=["Payroll - Reimbursement"])
loans_router = APIRouter(prefix="/loans", tags=["Payroll - Loan"])
loan_installments_router = APIRouter(prefix="/loan-installments", tags=["Payroll - LoanInstallment"])
employee_salary_components_router = APIRouter(
    prefix="/employee-salary-components",
    tags=["Payroll - EmployeeSalaryComponent"],
)
adjustments_router = APIRouter(prefix="/payroll-adjustments", tags=["Payroll - PayrollAdjustment"])
postings_router = APIRouter(prefix="/payroll-postings", tags=["Payroll - PayrollPosting"])
summaries_router = APIRouter(prefix="/payroll-summaries", tags=["Payroll - PayrollSummary"])
reports_router = APIRouter(prefix="/reports", tags=["Payroll - Reports"])

@reports_router.get("/cost-summary", response_model=APIResponse[dict])
def payroll_cost_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=PayrollReportService(db).payroll_cost_summary(ctx, company_id))
@periods_router.get("", response_model=APIResponse[list[PayrollPeriodResponse]])
def list_periods(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(PayrollPeriodService(db).list(ctx, company_id), pagination))

@periods_router.post("", response_model=APIResponse[PayrollPeriodResponse])
def create_periods(
    body: PayrollPeriodCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PayrollPeriodService(db).create(ctx, **body.model_dump()))

@periods_router.patch("/{row_id}", response_model=APIResponse[PayrollPeriodResponse])
def update_periods(
    row_id: UUID,
    body: PayrollPeriodUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PayrollPeriodService(db).update(ctx, row_id, **extract_update_fields(body)))

@periods_router.post("/generate", response_model=APIResponse[list[PayrollPeriodResponse]])
def generate_payroll_periods(
    body: PayrollPeriodGenerateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=PayrollPeriodService(db).generate(ctx, **body.model_dump()),
    )


@periods_router.post("/ensure-current", response_model=APIResponse[PayrollPeriodResponse])
def ensure_current_payroll_period(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:create"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=PayrollPeriodService(db).ensure_current_period(ctx, company_id))


@periods_router.get("/{row_id}/employee-day-ledger", response_model=APIResponse[dict])
def payroll_period_employee_day_ledger(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:read"))],
    db: Annotated[Session, Depends(get_db)],
    employee_id: UUID,
):
    period = PayrollPeriodService(db).get(ctx, row_id)
    from modules.payroll.adapters.hr_port import PayrollHrAdapter

    hr = PayrollHrAdapter(db)
    day_svc = PayrollPeriodDayService(db)
    cache = day_svc.build_cache(ctx, period.company_id, period.start_date, period.end_date)
    result = day_svc.resolve_employee_pay_days(
        cache,
        employee_id,
        hr.attendance_facts(ctx, period.company_id),
        hr.leave_facts(ctx, period.company_id),
    )
    return APIResponse(
        message="OK",
        data={
            "period_id": str(period.id),
            "employee_id": str(employee_id),
            "period_days": float(result.period_days),
            "paid_days": float(result.paid_days),
            "lop_days": float(result.lop_days),
            "leave_days": float(result.leave_days),
            "paid_leave_days": result.day_summary_json.get("counts", {}).get("paid_leave"),
            "unpaid_leave_days": result.day_summary_json.get("counts", {}).get("unpaid_leave"),
            "primary_shift_id": str(result.primary_shift_id) if result.primary_shift_id else None,
            "day_summary": result.day_summary_json,
        },
    )


@periods_router.post("/{row_id}/start-processing", response_model=APIResponse[PayrollPeriodResponse])
def payroll_period_start_processing(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PayrollPeriodService(db).start_processing(ctx, row_id))


@periods_router.post("/{row_id}/approve", response_model=APIResponse[PayrollPeriodResponse])
def payroll_period_approve(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PayrollPeriodService(db).approve(ctx, row_id))


@periods_router.post("/{row_id}/close", response_model=APIResponse[PayrollPeriodResponse])
def payroll_period_close(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PayrollPeriodService(db).close(ctx, row_id))


@periods_router.post("/{row_id}/reopen", response_model=APIResponse[PayrollPeriodResponse])
def payroll_period_reopen(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PayrollPeriodService(db).reopen(ctx, row_id))


@periods_router.post("/{row_id}/cancel", response_model=APIResponse[PayrollPeriodResponse])
def payroll_period_cancel(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PayrollPeriodService(db).cancel(ctx, row_id))

@policies_router.get("/defaults", response_model=APIResponse[dict])
def payroll_policy_defaults(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:read"))],
):
    return APIResponse(message="OK", data=PayrollPolicyService.default_template())


@policies_router.get("/resolved", response_model=APIResponse[dict])
def payroll_policy_resolved(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=PayrollPolicyService(db).get_active_or_defaults(ctx, company_id),
    )


@policies_router.get("/active", response_model=APIResponse[PayrollPolicyResponse | None])
def payroll_policy_active(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=PayrollPolicyService(db).get_active(ctx, company_id))


@policies_router.get("", response_model=APIResponse[list[PayrollPolicyResponse]])
def list_payroll_policies(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=paginate(PayrollPolicyService(db).list(ctx, company_id), pagination),
    )


@policies_router.post("/ensure-default", response_model=APIResponse[PayrollPolicyResponse])
def ensure_default_payroll_policy(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:create"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=PayrollPolicyService(db).ensure_default_active(ctx, company_id),
    )


@policies_router.post("", response_model=APIResponse[PayrollPolicyResponse])
def create_payroll_policy(
    body: PayrollPolicyCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PayrollPolicyService(db).create(ctx, **body.model_dump()))


@policies_router.patch("/{row_id}", response_model=APIResponse[PayrollPolicyResponse])
def update_payroll_policy(
    row_id: UUID,
    body: PayrollPolicyUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=PayrollPolicyService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


@policies_router.post("/{row_id}/activate", response_model=APIResponse[PayrollPolicyResponse])
def activate_payroll_policy(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.period:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Activated", data=PayrollPolicyService(db).activate(ctx, row_id))


@salary_structures_router.get("", response_model=APIResponse[list[SalaryStructureResponse]])
def list_salary_structures(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.structure:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(SalaryStructureService(db).list(ctx, company_id), pagination))

@salary_structures_router.post("", response_model=APIResponse[SalaryStructureResponse])
def create_salary_structures(
    body: SalaryStructureCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.structure:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=SalaryStructureService(db).create(ctx, **body.model_dump()))

@salary_structures_router.patch("/{row_id}", response_model=APIResponse[SalaryStructureResponse])
def update_salary_structures(
    row_id: UUID,
    body: SalaryStructureUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.structure:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=SalaryStructureService(db).update(ctx, row_id, **extract_update_fields(body)))

@salary_components_router.get("", response_model=APIResponse[list[SalaryComponentResponse]])
def list_salary_components(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.component:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(SalaryComponentService(db).list(ctx, company_id), pagination))

@salary_components_router.post("", response_model=APIResponse[SalaryComponentResponse])
def create_salary_components(
    body: SalaryComponentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.component:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=SalaryComponentService(db).create(ctx, **body.model_dump()))

@salary_components_router.patch("/{row_id}", response_model=APIResponse[SalaryComponentResponse])
def update_salary_components(
    row_id: UUID,
    body: SalaryComponentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.component:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=SalaryComponentService(db).update(ctx, row_id, **extract_update_fields(body)))

@structure_lines_router.get("", response_model=APIResponse[list[SalaryStructureLineResponse]])
def list_structure_lines(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.structure:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(SalaryStructureLineService(db).list(ctx, company_id), pagination))

@structure_lines_router.post("", response_model=APIResponse[SalaryStructureLineResponse])
def create_structure_lines(
    body: SalaryStructureLineCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.structure:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=SalaryStructureLineService(db).create(ctx, **body.model_dump()))

@structure_lines_router.patch("/{row_id}", response_model=APIResponse[SalaryStructureLineResponse])
def update_structure_lines(
    row_id: UUID,
    body: SalaryStructureLineUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.structure:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=SalaryStructureLineService(db).update(ctx, row_id, **extract_update_fields(body)))

@employee_salaries_router.get("", response_model=APIResponse[list[EmployeeSalaryResponse]])
def list_employee_salaries(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.employee_salary:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(EmployeeSalaryService(db).list(ctx, company_id), pagination))

@employee_salaries_router.post("", response_model=APIResponse[EmployeeSalaryResponse])
def create_employee_salaries(
    body: EmployeeSalaryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.employee_salary:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=EmployeeSalaryService(db).create(ctx, **body.model_dump()))

@employee_salaries_router.patch("/{row_id}", response_model=APIResponse[EmployeeSalaryResponse])
def update_employee_salaries(
    row_id: UUID,
    body: EmployeeSalaryUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.employee_salary:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=EmployeeSalaryService(db).update(ctx, row_id, **extract_update_fields(body)))

@employee_salary_components_router.get("", response_model=APIResponse[list[EmployeeSalaryComponentResponse]])
def list_employee_salary_components(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.employee_salary:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=paginate(EmployeeSalaryComponentService(db).list(ctx, company_id), pagination),
    )

@employee_salary_components_router.post("", response_model=APIResponse[EmployeeSalaryComponentResponse])
def create_employee_salary_components(
    body: EmployeeSalaryComponentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.employee_salary:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=EmployeeSalaryComponentService(db).create(ctx, **body.model_dump()))

@employee_salary_components_router.patch("/{row_id}", response_model=APIResponse[EmployeeSalaryComponentResponse])
def update_employee_salary_components(
    row_id: UUID,
    body: EmployeeSalaryComponentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.employee_salary:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Updated",
        data=EmployeeSalaryComponentService(db).update(ctx, row_id, **extract_update_fields(body)),
    )

@earning_types_router.get("", response_model=APIResponse[list[EarningTypeResponse]])
def list_earning_types(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.component:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(EarningTypeService(db).list(ctx, company_id), pagination))

@earning_types_router.post("", response_model=APIResponse[EarningTypeResponse])
def create_earning_types(
    body: EarningTypeCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.component:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=EarningTypeService(db).create(ctx, **body.model_dump()))

@earning_types_router.patch("/{row_id}", response_model=APIResponse[EarningTypeResponse])
def update_earning_types(
    row_id: UUID,
    body: EarningTypeUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.component:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=EarningTypeService(db).update(ctx, row_id, **extract_update_fields(body)))

@deduction_types_router.get("", response_model=APIResponse[list[DeductionTypeResponse]])
def list_deduction_types(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.component:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(DeductionTypeService(db).list(ctx, company_id), pagination))

@deduction_types_router.post("", response_model=APIResponse[DeductionTypeResponse])
def create_deduction_types(
    body: DeductionTypeCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.component:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DeductionTypeService(db).create(ctx, **body.model_dump()))

@deduction_types_router.patch("/{row_id}", response_model=APIResponse[DeductionTypeResponse])
def update_deduction_types(
    row_id: UUID,
    body: DeductionTypeUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.component:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DeductionTypeService(db).update(ctx, row_id, **extract_update_fields(body)))

@tax_configurations_router.get("", response_model=APIResponse[list[TaxConfigurationResponse]])
def list_tax_configurations(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.tax:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(TaxConfigurationService(db).list(ctx, company_id), pagination))

@tax_configurations_router.post("", response_model=APIResponse[TaxConfigurationResponse])
def create_tax_configurations(
    body: TaxConfigurationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.tax:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=TaxConfigurationService(db).create(ctx, **body.model_dump()))

@tax_configurations_router.patch("/{row_id}", response_model=APIResponse[TaxConfigurationResponse])
def update_tax_configurations(
    row_id: UUID,
    body: TaxConfigurationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.tax:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=TaxConfigurationService(db).update(ctx, row_id, **extract_update_fields(body)))

@statutory_contributions_router.get("", response_model=APIResponse[list[StatutoryContributionResponse]])
def list_statutory_contributions(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.statutory:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(StatutoryContributionService(db).list(ctx, company_id), pagination))

@statutory_contributions_router.post("", response_model=APIResponse[StatutoryContributionResponse])
def create_statutory_contributions(
    body: StatutoryContributionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.statutory:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=StatutoryContributionService(db).create(ctx, **body.model_dump()))

@statutory_contributions_router.patch("/{row_id}", response_model=APIResponse[StatutoryContributionResponse])
def update_statutory_contributions(
    row_id: UUID,
    body: StatutoryContributionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.statutory:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=StatutoryContributionService(db).update(ctx, row_id, **extract_update_fields(body)))

@payroll_runs_router.get("", response_model=APIResponse[list[PayrollRunResponse]])
def list_payroll_runs(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.run:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(PayrollRunService(db).list(ctx, company_id), pagination))

@payroll_runs_router.post("", response_model=APIResponse[PayrollRunResponse])
def create_payroll_runs(
    body: PayrollRunCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.run:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PayrollRunService(db).create(ctx, **body.model_dump()))

@payroll_runs_router.patch("/{row_id}", response_model=APIResponse[PayrollRunResponse])
def update_payroll_runs(
    row_id: UUID,
    body: PayrollRunUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.run:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PayrollRunService(db).update(ctx, row_id, **extract_update_fields(body)))

@payroll_runs_router.post("/{row_id}/calculate", response_model=APIResponse[PayrollRunResponse])
def calculate_payroll_runs(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.run:calculate"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Calculated", data=PayrollRunService(db).calculate(ctx, row_id))

@payroll_runs_router.post("/{row_id}/submit", response_model=APIResponse[PayrollRunResponse])
def submit_payroll_runs(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.run:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Submitted", data=PayrollRunService(db).submit(ctx, row_id))

@payroll_runs_router.post("/{row_id}/approve", response_model=APIResponse[PayrollRunResponse])
def approve_payroll_runs(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.run:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Approved", data=PayrollRunService(db).approve(ctx, row_id))

@payroll_runs_router.post("/{row_id}/generate-payslips", response_model=APIResponse[list[PayslipResponse]])
def generate_payslips_for_run(
    row_id: UUID,
    body: GeneratePayslipsRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.payslip:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=PayslipService(db).generate_for_run(ctx, row_id, issue=body.issue),
    )


@payroll_runs_router.get("/{row_id}/bank-export", response_model=APIResponse[dict])
def export_payroll_run_bank_file(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.payslip:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    csv_text = PayslipService(db).generate_bank_export_for_run(ctx, row_id)
    return APIResponse(message="OK", data={"csv": csv_text, "content_type": "text/csv"})

@run_lines_router.get("", response_model=APIResponse[list[PayrollRunLineResponse]])
def list_run_lines(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.run:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(PayrollRunLineService(db).list(ctx, company_id), pagination))

@run_lines_router.post("", response_model=APIResponse[PayrollRunLineResponse])
def create_run_lines(
    body: PayrollRunLineCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.run:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PayrollRunLineService(db).create(ctx, **body.model_dump()))

@run_lines_router.patch("/{row_id}", response_model=APIResponse[PayrollRunLineResponse])
def update_run_lines(
    row_id: UUID,
    body: PayrollRunLineUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.run:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PayrollRunLineService(db).update(ctx, row_id, **extract_update_fields(body)))

@payslips_router.get("", response_model=APIResponse[list[PayslipResponse]])
def list_payslips(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.payslip:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(PayslipService(db).list(ctx, company_id), pagination))

@payslips_router.post("", response_model=APIResponse[PayslipResponse])
def create_payslips(
    body: PayslipCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.payslip:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PayslipService(db).create(ctx, **body.model_dump()))

@payslips_router.get("/{row_id}/export-text", response_model=APIResponse[dict])
def export_payslip_text(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.payslip:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    text = PayslipService(db).export_text(ctx, row_id)
    return APIResponse(message="OK", data={"text": text})

@payslips_router.patch("/{row_id}", response_model=APIResponse[PayslipResponse])
def update_payslips(
    row_id: UUID,
    body: PayslipUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.payslip:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PayslipService(db).update(ctx, row_id, **extract_update_fields(body)))

@payslips_router.post("/{row_id}/issue", response_model=APIResponse[PayslipResponse])
def issue_payslips(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.payslip:issue"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Issued", data=PayslipService(db).issue(ctx, row_id))

@bonuses_router.get("", response_model=APIResponse[list[BonusResponse]])
def list_bonuses(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.bonus:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(BonusService(db).list(ctx, company_id), pagination))

@bonuses_router.post("", response_model=APIResponse[BonusResponse])
def create_bonuses(
    body: BonusCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.bonus:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=BonusService(db).create(ctx, **body.model_dump()))

@bonuses_router.patch("/{row_id}", response_model=APIResponse[BonusResponse])
def update_bonuses(
    row_id: UUID,
    body: BonusUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.bonus:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=BonusService(db).update(ctx, row_id, **extract_update_fields(body)))

@bonuses_router.post("/{row_id}/submit", response_model=APIResponse[BonusResponse])
def submit_bonuses(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.bonus:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Submitted", data=BonusService(db).submit(ctx, row_id))

@bonuses_router.post("/{row_id}/approve", response_model=APIResponse[BonusResponse])
def approve_bonuses(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.bonus:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Approved", data=BonusService(db).approve(ctx, row_id))

@reimbursements_router.get("", response_model=APIResponse[list[ReimbursementResponse]])
def list_reimbursements(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.reimbursement:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(ReimbursementService(db).list(ctx, company_id), pagination))

@reimbursements_router.post("", response_model=APIResponse[ReimbursementResponse])
def create_reimbursements(
    body: ReimbursementCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.reimbursement:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ReimbursementService(db).create(ctx, **body.model_dump()))

@reimbursements_router.patch("/{row_id}", response_model=APIResponse[ReimbursementResponse])
def update_reimbursements(
    row_id: UUID,
    body: ReimbursementUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.reimbursement:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ReimbursementService(db).update(ctx, row_id, **extract_update_fields(body)))

@reimbursements_router.post("/{row_id}/submit", response_model=APIResponse[ReimbursementResponse])
def submit_reimbursements(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.reimbursement:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Submitted", data=ReimbursementService(db).submit(ctx, row_id))

@reimbursements_router.post("/{row_id}/approve", response_model=APIResponse[ReimbursementResponse])
def approve_reimbursements(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.reimbursement:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Approved", data=ReimbursementService(db).approve(ctx, row_id))

@loans_router.get("", response_model=APIResponse[list[LoanResponse]])
def list_loans(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.loan:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(LoanService(db).list(ctx, company_id), pagination))

@loans_router.post("", response_model=APIResponse[LoanResponse])
def create_loans(
    body: LoanCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.loan:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=LoanService(db).create(ctx, **body.model_dump()))

@loans_router.patch("/{row_id}", response_model=APIResponse[LoanResponse])
def update_loans(
    row_id: UUID,
    body: LoanUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.loan:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=LoanService(db).update(ctx, row_id, **extract_update_fields(body)))

@loans_router.post("/{row_id}/submit", response_model=APIResponse[LoanResponse])
def submit_loans(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.loan:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Submitted", data=LoanService(db).submit(ctx, row_id))

@loans_router.post("/{row_id}/approve", response_model=APIResponse[LoanResponse])
def approve_loans(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.loan:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Approved", data=LoanService(db).approve(ctx, row_id))

@loan_installments_router.get("", response_model=APIResponse[list[LoanInstallmentResponse]])
def list_loan_installments(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.loan:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(LoanInstallmentService(db).list(ctx, company_id), pagination))

@loan_installments_router.post("", response_model=APIResponse[LoanInstallmentResponse])
def create_loan_installments(
    body: LoanInstallmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.loan:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=LoanInstallmentService(db).create(ctx, **body.model_dump()))

@loan_installments_router.patch("/{row_id}", response_model=APIResponse[LoanInstallmentResponse])
def update_loan_installments(
    row_id: UUID,
    body: LoanInstallmentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.loan:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=LoanInstallmentService(db).update(ctx, row_id, **extract_update_fields(body)))

@adjustments_router.get("", response_model=APIResponse[list[PayrollAdjustmentResponse]])
def list_adjustments(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.adjustment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(PayrollAdjustmentService(db).list(ctx, company_id), pagination))

@adjustments_router.post("", response_model=APIResponse[PayrollAdjustmentResponse])
def create_adjustments(
    body: PayrollAdjustmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.adjustment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PayrollAdjustmentService(db).create(ctx, **body.model_dump()))

@adjustments_router.patch("/{row_id}", response_model=APIResponse[PayrollAdjustmentResponse])
def update_adjustments(
    row_id: UUID,
    body: PayrollAdjustmentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.adjustment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PayrollAdjustmentService(db).update(ctx, row_id, **extract_update_fields(body)))

@adjustments_router.post("/{row_id}/apply", response_model=APIResponse[PayrollAdjustmentResponse])
def apply_adjustments(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.adjustment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Applied", data=PayrollAdjustmentService(db).apply(ctx, row_id))

@postings_router.get("", response_model=APIResponse[list[PayrollPostingResponse]])
def list_postings(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.posting:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(PayrollPostingService(db).list(ctx, company_id), pagination))

@postings_router.post("", response_model=APIResponse[PayrollPostingResponse])
def create_postings(
    body: PayrollPostingCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.posting:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PayrollPostingService(db).create(ctx, **body.model_dump()))

@postings_router.patch("/{row_id}", response_model=APIResponse[PayrollPostingResponse])
def update_postings(
    row_id: UUID,
    body: PayrollPostingUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.posting:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PayrollPostingService(db).update(ctx, row_id, **extract_update_fields(body)))

@postings_router.post("/{row_id}/submit", response_model=APIResponse[PayrollPostingResponse])
def submit_postings(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.posting:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Submitted", data=PayrollPostingService(db).submit(ctx, row_id))

@postings_router.post("/{row_id}/post", response_model=APIResponse[PayrollPostingResponse])
def post_postings(
    row_id: UUID,
    body: PayrollPostingPostRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.posting:post"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Posted",
        data=PayrollPostingService(db).post(
            ctx,
            row_id,
            debit_account_id=body.debit_account_id,
            credit_account_id=body.credit_account_id,
        ),
    )

@summaries_router.get("", response_model=APIResponse[list[PayrollSummaryResponse]])
def list_summaries(
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(PayrollSummaryService(db).list(ctx, company_id), pagination))

@summaries_router.post("", response_model=APIResponse[PayrollSummaryResponse])
def create_summaries(
    body: PayrollSummaryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.report:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=PayrollSummaryService(db).create(ctx, **body.model_dump()))

@summaries_router.patch("/{row_id}", response_model=APIResponse[PayrollSummaryResponse])
def update_summaries(
    row_id: UUID,
    body: PayrollSummaryUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("payroll.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=PayrollSummaryService(db).update(ctx, row_id, **extract_update_fields(body)))
