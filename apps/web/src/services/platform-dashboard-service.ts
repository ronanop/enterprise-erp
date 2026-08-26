import { erpModules } from "@/config/modules";
import { canAccessHref } from "@/lib/module-access";
import { loadAnalyticsOverview } from "@/services/analytics-service";
import { loadAssetsOverview } from "@/services/assets-service";
import {
  asStatus as crmAsStatus,
  countOpenDocs as crmCountOpenDocs,
  loadCrmOverview,
  sumField as crmSumField,
} from "@/services/crm-service";
import { loadDocumentsOverview } from "@/services/documents-service";
import { loadEmailOverview } from "@/services/email-notification-service";
import { loadEcommerceOverview } from "@/services/ecommerce-service";
import {
  countByStatus as financeCountByStatus,
  loadFinanceOverview,
  openPeriodCount,
  sumBalances,
} from "@/services/finance-service";
import { loadGrcOverviewApi } from "@/services/grc-service";
import {
  countOpenDocs as helpdeskCountOpenDocs,
  loadHelpdeskOverview,
} from "@/services/helpdesk-service";
import { loadHrOverview } from "@/services/hr-service";
import { loadIntegrationOverview } from "@/services/integration-service";
import { loadInventoryOverview } from "@/services/inventory-service";
import { loadManufacturingOverview } from "@/services/manufacturing-service";
import { loadMarketingOverview } from "@/services/marketing-service";
import { loadPayrollOverview } from "@/services/payroll-service";
import { loadPortalOverview } from "@/services/portal-service";
import {
  asStatus as procAsStatus,
  loadProcurementOverview,
} from "@/services/procurement-service";
import { loadProjectsOverview } from "@/services/projects-service";
import { loadQualityOverview } from "@/services/quality-service";
import { loadRecruitmentOverview } from "@/services/recruitment-service";
import { listOvfs, listQuotes } from "@/services/sales-crm-service";
import { loadSalesOverview } from "@/services/sales-service";
import { loadServiceOverview } from "@/services/service-mgmt-service";
import { buildProcurementPipelineMetrics } from "@/utils/procurement-pipeline-metrics";

export type PlatformKpi = {
  label: string;
  value: string;
  hint?: string;
};

export type ModuleAnalytics = {
  key: string;
  title: string;
  href: string;
  status: "ok" | "partial" | "error";
  recordCount: number;
  kpis: PlatformKpi[];
  errors: string[];
};

export type ConnectedPipelineStage = {
  stage: string;
  count: number;
  module: string;
  href: string;
};

export type OpsBacklogItem = {
  name: string;
  count: number;
  module: string;
  href: string;
};

export type PlatformDashboardData = {
  loadedAt: string;
  executive: PlatformKpi[];
  opsBacklog: OpsBacklogItem[];
  moduleHealth: { name: string; value: number }[];
  modules: ModuleAnalytics[];
  connectedPipeline: ConnectedPipelineStage[];
  moduleActivity: { name: string; count: number; href: string }[];
  partial: boolean;
  authBlocked: boolean;
  statusCodes: number[];
};

type ModuleLoaderResult = {
  key: string;
  title: string;
  href: string;
  analytics: Omit<ModuleAnalytics, "key" | "title" | "href">;
  pipeline?: Partial<Record<string, number>>;
  executive?: Partial<Record<string, number | string>>;
};

function formatCount(value: number): string {
  return value.toLocaleString("en-IN");
}

function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function moduleMeta(key: string) {
  const mod = erpModules.find((row) => row.key === key);
  return {
    title: mod?.title ?? key,
    href: mod?.href ?? `/${key}`,
  };
}

