"""Finance Pydantic schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AccountGroupCreateRequest(BaseModel):
    group_code: str
    group_name: str
    account_type: str
    parent_group_id: UUID | None = None
    display_order: int = 1
    status: str = "active"


class AccountGroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    group_code: str
    group_name: str
    account_type: str
    parent_group_id: UUID | None = None
    display_order: int = 1
    status: str
    created_by: UUID | None = None
    created_at: datetime | None = None


class ChartOfAccountCreateRequest(BaseModel):
    account_group_id: UUID
    account_code: str
    account_name: str
    account_type: str
    normal_balance: str
    parent_account_id: UUID | None = None
    is_posting_account: bool = True
    is_cost_center_enabled: bool = False
    is_profit_center_enabled: bool = False
    is_tax_applicable: bool = False
    currency_code: str | None = None
    description: str | None = None
    status: str = "draft"


class ChartOfAccountUpdateRequest(BaseModel):
    account_group_id: UUID | None = None
    account_code: str | None = None
    account_name: str | None = None
    account_type: str | None = None
    normal_balance: str | None = None
    parent_account_id: UUID | None = None
    is_posting_account: bool | None = None
    is_cost_center_enabled: bool | None = None
    is_profit_center_enabled: bool | None = None
    is_tax_applicable: bool | None = None
    currency_code: str | None = None
    description: str | None = None
    status: str | None = None
    version: int | None = None


class ChartOfAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    account_group_id: UUID
    account_code: str
    account_name: str
    account_type: str
    normal_balance: str
    parent_account_id: UUID | None = None
    is_posting_account: bool
    is_cost_center_enabled: bool = False
    is_profit_center_enabled: bool = False
    is_tax_applicable: bool = False
    currency_code: str | None = None
    description: str | None = None
    status: str
    version: int
    created_by: UUID | None = None
    created_at: datetime | None = None
    updated_by: UUID | None = None
    updated_at: datetime | None = None
    parent_account_code: str | None = None
    parent_account_name: str | None = None
    account_group_code: str | None = None
    account_group_name: str | None = None
    balance: float | None = None
    child_count: int | None = None


class ChartOfAccountListResponse(BaseModel):
    items: list[ChartOfAccountResponse]
    total: int
    page: int
    page_size: int


class ChartOfAccountSummaryResponse(BaseModel):
    total_accounts: int
    active_accounts: int
    inactive_accounts: int
    draft_accounts: int
    assets: int
    liabilities: int
    equity: int
    income: int
    expense: int
    recently_created: list[ChartOfAccountResponse] = Field(default_factory=list)


class ChartOfAccountBalanceResponse(BaseModel):
    account_id: UUID
    account_code: str
    debit_total: float
    credit_total: float
    balance: float


class ChartOfAccountImportRow(BaseModel):
    account_group_id: UUID | None = None
    account_group_code: str | None = None
    account_code: str
    account_name: str
    account_type: str
    normal_balance: str
    parent_account_code: str | None = None
    is_posting_account: bool = True
    is_cost_center_enabled: bool = False
    currency_code: str | None = None
    description: str | None = None
    status: str = "draft"


class ChartOfAccountImportRequest(BaseModel):
    rows: list[ChartOfAccountImportRow]


class ChartOfAccountImportResult(BaseModel):
    created: int
    failed: int
    errors: list[str] = Field(default_factory=list)


class ChartOfAccountMergeRequest(BaseModel):
    source_account_id: UUID
    target_account_id: UUID
    comments: str | None = None


class AccountRelatedJournalResponse(BaseModel):
    id: UUID
    journal_number: str
    journal_date: date
    description: str
    status: str
    total_debit: float
    total_credit: float


class FiscalYearCreateRequest(BaseModel):
    fiscal_year_code: str
    fiscal_year_name: str
    start_date: date
    end_date: date
    description: str | None = None
    is_default: bool = False


class FiscalYearUpdateRequest(BaseModel):
    fiscal_year_code: str | None = None
    fiscal_year_name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    description: str | None = None
    is_default: bool | None = None
    status: str | None = None
    version: int | None = None


class FiscalYearResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    fiscal_year_code: str
    fiscal_year_name: str
    start_date: date
    end_date: date
    status: str
    description: str | None = None
    is_default: bool = False
    closed_at: datetime | None = None
    closed_by: UUID | None = None
    created_by: UUID | None = None
    created_at: datetime | None = None
    updated_by: UUID | None = None
    updated_at: datetime | None = None
    version: int | None = None
    period_count: int | None = None
    closed_period_count: int | None = None
    locked_period_count: int | None = None
    journal_count: int | None = None


class FiscalYearListResponse(BaseModel):
    items: list[FiscalYearResponse]
    total: int
    page: int
    page_size: int


class PeriodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    fiscal_year_id: UUID
    period_number: int
    period_name: str
    start_date: date
    end_date: date
    status: str
    ar_closed: bool
    ap_closed: bool
    inventory_closed: bool = False
    payroll_closed: bool = False
    gl_closed: bool
    closed_at: datetime | None = None
    closed_by: UUID | None = None
    created_by: UUID | None = None
    created_at: datetime | None = None
    updated_by: UUID | None = None
    updated_at: datetime | None = None
    version: int | None = None
    fiscal_year_code: str | None = None
    fiscal_year_name: str | None = None
    journal_count: int | None = None
    journal_posting_allowed: bool | None = None
    quarter: int | None = None


class PeriodListResponse(BaseModel):
    items: list[PeriodResponse]
    total: int
    page: int
    page_size: int


class FiscalSummaryResponse(BaseModel):
    active_fiscal_year: FiscalYearResponse | None = None
    total_fiscal_years: int
    open_periods: int
    closed_periods: int
    locked_periods: int
    current_period: PeriodResponse | None = None
    recently_closed_periods: list[PeriodResponse] = Field(default_factory=list)
    year_close_progress_pct: float = 0.0


class BulkPeriodActionRequest(BaseModel):
    period_ids: list[UUID]
    action: str
    comments: str | None = None


class BulkPeriodActionResult(BaseModel):
    succeeded: int
    failed: int
    errors: list[str] = Field(default_factory=list)


class FiscalYearClosePreviewResponse(BaseModel):
    fiscal_year_id: UUID
    fiscal_year_code: str
    open_journals: int
    unclosed_periods: int
    warnings: list[str] = Field(default_factory=list)
    can_close: bool


class FiscalYearImportRow(BaseModel):
    fiscal_year_code: str
    fiscal_year_name: str
    start_date: date
    end_date: date
    description: str | None = None


class FiscalYearImportRequest(BaseModel):
    rows: list[FiscalYearImportRow]


class FiscalYearImportResult(BaseModel):
    created: int
    failed: int
    errors: list[str] = Field(default_factory=list)


class PeriodCloseFlagsRequest(BaseModel):
    ar_closed: bool | None = None
    ap_closed: bool | None = None
    inventory_closed: bool | None = None
    payroll_closed: bool | None = None
    gl_closed: bool | None = None


class JournalCreateRequest(BaseModel):
    branch_id: UUID
    journal_date: date
    description: str
    journal_type: str = "manual"
    currency_code: str = "INR"
    exchange_rate: float = 1.0
    period_id: UUID | None = None
    company_id: UUID | None = None


class JournalUpdateRequest(BaseModel):
    journal_date: date | None = None
    description: str | None = None
    journal_type: str | None = None
    currency_code: str | None = None
    exchange_rate: float | None = None
    period_id: UUID | None = None
    branch_id: UUID | None = None
    version: int | None = None


class JournalLineCreateRequest(BaseModel):
    line_number: int
    account_id: UUID
    debit_amount: float = 0
    credit_amount: float = 0
    description: str | None = None
    cost_center_id: UUID | None = None
    tax_id: UUID | None = None
    customer_id: UUID | None = None
    vendor_id: UUID | None = None


class JournalLineUpdateRequest(BaseModel):
    line_number: int | None = None
    account_id: UUID | None = None
    debit_amount: float | None = None
    credit_amount: float | None = None
    description: str | None = None
    cost_center_id: UUID | None = None
    tax_id: UUID | None = None
    customer_id: UUID | None = None
    vendor_id: UUID | None = None
    reference_number: str | None = None


class JournalLinesReorderRequest(BaseModel):
    line_ids: list[UUID]


class JournalCommentRequest(BaseModel):
    comment: str = Field(min_length=1, max_length=2000)


class JournalLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    line_number: int
    account_id: UUID
    description: str | None = None
    debit_amount: float
    credit_amount: float
    base_debit_amount: float
    base_credit_amount: float
    currency_code: str | None = None
    exchange_rate: float | None = None
    cost_center_id: UUID | None = None
    profit_center_id: UUID | None = None
    tax_id: UUID | None = None
    customer_id: UUID | None = None
    vendor_id: UUID | None = None
    reference_number: str | None = None
    created_by: UUID | None = None
    created_at: datetime | None = None


class JournalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    branch_id: UUID
    journal_number: str
    journal_date: date
    journal_type: str
    description: str
    fiscal_year_id: UUID | None = None
    period_id: UUID | None = None
    currency_code: str | None = None
    exchange_rate: float | None = None
    total_debit: float
    total_credit: float
    status: str
    workflow_status: str
    workflow_instance_id: UUID | None = None
    posted_at: datetime | None = None
    posted_by: UUID | None = None
    reversal_of_id: UUID | None = None
    created_by: UUID | None = None
    created_at: datetime | None = None
    updated_by: UUID | None = None
    updated_at: datetime | None = None
    version: int | None = None
    lines: list[JournalLineResponse] = Field(default_factory=list)


class JournalListResponse(BaseModel):
    items: list[JournalResponse]
    total: int
    page: int
    page_size: int


class GlEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    entry_number: str
    entry_date: date
    account_id: UUID
    account_code: str
    debit_amount: float
    credit_amount: float
    base_debit_amount: float
    base_credit_amount: float
    currency_code: str | None = None
    description: str | None = None
    company_id: UUID | None = None
    branch_id: UUID | None = None
    period_id: UUID | None = None
    fiscal_year_id: UUID | None = None
    journal_header_id: UUID | None = None
    journal_line_id: UUID | None = None
    cost_center_id: UUID | None = None
    profit_center_id: UUID | None = None
    exchange_rate: float | None = None
    is_reversal: bool = False
    posted_at: datetime | None = None
    posted_by: UUID | None = None
    created_at: datetime | None = None
    account_name: str | None = None
    journal_number: str | None = None
    journal_status: str | None = None
    journal_type: str | None = None
    workflow_status: str | None = None
    period_name: str | None = None
    fiscal_year_code: str | None = None
    cost_center_name: str | None = None
    project_ref: str | None = None
    running_balance: float | None = None


class GlEntryListResponse(BaseModel):
    items: list[GlEntryResponse]
    total: int
    page: int
    page_size: int
    total_debit: float = 0
    total_credit: float = 0


class GlSummaryResponse(BaseModel):
    total_accounts: int
    active_ledger_accounts: int
    total_debits: float
    total_credits: float
    current_balance: float
    todays_transactions: int
    current_fiscal_year_code: str | None = None
    current_fiscal_year_id: UUID | None = None
    current_period_name: str | None = None
    current_period_id: UUID | None = None


class GlAccountLedgerLineResponse(BaseModel):
    id: UUID | None = None
    entry_date: date
    entry_number: str
    journal_header_id: UUID | None = None
    journal_number: str | None = None
    description: str | None = None
    debit_amount: float
    credit_amount: float
    running_balance: float


class GlMonthlySummaryResponse(BaseModel):
    year: int
    month: int
    label: str
    debit_total: float
    credit_total: float
    net: float


class GlAccountLedgerResponse(BaseModel):
    account_id: UUID
    account_code: str
    account_name: str
    account_type: str
    normal_balance: str
    status: str
    opening_balance: float
    debit_total: float
    credit_total: float
    closing_balance: float
    lines: list[GlAccountLedgerLineResponse] = Field(default_factory=list)
    monthly_summary: list[GlMonthlySummaryResponse] = Field(default_factory=list)
    related_journal_ids: list[UUID] = Field(default_factory=list)


class GlTrialBalancePreviewLine(BaseModel):
    account_id: UUID
    account_code: str
    account_name: str
    opening: float
    debit: float
    credit: float
    closing: float


class GlTrialBalancePreviewResponse(BaseModel):
    lines: list[GlTrialBalancePreviewLine] = Field(default_factory=list)
    total_opening: float = 0
    total_debit: float = 0
    total_credit: float = 0
    total_closing: float = 0
    difference: float = 0


class CustomerLedgerCreateRequest(BaseModel):
    branch_id: UUID
    customer_id: UUID
    document_date: date
    due_date: date
    document_type: str
    debit_amount: float = 0
    credit_amount: float = 0
    currency_code: str = "INR"
    company_id: UUID | None = None
    exchange_rate: float = 1.0


class CustomerLedgerUpdateRequest(BaseModel):
    document_date: date | None = None
    due_date: date | None = None
    debit_amount: float | None = None
    credit_amount: float | None = None
    currency_code: str | None = None
    exchange_rate: float | None = None


class CustomerLedgerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    customer_id: UUID
    document_number: str
    document_date: date
    due_date: date
    document_type: str = "invoice"
    debit_amount: float = 0
    credit_amount: float = 0
    balance_amount: float
    currency_code: str = "INR"
    exchange_rate: float = 1.0
    status: str
    workflow_status: str | None = None
    aging_bucket: str | None = None
    company_id: UUID | None = None
    branch_id: UUID | None = None
    journal_header_id: UUID | None = None
    source_module: str | None = None
    source_document_id: UUID | None = None
    created_at: datetime | None = None
    created_by: UUID | None = None
    updated_at: datetime | None = None
    updated_by: UUID | None = None
    version: int = 1
    customer_code: str | None = None
    customer_name: str | None = None
    outstanding_amount: float | None = None
    paid_amount: float | None = None
    days_overdue: int | None = None


class CustomerLedgerListResponse(BaseModel):
    items: list[CustomerLedgerResponse]
    total: int
    page: int
    page_size: int
    total_outstanding: float = 0
    total_paid: float = 0
    total_balance: float = 0


class ArAgingBucket(BaseModel):
    bucket: str
    amount: float
    count: int = 0


class ArSummaryResponse(BaseModel):
    outstanding_receivables: float = 0
    collected_today: float = 0
    overdue_invoices: int = 0
    overdue_amount: float = 0
    current_month_collections: float = 0
    customer_count: int = 0
    collection_efficiency: float = 0
    aging: list[ArAgingBucket] = Field(default_factory=list)
    open_invoice_count: int = 0
    receipt_count: int = 0


class ArAgingReportResponse(BaseModel):
    as_of: date
    buckets: list[ArAgingBucket] = Field(default_factory=list)
    items: list[CustomerLedgerResponse] = Field(default_factory=list)
    total_outstanding: float = 0


class ArReceiptCreateRequest(BaseModel):
    branch_id: UUID
    customer_id: UUID
    document_date: date
    amount: float
    currency_code: str = "INR"
    company_id: UUID | None = None
    exchange_rate: float = 1.0
    allocate_to_invoice_id: UUID | None = None
    notes: str | None = None


class ArAllocationLine(BaseModel):
    invoice_id: UUID
    amount: float


class ArAllocateRequest(BaseModel):
    receipt_id: UUID
    allocations: list[ArAllocationLine]


class ArPaymentAllocateRequest(BaseModel):
    """Allocate a payment amount to an invoice (partial/full), optionally from a receipt."""

    amount: float
    receipt_id: UUID | None = None


class ArCustomerLedgerLine(BaseModel):
    id: UUID
    document_number: str
    document_date: date
    due_date: date | None = None
    document_type: str
    debit_amount: float
    credit_amount: float
    balance_amount: float
    status: str
    running_balance: float
    currency_code: str = "INR"


class ArCustomerLedgerResponse(BaseModel):
    customer_id: UUID
    customer_code: str | None = None
    customer_name: str | None = None
    opening_balance: float = 0
    closing_balance: float = 0
    invoice_total: float = 0
    receipt_total: float = 0
    adjustment_total: float = 0
    lines: list[ArCustomerLedgerLine] = Field(default_factory=list)


class VendorLedgerCreateRequest(BaseModel):
    branch_id: UUID
    vendor_id: UUID
    document_date: date
    due_date: date
    document_type: str
    credit_amount: float = 0
    debit_amount: float = 0
    currency_code: str = "INR"
    company_id: UUID | None = None
    exchange_rate: float = 1.0


class VendorLedgerUpdateRequest(BaseModel):
    document_date: date | None = None
    due_date: date | None = None
    debit_amount: float | None = None
    credit_amount: float | None = None
    currency_code: str | None = None
    exchange_rate: float | None = None


class VendorLedgerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vendor_id: UUID
    document_number: str
    document_date: date
    due_date: date
    document_type: str = "invoice"
    debit_amount: float = 0
    credit_amount: float = 0
    balance_amount: float
    currency_code: str = "INR"
    exchange_rate: float = 1.0
    status: str
    workflow_status: str | None = None
    aging_bucket: str | None = None
    company_id: UUID | None = None
    branch_id: UUID | None = None
    journal_header_id: UUID | None = None
    source_module: str | None = None
    source_document_id: UUID | None = None
    created_at: datetime | None = None
    created_by: UUID | None = None
    updated_at: datetime | None = None
    updated_by: UUID | None = None
    version: int = 1
    vendor_code: str | None = None
    vendor_name: str | None = None
    outstanding_amount: float | None = None
    paid_amount: float | None = None
    days_overdue: int | None = None


class VendorLedgerListResponse(BaseModel):
    items: list[VendorLedgerResponse]
    total: int
    page: int
    page_size: int
    total_outstanding: float = 0
    total_paid: float = 0
    total_balance: float = 0


class ApAgingBucket(BaseModel):
    bucket: str
    amount: float
    count: int = 0


class ApVendorAgingSummary(BaseModel):
    vendor_id: UUID
    vendor_code: str | None = None
    vendor_name: str | None = None
    total: float = 0
    bucket_0_30: float = 0
    bucket_31_60: float = 0
    bucket_61_90: float = 0
    bucket_90_plus: float = 0


class ApSummaryResponse(BaseModel):
    outstanding_payables: float = 0
    payments_due_today: float = 0
    payments_due_today_count: int = 0
    overdue_bills: int = 0
    overdue_amount: float = 0
    current_month_payments: float = 0
    vendor_count: int = 0
    payment_efficiency: float = 0
    cash_requirement: float = 0
    aging: list[ApAgingBucket] = Field(default_factory=list)
    open_invoice_count: int = 0
    payment_count: int = 0


class ApAgingReportResponse(BaseModel):
    as_of: date
    buckets: list[ApAgingBucket] = Field(default_factory=list)
    items: list[VendorLedgerResponse] = Field(default_factory=list)
    vendor_summary: list[ApVendorAgingSummary] = Field(default_factory=list)
    total_outstanding: float = 0


class ApPaymentCreateRequest(BaseModel):
    branch_id: UUID
    vendor_id: UUID
    document_date: date
    amount: float
    currency_code: str = "INR"
    company_id: UUID | None = None
    exchange_rate: float = 1.0
    allocate_to_invoice_id: UUID | None = None
    notes: str | None = None
    payment_advice: str | None = None


class ApAllocationLine(BaseModel):
    invoice_id: UUID
    amount: float


class ApAllocateRequest(BaseModel):
    payment_id: UUID
    allocations: list[ApAllocationLine]


class ApVendorLedgerLine(BaseModel):
    id: UUID
    document_number: str
    document_date: date
    due_date: date | None = None
    document_type: str
    debit_amount: float
    credit_amount: float
    balance_amount: float
    status: str
    running_balance: float
    currency_code: str = "INR"


class ApVendorLedgerResponse(BaseModel):
    vendor_id: UUID
    vendor_code: str | None = None
    vendor_name: str | None = None
    opening_balance: float = 0
    closing_balance: float = 0
    invoice_total: float = 0
    payment_total: float = 0
    adjustment_total: float = 0
    lines: list[ApVendorLedgerLine] = Field(default_factory=list)


class PaymentRequest(BaseModel):
    amount: float
    receipt_id: UUID | None = None
    payment_id: UUID | None = None


class CurrencyRateCreateRequest(BaseModel):
    currency_id: UUID
    currency_code: str
    base_currency_code: str
    exchange_rate: float
    rate_type: str = "manual"
    effective_from: date
    effective_to: date | None = None
    status: str = "active"
    company_id: UUID | None = None


class CurrencyRateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    currency_code: str
    base_currency_code: str
    exchange_rate: float
    effective_from: date
    effective_to: date | None
    status: str


class AssetTransactionCreateRequest(BaseModel):
    branch_id: UUID
    asset_id: UUID
    transaction_date: date
    transaction_type: str
    amount: float
    period_id: UUID
    currency_code: str = "INR"
    description: str | None = None
    company_id: UUID | None = None


class AssetTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    transaction_number: str
    asset_id: UUID
    transaction_type: str
    amount: float
    status: str


class TaxRegisterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    register_number: str
    register_date: date
    tax_type: str
    transaction_type: str
    taxable_amount: float
    tax_amount: float
    currency_code: str | None = None
    source_module: str | None = None
    status: str


class TrialBalanceLineResponse(BaseModel):
    account_id: UUID
    account_code: str
    account_name: str
    debit_total: float
    credit_total: float
    balance: float
    opening: float = 0
    closing: float = 0
    account_type: str | None = None


class TrialBalanceReportResponse(BaseModel):
    lines: list[TrialBalanceLineResponse] = Field(default_factory=list)
    total_opening: float = 0
    total_debit: float = 0
    total_credit: float = 0
    total_closing: float = 0
    difference: float = 0
    period_id: UUID | None = None
    fiscal_year_id: UUID | None = None
    from_date: date | None = None
    to_date: date | None = None


class StatementLineResponse(BaseModel):
    account_id: UUID | None = None
    account_code: str | None = None
    account_name: str
    account_type: str | None = None
    amount: float = 0
    previous_amount: float = 0
    variance: float = 0
    section: str | None = None
    is_total: bool = False
    level: int = 0


class BalanceSheetReportResponse(BaseModel):
    assets: list[StatementLineResponse] = Field(default_factory=list)
    liabilities: list[StatementLineResponse] = Field(default_factory=list)
    equity: list[StatementLineResponse] = Field(default_factory=list)
    total_assets: float = 0
    total_liabilities: float = 0
    total_equity: float = 0
    previous_total_assets: float = 0
    previous_total_liabilities: float = 0
    previous_total_equity: float = 0
    as_of: date | None = None
    previous_as_of: date | None = None


class ProfitLossReportResponse(BaseModel):
    revenue: list[StatementLineResponse] = Field(default_factory=list)
    cogs: list[StatementLineResponse] = Field(default_factory=list)
    operating_expenses: list[StatementLineResponse] = Field(default_factory=list)
    total_revenue: float = 0
    total_cogs: float = 0
    gross_profit: float = 0
    total_operating_expenses: float = 0
    operating_income: float = 0
    net_profit: float = 0
    previous_total_revenue: float = 0
    previous_gross_profit: float = 0
    previous_operating_income: float = 0
    previous_net_profit: float = 0
    from_date: date | None = None
    to_date: date | None = None


class CashFlowSectionLine(BaseModel):
    label: str
    amount: float = 0


class CashFlowReportResponse(BaseModel):
    operating: list[CashFlowSectionLine] = Field(default_factory=list)
    investing: list[CashFlowSectionLine] = Field(default_factory=list)
    financing: list[CashFlowSectionLine] = Field(default_factory=list)
    net_operating: float = 0
    net_investing: float = 0
    net_financing: float = 0
    net_change: float = 0
    opening_cash: float = 0
    closing_cash: float = 0
    from_date: date | None = None
    to_date: date | None = None


class JournalRegisterLineResponse(BaseModel):
    id: UUID
    journal_number: str
    journal_date: date | None = None
    journal_type: str | None = None
    reference: str | None = None
    description: str | None = None
    status: str
    workflow_status: str | None = None
    total_debit: float = 0
    total_credit: float = 0
    currency_code: str | None = None
    period_id: UUID | None = None
    fiscal_year_id: UUID | None = None
    created_by: UUID | None = None


class JournalRegisterReportResponse(BaseModel):
    items: list[JournalRegisterLineResponse] = Field(default_factory=list)
    total: int = 0
    total_debit: float = 0
    total_credit: float = 0


class GlReportLineResponse(BaseModel):
    id: UUID
    entry_number: str
    entry_date: date
    account_id: UUID
    account_code: str
    account_name: str | None = None
    journal_number: str | None = None
    journal_header_id: UUID | None = None
    description: str | None = None
    debit_amount: float = 0
    credit_amount: float = 0
    cost_center_id: UUID | None = None
    currency_code: str | None = None
    journal_status: str | None = None


class GlReportResponse(BaseModel):
    items: list[GlReportLineResponse] = Field(default_factory=list)
    total: int = 0
    total_debit: float = 0
    total_credit: float = 0


class TaxSummaryLineResponse(BaseModel):
    tax_type: str
    transaction_type: str
    taxable_amount: float = 0
    tax_amount: float = 0
    count: int = 0


class TaxSummaryReportResponse(BaseModel):
    lines: list[TaxSummaryLineResponse] = Field(default_factory=list)
    total_taxable: float = 0
    total_tax: float = 0


class CostCenterSummaryLineResponse(BaseModel):
    cost_center_id: UUID | None = None
    cost_center_name: str | None = None
    debit_total: float = 0
    credit_total: float = 0
    net: float = 0
    entry_count: int = 0


class CostCenterSummaryReportResponse(BaseModel):
    lines: list[CostCenterSummaryLineResponse] = Field(default_factory=list)
    total_debit: float = 0
    total_credit: float = 0


class ReportCatalogItem(BaseModel):
    key: str
    title: str
    description: str
    href: str
    category: str


class WorkflowActionRequest(BaseModel):
    comments: str | None = None
