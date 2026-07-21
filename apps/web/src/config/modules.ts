/**
 * Frontend module registry mirrored from apps/api/src/shared/router.py
 * and each module's routers. Every entry maps to a real API prefix.
 */

export type ModuleResource = {
  key: string;
  title: string;
  description: string;
  /** Absolute path under /api/v1 (e.g. /customers or /finance/journals) */
  apiPath: string;
  listable?: boolean;
};

export type ErpModule = {
  key: string;
  title: string;
  description: string;
  href: string;
  group: "platform" | "foundation" | "organization" | "master-data" | "operations";
  icon:
    | "dashboard"
    | "shield"
    | "building"
    | "boxes"
    | "wallet"
    | "cart"
    | "truck"
    | "package"
    | "factory"
    | "quality"
    | "crm"
    | "hr"
    | "payroll"
    | "recruit"
    | "project"
    | "asset"
    | "service"
    | "helpdesk"
    | "document"
    | "grc"
    | "analytics"
    | "integration"
    | "ecommerce"
    | "portal";
  resources: ModuleResource[];
};

export const erpModules: ErpModule[] = [
  {
    key: "foundation",
    title: "Foundation",
    description: "Auth, tenants, RBAC, workflows, notifications, audit, and settings.",
    href: "/foundation",
    group: "foundation",
    icon: "shield",
    resources: [
      { key: "tenants", title: "Tenants", description: "Tenant registry", apiPath: "/tenants" },
      { key: "users", title: "Users", description: "User accounts and sessions", apiPath: "/users" },
      { key: "roles", title: "Roles", description: "RBAC roles", apiPath: "/roles" },
      {
        key: "permissions",
        title: "Permissions",
        description: "Permission catalog",
        apiPath: "/permissions",
      },
      {
        key: "workflows",
        title: "Workflows",
        description: "Workflow definitions and instances",
        apiPath: "/workflows/definitions",
      },
      {
        key: "workflow-instances",
        title: "Workflow Instances",
        description: "Running workflow instances",
        apiPath: "/workflows/instances",
      },
      {
        key: "notifications",
        title: "Notifications",
        description: "Templates and notification events",
        apiPath: "/notifications/templates",
      },
      { key: "audit", title: "Audit", description: "Audit logs and events", apiPath: "/audit/logs" },
      { key: "settings", title: "Settings", description: "System settings", apiPath: "/settings" },
    ],
  },
  {
    key: "organization",
    title: "Organization",
    description: "Companies, branches, departments, and org hierarchy.",
    href: "/organization",
    group: "organization",
    icon: "building",
    resources: [
      { key: "companies", title: "Companies", description: "Legal entities", apiPath: "/companies" },
      { key: "branches", title: "Branches", description: "Operating branches", apiPath: "/branches" },
      {
        key: "departments",
        title: "Departments",
        description: "Departments",
        apiPath: "/departments",
      },
      {
        key: "business-units",
        title: "Business Units",
        description: "Business units",
        apiPath: "/business-units",
      },
      { key: "locations", title: "Locations", description: "Physical locations", apiPath: "/locations" },
      {
        key: "cost-centers",
        title: "Cost Centers",
        description: "Cost centers",
        apiPath: "/cost-centers",
      },
      {
        key: "profit-centers",
        title: "Profit Centers",
        description: "Profit centers",
        apiPath: "/profit-centers",
      },
      {
        key: "tree",
        title: "Org Tree",
        description: "Organization hierarchy",
        apiPath: "/organization/tree",
        listable: true,
      },
    ],
  },
  {
    key: "master-data",
    title: "Master Data",
    description: "Shared masters used across all business modules.",
    href: "/master-data",
    group: "master-data",
    icon: "boxes",
    resources: [
      { key: "employees", title: "Employees", description: "Employee master", apiPath: "/employees" },
      { key: "customers", title: "Customers", description: "Customer master", apiPath: "/customers" },
      { key: "vendors", title: "Vendors", description: "Vendor master", apiPath: "/vendors" },
      { key: "products", title: "Products", description: "Product catalog", apiPath: "/products" },
      {
        key: "product-categories",
        title: "Product Categories",
        description: "Category tree",
        apiPath: "/product-categories",
      },
      { key: "uoms", title: "Units of Measure", description: "UOM catalog", apiPath: "/uoms" },
      { key: "currencies", title: "Currencies", description: "Currency codes", apiPath: "/currencies" },
      { key: "taxes", title: "Taxes", description: "Tax configuration", apiPath: "/taxes" },
      {
        key: "md-assets",
        title: "Asset Master",
        description: "Master-data assets",
        apiPath: "/assets",
      },
      { key: "warehouses", title: "Warehouses", description: "Warehouse master", apiPath: "/warehouses" },
    ],
  },
  {
    key: "finance",
    title: "Finance",
    description: "Double-entry GL, fiscal calendar, journals, AR/AP, tax, and reports.",
    href: "/finance",
    group: "operations",
    icon: "wallet",
    resources: [
      {
        key: "account-groups",
        title: "Account Groups",
        description: "COA group hierarchy",
        apiPath: "/finance/account-groups",
      },
      {
        key: "chart-of-accounts",
        title: "Chart of Accounts",
        description: "Assets, liabilities, equity, revenue, expenses",
        apiPath: "/finance/chart-of-accounts",
      },
      {
        key: "fiscal-years",
        title: "Fiscal Years",
        description: "Open, closed, and archived years",
        apiPath: "/finance/fiscal-years",
      },
      {
        key: "periods",
        title: "Periods",
        description: "Monthly periods and closing flags",
        apiPath: "/finance/periods",
      },
      {
        key: "journals",
        title: "Journals",
        description: "Manual, system, adjustment, and reversal entries",
        apiPath: "/finance/journals",
      },
      {
        key: "gl",
        title: "General Ledger",
        description: "Posted ledger inquiry",
        apiPath: "/finance/gl",
      },
      {
        key: "ar",
        title: "Accounts Receivable",
        description: "Customer dues and aging",
        apiPath: "/finance/ar",
      },
      {
        key: "ap",
        title: "Accounts Payable",
        description: "Vendor liabilities and aging",
        apiPath: "/finance/ap",
      },
      {
        key: "tax-register",
        title: "Tax Register",
        description: "GST/VAT/TDS register lines",
        apiPath: "/finance/tax-register",
      },
      {
        key: "currency-rates",
        title: "Currency Rates",
        description: "FX rates for multi-currency posting",
        apiPath: "/finance/currency-rates",
      },
      {
        key: "asset-transactions",
        title: "Asset Transactions",
        description: "Depreciation and asset accounting postings",
        apiPath: "/finance/asset-transactions",
      },
      {
        key: "reports",
        title: "Reports",
        description: "Trial balance and AR/AP aging",
        apiPath: "/finance/reports/trial-balance",
        listable: true,
      },
    ],
  },
  {
    key: "sales",
    title: "Sales",
    description: "Order-to-cash: pricing, quotations, orders, deliveries, invoices, returns.",
    href: "/sales",
    group: "operations",
    icon: "cart",
    resources: [
      {
        key: "price-lists",
        title: "Price Lists",
        description: "Standard and customer-specific pricing",
        apiPath: "/sales/price-lists",
      },
      {
        key: "discount-rules",
        title: "Discount Rules",
        description: "Volume, promo, and approval discounts",
        apiPath: "/sales/discount-rules",
      },
      {
        key: "customer-credit",
        title: "Customer Credit",
        description: "Credit limits, usage, and holds",
        apiPath: "/sales/customer-credit",
      },
      {
        key: "quotations",
        title: "Quotations",
        description: "Customer proposals and validity",
        apiPath: "/sales/quotations",
      },
      {
        key: "orders",
        title: "Sales Orders",
        description: "Confirmed demand and fulfillment",
        apiPath: "/sales/orders",
      },
      {
        key: "deliveries",
        title: "Deliveries",
        description: "Outbound shipments against orders",
        apiPath: "/sales/deliveries",
      },
      {
        key: "invoices",
        title: "Invoices",
        description: "Billing documents and AR posting",
        apiPath: "/sales/invoices",
      },
      {
        key: "returns",
        title: "Returns",
        description: "Sales returns and credit notes",
        apiPath: "/sales/returns",
      },
    ],
  },
  {
    key: "procurement",
    title: "Procurement",
    description: "Procure-to-pay: requisitions, RFQs, POs, GRNs, vendor invoices, contracts.",
    href: "/procurement",
    group: "operations",
    icon: "truck",
    resources: [
      {
        key: "requisitions",
        title: "Requisitions",
        description: "Internal purchase requests",
        apiPath: "/procurement/requisitions",
      },
      {
        key: "rfqs",
        title: "RFQs",
        description: "Requests for quotation",
        apiPath: "/procurement/rfqs",
      },
      {
        key: "vendor-quotations",
        title: "Vendor Quotations",
        description: "Supplier quote responses",
        apiPath: "/procurement/vendor-quotations",
      },
      {
        key: "comparisons",
        title: "Comparisons",
        description: "Vendor quote comparisons",
        apiPath: "/procurement/comparisons",
      },
      {
        key: "orders",
        title: "Purchase Orders",
        description: "Committed purchase orders",
        apiPath: "/procurement/orders",
      },
      {
        key: "grns",
        title: "GRNs",
        description: "Goods receipt notes",
        apiPath: "/procurement/grns",
      },
      {
        key: "invoices",
        title: "Vendor Invoices",
        description: "AP invoices and balances",
        apiPath: "/procurement/invoices",
      },
      {
        key: "returns",
        title: "Returns",
        description: "Purchase returns to vendors",
        apiPath: "/procurement/returns",
      },
      {
        key: "contracts",
        title: "Contracts",
        description: "Vendor contract agreements",
        apiPath: "/procurement/contracts",
      },
      {
        key: "performance",
        title: "Vendor Performance",
        description: "Supplier scorecards",
        apiPath: "/procurement/performance",
      },
    ],
  },
  {
    key: "inventory",
    title: "Inventory",
    description: "Warehouse stock, bins, batches, transfers, adjustments, and valuation.",
    href: "/inventory",
    group: "operations",
    icon: "package",
    resources: [
      {
        key: "stock",
        title: "Stock",
        description: "On-hand, reserved, and available balances",
        apiPath: "/inventory/stock",
      },
      {
        key: "bins",
        title: "Bins",
        description: "Storage bin locations",
        apiPath: "/inventory/bins",
      },
      {
        key: "batches",
        title: "Batches",
        description: "Batch and lot tracking",
        apiPath: "/inventory/batches",
      },
      {
        key: "serials",
        title: "Serials",
        description: "Serial number tracking",
        apiPath: "/inventory/serials",
      },
      {
        key: "reservations",
        title: "Reservations",
        description: "Stock reserved for demand",
        apiPath: "/inventory/reservations",
      },
      {
        key: "transfers",
        title: "Transfers",
        description: "Inter-warehouse stock moves",
        apiPath: "/inventory/transfers",
      },
      {
        key: "adjustments",
        title: "Adjustments",
        description: "Quantity corrections",
        apiPath: "/inventory/adjustments",
      },
      {
        key: "cycle-counts",
        title: "Cycle Counts",
        description: "Physical count programs",
        apiPath: "/inventory/cycle-counts",
      },
      {
        key: "policies",
        title: "Policies",
        description: "Reorder points and safety stock",
        apiPath: "/inventory/policies",
      },
      {
        key: "valuation",
        title: "Valuation",
        description: "Cost layers and valuation",
        apiPath: "/inventory/valuation/layers",
      },
      {
        key: "reports",
        title: "Reports",
        description: "Stock summary and batch expiry",
        apiPath: "/inventory/reports/stock-summary",
        listable: true,
      },
    ],
  },
  {
    key: "manufacturing",
    title: "Manufacturing",
    description:
      "Production lifecycle — BOMs, routings, work orders, material issues, FG receipts, WIP, scrap, and variances.",
    href: "/manufacturing",
    group: "operations",
    icon: "factory",
    resources: [
      {
        key: "boms",
        title: "BOMs",
        description: "Product structures and revisions",
        apiPath: "/manufacturing/boms",
      },
      {
        key: "routings",
        title: "Routings",
        description: "Operation sequences and work centers",
        apiPath: "/manufacturing/routings",
      },
      {
        key: "work-centers",
        title: "Work Centers",
        description: "Capacity and shop-floor centers",
        apiPath: "/manufacturing/work-centers",
      },
      {
        key: "machines",
        title: "Machines",
        description: "Machine status and utilization",
        apiPath: "/manufacturing/machines",
      },
      {
        key: "production-orders",
        title: "Production Orders",
        description: "Work orders and planned quantities",
        apiPath: "/manufacturing/production-orders",
      },
      {
        key: "material-issues",
        title: "Material Issues",
        description: "Issue components to the floor",
        apiPath: "/manufacturing/material-issues",
      },
      {
        key: "material-returns",
        title: "Material Returns",
        description: "Return unused components",
        apiPath: "/manufacturing/material-returns",
      },
      {
        key: "production-receipts",
        title: "Production Receipts",
        description: "Finished goods into inventory",
        apiPath: "/manufacturing/production-receipts",
      },
      {
        key: "scrap",
        title: "Scrap",
        description: "Process and material scrap",
        apiPath: "/manufacturing/scrap",
      },
      {
        key: "wip",
        title: "WIP",
        description: "Work-in-progress cost balances",
        apiPath: "/manufacturing/wip",
      },
      {
        key: "variances",
        title: "Variances",
        description: "Standard vs actual production variances",
        apiPath: "/manufacturing/variances",
      },
    ],
  },
  {
    key: "quality",
    title: "Quality",
    description:
      "Quality lifecycle — inspection plans, IQC/IPQC/FQC, defects, NCRs, CAPA, supplier scores, complaints, and audits.",
    href: "/quality",
    group: "operations",
    icon: "quality",
    resources: [
      {
        key: "plans",
        title: "Inspection Plans",
        description: "Inspection plan masters",
        apiPath: "/quality/plans",
      },
      {
        key: "sampling-plans",
        title: "Sampling Plans",
        description: "AQL and sampling rules",
        apiPath: "/quality/sampling-plans",
      },
      {
        key: "characteristics",
        title: "Characteristics",
        description: "Measurable quality traits",
        apiPath: "/quality/characteristics",
      },
      {
        key: "defect-types",
        title: "Defect Types",
        description: "Defect catalog and severity",
        apiPath: "/quality/defect-types",
      },
      {
        key: "incoming-inspections",
        title: "Incoming Inspections",
        description: "Incoming quality control",
        apiPath: "/quality/incoming-inspections",
      },
      {
        key: "inprocess-inspections",
        title: "In-Process Inspections",
        description: "In-process quality control",
        apiPath: "/quality/inprocess-inspections",
      },
      {
        key: "final-inspections",
        title: "Final Inspections",
        description: "Final quality control",
        apiPath: "/quality/final-inspections",
      },
      {
        key: "defects",
        title: "Defects",
        description: "Logged defect records",
        apiPath: "/quality/defects",
      },
      {
        key: "ncrs",
        title: "NCRs",
        description: "Non-conformance reports",
        apiPath: "/quality/ncrs",
      },
      {
        key: "capas",
        title: "CAPAs",
        description: "Corrective and preventive actions",
        apiPath: "/quality/capas",
      },
      {
        key: "supplier-quality",
        title: "Supplier Quality",
        description: "Supplier quality scores",
        apiPath: "/quality/supplier-quality",
      },
      {
        key: "complaints",
        title: "Complaints",
        description: "Customer quality complaints",
        apiPath: "/quality/complaints",
      },
      {
        key: "audits",
        title: "Audits",
        description: "Internal and supplier audits",
        apiPath: "/quality/audits",
      },
      {
        key: "scores",
        title: "Scores",
        description: "Published quality scores",
        apiPath: "/quality/scores",
      },
    ],
  },
  {
    key: "crm",
    title: "CRM",
    description:
      "Lead-to-deal workspace — leads, opportunities, campaigns, tasks, meetings, and customer feedback.",
    href: "/crm",
    group: "operations",
    icon: "crm",
    resources: [
      {
        key: "my-jobs",
        title: "My Jobs",
        description: "Team approval inbox — approve or reject with remarks",
        apiPath: "/crm/my-jobs",
      },
      {
        key: "companies",
        title: "Company",
        description: "Sales accounts — the only entry point for creating leads",
        apiPath: "/crm/companies",
      },
      {
        key: "opportunities",
        title: "Opportunities",
        description: "Deals converted from leads — BOQ to Won/Lost blueprint",
        apiPath: "/crm/opportunities",
      },
      {
        key: "quotes",
        title: "Quotes",
        description: "Customer quotations with margin-gated approvals",
        apiPath: "/crm/quotes",
      },
      {
        key: "ovf",
        title: "OVF",
        description: "Order Value Forms — approval, SCM share, and deal-won",
        apiPath: "/crm/ovf",
      },
      {
        key: "contacts",
        title: "Contacts",
        description: "Company contact persons",
        apiPath: "/crm/contacts",
      },
      {
        key: "products",
        title: "Products",
        description: "Product / SKU catalog for quote and OVF lines",
        apiPath: "/crm/products",
      },
      {
        key: "calls",
        title: "Calls",
        description: "Call logging (coming soon)",
        apiPath: "/crm/call-logs",
      },
      {
        key: "kyc",
        title: "KYC",
        description: "Customer KYC verification (coming soon)",
        apiPath: "/crm/kyc",
      },
      {
        key: "lead-sources",
        title: "Lead Sources",
        description: "Lead origin catalog",
        apiPath: "/crm/lead-sources",
      },
      {
        key: "leads",
        title: "Leads",
        description: "Sales leads and prospects",
        apiPath: "/crm/leads",
      },
      {
        key: "lead-assignments",
        title: "Lead Assignments",
        description: "Lead ownership history",
        apiPath: "/crm/lead-assignments",
      },
      {
        key: "lead-activities",
        title: "Lead Activities",
        description: "Calls, notes, and lead tasks",
        apiPath: "/crm/lead-activities",
      },
      {
        key: "pipelines",
        title: "Pipelines",
        description: "Sales pipeline definitions",
        apiPath: "/crm/pipelines",
      },
      {
        key: "opportunities",
        title: "Opportunities",
        description: "Deals and expected revenue",
        apiPath: "/crm/opportunities",
      },
      {
        key: "opportunity-stages",
        title: "Opportunity Stages",
        description: "Pipeline stage history",
        apiPath: "/crm/opportunity-stages",
      },
      {
        key: "campaigns",
        title: "Campaigns",
        description: "Marketing campaigns",
        apiPath: "/crm/campaigns",
      },
      {
        key: "interactions",
        title: "Interactions",
        description: "Customer interactions",
        apiPath: "/crm/interactions",
      },
      {
        key: "tasks",
        title: "Tasks",
        description: "CRM sales tasks",
        apiPath: "/crm/tasks",
      },
      {
        key: "followups",
        title: "Follow-ups",
        description: "Scheduled follow-ups",
        apiPath: "/crm/followups",
      },
      {
        key: "meetings",
        title: "Meetings",
        description: "Meeting schedule",
        apiPath: "/crm/meetings",
      },
      {
        key: "call-logs",
        title: "Call Logs",
        description: "Call activity log",
        apiPath: "/crm/call-logs",
      },
      {
        key: "email-logs",
        title: "Email Logs",
        description: "Email activity log",
        apiPath: "/crm/email-logs",
      },
      {
        key: "visit-logs",
        title: "Visit Logs",
        description: "Field visit log",
        apiPath: "/crm/visit-logs",
      },
      {
        key: "customer-feedback",
        title: "Customer Feedback",
        description: "Customer feedback records",
        apiPath: "/crm/customer-feedback",
      },
      {
        key: "customer-satisfaction",
        title: "Customer Satisfaction",
        description: "CSAT score records",
        apiPath: "/crm/customer-satisfaction",
      },
    ],
  },
  {
    key: "hr",
    title: "HRMS",
    description:
      "Workforce lifecycle — profiles, employment, attendance, leave, performance, training, and separation.",
    href: "/hr",
    group: "operations",
    icon: "hr",
    resources: [
      {
        key: "designations",
        title: "Designations",
        description: "Job designation masters",
        apiPath: "/hr/designations",
      },
      {
        key: "employee-profiles",
        title: "Employee Profiles",
        description: "Employee master profiles",
        apiPath: "/hr/employee-profiles",
      },
      {
        key: "employment",
        title: "Employment",
        description: "Employment contracts and status",
        apiPath: "/hr/employment",
      },
      {
        key: "shifts",
        title: "Shifts",
        description: "Shift definitions",
        apiPath: "/hr/shifts",
      },
      {
        key: "shift-assignments",
        title: "Shift Assignments",
        description: "Employee shift roster",
        apiPath: "/hr/shift-assignments",
      },
      {
        key: "holiday-calendars",
        title: "Holiday Calendars",
        description: "Company holiday calendars",
        apiPath: "/hr/holiday-calendars",
      },
      {
        key: "leave-types",
        title: "Leave Types",
        description: "Leave type catalog",
        apiPath: "/hr/leave-types",
      },
      {
        key: "leave-balances",
        title: "Leave Balances",
        description: "Employee leave balances",
        apiPath: "/hr/leave-balances",
      },
      {
        key: "leave-requests",
        title: "Leave Requests",
        description: "Leave applications and approvals",
        apiPath: "/hr/leave-requests",
      },
      {
        key: "attendance",
        title: "Attendance",
        description: "Daily attendance records",
        apiPath: "/hr/attendance",
      },
      {
        key: "employee-documents",
        title: "Employee Documents",
        description: "HR document vault",
        apiPath: "/hr/employee-documents",
      },
      {
        key: "performance-reviews",
        title: "Performance Reviews",
        description: "Review cycles and ratings",
        apiPath: "/hr/performance-reviews",
      },
      {
        key: "goals",
        title: "Goals",
        description: "Employee goals and OKRs",
        apiPath: "/hr/goals",
      },
      {
        key: "appraisals",
        title: "Appraisals",
        description: "Appraisal scorecards",
        apiPath: "/hr/appraisals",
      },
      {
        key: "training",
        title: "Training",
        description: "Training programs",
        apiPath: "/hr/training",
      },
      {
        key: "separation",
        title: "Separation",
        description: "Resignation and exit process",
        apiPath: "/hr/separation",
      },
    ],
  },
  {
    key: "payroll",
    title: "Payroll",
    description:
      "Compensation lifecycle — periods, salary structures, payroll runs, payslips, bonuses, loans, and statutory.",
    href: "/payroll",
    group: "operations",
    icon: "payroll",
    resources: [
      {
        key: "payroll-periods",
        title: "Payroll Periods",
        description: "Pay cycle periods",
        apiPath: "/payroll/payroll-periods",
      },
      {
        key: "salary-structures",
        title: "Salary Structures",
        description: "Compensation structure templates",
        apiPath: "/payroll/salary-structures",
      },
      {
        key: "salary-components",
        title: "Salary Components",
        description: "Earnings and deduction components",
        apiPath: "/payroll/salary-components",
      },
      {
        key: "employee-salaries",
        title: "Employee Salaries",
        description: "Employee salary assignments",
        apiPath: "/payroll/employee-salaries",
      },
      {
        key: "earning-types",
        title: "Earning Types",
        description: "Earning type catalog",
        apiPath: "/payroll/earning-types",
      },
      {
        key: "deduction-types",
        title: "Deduction Types",
        description: "Deduction type catalog",
        apiPath: "/payroll/deduction-types",
      },
      {
        key: "tax-configurations",
        title: "Tax Configurations",
        description: "Payroll tax rules",
        apiPath: "/payroll/tax-configurations",
      },
      {
        key: "statutory-contributions",
        title: "Statutory Contributions",
        description: "PF, ESI, and statutory",
        apiPath: "/payroll/statutory-contributions",
      },
      {
        key: "payroll-runs",
        title: "Payroll Runs",
        description: "Payroll calculation runs",
        apiPath: "/payroll/payroll-runs",
      },
      {
        key: "payslips",
        title: "Payslips",
        description: "Generated employee payslips",
        apiPath: "/payroll/payslips",
      },
      {
        key: "bonuses",
        title: "Bonuses",
        description: "Bonus and incentive payments",
        apiPath: "/payroll/bonuses",
      },
      {
        key: "reimbursements",
        title: "Reimbursements",
        description: "Expense reimbursements",
        apiPath: "/payroll/reimbursements",
      },
      {
        key: "loans",
        title: "Loans",
        description: "Employee loans and advances",
        apiPath: "/payroll/loans",
      },
      {
        key: "payroll-adjustments",
        title: "Adjustments",
        description: "Payroll adjustments",
        apiPath: "/payroll/payroll-adjustments",
      },
      {
        key: "payroll-summaries",
        title: "Summaries",
        description: "Period payroll summaries",
        apiPath: "/payroll/payroll-summaries",
      },
    ],
  },
  {
    key: "recruitment",
    title: "Recruitment",
    description:
      "Hire-to-onboard ATS — requisitions, postings, candidates, applications, interviews, offers, BGV, and onboarding.",
    href: "/recruitment",
    group: "operations",
    icon: "recruit",
    resources: [
      {
        key: "job-requisitions",
        title: "Job Requisitions",
        description: "Approved openings and hiring demand",
        apiPath: "/recruitment/job-requisitions",
      },
      {
        key: "job-postings",
        title: "Job Postings",
        description: "Published channels for requisitions",
        apiPath: "/recruitment/job-postings",
      },
      {
        key: "recruitment-sources",
        title: "Sources",
        description: "Attribution channels and agencies",
        apiPath: "/recruitment/recruitment-sources",
      },
      {
        key: "recruiters",
        title: "Recruiters",
        description: "Recruiter directory and capacity",
        apiPath: "/recruitment/recruiters",
      },
      {
        key: "candidates",
        title: "Candidates",
        description: "Pre-employee talent master",
        apiPath: "/recruitment/candidates",
      },
      {
        key: "applications",
        title: "Applications",
        description: "Candidate ↔ posting pipeline",
        apiPath: "/recruitment/applications",
      },
      {
        key: "application-stages",
        title: "Application Stages",
        description: "Stage history and SLA trail",
        apiPath: "/recruitment/application-stages",
      },
      {
        key: "interviews",
        title: "Interviews",
        description: "Schedules, panels, and results",
        apiPath: "/recruitment/interviews",
      },
      {
        key: "interview-feedback",
        title: "Interview Feedback",
        description: "Scores and recommendations",
        apiPath: "/recruitment/interview-feedback",
      },
      {
        key: "offers",
        title: "Offers",
        description: "Compensation offers and validity",
        apiPath: "/recruitment/offers",
      },
      {
        key: "background-verifications",
        title: "Background Checks",
        description: "BGV clearance workflow",
        apiPath: "/recruitment/background-verifications",
      },
      {
        key: "talent-pools",
        title: "Talent Pools",
        description: "Passive / future-hire pools",
        apiPath: "/recruitment/talent-pools",
      },
      {
        key: "onboarding",
        title: "Onboarding",
        description: "Pre-employee handoff to HR",
        apiPath: "/recruitment/onboarding",
      },
      {
        key: "onboarding-tasks",
        title: "Onboarding Tasks",
        description: "Task checklist per hire",
        apiPath: "/recruitment/onboarding-tasks",
      },
    ],
  },
  {
    key: "projects",
    title: "Projects",
    description:
      "PMO delivery — portfolio, WBS, tasks, timesheets, resources, budgets, costs, issues, risks, and change control.",
    href: "/projects",
    group: "operations",
    icon: "project",
    resources: [
      {
        key: "projects",
        title: "Projects",
        description: "Portfolio / project register",
        apiPath: "/projects/projects",
      },
      {
        key: "project-phases",
        title: "Phases",
        description: "WBS phase structure",
        apiPath: "/projects/project-phases",
      },
      {
        key: "project-milestones",
        title: "Milestones",
        description: "Delivery checkpoints",
        apiPath: "/projects/project-milestones",
      },
      {
        key: "project-tasks",
        title: "Tasks",
        description: "Work breakdown tasks",
        apiPath: "/projects/project-tasks",
      },
      {
        key: "timesheets",
        title: "Timesheets",
        description: "Time capture headers",
        apiPath: "/projects/timesheets",
      },
      {
        key: "timesheet-entries",
        title: "Timesheet Entries",
        description: "Daily hour lines",
        apiPath: "/projects/timesheet-entries",
      },
      {
        key: "resource-plans",
        title: "Resource Plans",
        description: "Capacity planning",
        apiPath: "/projects/resource-plans",
      },
      {
        key: "resource-allocations",
        title: "Resource Allocations",
        description: "Named allocations",
        apiPath: "/projects/resource-allocations",
      },
      {
        key: "project-budgets",
        title: "Budgets",
        description: "Budget lines by type",
        apiPath: "/projects/project-budgets",
      },
      {
        key: "project-costs",
        title: "Costs",
        description: "Actual cost postings",
        apiPath: "/projects/project-costs",
      },
      {
        key: "project-issues",
        title: "Issues",
        description: "Issue register",
        apiPath: "/projects/project-issues",
      },
      {
        key: "project-risks",
        title: "Risks",
        description: "Risk register",
        apiPath: "/projects/project-risks",
      },
      {
        key: "change-requests",
        title: "Change Requests",
        description: "Scope / change board",
        apiPath: "/projects/change-requests",
      },
      {
        key: "project-documents",
        title: "Documents",
        description: "Project document library",
        apiPath: "/projects/project-documents",
      },
    ],
  },
  {
    key: "assets",
    title: "Assets",
    description:
      "Fixed-asset lifecycle — register, custody, warranty, maintenance, depreciation, disposal, and audits.",
    href: "/assets",
    group: "operations",
    icon: "asset",
    resources: [
      {
        key: "asset-categories",
        title: "Categories",
        description: "Asset category taxonomy",
        apiPath: "/assets/asset-categories",
      },
      {
        key: "assets",
        title: "Assets",
        description: "Operational asset register",
        apiPath: "/assets/assets",
      },
      {
        key: "asset-components",
        title: "Components",
        description: "Sub-assemblies and parts",
        apiPath: "/assets/asset-components",
      },
      {
        key: "asset-assignments",
        title: "Assignments",
        description: "Custodian assignments",
        apiPath: "/assets/asset-assignments",
      },
      {
        key: "asset-transfers",
        title: "Transfers",
        description: "Location / branch moves",
        apiPath: "/assets/asset-transfers",
      },
      {
        key: "asset-locations",
        title: "Locations",
        description: "Location history trail",
        apiPath: "/assets/asset-locations",
      },
      {
        key: "asset-warranties",
        title: "Warranties",
        description: "Warranty coverage",
        apiPath: "/assets/asset-warranties",
      },
      {
        key: "asset-insurances",
        title: "Insurance",
        description: "Insurance policies",
        apiPath: "/assets/asset-insurances",
      },
      {
        key: "maintenance-plans",
        title: "Maintenance Plans",
        description: "Preventive schedules",
        apiPath: "/assets/maintenance-plans",
      },
      {
        key: "asset-maintenances",
        title: "Maintenance",
        description: "Maintenance work orders",
        apiPath: "/assets/asset-maintenances",
      },
      {
        key: "asset-depreciations",
        title: "Depreciation",
        description: "Depreciation runs",
        apiPath: "/assets/asset-depreciations",
      },
      {
        key: "asset-disposals",
        title: "Disposals",
        description: "Disposal & write-off",
        apiPath: "/assets/asset-disposals",
      },
      {
        key: "asset-audits",
        title: "Audits",
        description: "Physical verification",
        apiPath: "/assets/asset-audits",
      },
      {
        key: "meter-readings",
        title: "Meter Readings",
        description: "Usage meters",
        apiPath: "/assets/meter-readings",
      },
    ],
  },
  {
    key: "service",
    title: "Service",
    description:
      "Field service — requests, tickets, dispatch, work orders, visits, SLA, escalations, and contracts.",
    href: "/service",
    group: "operations",
    icon: "service",
    resources: [
      {
        key: "service-categories",
        title: "Categories",
        description: "Service category catalog",
        apiPath: "/service/service-categories",
      },
      {
        key: "service-requests",
        title: "Requests",
        description: "Customer service requests",
        apiPath: "/service/service-requests",
      },
      {
        key: "service-tickets",
        title: "Tickets",
        description: "Operational ticket queue",
        apiPath: "/service/service-tickets",
      },
      {
        key: "service-assignments",
        title: "Assignments",
        description: "Technician dispatch",
        apiPath: "/service/service-assignments",
      },
      {
        key: "service-schedules",
        title: "Schedules",
        description: "Visit / WO schedules",
        apiPath: "/service/service-schedules",
      },
      {
        key: "work-orders",
        title: "Work Orders",
        description: "Field work orders",
        apiPath: "/service/work-orders",
      },
      {
        key: "service-tasks",
        title: "Tasks",
        description: "WO task checklist",
        apiPath: "/service/service-tasks",
      },
      {
        key: "service-visits",
        title: "Visits",
        description: "On-site field visits",
        apiPath: "/service/service-visits",
      },
      {
        key: "service-materials",
        title: "Materials",
        description: "Parts & materials used",
        apiPath: "/service/service-materials",
      },
      {
        key: "time-entries",
        title: "Time Entries",
        description: "Labor time capture",
        apiPath: "/service/time-entries",
      },
      {
        key: "service-slas",
        title: "SLAs",
        description: "SLA policy definitions",
        apiPath: "/service/service-slas",
      },
      {
        key: "service-escalations",
        title: "Escalations",
        description: "SLA breach escalations",
        apiPath: "/service/service-escalations",
      },
      {
        key: "service-contracts",
        title: "Contracts",
        description: "AMC / service contracts",
        apiPath: "/service/service-contracts",
      },
      {
        key: "service-feedback",
        title: "Feedback",
        description: "Customer CSAT feedback",
        apiPath: "/service/service-feedback",
      },
    ],
  },
  {
    key: "helpdesk",
    title: "Helpdesk",
    description:
      "Customer support — tickets, assignments, SLA, escalations, knowledge base, resolutions, and feedback.",
    href: "/helpdesk",
    group: "operations",
    icon: "helpdesk",
    resources: [
      {
        key: "ticket-categories",
        title: "Categories",
        description: "Ticket category catalog",
        apiPath: "/helpdesk/ticket-categories",
      },
      {
        key: "ticket-priorities",
        title: "Priorities",
        description: "Priority definitions",
        apiPath: "/helpdesk/ticket-priorities",
      },
      {
        key: "tickets",
        title: "Tickets",
        description: "Support ticket queue",
        apiPath: "/helpdesk/tickets",
      },
      {
        key: "ticket-assignments",
        title: "Assignments",
        description: "Agent assignments",
        apiPath: "/helpdesk/ticket-assignments",
      },
      {
        key: "ticket-comments",
        title: "Comments",
        description: "Ticket collaboration",
        apiPath: "/helpdesk/ticket-comments",
      },
      {
        key: "ticket-slas",
        title: "SLAs",
        description: "Ticket SLA policies",
        apiPath: "/helpdesk/ticket-slas",
      },
      {
        key: "ticket-escalations",
        title: "Escalations",
        description: "SLA breach escalations",
        apiPath: "/helpdesk/ticket-escalations",
      },
      {
        key: "knowledge-bases",
        title: "Knowledge Bases",
        description: "KB spaces",
        apiPath: "/helpdesk/knowledge-bases",
      },
      {
        key: "knowledge-articles",
        title: "Articles",
        description: "Self-service articles",
        apiPath: "/helpdesk/knowledge-articles",
      },
      {
        key: "resolutions",
        title: "Resolutions",
        description: "Closure resolutions",
        apiPath: "/helpdesk/resolutions",
      },
      {
        key: "support-teams",
        title: "Support Teams",
        description: "Agent teams",
        apiPath: "/helpdesk/support-teams",
      },
      {
        key: "support-shifts",
        title: "Shifts",
        description: "Support shifts",
        apiPath: "/helpdesk/support-shifts",
      },
      {
        key: "support-schedules",
        title: "Schedules",
        description: "Coverage schedules",
        apiPath: "/helpdesk/support-schedules",
      },
      {
        key: "customer-feedback",
        title: "Feedback",
        description: "CSAT / customer feedback",
        apiPath: "/helpdesk/customer-feedback",
      },
    ],
  },
  {
    key: "documents",
    title: "Documents",
    description:
      "DMS — folders, library, versions, tags, permissions, shares, approvals, workflows, templates, retention, and archives.",
    href: "/documents",
    group: "operations",
    icon: "document",
    resources: [
      {
        key: "folders",
        title: "Folders",
        description: "Folder tree / catalog",
        apiPath: "/documents/folders",
      },
      {
        key: "documents",
        title: "Documents",
        description: "Central document library",
        apiPath: "/documents/documents",
      },
      {
        key: "document-versions",
        title: "Versions",
        description: "Version control / check-in",
        apiPath: "/documents/document-versions",
      },
      {
        key: "document-tags",
        title: "Tags",
        description: "Classification tags",
        apiPath: "/documents/document-tags",
      },
      {
        key: "document-permissions",
        title: "Permissions",
        description: "Document ACL",
        apiPath: "/documents/document-permissions",
      },
      {
        key: "document-shares",
        title: "Shares",
        description: "Secure sharing links",
        apiPath: "/documents/document-shares",
      },
      {
        key: "document-approvals",
        title: "Approvals",
        description: "Publish approvals",
        apiPath: "/documents/document-approvals",
      },
      {
        key: "document-workflows",
        title: "Workflows",
        description: "Doc approval workflows",
        apiPath: "/documents/document-workflows",
      },
      {
        key: "templates",
        title: "Templates",
        description: "Authoring templates",
        apiPath: "/documents/templates",
      },
      {
        key: "retention-policies",
        title: "Retention Policies",
        description: "Retention & disposal rules",
        apiPath: "/documents/retention-policies",
      },
      {
        key: "archives",
        title: "Archives",
        description: "Archived records vault",
        apiPath: "/documents/archives",
      },
    ],
  },
  {
    key: "grc",
    title: "GRC",
    description:
      "Governance, risk & compliance — policies, controls, risk register, assessments, frameworks, audits, CAPA, exceptions, and incidents.",
    href: "/grc",
    group: "operations",
    icon: "grc",
    resources: [
      {
        key: "policies",
        title: "Policies",
        description: "Policy catalog",
        apiPath: "/grc/policies",
      },
      {
        key: "policy-versions",
        title: "Policy Versions",
        description: "Policy version history",
        apiPath: "/grc/policy-versions",
      },
      {
        key: "controls",
        title: "Controls",
        description: "Internal controls",
        apiPath: "/grc/controls",
      },
      {
        key: "control-tests",
        title: "Control Tests",
        description: "Control test results",
        apiPath: "/grc/control-tests",
      },
      {
        key: "risk-categories",
        title: "Risk Categories",
        description: "Risk taxonomy",
        apiPath: "/grc/risk-categories",
      },
      {
        key: "risk-registers",
        title: "Risk Register",
        description: "Enterprise risks",
        apiPath: "/grc/risk-registers",
      },
      {
        key: "risk-assessments",
        title: "Risk Assessments",
        description: "Impact × probability",
        apiPath: "/grc/risk-assessments",
      },
      {
        key: "risk-treatments",
        title: "Risk Treatments",
        description: "Treatment strategies",
        apiPath: "/grc/risk-treatments",
      },
      {
        key: "compliance-frameworks",
        title: "Compliance Frameworks",
        description: "Standards & frameworks",
        apiPath: "/grc/compliance-frameworks",
      },
      {
        key: "compliance-assessments",
        title: "Compliance Assessments",
        description: "Compliance evaluations",
        apiPath: "/grc/compliance-assessments",
      },
      {
        key: "audit-plans",
        title: "Audit Plans",
        description: "Annual audit plans",
        apiPath: "/grc/audit-plans",
      },
      {
        key: "audits",
        title: "Audits",
        description: "Audit engagements",
        apiPath: "/grc/audits",
      },
      {
        key: "audit-findings",
        title: "Findings",
        description: "Audit findings",
        apiPath: "/grc/audit-findings",
      },
      {
        key: "corrective-actions",
        title: "Corrective Actions",
        description: "CAPA remediation",
        apiPath: "/grc/corrective-actions",
      },
      {
        key: "exceptions",
        title: "Exceptions",
        description: "Policy exceptions",
        apiPath: "/grc/exceptions",
      },
      {
        key: "incidents",
        title: "Incidents",
        description: "GRC incidents",
        apiPath: "/grc/incidents",
      },
    ],
  },
  {
    key: "analytics",
    title: "Analytics",
    description:
      "BI — dashboards, widgets, reports, schedules, datasets, metrics, KPIs, dimensions, alerts, subscriptions, exports, and imports.",
    href: "/analytics",
    group: "operations",
    icon: "analytics",
    resources: [
      {
        key: "dashboards",
        title: "Dashboards",
        description: "Executive & operational dashboards",
        apiPath: "/analytics/dashboards",
      },
      {
        key: "dashboard-widgets",
        title: "Widgets",
        description: "Dashboard widgets / tiles",
        apiPath: "/analytics/dashboard-widgets",
      },
      {
        key: "reports",
        title: "Reports",
        description: "Operational & management reports",
        apiPath: "/analytics/reports",
      },
      {
        key: "report-schedules",
        title: "Report Schedules",
        description: "Scheduled report delivery",
        apiPath: "/analytics/report-schedules",
      },
      {
        key: "datasets",
        title: "Datasets",
        description: "Analytical datasets",
        apiPath: "/analytics/datasets",
      },
      {
        key: "metrics",
        title: "Metrics",
        description: "Metric definitions",
        apiPath: "/analytics/metrics",
      },
      {
        key: "kpis",
        title: "KPIs",
        description: "KPI engine definitions",
        apiPath: "/analytics/kpis",
      },
      {
        key: "dimensions",
        title: "Dimensions",
        description: "Dataset dimensions",
        apiPath: "/analytics/dimensions",
      },
      {
        key: "alert-rules",
        title: "Alert Rules",
        description: "Threshold alert rules",
        apiPath: "/analytics/alert-rules",
      },
      {
        key: "subscriptions",
        title: "Subscriptions",
        description: "Dashboard / report subscriptions",
        apiPath: "/analytics/subscriptions",
      },
      {
        key: "data-exports",
        title: "Data Exports",
        description: "Export jobs",
        apiPath: "/analytics/data-exports",
      },
      {
        key: "data-imports",
        title: "Data Imports",
        description: "Import jobs",
        apiPath: "/analytics/data-imports",
      },
    ],
  },
  {
    key: "integration",
    title: "Integration",
    description:
      "Integration hub — external systems, connectors, credentials, OAuth, webhooks, events, queues, sync, mappings, and rate limits.",
    href: "/integration",
    group: "operations",
    icon: "integration",
    resources: [
      {
        key: "external-systems",
        title: "External Systems",
        description: "Connected external systems",
        apiPath: "/integration/external-systems",
      },
      {
        key: "connectors",
        title: "Connectors",
        description: "Protocol adapters",
        apiPath: "/integration/connectors",
      },
      {
        key: "api-credentials",
        title: "API Credentials",
        description: "Vault-backed credentials",
        apiPath: "/integration/api-credentials",
      },
      {
        key: "oauth-clients",
        title: "OAuth Clients",
        description: "OAuth client registrations",
        apiPath: "/integration/oauth-clients",
      },
      {
        key: "webhooks",
        title: "Webhooks",
        description: "Inbound / outbound webhooks",
        apiPath: "/integration/webhooks",
      },
      {
        key: "event-definitions",
        title: "Event Definitions",
        description: "Event bus catalog",
        apiPath: "/integration/event-definitions",
      },
      {
        key: "message-queues",
        title: "Message Queues",
        description: "Message queue definitions",
        apiPath: "/integration/message-queues",
      },
      {
        key: "retry-queues",
        title: "Retry Queues",
        description: "Retry backlog",
        apiPath: "/integration/retry-queues",
      },
      {
        key: "dead-letters",
        title: "Dead Letters",
        description: "Dead-letter queue",
        apiPath: "/integration/dead-letters",
      },
      {
        key: "data-mappings",
        title: "Data Mappings",
        description: "Field mapping rules",
        apiPath: "/integration/data-mappings",
      },
      {
        key: "sync-jobs",
        title: "Sync Jobs",
        description: "Push / pull sync runs",
        apiPath: "/integration/sync-jobs",
      },
      {
        key: "sync-logs",
        title: "Sync Logs",
        description: "Sync execution logs",
        apiPath: "/integration/sync-logs",
      },
      {
        key: "rate-limits",
        title: "Rate Limits",
        description: "API rate limit policies",
        apiPath: "/integration/rate-limits",
      },
    ],
  },
  {
    key: "ecommerce",
    title: "Ecommerce",
    description:
      "Omnichannel commerce — stores, channels, listings, carts, orders, payments, shipments, returns, coupons, promotions, and marketplace connectors.",
    href: "/ecommerce",
    group: "operations",
    icon: "ecommerce",
    resources: [
      {
        key: "stores",
        title: "Stores",
        description: "Online storefronts",
        apiPath: "/ecommerce/stores",
      },
      {
        key: "sales-channels",
        title: "Sales Channels",
        description: "Website / marketplace channels",
        apiPath: "/ecommerce/sales-channels",
      },
      {
        key: "product-listings",
        title: "Product Listings",
        description: "Channel catalog listings",
        apiPath: "/ecommerce/product-listings",
      },
      {
        key: "customer-carts",
        title: "Carts",
        description: "Customer shopping carts",
        apiPath: "/ecommerce/customer-carts",
      },
      {
        key: "orders",
        title: "Orders",
        description: "Channel orders",
        apiPath: "/ecommerce/orders",
      },
      {
        key: "payments",
        title: "Payments",
        description: "Gateway payments",
        apiPath: "/ecommerce/payments",
      },
      {
        key: "shipments",
        title: "Shipments",
        description: "Fulfillment shipments",
        apiPath: "/ecommerce/shipments",
      },
      {
        key: "return-requests",
        title: "Return Requests",
        description: "Customer returns",
        apiPath: "/ecommerce/return-requests",
      },
      {
        key: "coupons",
        title: "Coupons",
        description: "Discount coupons",
        apiPath: "/ecommerce/coupons",
      },
      {
        key: "promotions",
        title: "Promotions",
        description: "Promotional campaigns",
        apiPath: "/ecommerce/promotions",
      },
      {
        key: "marketplace-connectors",
        title: "Marketplace Connectors",
        description: "Marketplace bindings",
        apiPath: "/ecommerce/marketplace-connectors",
      },
    ],
  },
  {
    key: "portal",
    title: "Portal",
    description:
      "Customer self-service portal — accounts, sessions, projected order/invoice views, tickets, and preferences (ERD_23).",
    href: "/portal",
    group: "operations",
    icon: "portal",
    resources: [
      {
        key: "portal-accounts",
        title: "Portal Accounts",
        description: "External login accounts linked to master customers",
        apiPath: "/portal/portal-accounts",
      },
      {
        key: "customer-profiles",
        title: "Customer Profiles",
        description: "Self-service profile shells (language, timezone)",
        apiPath: "/portal/customer-profiles",
      },
      {
        key: "portal-sessions",
        title: "Sessions",
        description: "Authenticated portal sessions",
        apiPath: "/portal/portal-sessions",
      },
      {
        key: "dashboards",
        title: "Dashboards",
        description: "Portal home dashboards and layouts",
        apiPath: "/portal/dashboards",
      },
      {
        key: "notifications",
        title: "Notifications",
        description: "In-portal notification inbox",
        apiPath: "/portal/notifications",
      },
      {
        key: "message-threads",
        title: "Messages",
        description: "Support message threads",
        apiPath: "/portal/message-threads",
      },
      {
        key: "order-views",
        title: "Order Views",
        description: "Projected sales order views (consume-only)",
        apiPath: "/portal/order-views",
      },
      {
        key: "invoice-views",
        title: "Invoice Views",
        description: "Projected finance invoice views (consume-only)",
        apiPath: "/portal/invoice-views",
      },
      {
        key: "document-access",
        title: "Document Access",
        description: "Document access grants for portal users",
        apiPath: "/portal/document-accesses",
      },
      {
        key: "support-tickets",
        title: "Support Tickets",
        description: "Portal ticket envelopes mapped to Helpdesk",
        apiPath: "/portal/support-tickets",
      },
      {
        key: "service-requests",
        title: "Service Requests",
        description: "Portal service request envelopes",
        apiPath: "/portal/service-requests",
      },
      {
        key: "preferences",
        title: "Preferences",
        description: "Per-account notification and UI preferences",
        apiPath: "/portal/preferences",
      },
      {
        key: "login-audits",
        title: "Login Audits",
        description: "Portal login success/failure audit trail",
        apiPath: "/portal/login-audits",
      },
    ],
  },
];

export function getModule(key: string): ErpModule | undefined {
  return erpModules.find((m) => m.key === key);
}

export function getResource(moduleKey: string, resourceKey: string): ModuleResource | undefined {
  return getModule(moduleKey)?.resources.find((r) => r.key === resourceKey);
}

export function getModulesByGroup(group: ErpModule["group"]): ErpModule[] {
  return erpModules.filter((m) => m.group === group);
}