function resultFromOverview(
  key: string,
  overview: {
    errors?: string[];
    statusCodes?: number[];
    partial?: boolean;
  },
  recordCount: number,
  kpis: PlatformKpi[],
  extras?: {
    pipeline?: Partial<Record<string, number>>;
    executive?: Partial<Record<string, number | string>>;
  },
): ModuleLoaderResult {
  const meta = moduleMeta(key);
  const errors = overview.errors ?? [];
  const statusCodes = overview.statusCodes ?? [];
  return {
    key,
    ...meta,
    analytics: {
      status: errors.length ? (overview.partial ? "partial" : "error") : "ok",
      recordCount,
      kpis,
      errors,
    },
    pipeline: extras?.pipeline,
    executive: extras?.executive,
    ...(statusCodes.length ? { statusCodes } : {}),
  };
}

async function loadCrmAnalytics(): Promise<ModuleLoaderResult> {
  const overview = await loadCrmOverview();
  const openOpps = overview.opportunities.filter(
    (row) => crmAsStatus(row.status) === "open" || !row.status,
  );
  let quotesCount = 0;
  let ovfCount = 0;
  try {
    const [quotes, ovfs] = await Promise.all([listQuotes(), listOvfs()]);
    quotesCount = quotes.length;
    ovfCount = ovfs.length;
  } catch {
    // CRM sales endpoints may be restricted independently.
  }
  const recordCount =
    overview.leads.length +
    overview.opportunities.length +
    overview.tasks.length +
    quotesCount +
    ovfCount;
  return resultFromOverview(
    "crm",
    overview,
    recordCount,
    [
      { label: "Open leads", value: formatCount(crmCountOpenDocs(overview.leads, ["converted", "lost", "unqualified"])) },
      { label: "Open opportunities", value: formatCount(openOpps.length) },
      { label: "Pipeline value", value: formatInr(crmSumField(openOpps, "expected_revenue")) },
      { label: "Quotes", value: formatCount(quotesCount) },
      { label: "OVFs", value: formatCount(ovfCount) },
    ],
    {
      pipeline: {
        leads: overview.leads.length,
        opportunities: overview.opportunities.length,
        quotes: quotesCount,
        ovf: ovfCount,
      },
      executive: {
        pipelineValue: crmSumField(openOpps, "expected_revenue"),
        openOpportunities: openOpps.length,
      },
    },
  );
}

async function loadFinanceAnalytics(): Promise<ModuleLoaderResult> {
  const overview = await loadFinanceOverview();
  const arOutstanding = sumBalances(overview.ar);
  const apOutstanding = sumBalances(overview.ap);
  const recordCount =
    overview.journals.length +
    overview.ar.length +
    overview.ap.length +
    overview.accounts.length;
  return resultFromOverview(
    "finance",
    overview,
    recordCount,
    [
      {
        label: "Open journals",
        value: formatCount(
          financeCountByStatus(overview.journals, ["draft", "pending", "in_review", "submitted"]),
        ),
      },
      {
        label: "Posted journals",
        value: formatCount(financeCountByStatus(overview.journals, ["posted", "approved"])),
      },
      { label: "AR outstanding", value: formatInr(arOutstanding) },
      { label: "AP outstanding", value: formatInr(apOutstanding) },
      { label: "Open periods", value: formatCount(openPeriodCount(overview.periods)) },
    ],
    {
      executive: { arOutstanding, apOutstanding },
    },
  );
}

async function loadProcurementAnalytics(): Promise<ModuleLoaderResult> {
  const overview = await loadProcurementOverview();
  const pipeline = buildProcurementPipelineMetrics(overview);
  const openPos = overview.orders.filter((row) => {
    const status = procAsStatus(row.status);
    return status !== "draft" && status !== "submitted" && status !== "cancelled";
  }).length;
  const recordCount =
    overview.scmQueue.length +
    overview.orders.length +
    overview.grns.length +
    overview.invoices.length;
  return resultFromOverview(
    "procurement",
    overview,
    recordCount,
    [
      { label: "SCM queue", value: formatCount(pipeline.scm) },
      { label: "Issued POs", value: formatCount(openPos) },
      { label: "GRN docs", value: formatCount(pipeline.grns) },
      { label: "Receipt %", value: `${pipeline.receiptPct}%` },
      { label: "Delivery challans", value: formatCount(pipeline["delivery-challan"]) },
    ],
    {
      pipeline: {
        scmQueue: pipeline.scm,
        purchaseOrders: openPos,
        grns: pipeline.grns,
      },
      executive: { openPos, scmQueue: pipeline.scm },
    },
  );
}

