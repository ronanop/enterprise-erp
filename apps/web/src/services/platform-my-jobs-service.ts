/** Cross-module My Jobs aggregation for the platform Overview page. */

import { ApiClientError } from "@/services/api-client";
import { inboxItemHref, loadHrEssInbox } from "@/services/hr-ess-inbox-service";
import {
  listProjectMyJobs,
  type ProjectMyJob,
} from "@/services/projects-portal-service";
import {
  listMyJobs,
  myJobEntityHref,
  type ApprovalTask,
} from "@/services/sales-crm-service";

export type PlatformMyJobRow = {
  id: string;
  title: string;
  reference: string;
  detail: string;
  status: string;
  href: string;
};

export type PlatformMyJobModuleSection = {
  moduleKey: string;
  moduleTitle: string;
  moduleHref: string;
  jobs: PlatformMyJobRow[];
  error?: string;
};

const MODULE_ORDER = ["crm", "projects", "hr"] as const;

const MODULE_META: Record<
  (typeof MODULE_ORDER)[number],
  { title: string; href: string }
> = {
  crm: { title: "CRM", href: "/crm/my-jobs" },
  projects: { title: "Projects", href: "/projects/my-jobs" },
  hr: { title: "HR", href: "/hr/ess-inbox" },
};

function crmRows(tasks: ApprovalTask[]): PlatformMyJobRow[] {
  return tasks.map((task) => ({
    id: `crm-${task.id}`,
    title: task.title || task.task_code,
    reference: task.task_code,
    detail: [task.entity_type, task.team_role].filter(Boolean).join(" · ") || "Approval",
    status: task.status,
    href: (() => {
      const base = myJobEntityHref(task.entity_type, task.entity_id);
      if (base === "/crm/my-jobs") return base;
      const sep = base.includes("?") ? "&" : "?";
      return `${base}${sep}from=my-jobs`;
    })(),
  }));
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
