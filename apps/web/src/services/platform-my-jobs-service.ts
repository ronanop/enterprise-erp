/** Cross-module My Jobs aggregation for the platform Overview page. */

import { ApiClientError } from "@/services/api-client";
import { inboxItemHref, loadHrEssInbox } from "@/services/hr-ess-inbox-service";
import {
  listProjectMyJobs,
  type ProjectMyJob,
} from "@/services/projects-portal-service";
import {
  getProcApprovalCapabilities,
  listMyInvoiceGenerationTasks,
  listScmChargeApprovals,
  listScmFinalizeApprovals,
  listScmHoldApprovals,
  type ProcInvoiceGenerationTask,
  type ScmChargeApproval,
  type ScmFinalizeApproval,
  type ScmHoldApproval,
} from "@/services/procurement-service";
import {
  listMyJobs,
  myJobEntityHref,
  type ApprovalTask,
} from "@/services/sales-crm-service";

export type PlatformMyJobOpenMode = "link" | "invoice_generation_dialog";

/** In-page action capability for the platform My Jobs table. */
export type PlatformMyJobActionKind =
  | "crm_approve"
  | "crm_complex"
  | "proc_accept_po"
  | "proc_issue_po"
  | "proc_hold"
  | "proc_freight"
  | "proc_invoice"
  | "link";

export type PlatformMyJobRow = {
  id: string;
  title: string;
  reference: string;
  detail: string;
  status: string;
  href: string;
  /** When set, Open uses an in-page dialog instead of navigating. */
  openMode?: PlatformMyJobOpenMode;
  invoiceTaskId?: string;
  orderId?: string;
  ovfId?: string;
  receiptBatchId?: string;
  /** Show Download PO for finalize / invoice jobs. */
  showPoDownload?: boolean;
  /** Download quote print PDF (CRM quote approvals). */
  showQuoteDownload?: boolean;
  quoteId?: string;
  actionKind?: PlatformMyJobActionKind;
  /** CRM approval task id (without crm- prefix). */
  crmTaskId?: string;
  crmAction?: string | null;
  approveLabel?: string;
};

export type PlatformMyJobModuleSection = {
  moduleKey: string;
  moduleTitle: string;
  moduleHref: string;
  jobs: PlatformMyJobRow[];
  error?: string;
};

const MODULE_ORDER = ["crm", "projects", "hr", "procurement"] as const;

const MODULE_META: Record<
  (typeof MODULE_ORDER)[number],
  { title: string; href: string }
> = {
  crm: { title: "CRM", href: "/crm/my-jobs" },
  projects: { title: "Projects", href: "/projects/my-jobs" },
  hr: { title: "HR", href: "/hr/ess-inbox" },
  procurement: { title: "Procurement", href: "/procurement/my-jobs" },
};

const CRM_COMPLEX_ACTIONS = new Set([
  "provide_freight",
  "provide_supporting_items",
  "price_supporting_items",
  "provide_service_visits",
  "provide_boq_attachment",
  "provide_sow_attachment",
]);

function crmApproveLabel(action: string | null | undefined): string {
  if (action === "provide_freight") return "Submit freight";
  if (action === "provide_supporting_items") return "Submit items";
  if (action === "price_supporting_items") return "Submit prices";
  if (action === "provide_service_visits") return "Submit plan";
  if (action === "provide_boq_attachment" || action === "provide_sow_attachment") {
    return "Submit file";
  }
  return "Approve";
}

function crmRows(tasks: ApprovalTask[]): PlatformMyJobRow[] {
  return tasks.map((task) => {
    const action = task.action || null;
    const complex = Boolean(action && CRM_COMPLEX_ACTIONS.has(action));
    const base = myJobEntityHref(task.entity_type, task.entity_id);
    const href =
      base === "/crm/my-jobs"
        ? base
        : `${base}${base.includes("?") ? "&" : "?"}from=my-jobs`;
    return {
      id: `crm-${task.id}`,
      title: task.title || task.task_code,
      reference: task.task_code,
      detail: [task.entity_type, task.team_role].filter(Boolean).join(" · ") || "Approval",
      status: task.status,
      href: complex ? "/crm/my-jobs" : href,
      actionKind: complex ? ("crm_complex" as const) : ("crm_approve" as const),
      crmTaskId: task.id,
      crmAction: action,
      approveLabel: crmApproveLabel(action),
      showQuoteDownload: task.entity_type === "quote",
      quoteId: task.entity_type === "quote" ? task.entity_id : undefined,
    };
  });
}