async function loadHrAnalytics(): Promise<ModuleLoaderResult> {
  const overview = await loadHrOverview();
  const activeProfiles = overview.profiles.filter((row) => {
    const status = String(row.status ?? row.employment_status ?? "").toLowerCase();
    return !status || !["terminated", "inactive", "separated"].includes(status);
  });
  const pendingLeave = overview.leaveRequests.filter((row) =>
    ["pending", "submitted", "in_review"].includes(String(row.status ?? "").toLowerCase()),
  );
  const recordCount =
    overview.profiles.length +
    overview.leaveRequests.length +
    overview.attendance.length;
  return resultFromOverview(
    "hr",
    overview,
    recordCount,
    [
      { label: "Profiles", value: formatCount(overview.profiles.length) },
      { label: "Active employees", value: formatCount(activeProfiles.length) },
      { label: "Pending leave", value: formatCount(pendingLeave.length) },
      { label: "Open goals", value: formatCount(overview.goals.length) },
      { label: "Training programs", value: formatCount(overview.training.length) },
    ],
    { executive: { headcount: activeProfiles.length } },
  );
}

async function loadHelpdeskAnalytics(): Promise<ModuleLoaderResult> {
  const overview = await loadHelpdeskOverview();
  const openTickets = helpdeskCountOpenDocs(overview.tickets, [
    "resolved",
    "closed",
    "cancelled",
  ]);
  const recordCount = overview.tickets.length + overview.articles.length;
  return resultFromOverview(
    "helpdesk",
    overview,
    recordCount,
    [
      { label: "Open tickets", value: formatCount(openTickets) },
      { label: "Total tickets", value: formatCount(overview.tickets.length) },
      { label: "KB articles", value: formatCount(overview.articles.length) },
      { label: "Teams", value: formatCount(overview.teams.length) },
      { label: "SLA policies", value: formatCount(overview.slas.length) },
    ],
    { executive: { openTickets } },
  );
}

async function loadGenericOverviewAnalytics(
  key: string,
  load: () => Promise<{ errors?: string[]; statusCodes?: number[]; partial?: boolean } & Record<string, unknown>>,
  countFields: string[],
  kpis: (overview: Record<string, unknown>) => PlatformKpi[],
): Promise<ModuleLoaderResult> {
  const overview = await load();
  const recordCount = countFields.reduce(
    (sum, field) => sum + (Array.isArray(overview[field]) ? overview[field].length : 0),
    0,
  );
  return resultFromOverview(key, overview, recordCount, kpis(overview));
}

const MODULE_LOADERS: Record<string, () => Promise<ModuleLoaderResult>> = {
  crm: loadCrmAnalytics,
  finance: loadFinanceAnalytics,
  procurement: loadProcurementAnalytics,
  hr: loadHrAnalytics,
  helpdesk: loadHelpdeskAnalytics,
  payroll: () =>
    loadGenericOverviewAnalytics(
      "payroll",
      loadPayrollOverview,
      ["runs", "components", "structures", "payslips"],
      (overview) => [
        { label: "Payroll runs", value: formatCount((overview.runs as unknown[]).length) },
        { label: "Payslips", value: formatCount((overview.payslips as unknown[]).length) },
        { label: "Components", value: formatCount((overview.components as unknown[]).length) },
      ],
    ),
  recruitment: () =>
    loadGenericOverviewAnalytics(
      "recruitment",
      loadRecruitmentOverview,
      ["postings", "candidates", "applications", "offers"],
      (overview) => [
        { label: "Job postings", value: formatCount((overview.postings as unknown[]).length) },
        { label: "Candidates", value: formatCount((overview.candidates as unknown[]).length) },
        { label: "Applications", value: formatCount((overview.applications as unknown[]).length) },
        { label: "Offers", value: formatCount((overview.offers as unknown[]).length) },
      ],
    ),
  inventory: () =>
    loadGenericOverviewAnalytics(
      "inventory",
      loadInventoryOverview,
      ["stock", "bins", "transfers", "adjustments"],
      (overview) => [
        { label: "Stock rows", value: formatCount((overview.stock as unknown[]).length) },
        { label: "Bins", value: formatCount((overview.bins as unknown[]).length) },
        { label: "Transfers", value: formatCount((overview.transfers as unknown[]).length) },
        { label: "Adjustments", value: formatCount((overview.adjustments as unknown[]).length) },
      ],
    ),
  manufacturing: () =>
    loadGenericOverviewAnalytics(
      "manufacturing",
      loadManufacturingOverview,
      ["orders", "boms", "workCenters", "issues"],
      (overview) => [
        { label: "Production orders", value: formatCount((overview.orders as unknown[]).length) },
        { label: "BOMs", value: formatCount((overview.boms as unknown[]).length) },
        { label: "Work centers", value: formatCount((overview.workCenters as unknown[]).length) },
      ],
    ),
  projects: async () => {
    const overview = await loadProjectsOverview();
    const projectCount = overview.projects.length;
    const taskCount = overview.tasks.length;
    const issueCount = overview.issues.length;
    const riskCount = overview.risks.length;
    return resultFromOverview(
      "projects",
      overview,
      projectCount + taskCount + issueCount + riskCount,
      [
        { label: "Projects", value: formatCount(projectCount) },
        { label: "Tasks", value: formatCount(taskCount) },
        { label: "Issues", value: formatCount(issueCount) },
        { label: "Risks", value: formatCount(riskCount) },
      ],
      {
        pipeline: {
          projects: projectCount,
          tasks: taskCount,
          issues: issueCount,
        },
        executive: { activeProjects: projectCount },
      },
    );
  },
  assets: () =>
    loadGenericOverviewAnalytics(
      "assets",
      loadAssetsOverview,
      ["assets", "maintenances", "depreciations", "disposals"],
      (overview) => [
        { label: "Assets", value: formatCount((overview.assets as unknown[]).length) },
        { label: "Maintenance", value: formatCount((overview.maintenances as unknown[]).length) },
        { label: "Depreciation", value: formatCount((overview.depreciations as unknown[]).length) },
      ],
    ),
  quality: () =>
    loadGenericOverviewAnalytics(
      "quality",
      loadQualityOverview,
      ["plans", "incoming", "ncrs", "capas"],
      (overview) => [
        { label: "Inspection plans", value: formatCount((overview.plans as unknown[]).length) },
        { label: "Incoming inspections", value: formatCount((overview.incoming as unknown[]).length) },
        { label: "NCRs", value: formatCount((overview.ncrs as unknown[]).length) },
        { label: "CAPAs", value: formatCount((overview.capas as unknown[]).length) },
      ],
    ),
  marketing: async () => {
    try {
      const overview = await loadMarketingOverview();
      return {
        key: "marketing",
        ...moduleMeta("marketing"),
        analytics: {
          status: "ok",
          recordCount:
            overview.campaigns_total +
            overview.content_requests_total +
            overview.research_reports,
          kpis: [
            { label: "Active campaigns", value: formatCount(overview.campaigns_active) },
            { label: "Content drafts", value: formatCount(overview.content_drafts) },
            { label: "Publish pending", value: formatCount(overview.publish_pending) },
            { label: "Upcoming calendar", value: formatCount(overview.calendar_upcoming) },
          ],
          errors: [],
        },
      };
    } catch (err) {
      return {
        key: "marketing",
        ...moduleMeta("marketing"),
        analytics: {
          status: "error",
          recordCount: 0,
          kpis: [],
          errors: [err instanceof Error ? err.message : "Failed to load marketing analytics"],
        },
      };
    }
  },
  grc: async () => {
    try {
      const overview = await loadGrcOverviewApi();
      const kpis = overview.kpis;
      return {
        key: "grc",
        ...moduleMeta("grc"),
        analytics: {
          status: "ok",
          recordCount:
            kpis.total_risks +
            kpis.total_controls +
            kpis.total_audits +
            kpis.total_policies,
          kpis: [
            { label: "Open risks", value: formatCount(kpis.open_risks) },
            { label: "Active controls", value: formatCount(kpis.active_controls) },
            { label: "Planned audits", value: formatCount(kpis.planned_audits) },
            { label: "Open CAPAs", value: formatCount(kpis.open_capas) },
          ],
          errors: [],
        },
      };
    } catch (err) {
      return {
        key: "grc",
        ...moduleMeta("grc"),
        analytics: {
          status: "error",
          recordCount: 0,
          kpis: [],
          errors: [err instanceof Error ? err.message : "Failed to load GRC overview"],
        },
      };
    }
  },
  documents: () =>
    loadGenericOverviewAnalytics(
      "documents",
      loadDocumentsOverview,
      ["documents", "templates", "workflows", "attachments"],
      (overview) => [
        { label: "Documents", value: formatCount((overview.documents as unknown[]).length) },
        { label: "Templates", value: formatCount((overview.templates as unknown[]).length) },
        { label: "Workflows", value: formatCount((overview.workflows as unknown[]).length) },
      ],
    ),
  analytics: () =>
    loadGenericOverviewAnalytics(
      "analytics",
      loadAnalyticsOverview,
      ["dashboards", "reports", "kpis", "metrics"],
      (overview) => [
        { label: "Dashboards", value: formatCount((overview.dashboards as unknown[]).length) },
        { label: "Reports", value: formatCount((overview.reports as unknown[]).length) },
        { label: "KPIs", value: formatCount((overview.kpis as unknown[]).length) },
        { label: "Metrics", value: formatCount((overview.metrics as unknown[]).length) },
      ],
    ),
  service: () =>
    loadGenericOverviewAnalytics(
      "service",
      loadServiceOverview,
      ["contracts", "workOrders", "assignments", "slas"],
      (overview) => [
        { label: "Contracts", value: formatCount((overview.contracts as unknown[]).length) },
        { label: "Work orders", value: formatCount((overview.workOrders as unknown[]).length) },
        { label: "Assignments", value: formatCount((overview.assignments as unknown[]).length) },
      ],
    ),
  sales: () =>
    loadGenericOverviewAnalytics(
      "sales",
      loadSalesOverview,
      ["orders", "deliveries", "invoices", "returns"],
      (overview) => [
        { label: "Sales orders", value: formatCount((overview.orders as unknown[]).length) },
        { label: "Deliveries", value: formatCount((overview.deliveries as unknown[]).length) },
        { label: "Invoices", value: formatCount((overview.invoices as unknown[]).length) },
      ],
    ),
  ecommerce: () =>
    loadGenericOverviewAnalytics(
      "ecommerce",
      loadEcommerceOverview,
      ["orders", "listings", "stores", "channels"],
      (overview) => [
        { label: "Orders", value: formatCount((overview.orders as unknown[]).length) },
        { label: "Listings", value: formatCount((overview.listings as unknown[]).length) },
        { label: "Stores", value: formatCount((overview.stores as unknown[]).length) },
      ],
    ),
  portal: () =>
    loadGenericOverviewAnalytics(
      "portal",
      loadPortalOverview,
      ["accounts", "dashboards", "notifications", "tickets"],
      (overview) => [
        { label: "Portal accounts", value: formatCount((overview.accounts as unknown[]).length) },
        { label: "Dashboards", value: formatCount((overview.dashboards as unknown[]).length) },
      ],
    ),
  integration: () =>
    loadGenericOverviewAnalytics(
      "integration",
      loadIntegrationOverview,
      ["connectors", "syncJobs", "mappings", "events"],
      (overview) => [
        { label: "Connectors", value: formatCount((overview.connectors as unknown[]).length) },
        { label: "Sync jobs", value: formatCount((overview.syncJobs as unknown[]).length) },
        { label: "Mappings", value: formatCount((overview.mappings as unknown[]).length) },
      ],
    ),
  email: async () => {
    try {
      const overview = await loadEmailOverview();
      if (!overview) {
        throw new Error("Email overview returned no data");
      }
      return {
        key: "email",
        ...moduleMeta("email"),
        analytics: {
          status: "ok",
          recordCount: overview.counts.events + overview.counts.deliveries,
          kpis: [
            { label: "Email events", value: formatCount(overview.counts.events) },
            { label: "Deliveries", value: formatCount(overview.counts.deliveries) },
            {
              label: "Provider",
              value: overview.provider.configured ? "Configured" : "Not configured",
            },
          ],
          errors: [],
        },
      };
    } catch (err) {
      return {
        key: "email",
        ...moduleMeta("email"),
        analytics: {
          status: "error",
          recordCount: 0,
          kpis: [],
          errors: [err instanceof Error ? err.message : "Failed to load email overview"],
        },
      };
    }
  },
};