function projectRows(jobs: ProjectMyJob[]): PlatformMyJobRow[] {
  return jobs.map((job) => ({
    id: `prj-${job.site_installation_id}-${job.assigned_stage}`,
    title: job.stage_label || job.assigned_stage,
    reference: job.document_number || job.project_name,
    detail: [job.project_name, job.site_name].filter(Boolean).join(" · "),
    status: job.work_status || "open",
    href: job.form_path?.startsWith("/")
      ? job.form_path
      : `/projects/projects/${job.project_id}`,
  }));
}

function invoiceGenerationRows(tasks: ProcInvoiceGenerationTask[]): PlatformMyJobRow[] {
  return tasks.map((task) => {
    const po = (task.purchase_order_number || "").trim();
    const grn = (task.grn_number || "").trim();
    // Prefer PO in the list title/reference — GRNs are secondary detail.
    const title = po
      ? `Invoice generation · ${po}`
      : task.title || task.task_code;
    return {
      id: `proc-inv-${task.id}`,
      title,
      reference: [po, grn].filter(Boolean).join(" · ") || task.task_code,
      detail:
        [task.vendor_name, task.items_summary].filter(Boolean).join(" · ") ||
        "Invoice generation",
      status: task.status,
      href: "/procurement/my-jobs",
      openMode: "invoice_generation_dialog" as const,
      invoiceTaskId: task.id,
      orderId: task.order_header_id,
      receiptBatchId: task.receipt_batch_id,
      showPoDownload: true,
      actionKind: "proc_invoice" as const,
      approveLabel: "Generate invoice",
    };
  });
}

function finalizeApprovalRows(
  rows: ScmFinalizeApproval[],
  caps: { is_module_admin: boolean; steps: string[] },
): PlatformMyJobRow[] {
  const steps = new Set(caps.steps || []);
  const isAdmin = Boolean(caps.is_module_admin);
  return rows
    .filter((row) => {
      if ((row.status || "").toLowerCase() !== "pending") return false;
      if (isAdmin) return true;
      const stage = row.scm_approval_stage || "accept_po";
      const stepKey = stage === "management" ? "management_po" : "accept_po";
      return steps.has(stepKey);
    })
    .map((row) => {
      const stage = row.scm_approval_stage || "accept_po";
      const isManagement = stage === "management";
      const stageLabel =
        row.stage_label ||
        (isManagement ? "Management PO approval" : "Accept PO");
      const poLabel =
        row.company_po_number || row.document_number || row.order_id;
      return {
        id: `proc-po-${row.order_id}-${stage}`,
        title: stageLabel,
        reference: poLabel,
        detail:
          [row.customer_name, row.vendor_name, row.requested_by_name]
            .filter(Boolean)
            .join(" · ") || "PO approval",
        status: row.status,
        href: `/procurement/orders/${row.order_id}`,
        orderId: row.order_id,
        showPoDownload: true,
        actionKind: isManagement
          ? ("proc_issue_po" as const)
          : ("proc_accept_po" as const),
        approveLabel: isManagement ? "Issue PO" : "Accept PO",
      };
    });
}

function holdApprovalRows(
  rows: ScmHoldApproval[],
  steps: Set<string>,
): PlatformMyJobRow[] {
  if (!steps.has("hold_decision")) return [];
  return rows
    .filter((row) => (row.status || "").toLowerCase() === "pending")
    .map((row) => ({
      id: `proc-hold-${row.ovf_id}`,
      title: "Hold approve / reject",
      reference: row.ovf_no,
      detail:
        [row.customer_name, row.requested_by_name, row.remark].filter(Boolean).join(" · ") ||
        "OVF hold request",
      status: row.status,
      href: `/procurement/scm/ovf/${row.ovf_id}`,
      ovfId: row.ovf_id,
      actionKind: "proc_hold" as const,
      approveLabel: "Approve hold",
    }));
}

function freightApprovalRows(
  rows: ScmChargeApproval[],
  steps: Set<string>,
): PlatformMyJobRow[] {
  if (!steps.has("freight_finance")) return [];
  return rows
    .filter((row) => (row.status || "").toLowerCase() === "pending")
    .map((row) => ({
      id: `proc-freight-${row.ovf_id}`,
      title: "Freight & finance",
      reference: row.ovf_no,
      detail:
        [
          row.customer_name,
          `Freight ₹${Number(row.freight) || 0}`,
          `Finance ${Number(row.finance_cost_pct) || 0}%`,
        ]
          .filter(Boolean)
          .join(" · ") || "Freight and finance request",
      status: row.status,
      href: `/procurement/scm/ovf/${row.ovf_id}`,
      ovfId: row.ovf_id,
      actionKind: "proc_freight" as const,
      approveLabel: "Approve charges",
    }));
}