function buildConnectedPipeline(results: ModuleLoaderResult[]): ConnectedPipelineStage[] {
  const crm = results.find((row) => row.key === "crm")?.pipeline ?? {};
  const proc = results.find((row) => row.key === "procurement")?.pipeline ?? {};
  const prj = results.find((row) => row.key === "projects")?.pipeline ?? {};
  return [
    { stage: "Leads", count: crm.leads ?? 0, module: "CRM", href: "/crm/leads" },
    { stage: "Opportunities", count: crm.opportunities ?? 0, module: "CRM", href: "/crm/opportunities" },
    { stage: "Quotes", count: crm.quotes ?? 0, module: "CRM", href: "/crm/quotes" },
    { stage: "OVF", count: crm.ovf ?? 0, module: "CRM", href: "/crm/ovf" },
    { stage: "SCM queue", count: proc.scmQueue ?? 0, module: "Procurement", href: "/procurement/scm" },
    { stage: "Purchase orders", count: proc.purchaseOrders ?? 0, module: "Procurement", href: "/procurement/orders" },
    { stage: "GRNs", count: proc.grns ?? 0, module: "Procurement", href: "/procurement/grns" },
    { stage: "Projects", count: prj.projects ?? 0, module: "Projects", href: "/projects/projects" },
    { stage: "Tasks", count: prj.tasks ?? 0, module: "Projects", href: "/projects/project-tasks" },
    { stage: "Issues", count: prj.issues ?? 0, module: "Projects", href: "/projects/project-issues" },
  ];
}

function buildExecutive(results: ModuleLoaderResult[]): PlatformKpi[] {
  const exec: Record<string, number | string> = {};
  for (const row of results) {
    if (row.executive) Object.assign(exec, row.executive);
  }
  return [
    {
      label: "Pipeline value",
      value: formatInr(Number(exec.pipelineValue ?? 0)),
      hint: "Open CRM opportunities",
    },
    {
      label: "AR outstanding",
      value: formatInr(Number(exec.arOutstanding ?? 0)),
      hint: "Finance receivables",
    },
    {
      label: "AP outstanding",
      value: formatInr(Number(exec.apOutstanding ?? 0)),
      hint: "Finance payables",
    },
    {
      label: "Open POs",
      value: formatCount(Number(exec.openPos ?? 0)),
      hint: "Issued procurement orders",
    },
    {
      label: "Open tickets",
      value: formatCount(Number(exec.openTickets ?? 0)),
      hint: "Helpdesk backlog",
    },
    {
      label: "Headcount",
      value: formatCount(Number(exec.headcount ?? 0)),
      hint: "Active employee profiles",
    },
  ];
}

export async function loadPlatformDashboard(
  moduleKeys: string[],
  userType?: string,
): Promise<PlatformDashboardData> {
  const accessibleKeys = Object.keys(MODULE_LOADERS).filter((key) =>
    canAccessHref(moduleMeta(key).href, moduleKeys, userType),
  );

  const settled = await Promise.allSettled(
    accessibleKeys.map((key) => MODULE_LOADERS[key]()),
  );

  const results: ModuleLoaderResult[] = settled
    .filter((row): row is PromiseFulfilledResult<ModuleLoaderResult> => row.status === "fulfilled")
    .map((row) => row.value);

  const statusCodes: number[] = [];
  let partial = false;

  for (const row of results) {
    if (row.analytics.status !== "ok") partial = true;
    if ("statusCodes" in row && Array.isArray(row.statusCodes)) {
      statusCodes.push(...row.statusCodes);
    }
  }

  const modules: ModuleAnalytics[] = results
    .map((row) => ({
      key: row.key,
      title: row.title,
      href: row.href,
      ...row.analytics,
    }))
    .sort((a, b) => b.recordCount - a.recordCount);

  const moduleActivity = modules
    .filter((row) => row.recordCount > 0)
    .slice(0, 10)
    .map((row) => ({
      name: row.title,
      count: row.recordCount,
      href: row.href,
    }));

  return {
    loadedAt: new Date().toISOString(),
    executive: buildExecutive(results),
    opsBacklog: buildOpsBacklog(results),
    moduleHealth: [
      { name: "Live", value: modules.filter((row) => row.status === "ok").length },
      { name: "Partial", value: modules.filter((row) => row.status === "partial").length },
      { name: "Offline", value: modules.filter((row) => row.status === "error").length },
    ].filter((row) => row.value > 0),
    modules,
    connectedPipeline: buildConnectedPipeline(results),
    moduleActivity,
    partial,
    authBlocked: statusCodes.includes(401),
    statusCodes,
  };
}