async function procurementRows(): Promise<PlatformMyJobRow[]> {
  const [invoiceTasks, finalizeRows, holdRows, chargeRows, caps] = await Promise.all([
    listMyInvoiceGenerationTasks("pending").catch(() => [] as ProcInvoiceGenerationTask[]),
    listScmFinalizeApprovals().catch(() => [] as ScmFinalizeApproval[]),
    listScmHoldApprovals().catch(() => [] as ScmHoldApproval[]),
    listScmChargeApprovals().catch(() => [] as ScmChargeApproval[]),
    getProcApprovalCapabilities().catch(() => ({
      is_module_admin: false,
      steps: [] as string[],
      can_decide_approvals: false,
    })),
  ]);
  const steps = new Set(caps.steps || []);
  return [
    ...finalizeApprovalRows(finalizeRows, caps),
    ...holdApprovalRows(holdRows, steps),
    ...freightApprovalRows(chargeRows, steps),
    ...invoiceGenerationRows(invoiceTasks),
  ];
}

function shouldLoadModule(
  moduleKey: string,
  moduleKeys: string[],
  adminModuleKeys: string[],
  isErpAdmin: boolean,
): boolean {
  if (isErpAdmin) return true;
  if (adminModuleKeys.includes(moduleKey)) return true;
  return moduleKeys.includes(moduleKey);
}

/**
 * Load pending jobs for each module the user can access.
 * Only modules that return at least one job (or an error) are included.
 */
export async function loadPlatformMyJobs(input: {
  moduleKeys: string[];
  adminModuleKeys: string[];
  isErpAdmin: boolean;
}): Promise<PlatformMyJobModuleSection[]> {
  const sections: PlatformMyJobModuleSection[] = [];

  const loaders: Array<{
    key: (typeof MODULE_ORDER)[number];
    run: () => Promise<PlatformMyJobRow[]>;
  }> = [
      {
        key: "crm",
        run: async () =>
          crmRows(await listMyJobs({ mine: true, status: "pending" })),
      },
      {
        key: "projects",
        run: async () => projectRows(await listProjectMyJobs()),
      },
      {
        key: "hr",
        run: async () => {
          const items = await loadHrEssInbox({ includeCompoff: true });
          return items
            .filter((item) => item.pending)
            .map((item) => ({
              id: `hr-${item.id}`,
              title: item.title,
              reference: item.document_number || item.category,
              detail: [item.employee_name, item.detail].filter(Boolean).join(" · "),
              status: item.status,
              href: inboxItemHref(item),
            }));
        },
      },
      {
        key: "procurement",
        run: async () => procurementRows(),
      },
    ];

  await Promise.all(
    loaders.map(async ({ key, run }) => {
      if (
        !shouldLoadModule(
          key,
          input.moduleKeys,
          input.adminModuleKeys,
          input.isErpAdmin,
        )
      ) {
        return;
      }
      const meta = MODULE_META[key];
      try {
        const jobs = await run();
        if (jobs.length === 0) return;
        sections.push({
          moduleKey: key,
          moduleTitle: meta.title,
          moduleHref: meta.href,
          jobs,
        });
      } catch (err) {
        // No module access / missing permission — omit silently.
        if (err instanceof ApiClientError && (err.status === 401 || err.status === 403)) {
          return;
        }
        const message =
          err instanceof Error && err.message.trim()
            ? err.message
            : "Could not load jobs for this module";
        sections.push({
          moduleKey: key,
          moduleTitle: meta.title,
          moduleHref: meta.href,
          jobs: [],
          error: message,
        });
      }
    }),
  );

  const order = new Map(MODULE_ORDER.map((k, i) => [k, i]));
  sections.sort(
    (a, b) => (order.get(a.moduleKey as (typeof MODULE_ORDER)[number]) ?? 99) -
      (order.get(b.moduleKey as (typeof MODULE_ORDER)[number]) ?? 99),
  );
  return sections;
}

export function totalPlatformMyJobCount(
  sections: PlatformMyJobModuleSection[],
): number {
  return sections.reduce((sum, s) => sum + s.jobs.length, 0);
}