function buildOpsBacklog(results: ModuleLoaderResult[]): OpsBacklogItem[] {
  const crm = results.find((row) => row.key === "crm")?.pipeline ?? {};
  const proc = results.find((row) => row.key === "procurement")?.pipeline ?? {};
  const prj = results.find((row) => row.key === "projects")?.pipeline ?? {};
  const exec: Record<string, number | string> = {};
  for (const row of results) {
    if (row.executive) Object.assign(exec, row.executive);
  }
  return [
    {
      name: "Open opportunities",
      count: Number(exec.openOpportunities ?? crm.opportunities ?? 0),
      module: "CRM",
      href: "/crm/opportunities",
    },
    {
      name: "SCM queue",
      count: Number(proc.scmQueue ?? 0),
      module: "Procurement",
      href: "/procurement/scm",
    },
    {
      name: "Open POs",
      count: Number(exec.openPos ?? 0),
      module: "Procurement",
      href: "/procurement/orders",
    },
    {
      name: "Open tickets",
      count: Number(exec.openTickets ?? 0),
      module: "Helpdesk",
      href: "/helpdesk",
    },
    {
      name: "Active projects",
      count: Number(prj.projects ?? exec.activeProjects ?? 0),
      module: "Projects",
      href: "/projects/projects",
    },
    {
      name: "Project issues",
      count: Number(prj.issues ?? 0),
      module: "Projects",
      href: "/projects/project-issues",
    },
  ];
}
